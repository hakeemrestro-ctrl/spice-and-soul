import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
const m=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),adapter:vi.fn(),verify:vi.fn(),authorize:vi.fn(),audit:vi.fn(),device:vi.fn(),create:vi.fn()}));
vi.mock('../../lib/supabase/admin',()=>({createAdminClient:()=>({rpc:m.rpc,from:m.from})}));
vi.mock('../../lib/billdesk-uat-auth',()=>({authorizeBilldeskCheckout:m.authorize,billdeskAppOrigin:()=> 'https://uat.example.invalid'}));
vi.mock('../../lib/billdesk-device',()=>({billdeskDevice:m.device}));
vi.mock('../../lib/billdesk-adapter-client',()=>({upstreamEnabled:()=>true,adapterRequest:m.adapter}));
vi.mock('../../lib/billdesk',()=>({BILLDESK_MERCID:'fixture',auditBilldeskConfig:m.audit,generateOrderId:()=> 'BD_fixture',generateTraceId:()=> 'TRACE',
 createJwsToken:m.create,billdeskTimestamp:()=> '20261008123000',verifyJwsToken:m.verify}));
import { POST } from '../../app/api/billdesk/initiate/route';
type StoredAttempt = { fingerprint: string; orderId: string; state: string; response?: unknown };
type CourseQuery = { select: () => CourseQuery; eq: () => CourseQuery; single: () => Promise<{ data: { id: string; title: string; price_cents: number }; error: null }> };
let stored:StoredAttempt|null=null;
beforeEach(()=>{
  stored=null;m.authorize.mockResolvedValue('a'.repeat(64));m.device.mockReturnValue({ip:'8.8.8.8'});m.adapter.mockResolvedValue('synthetic-response');
  m.create.mockImplementation(async payload=>{expect(payload.order_date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/);return 'synthetic';});
  vi.stubEnv('BILLDESK_ENV','UAT');
  vi.stubEnv('BILLDESK_UAT_APP_ORIGIN','https://uat.example.invalid');vi.stubEnv('BILLDESK_UAT_HOSTED_URL','https://uat1.billdesk.com/fixture-hosted');vi.stubEnv('BILLDESK_UAT_HOSTED_FIELDS','token');
  m.verify.mockResolvedValue({payload:{status:'ACTIVE',orderid:'BD_fixture',mercid:'fixture',currency:'356',amount:'100.00',bdorderid:'fixture',links:[{rel:'redirect',method:'POST',href:'https://uat1.billdesk.com/fixture-hosted',parameters:{token:'synthetic'}}]}});
  m.from.mockImplementation(()=>{const chain:CourseQuery={select:()=>chain,eq:()=>chain,single:async()=>({data:{id:'course',title:'Fixture',price_cents:10000},error:null})};return chain;});
  m.rpc.mockImplementation(async(name,args)=>{
    if(name==='billdesk_reserve_checkout'){
      if(stored){if(stored.fingerprint!==args.p_fingerprint)return {error:{message:'mismatch'},data:null};return {data:{...stored,dispatch:false},error:null};}
      stored={fingerprint:args.p_fingerprint,orderId:args.p_order_id,state:'started'};return {data:{...stored,dispatch:true},error:null};
    }
    if(name==='billdesk_finish_checkout'){if(!stored)throw new Error('Missing fixture reservation');stored.state=args.p_state;stored.response=args.p_response;return {error:null};}
    throw new Error('Unexpected RPC');
  });
  vi.spyOn(console,'info').mockImplementation(()=>{});vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Network forbidden');}));
});
afterEach(()=>{vi.restoreAllMocks();vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
function request(body=JSON.stringify({courseId:'123e4567-e89b-12d3-a456-426614174000',email:'fixture@example.invalid',name:'Fixture'})){
  return new NextRequest('https://uat.example.invalid/api/billdesk/initiate',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},body});
}
it('route reserves before adapter dispatch and returns the same cached hosted form on retry',async()=>{
  m.adapter.mockImplementation(async()=>{expect(stored?.state).toBe('started');return 'synthetic-response';});
  const first=await POST(request()), second=await POST(request());expect(first.status).toBe(200);expect(await second.json()).toEqual(await first.json());expect(m.adapter).toHaveBeenCalledTimes(1);expect(first.headers.get('cache-control')).toBe('no-store');expect(fetch).not.toHaveBeenCalled();
});
it('uses the fixed production adapter operation only with the production hosted profile',async()=>{
  vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_HOSTED_URL','https://api.billdesk.com/fixture-hosted');vi.stubEnv('BILLDESK_HOSTED_FIELDS','token');
  m.verify.mockResolvedValue({payload:{status:'ACTIVE',orderid:'BD_fixture',mercid:'fixture',currency:'356',amount:'100.00',bdorderid:'fixture',links:[{rel:'redirect',method:'POST',href:'https://api.billdesk.com/fixture-hosted',parameters:{token:'synthetic'}}]}});
  expect((await POST(request())).status).toBe(200);expect(m.adapter).toHaveBeenCalledWith('/prod/orders/create',expect.any(Object));
});
it('route timeout leaves unknown and no second upstream operation',async()=>{
  m.adapter.mockRejectedValue(new Error('timeout private data'));expect((await POST(request())).status).toBe(409);expect(stored?.state).toBe('unknown');expect((await POST(request())).status).toBe(409);expect(m.adapter).toHaveBeenCalledTimes(1);
});
it('route rejects malformed authenticated response without returning hosted data',async()=>{
  m.verify.mockResolvedValue({payload:{status:'ACTIVE',links:{}}});const r=await POST(request());expect(r.status).toBe(409);expect(await r.json()).not.toHaveProperty('hostedUrl');expect(stored?.state).toBe('unknown');
});
for(const body of ['{','x'.repeat(16385)])it(`route rejects invalid or oversized body (${body.length} bytes) before business DB`,async()=>{
  expect((await POST(request(body))).status).toBe(400);expect(m.from).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();expect(m.adapter).not.toHaveBeenCalled();
});
it('missing hosted profile prevents reservation and adapter dispatch',async()=>{
  vi.stubEnv('BILLDESK_UAT_HOSTED_FIELDS','');expect((await POST(request())).status).toBe(500);expect(m.from).not.toHaveBeenCalled();expect(m.adapter).not.toHaveBeenCalled();
});
it('concurrent route retries share one operation in mocked reservation model',async()=>{
  const results=await Promise.all(Array.from({length:10},()=>POST(request())));expect(results.filter(r=>r.status===200).length).toBeGreaterThanOrEqual(1);expect(m.adapter).toHaveBeenCalledTimes(1);
});
it('unexpected business DB exception never exposes raw customer data',async()=>{
  m.from.mockImplementation(()=>{throw new Error('private@example.invalid raw-token');});const r=await POST(request());expect(r.status).toBe(503);
  const logged=JSON.stringify(vi.mocked(console.info).mock.calls)+JSON.stringify(await r.json());expect(logged).not.toMatch(/private@|raw-token/);expect(m.adapter).not.toHaveBeenCalled();
});
