import 'server-only';

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown, max: number): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value); }
function configuredHostedProfile() {
  if (process.env.BILLDESK_ENV === 'UAT') return { url: process.env.BILLDESK_UAT_HOSTED_URL || '', fields: process.env.BILLDESK_UAT_HOSTED_FIELDS || '' };
  if (process.env.BILLDESK_ENV === 'PROD') return { url: process.env.BILLDESK_HOSTED_URL || '', fields: process.env.BILLDESK_HOSTED_FIELDS || '' };
  return { url: '', fields: '' };
}
// Host, path and form-field profile are deliberately unset until BillDesk confirms
// the hosted-page contract. Do not infer it from an arbitrary signed response.
export function hostedProfile(profile = configuredHostedProfile()) {
  const fail = () => { throw new Error('Invalid BillDesk hosted response'); };
  let allowed: URL;
  try { allowed = new URL(profile.url); } catch { return fail(); }
  if (allowed.protocol !== 'https:' || allowed.port || allowed.username || allowed.password || allowed.search || allowed.hash ||
    !allowed.hostname.endsWith('.billdesk.com')) return fail();
  const fields = profile.fields.split(',').map(f => f.trim()).filter(Boolean);
  if (!fields.length || fields.some(f => !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(f)) || new Set(fields).size !== fields.length) return fail();
  return { allowed, fields };
}
export function validateCreateResponse(value: unknown, expected: { orderId: string; merchantId: string; amount: string },
  profile = configuredHostedProfile()) {
  const fail = () => { throw new Error('Invalid BillDesk hosted response'); };
  const { allowed, fields } = hostedProfile(profile);
  if (!record(value) || value.status !== 'ACTIVE' || value.orderid !== expected.orderId || value.mercid !== expected.merchantId ||
    value.amount !== expected.amount || value.currency !== '356' || !text(value.bdorderid, 64) ||
    !Array.isArray(value.links) || value.links.length < 1 || value.links.length > 10) return fail();
  // Validate every link structurally; only one explicitly hosted POST is consumed.
  for (const link of value.links) {
    if (!record(link) || !text(link.rel, 64) || !text(link.href, 2048) || !text(link.method, 16)) return fail();
    let url: URL; try { url = new URL(link.href); } catch { return fail(); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      !url.hostname.endsWith('.billdesk.com') || !['GET', 'POST'].includes(link.method)) return fail();
  }
  const hosted = value.links.filter(l => l.rel === 'redirect');
  if (hosted.length !== 1) return fail();
  const link = hosted[0];
  if (link.method !== 'POST' || link.href !== allowed.href || !record(link.parameters) ||
    Object.keys(link.parameters).sort().join(',') !== [...fields].sort().join(',') ||
    !Object.values(link.parameters).every(v => text(v, 16384))) return fail();
  return { bdOrderId: value.bdorderid, hostedUrl: link.href as string, hostedParameters: link.parameters as Record<string, string> };
}
