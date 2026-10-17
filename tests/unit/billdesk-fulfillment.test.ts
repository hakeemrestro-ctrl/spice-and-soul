import { afterEach,beforeEach,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({send:vi.fn(),pdf:vi.fn()}));
vi.mock('../../lib/resend',()=>({resend:{emails:{send:mocks.send}}}));
vi.mock('../../lib/generate-recipe-pdf',()=>({generateRecipePdf:mocks.pdf}));
vi.mock('../../lib/generate-certificate-pdf',()=>({generateCertificatePdf:mocks.pdf}));
vi.mock('../../lib/invoice',()=>({generateInvoicePdf:mocks.pdf}));
import { fulfillBilldeskOrder } from '../../lib/billdesk-fulfillment';
import { BILLDESK_STEPS } from '../../lib/billdesk-steps';
import { mkdir, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
beforeEach(()=>{vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_APP_ORIGIN','https://fixture.example.invalid');mocks.send.mockResolvedValue({data:{id:'message-fixture'},error:null});mocks.pdf.mockResolvedValue(Buffer.from('fixture-pdf'));vi.spyOn(console,'info').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden');}));});
afterEach(()=>{vi.restoreAllMocks();vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
const pending={order_id:'BD_fixture',course_id:'course',amount_cents:10000,customer_email:'private@example.invalid',customer_name:'Private Name',metadata:{paymentGateway:'billdesk'}};
it('UAT blocked mail fails before fulfillment database effects', async () => {
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('BILLDESK_EMAIL_CAPTURE', '');
  const { db, p, effects } = database();
  await expect(fulfillBilldeskOrder(p, 'TRANSACTIONFIXTURE', db)).rejects.toThrow('disabled');
  expect(db.rpc).not.toHaveBeenCalled(); expect(db.from).not.toHaveBeenCalled();
  expect(effects).toEqual([]); expect(mocks.send).not.toHaveBeenCalled();
});
it('UAT fulfillment records capture evidence, never provider acceptance or delivery', async () => {
  const base = join(tmpdir(), 'billdesk-uat-capture');
  await mkdir(base, { recursive: true, mode: 0o700 });
  const dir = await mkdtemp(join(base, 'fulfillment-'));
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('BILLDESK_UAT_APP_ORIGIN', 'https://uat.example.invalid');
  vi.stubEnv('VERCEL', ''); vi.stubEnv('BILLDESK_EMAIL_CAPTURE', 'local');
  vi.stubEnv('BILLDESK_EMAIL_CAPTURE_DIR', dir); vi.stubEnv('BILLDESK_EMAIL_CAPTURE_RECIPIENTS', pending.customer_email);
  const { db, p, rows } = database();
  await fulfillBilldeskOrder(p, 'TRANSACTIONFIXTURE', db);
  for (const step of ['welcome_email', 'invoice_email', 'certificate_email']) expect(rows.get(step)?.result).toMatchObject({ status: 'captured', delivered: false });
  expect(await readdir(dir)).toHaveLength(3); expect(mocks.send).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
function database(bundle=false,gift=false){
  const rows=new Map<string,{state:string;result:unknown;owner?:string}>();
  const effects:string[]=[];
  type StepArgs = { p_action: string; p_step: string; p_owner: string; p_state: string; p_result: unknown };
  type Result = { data: unknown; error: null };
  type Chain = { select: () => Chain; eq: (key: string, value: string) => Chain; order: () => Promise<Result>; maybeSingle: () => Promise<Result>; single: () => Promise<Result>; insert: (value: unknown) => Chain | { select: () => Promise<Result> } };
  const rpc=vi.fn(async(_name:string,args:StepArgs)=>{
    if(_name==='increment_coupon_use'){effects.push('coupon');return {data:null,error:null};}
    if(args.p_action==='prepare'){for(const s of BILLDESK_STEPS)if(!rows.has(s))rows.set(s,{state:'pending',result:null});return {data:{},error:null};}
    const row=rows.get(args.p_step)!;
    if(args.p_action==='claim'){
      if(row.state==='completed')return {data:row,error:null};if(['running','unknown'].includes(row.state))return {data:{state:'review'},error:null};
      rows.set(args.p_step,{state:'running',result:null,owner:args.p_owner});return {data:{state:'claimed'},error:null};
    }
    if(args.p_action==='finish'){expect(row.owner).toBe(args.p_owner);rows.set(args.p_step,{state:args.p_state,result:args.p_result});return {data:{},error:null};}
    throw new Error('Unexpected RPC');
  });
  const from=vi.fn((table:string)=>{
    let insert=false,id='course';
    const result=()=>{
      if(insert)effects.push(table);
      let data:unknown={id:table+'-id'};
      if(table==='courses')data={id,title:'Fixture Course',recipe_count:1,is_bundle:bundle&&id==='course',bundle_course_ids:bundle?['child1','child2']:null};
      if(table==='recipes')data=[{id:'recipe',title:'Fixture Recipe'}];
      if(table==='orders'&&insert&&bundle&&id==='course')data={id:'parent-id'};
      return {data,error:null};
    };
    const chain:Chain={select:()=>chain,eq:(_key:string,v:string)=>{id=v;return chain;},order:async()=>result(),maybeSingle:async()=>result(),single:async()=>result(),
      insert:(value:unknown)=>{insert=true;if(Array.isArray(value))return {select:async()=>{effects.push('children');return {data:value.map((_,i)=>({id:i})),error:null};}};return chain;}};
    return chain;
  });
  const p=gift?{...pending,metadata:{...pending.metadata,isGift:'true',giftRecipientEmail:'gift@example.invalid',giftRecipientName:'Gift Name'}}:pending;
  // The fixture implements only the SDK surface exercised by this executor.
  return {db:{rpc,from,auth:{admin:{createUser:vi.fn()}}} as unknown as Parameters<typeof fulfillBilldeskOrder>[2],rows,effects,p};
}
it('records all single-course steps and all three email acceptance IDs',async()=>{
  const {db,rows,p}=database();await fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db);
  expect(rows.size).toBe(15);expect([...rows.values()].every(r=>r.state==='completed')).toBe(true);expect(mocks.send).toHaveBeenCalledTimes(3);
  for(const s of ['welcome_email','invoice_email','certificate_email'])expect(rows.get(s)?.result).toEqual({messageId:'message-fixture',status:'accepted'});
  expect(fetch).not.toHaveBeenCalled();
});
it('SDK email error leaves unknown and cannot replay completed welcome or order effects',async()=>{
  const {db,rows,effects,p}=database();mocks.send.mockResolvedValueOnce({data:{id:'welcome-fixture'},error:null}).mockResolvedValueOnce({data:null,error:{message:'private@example.invalid secret-token'}});
  await expect(fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db)).rejects.toThrow('reconciliation');
  expect(rows.get('welcome_email')?.state).toBe('completed');expect(rows.get('invoice_email')?.state).toBe('unknown');expect(rows.get('certificate_email')?.state).toBe('pending');
  const count=effects.length;await expect(fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db)).rejects.toThrow('reconciliation');expect(mocks.send).toHaveBeenCalledTimes(2);expect(effects.length).toBe(count);
  const logged=JSON.stringify(vi.mocked(console.info).mock.calls);expect(logged).not.toMatch(/private@|secret-token|Private Name|INV-/);
});
it('operator-reconciled not-applied step resumes individually without resending welcome',async()=>{
  const {db,rows,p}=database();mocks.send.mockResolvedValueOnce({data:{id:'welcome-fixture'},error:null}).mockRejectedValueOnce(new Error('timeout'));
  await expect(fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db)).rejects.toThrow();
  // Model an independently evidenced operator resolution, NOT automatic reset.
  rows.set('invoice_email',{state:'pending',result:null});await fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db);
  expect(mocks.send).toHaveBeenCalledTimes(4);expect(rows.get('welcome_email')?.result).toEqual({messageId:'welcome-fixture',status:'accepted'});expect([...rows.values()].every(r=>r.state==='completed')).toBe(true);
});
it('bundle explicitly tracks child orders and skips certificate effects',async()=>{
  const {db,rows,effects,p}=database(true);await fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db);expect(effects).toContain('children');expect(mocks.send).toHaveBeenCalledTimes(2);expect(rows.get('certificate_record')?.result).toEqual({skipped:true});
});
it('gift tracks distinct recipient documents and gift delivery acceptance',async()=>{
  const {db,rows,p}=database(false,true);await fulfillBilldeskOrder(p,'TRANSACTIONFIXTURE',db);expect(mocks.send).toHaveBeenCalledTimes(4);expect(mocks.pdf.mock.calls.some(([input])=>input.customerName==='Gift Name')).toBe(true);expect(rows.get('gift_email')?.state).toBe('completed');
});
it('blocked coupon increment cannot be marked complete or proceed to email',async()=>{
  const {db,rows,p}=database();await expect(fulfillBilldeskOrder({...p,metadata:{...p.metadata,couponCode:'FIXTURE'}},'TRANSACTIONFIXTURE',db)).rejects.toThrow();
  expect(rows.get('coupon')?.state).toBe('unknown');expect(mocks.send).not.toHaveBeenCalled();
});
