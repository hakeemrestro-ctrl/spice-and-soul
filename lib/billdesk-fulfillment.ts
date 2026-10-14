import 'server-only';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingOrderRow } from './fulfill-order';
import type { Course, Recipe } from '@/types';
import { stepRunner, type StepStore } from './billdesk-steps';
import { billdeskLog } from './billdesk-log';
import { generateRecipePdf } from './generate-recipe-pdf';
import { generateInvoicePdf } from './invoice';
import { generateCertificatePdf } from './generate-certificate-pdf';
import { PurchaseConfirmationEmail } from '@/components/email-templates/purchase-confirmation';
import { InvoiceEmail } from '@/components/email-templates/invoice-email';
import { resend } from './resend';
import { billdeskAppOrigin } from './billdesk-uat-auth';

const filename = (s: string) => s.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
const sender = { from: 'Spice & Soul Academy <hello@hakeemrestro.shop>', replyTo: 'hakeemrestro@gmail.com' };

// This path intentionally does not call the shared best-effort fulfillment/email
// functions. Their Paytm/PayGlocal behavior and logging remain unchanged.
export async function fulfillBilldeskOrder(pending: PendingOrderRow, txnId: string, db: SupabaseClient) {
  const correlation = randomUUID(), started = Date.now();
  const rpc = async (args: Record<string, unknown>) => {
    const { data, error } = await db.rpc('billdesk_step', { p_order_id: pending.order_id, p_txn_id: txnId, ...args });
    if (error || !data) throw new Error('Fulfillment state unavailable');
    return data;
  };
  const store: StepStore = {
    prepare: async () => { await rpc({ p_action: 'prepare' }); },
    claim: (step, owner) => rpc({ p_action: 'claim', p_step: step, p_owner: owner }),
    finish: async (step, owner, state, result) => { await rpc({ p_action: 'finish', p_step: step, p_owner: owner, p_state: state, p_result: result }); },
  };
  await store.prepare();
  const run = stepRunner(store);
  try {
    const snapshot = await run('snapshot', false, async () => {
      const { data: course, error } = await db.from('courses').select('*').eq('id', pending.course_id).single();
      if (error || !course) throw new Error('Course unavailable');
      const children: { course: Course; recipes: Recipe[] }[] = [];
      const ids = course.is_bundle ? course.bundle_course_ids : [course.id];
      if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error('Course contents unavailable');
      for (const id of ids) {
        const c = id === course.id ? { data: course, error: null } : await db.from('courses').select('*').eq('id', id).single();
        const r = await db.from('recipes').select('*').eq('course_id', id).order('sort_order', { ascending: true });
        if (c.error || !c.data || r.error || !r.data) throw new Error('Course contents unavailable');
        children.push({ course: c.data as Course, recipes: r.data as Recipe[] });
      }
      const origin = new URL(billdeskAppOrigin());
      const now = new Date();
      return { pending, course: course as Course, children, date: now.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
        invoice: `INV-${now.getFullYear()}-${txnId.slice(0,12).toUpperCase()}`, resendUrl: `${origin.origin}/resend` };
    });
    const { course, children, invoice, date, resendUrl } = snapshot;
    // Immutable snapshot, including recipient and metadata, is reused on recovery.
    const p = snapshot.pending, meta = p.metadata ?? {}, email = p.customer_email, name = p.customer_name;
    const userId = await run('user', true, async () => {
      const existing = await db.from('users').select('id').eq('email', email).maybeSingle();
      if (existing.error) throw new Error('User lookup unavailable');
      if (existing.data) return existing.data.id as string;
      const result = await db.auth.admin.createUser({ email, password: randomUUID(), user_metadata: { full_name: name }, email_confirm: true });
      if (result.error || !result.data.user) throw new Error('User creation unavailable');
      return result.data.user.id;
    });
    const row = { user_id: userId, course_id: p.course_id, stripe_payment_intent_id: txnId, amount_cents: p.amount_cents,
      currency:'inr', status:'paid', invoice_number:invoice, customer_email:email, customer_name:name, stripe_last4:'billdesk',
      coupon_code:meta.couponCode ?? null, acquisition_source:meta.acquisitionSource ?? null,
      utm_source:meta.utmSource ?? null, utm_medium:meta.utmMedium ?? null, utm_campaign:meta.utmCampaign ?? null,
      utm_content:meta.utmContent ?? null, utm_term:meta.utmTerm ?? null };
    const parentId = await run('parent_order', true, async () => {
      const { data, error } = await db.from('orders').insert(row).select('id').single();
      if (error || !data) throw new Error('Order creation unavailable');
      return data.id as string;
    });
    await run('child_orders', true, async () => {
      if (!course.is_bundle) return { skipped: true };
      const { data, error } = await db.from('orders').insert(children.map(c => ({ ...row, course_id:c.course.id, amount_cents:0, parent_order_id:parentId }))).select('id');
      if (error || data?.length !== children.length) throw new Error('Child orders incomplete');
      return { ids: data.map(v => v.id) };
    });
    await run('coupon', true, async () => {
      if (!meta.couponCode) return { skipped: true };
      const { data, error } = await db.rpc('increment_coupon_use', { p_code: meta.couponCode });
      if (error || !Number.isInteger(data) || data < 1) throw new Error('Coupon effect not confirmed');
      return { applied: true, usesCount: data };
    });
    const recipes = await run('recipe_documents', false, async () => Promise.all(children.map(async c => ({
      filename: `${filename(c.course.title)}-recipes.pdf`,
      content: (await generateRecipePdf({ course:c.course, recipes:c.recipes, customerName:name })).toString('base64'),
    }))));
    const invoicePdf = await run('invoice_document', false, async () => (await generateInvoicePdf({ invoiceNumber:invoice,date,
      customerName:name,customerEmail:email,courseTitle:course.title,priceCents:p.amount_cents,last4:'billdesk',accessUrl:resendUrl })).toString('base64'));
    // SDK error results are failures too, not just thrown exceptions. Persist
    // provider IDs as acceptance evidence; this never asserts actual delivery.
    const send = async (data: Parameters<typeof resend.emails.send>[0], step: string) => {
      const result = await resend.emails.send({ ...sender, ...data }, { idempotencyKey: `billdesk/${p.order_id}/${step}` });
      if (result.error || !result.data?.id) throw new Error('Email acceptance unknown');
      return { messageId: result.data.id, status: 'accepted' };
    };
    const welcome = (recipientName: string, gift?: { senderName: string; message: string | null }) => createElement(PurchaseConfirmationEmail, {
      customerName:recipientName,courseTitle:course.title,recipeCount:children.reduce((n,c) => n+(c.recipes.length || c.course.recipe_count),0),resendUrl,
      childCourseTitles:course.is_bundle ? children.map(c => c.course.title) : undefined,giftFromName:gift?.senderName,giftMessage:gift?.message,
    });
    await run('welcome_email', true, () => send({ ...sender,to:email,subject:`Your ${course.title} recipe book is here`,react:welcome(name),attachments:recipes }, 'welcome'));
    await run('invoice_email', true, () => send({ ...sender,to:email,subject:`Invoice ${invoice} — ${course.title}`,
      react:createElement(InvoiceEmail,{ customerName:name,customerEmail:email,invoiceNumber:invoice,date,courseTitle:course.title,
        priceCents:p.amount_cents,last4:'billdesk',resendUrl }),attachments:[{ filename:`invoice-${invoice}.pdf`,content:invoicePdf }] }, 'invoice'));
    const gift = meta.isGift === 'true' && !!meta.giftRecipientEmail;
    await run('gift_order', true, async () => {
      if (!gift) return { skipped:true };
      const { data,error } = await db.from('gift_orders').insert({ sender_order_id:parentId,sender_email:email,sender_name:name,
        recipient_email:meta.giftRecipientEmail,recipient_name:meta.giftRecipientName ?? null,course_id:p.course_id,message:meta.giftMessage ?? null }).select('id').single();
      if (error || !data) throw new Error('Gift creation unavailable');
      return { id:data.id };
    });
    const giftDocuments = await run('gift_documents', false, async () => !gift ? [] : Promise.all(children.map(async c => ({
      filename: `${filename(c.course.title)}-recipes.pdf`,
      content: (await generateRecipePdf({ course:c.course, recipes:c.recipes, customerName:meta.giftRecipientName ?? meta.giftRecipientEmail!.split('@')[0] })).toString('base64'),
    }))));
    await run('gift_email', true, async () => {
      if (!gift) return { skipped:true };
      return send({ ...sender,to:meta.giftRecipientEmail!,subject:`${name} sent you a gift — ${course.title}`,
        react:welcome(meta.giftRecipientName ?? meta.giftRecipientEmail!.split('@')[0], { senderName:name,message:meta.giftMessage ?? null }),
        attachments:giftDocuments }, 'gift');
    });
    const certificate = await run('certificate_document', false, async () => course.is_bundle ? null :
      (await generateCertificatePdf({ customerName:name || email.split('@')[0],courseTitle:course.title,certificateId:parentId })).toString('base64'));
    await run('certificate_record', true, async () => {
      if (course.is_bundle) return { skipped:true };
      const { data,error } = await db.from('certificates').insert({ order_id:parentId,course_id:p.course_id,customer_name:name || email.split('@')[0],customer_email:email }).select('id').single();
      if (error || !data) throw new Error('Certificate persistence unavailable');
      return { id:data.id };
    });
    await run('certificate_email', true, async () => {
      if (!certificate) return { skipped:true };
      return send({ ...sender,to:email,subject:`Your Spice & Soul Certificate — ${course.title}`,
        html:`<p>Hi ${escapeHtml((name || email.split('@')[0]).split(' ')[0])},</p><p>Welcome to <strong>${escapeHtml(course.title)}</strong>! Your enrollment certificate is attached — a keepsake for your kitchen.</p><p>Happy cooking — Hakeem kitchen is always open.</p><p style="color:#9a7a5a;font-size:12px">Spice &amp; Soul Academy · by Hakeem, Bhopal</p>`,
        attachments:[{ filename:`spice-and-soul-certificate-${filename(course.title)}.pdf`,content:certificate }] }, 'certificate');
    });
    billdeskLog('fulfillment','completed',correlation,Date.now()-started);
  } catch {
    billdeskLog('fulfillment','review',correlation,Date.now()-started);
    throw new Error('BillDesk fulfillment requires reconciliation');
  }
}

// Deliberately no public recovery route. A service-role operator must reconcile
// ambiguous individual steps first, then invoke this with the persisted order.
export async function recoverBilldeskFulfillment(orderId: string, txnId: string, db: SupabaseClient) {
  const { data: pending, error: readError } = await db.from('pending_orders').select('*').eq('order_id',orderId).single();
  if (readError || !pending || pending.txn_id !== txnId || pending.status !== 'paid_unfulfilled' ||
    pending.metadata?.paymentGateway !== 'billdesk') throw new Error('BillDesk recovery binding unavailable');
  await fulfillBilldeskOrder(pending as PendingOrderRow, txnId, db);
  const { error } = await db.rpc('billdesk_finish_payment', { p_order_id:orderId,p_txn_id:txnId,p_complete:true });
  if (error) throw new Error('BillDesk fulfillment completion unavailable');
}
