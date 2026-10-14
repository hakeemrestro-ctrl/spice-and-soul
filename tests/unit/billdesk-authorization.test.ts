import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),create:vi.fn(),admin:vi.fn()}));
vi.mock('../../lib/supabase/server',()=>({createClient:mocks.create}));
vi.mock('../../lib/supabase/admin',()=>({createAdminClient:mocks.admin}));
import { authorizeBilldeskCheckout, authorizeBilldeskTester } from '../../lib/billdesk-uat-auth';
import { POST } from '../../app/api/billdesk/initiate/route';
beforeEach(()=>{
  vi.stubEnv('BILLDESK_ENV','UAT');vi.stubEnv('BILLDESK_UAT_APP_ORIGIN','https://uat.example.invalid');vi.stubEnv('BILLDESK_UAT_TESTER_IDS','allowed');
  mocks.create.mockResolvedValue({auth:{getUser:mocks.getUser}});mocks.getUser.mockResolvedValue({data:{user:{id:'allowed'}},error:null});
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('External network forbidden');}));
});
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
const request=()=>new NextRequest('https://uat.example.invalid/api/billdesk/initiate',{method:'POST',headers:{origin:'https://uat.example.invalid','content-type':'application/json','idempotency-key':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},body:JSON.stringify({courseId:'123e4567-e89b-12d3-a456-426614174000',email:'fixture@example.invalid',name:'Fixture'})});
it('accepts an allowlisted verified tester session',async()=>expect(await authorizeBilldeskTester(request())).toBe('allowed'));
it('binds an allowlisted UAT tester to a pseudonymous actor reference',async()=>{
  expect(await authorizeBilldeskCheckout(request(),'fixture@example.invalid')).toMatch(/^[a-f0-9]{64}$/);
});
it('allows public production checkout only with exact origin, explicit enablement and binding secret',async()=>{
  vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_APP_ORIGIN','https://www.example.invalid');
  vi.stubEnv('BILLDESK_CUSTOMER_CHECKOUT_ENABLED','true');vi.stubEnv('BILLDESK_CHECKOUT_BINDING_SECRET','s'.repeat(32));
  const req=new NextRequest('https://www.example.invalid/api/billdesk/initiate',{method:'POST',headers:{origin:'https://www.example.invalid'}});
  const first=await authorizeBilldeskCheckout(req,'Customer@Example.Invalid');
  expect(first).toMatch(/^[a-f0-9]{64}$/);expect(await authorizeBilldeskCheckout(req,'customer@example.invalid')).toBe(first);
  expect(mocks.create).not.toHaveBeenCalled();
});
for(const missing of ['flag','secret','origin','cross-site'])it(`fails closed for production customer checkout with ${missing}`,async()=>{
  vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_APP_ORIGIN','https://www.example.invalid');
  vi.stubEnv('BILLDESK_CUSTOMER_CHECKOUT_ENABLED','true');vi.stubEnv('BILLDESK_CHECKOUT_BINDING_SECRET','s'.repeat(32));
  const req=new NextRequest('https://www.example.invalid/api/billdesk/initiate',{method:'POST',headers:{origin:'https://www.example.invalid'}});
  if(missing==='flag')vi.stubEnv('BILLDESK_CUSTOMER_CHECKOUT_ENABLED','false');
  if(missing==='secret')vi.stubEnv('BILLDESK_CHECKOUT_BINDING_SECRET','short');
  if(missing==='origin')vi.stubEnv('BILLDESK_APP_ORIGIN','');
  if(missing==='cross-site')req.headers.set('origin','https://other.invalid');
  await expect(authorizeBilldeskCheckout(req,'customer@example.invalid')).rejects.toThrow();
});
for(const scenario of ['anonymous','not-allowlisted','auth-error','missing-config','cross-site','production','untrusted-http'])it(`rejects ${scenario} before business database or adapter access`,async()=>{
  vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');const req=request();
  if(scenario==='anonymous')mocks.getUser.mockResolvedValue({data:{user:null},error:null});
  if(scenario==='not-allowlisted')mocks.getUser.mockResolvedValue({data:{user:{id:'other'}},error:null});
  if(scenario==='auth-error')mocks.getUser.mockResolvedValue({data:{user:null},error:{message:'private'}});
  if(scenario==='missing-config')vi.stubEnv('BILLDESK_UAT_TESTER_IDS','');
  if(scenario==='cross-site')req.headers.set('origin','https://other.invalid');
  if(scenario==='production')vi.stubEnv('BILLDESK_ENV','PROD');
  if(scenario==='untrusted-http'){vi.stubEnv('BILLDESK_UAT_APP_ORIGIN','http://uat.example.invalid');req.headers.set('origin','http://uat.example.invalid');}
  const result=await POST(req);expect([403,503]).toContain(result.status);expect(mocks.admin).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
