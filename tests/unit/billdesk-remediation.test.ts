import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import ts from 'typescript';
import { authHeaders, authenticate, strictHeaders } from '../../adapter/billdesk/protocol';
import { adapterRequest } from '../../lib/billdesk-adapter-client';
import { publicCustomerIP } from '../../lib/billdesk-device';
import { readBilldeskBody } from '../../lib/billdesk-body';
import { runBilldeskCheckout, type CheckoutBinding, type CheckoutStore, type CheckoutReservation } from '../../lib/billdesk-checkout';
import { BILLDESK_STEPS, stepRunner, type StepStore } from '../../lib/billdesk-steps';
import { validateCreateResponse } from '../../lib/billdesk-create-response';
import { billdeskLog } from '../../lib/billdesk-log';

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); })); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const binding: CheckoutBinding = { actorRef:'a'.repeat(64),attemptId:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',courseId:'course',amount:10000,email:'fixture@example.invalid',name:'Fixture',coupon:'' };
// Durable-store contract model, NOT a PostgreSQL concurrency test.
function checkoutStore() {
  const db = new Map<string, CheckoutReservation & { fingerprint:string }>();
  const client = (): CheckoutStore => ({
    async reserve(b, fingerprint) {
      const old = db.get(b.attemptId);
      if (old) { if (old.fingerprint !== fingerprint) throw new Error('binding'); return { ...old,dispatch:false }; }
      const row = { dispatch:true,orderId:'BD_fixed',state:'started' as const,fingerprint }; db.set(b.attemptId,row); return row;
    },
    async finish(_id,state,response) { const row=db.get(binding.attemptId)!; db.set(binding.attemptId,{...row,state,response:response ?? undefined}); },
  });
  return { client, db };
}
it('checkout first attempt persists before dispatch and stores response', async () => {
  const {client,db}=checkoutStore(); const dispatch=vi.fn(async id => { expect(db.size).toBe(1); expect(id).toBe('BD_fixed'); return {hostedUrl:'fixture'}; });
  expect(await runBilldeskCheckout(binding,client(),dispatch)).toEqual({hostedUrl:'fixture'}); expect(dispatch).toHaveBeenCalledTimes(1);
});
for (const recovery of ['timeout','reconnect','process restart']) it(`checkout ${recovery} retains unknown operation`, async () => {
  const {client,db}=checkoutStore(); const dispatch=vi.fn(async()=>{throw new Error('timeout');});
  await expect(runBilldeskCheckout(binding,client(),dispatch)).rejects.toThrow('RECONCILIATION');
  await expect(runBilldeskCheckout(binding,client(),dispatch)).rejects.toThrow('RECONCILIATION');
  expect(db.get(binding.attemptId)?.state).toBe('unknown'); expect(dispatch).toHaveBeenCalledTimes(1);
});
it('started/crashed checkout never redispatches', async () => {
  const store=checkoutStore(); const dispatch=vi.fn();
  store.db.set(binding.attemptId,{dispatch:true,orderId:'BD_fixed',state:'started',fingerprint:(await import('../../lib/billdesk-checkout')).checkoutFingerprint(binding)});
  await expect(runBilldeskCheckout(binding,store.client(),dispatch)).rejects.toThrow();expect(dispatch).not.toHaveBeenCalled();
});
it('checkout reservation failure prevents dispatch entirely',async()=>{
  const store=checkoutStore().client();store.reserve=async()=>{throw new Error('DB unavailable');};const dispatch=vi.fn();
  await expect(runBilldeskCheckout(binding,store,dispatch)).rejects.toThrow();expect(dispatch).not.toHaveBeenCalled();
});
it('accepted response persistence failure cannot authorize another dispatch',async()=>{
  const {client,db}=checkoutStore(),store=client(),dispatch=vi.fn(async()=>({ok:true}));store.finish=async()=>{throw new Error('DB unavailable');};
  await expect(runBilldeskCheckout(binding,store,dispatch)).rejects.toThrow();expect(db.get(binding.attemptId)?.state).toBe('started');
  await expect(runBilldeskCheckout(binding,client(),dispatch)).rejects.toThrow();expect(dispatch).toHaveBeenCalledTimes(1);
});
for (const change of [{amount:9999},{courseId:'other'},{actorRef:'b'.repeat(64)},{email:'other@example.invalid'}]) it(`checkout rejects changed ${Object.keys(change)[0]}`, async()=>{
  const {client}=checkoutStore();const dispatch=vi.fn(async()=>({ok:true}));await runBilldeskCheckout(binding,client(),dispatch);
  await expect(runBilldeskCheckout({...binding,...change},client(),dispatch)).rejects.toThrow('binding');expect(dispatch).toHaveBeenCalledTimes(1);
});
it('concurrent checkout retries dispatch exactly once in the store contract model',async()=>{
  const {client}=checkoutStore(), dispatch=vi.fn(async()=>({ok:true}));
  await Promise.allSettled(Array.from({length:20},()=>runBilldeskCheckout(binding,client(),dispatch)));
  expect(dispatch).toHaveBeenCalledTimes(1); expect(await runBilldeskCheckout(binding,client(),dispatch)).toEqual({ok:true});
});
for(const app of [false,true]) for(const adapter of [false,true]) for(const path of ['/uat/orders/create','/uat/transactions/get'] as const)
it(`gate app=${app} adapter=${adapter} ${path} (mock transport only)`,async()=>{
  vi.stubEnv('BILLDESK_ENV','UAT');vi.stubEnv('BILLDESK_UPSTREAM_ENABLED',String(app));
  vi.stubEnv('BILLDESK_ADAPTER_URL','https://fixture.example.invalid');vi.stubEnv('BILLDESK_ADAPTER_AUTH_KEY_ID','fixture');vi.stubEnv('BILLDESK_ADAPTER_AUTH_SECRET','x'.repeat(32));
  const socket=vi.fn();const transport=vi.fn(async()=>{if(adapter){socket();return new Response('fixture',{headers:{'content-type':'application/jose'}});}return new Response('{"error":"UPSTREAM_DISABLED"}',{status:503});});
  const result=adapterRequest(path,{operationId:'operation-fixture-01',traceId:'TRACE',timestamp:'20261008123000',jose:'e30.e30.e30'},transport);
  if(app&&adapter) expect(await result).toBe('fixture');else await expect(result).rejects.toThrow('UPSTREAM_DISABLED');
  expect(transport).toHaveBeenCalledTimes(app?1:0);expect(socket).toHaveBeenCalledTimes(app&&adapter?1:0);expect(fetch).not.toHaveBeenCalled();
});

const key='fixture',secret='s'.repeat(32),path='/uat/orders/create',body=Buffer.from('{}'),now=1800000000000;
for(const offset of [-120000,120000]) it(`accepts exact HMAC boundary ${offset}`,()=>{expect(authenticate(new Headers(authHeaders(key,secret,path,body,now+offset)),'POST',path,body,key,secret,now)).toBeTruthy();});
for(const offset of [-120001,120001]) it(`rejects HMAC outside boundary ${offset}`,()=>{
  const signed=new Headers(authHeaders(key,secret,path,body,now));expect(()=>authenticate(signed,'POST',path,body,key,secret,now+offset)).toThrow();
});
for(const field of ['x-adapter-key-id','x-adapter-nonce','x-adapter-timestamp','x-adapter-version']) it(`rejects canonical field ambiguity ${field}`,()=>{
  const h=new Headers(authHeaders(key,secret,path,body,now));h.set(field,`${h.get(field)},extra`);expect(()=>authenticate(h,'POST',path,body,key,secret,now)).toThrow();
});
for(const name of ['X-Adapter-Signature','Content-Length','Host','Content-Type']) it(`rejects case-insensitive duplicate ${name}`,()=>{
  expect(()=>strictHeaders([name,'a',name.toLowerCase(),'b'])).toThrow('DUPLICATE_HEADER');
});
for(const ip of ['10.0.0.1','127.1.2.3','172.16.1.1','192.168.1.1','100.64.0.1','::ffff:10.0.0.1','::ffff:a00:1','0:0:0:0:0:ffff:7f00:1','::1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::1'])
it(`rejects private/mapped/special customer IP ${ip}`,()=>expect(publicCustomerIP(ip)).toBe(false));
for(const ip of ['8.8.8.8','2606:4700:4700::1111','2001:4860:4860::8888'])it(`accepts native public customer IP ${ip}`,()=>expect(publicCustomerIP(ip)).toBe(true));

const profile={url:'https://uat1.billdesk.com/fixture-hosted',fields:'token,merchantid'};
const expected={orderId:'BD_fixture',merchantId:'fixture',amount:'100.00'};
function response(){return {status:'ACTIVE',orderid:expected.orderId,mercid:expected.merchantId,amount:expected.amount,currency:'356',bdorderid:'fixture',links:[{rel:'redirect',method:'POST',href:profile.url,parameters:{token:'fixture',merchantid:'fixture'}}]};}
it('validates the complete hosted form profile',()=>expect(validateCreateResponse(response(),expected,profile).hostedUrl).toBe(profile.url));
it('validates the supplied UAT hosted form contract and rejects mismatched form bindings', () => {
  const kitProfile = { url: 'https://uat1.billdesk.com/u2/web/v1_2/embeddedsdk', fields: 'bdorderid,merchantid,rdata' };
  const value = { ...response(), links: [{ rel: 'redirect', method: 'POST', href: kitProfile.url,
    parameters: { bdorderid: 'fixture', merchantid: expected.merchantId, rdata: 'synthetic-opaque-data' } }] };
  expect(validateCreateResponse(value, expected, kitProfile).hostedParameters).toEqual(value.links[0].parameters);
  for (const field of ['bdorderid', 'merchantid'] as const) {
    const mismatch = structuredClone(value);
    mismatch.links[0].parameters[field] = 'unrelated';
    expect(() => validateCreateResponse(mismatch, expected, kitProfile)).toThrow();
  }
});
it('maps documented mercid to hosted merchantid without mutating the signed response', () => {
  const kit = { url: 'https://uat1.billdesk.com/u2/web/v1_2/embeddedsdk', fields: 'bdorderid,merchantid,rdata' };
  const value = { ...response(), links: [{ rel: 'redirect', method: 'POST', href: kit.url,
    parameters: { mercid: expected.merchantId, bdorderid: 'fixture', rdata: 'opaque-fixture' } }] };
  const original = structuredClone(value);
  expect(validateCreateResponse(value, expected, kit).hostedParameters).toEqual({
    merchantid: expected.merchantId, bdorderid: 'fixture', rdata: 'opaque-fixture',
  });
  expect(value).toEqual(original);
  value.links[0].parameters.mercid = 'different';
  expect(() => validateCreateResponse(value, expected, kit)).toThrow();
  const ambiguous = { ...original, links: [{ ...original.links[0], parameters: {
    ...original.links[0].parameters, merchantid: expected.merchantId,
  } }] };
  expect(() => validateCreateResponse(ambiguous, expected, kit)).toThrow();
  expect(() => validateCreateResponse(original, expected, { ...kit, url: 'https://uat1.billdesk.com/other' })).toThrow();
});
for(const mutation of ['links-object','duplicate','method','host','http','path','field','object-value','binding','relation','missing-id'])it(`rejects malformed authenticated response ${mutation}`,()=>{
  const r: Omit<ReturnType<typeof response>, 'links' | 'bdorderid'> & { bdorderid?: string; links: Array<{ rel: string; method: string; href: string; parameters: Record<string, unknown> }> }=response();
  if(mutation==='duplicate')r.links.push(r.links[0]);if(mutation==='method')r.links[0].method='GET';
  if(mutation==='host')r.links[0].href='https://evil.invalid/';if(mutation==='http')r.links[0].href=profile.url.replace('https','http');if(mutation==='path')r.links[0].href+='/evil';
  if(mutation==='field')r.links[0].parameters.extra='x';if(mutation==='object-value')r.links[0].parameters.token={x:'x'};if(mutation==='binding')r.amount='0.01';if(mutation==='relation')r.links[0].rel='authorization';if(mutation==='missing-id')delete r.bdorderid;
  const malformed = mutation==='links-object' ? {...r,links:{}} : r;
  expect(()=>validateCreateResponse(malformed,expected,profile)).toThrow();
});
it('unset hosted profile fails closed',()=>expect(()=>validateCreateResponse(response(),expected,{url:'',fields:''})).toThrow());
it('body size is bounded without Content-Length',async()=>{await expect(readBilldeskBody(new Request('https://fixture.invalid',{method:'POST',body:'x'.repeat(17)}),16)).rejects.toThrow('Body too large');});
it('compressed application bodies fail closed',async()=>{await expect(readBilldeskBody(new Request('https://fixture.invalid',{method:'POST',headers:{'content-encoding':'gzip'},body:'{}'}))).rejects.toThrow('encoding');});
it('slow body deadline cancels underlying stream',async()=>{
  vi.useFakeTimers();const cancel=vi.fn();const request=new Request('https://fixture.invalid',{method:'POST',body:new ReadableStream({cancel}),duplex:'half'} as RequestInit);
  const assertion=expect(readBilldeskBody(request,100,20)).rejects.toThrow('cancelled');await vi.advanceTimersByTimeAsync(20);await assertion;expect(cancel).toHaveBeenCalledTimes(1);
});
it('client disconnect cancels underlying body',async()=>{
  const control=new AbortController(), cancel=vi.fn();const req=new Request('https://fixture.invalid',{method:'POST',signal:control.signal,body:new ReadableStream({cancel}),duplex:'half'} as RequestInit);
  const assertion=expect(readBilldeskBody(req)).rejects.toThrow('cancelled');control.abort();await assertion;expect(cancel).toHaveBeenCalledTimes(1);
});
it('rejects invalid UTF8 and malformed JSON input',async()=>{
  await expect(readBilldeskBody(new Request('https://fixture.invalid',{method:'POST',body:new Uint8Array([255])}))).rejects.toThrow();
  expect(()=>JSON.parse('{')).toThrow();
});

function steps() {
  const rows=new Map<string,{state:string;result:unknown;owner?:string}>();
  const store:StepStore={prepare:async()=>{},claim:async(s,owner)=>{const row=rows.get(s);if(row?.state==='completed')return row;if(row&&row.state!=='failed')return {state:'review',result:null};rows.set(s,{state:'running',result:null,owner});return {state:'claimed',result:null};},
    finish:async(s,owner,state,result)=>{expect(rows.get(s)?.owner).toBe(owner);rows.set(s,{state,result});}};
  return {store,rows};
}
it('all fulfillment steps explicitly enumerated',()=>expect(new Set(BILLDESK_STEPS).size).toBe(15));
it('completed effects return persisted result without replay after worker recreation',async()=>{
  const {store}=steps(), effect=vi.fn(async()=>({messageId:'fixture',status:'accepted'}));
  await stepRunner(store)('welcome_email',true,effect);expect(await stepRunner(store)('welcome_email',true,effect)).toEqual({messageId:'fixture',status:'accepted'});expect(effect).toHaveBeenCalledTimes(1);
});
it('unknown external effect never automatically retries',async()=>{
  const {store,rows}=steps(),effect=vi.fn(async()=>{throw new Error('private customer data');});
  await expect(stepRunner(store)('invoice_email',true,effect)).rejects.toThrow('incomplete');expect(rows.get('invoice_email')?.state).toBe('unknown');
  await expect(stepRunner(store)('invoice_email',true,effect)).rejects.toThrow('reconciliation');expect(effect).toHaveBeenCalledTimes(1);
});
it('pure failed generation can recover independently',async()=>{
  const {store}=steps(),effect=vi.fn().mockRejectedValueOnce(new Error('fixture')).mockResolvedValue('pdf');
  await expect(stepRunner(store)('invoice_document',false,effect)).rejects.toThrow();expect(await stepRunner(store)('invoice_document',false,effect)).toBe('pdf');
});
it('concurrent fulfillment worker cannot enter same running step',async()=>{
  const {store}=steps();let release:()=>void=()=>{};const effect=vi.fn(()=>new Promise<void>(r=>{release=r;}));
  const first=stepRunner(store)('welcome_email',true,effect);await Promise.resolve();await expect(stepRunner(store)('welcome_email',true,effect)).rejects.toThrow();release();await first;expect(effect).toHaveBeenCalledTimes(1);
});
it('logger constructs only approved metadata and rejects PII correlation',()=>{
  const spy=vi.spyOn(console,'info').mockImplementation(()=>{});billdeskLog('fulfillment','review','fixture@example.invalid',12);
  const output=String(spy.mock.calls[0][0]);expect(output).not.toContain('@');expect(JSON.parse(output)).toEqual({operation:'fulfillment',category:'review',correlationId:'invalid',durationMs:12});
});
it('credential and transport modules declare server-only',()=>{
  for(const file of ['lib/billdesk.ts','lib/billdesk-adapter-client.ts','lib/billdesk-handler.ts','lib/billdesk-fulfillment.ts'])expect(readFileSync(file,'utf8')).toMatch(/import 'server-only'/);
});
it('no client entry imports BillDesk server modules (reference check, not production build)',()=>{
  function scan(root:string){for(const entry of readdirSync(root,{withFileTypes:true})){const p=join(root,entry.name);if(entry.isDirectory())scan(p);else if(/\.[tj]sx?$/.test(p)){const s=readFileSync(p,'utf8');if(/^['"]use client['"]/m.test(s))expect(s).not.toMatch(/(?:from|import\s*\()\s*['"][^'"]*(?:lib\/billdesk|adapter\/billdesk)/);}}}
  scan('app');scan('components');
});
it('client import graph cannot reach a server-only module (static local graph)',()=>{
  const entries:string[]=[];
  function files(root:string){for(const e of readdirSync(root,{withFileTypes:true})){const p=join(root,e.name);if(e.isDirectory())files(p);else if(/\.[tj]sx?$/.test(p))entries.push(resolve(p));}}
  files('app');files('components');files('lib');
  const visited=new Set<string>();
  function walk(file:string){
    if(visited.has(file))return;visited.add(file);
    const source=readFileSync(file,'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    expect(source,`client-reachable module ${file}`).not.toMatch(/import\s*['"]server-only['"]/);
    for(const statement of ast.statements){
      if(!ts.isImportDeclaration(statement)||statement.importClause?.isTypeOnly||!ts.isStringLiteral(statement.moduleSpecifier))continue;
      const spec=statement.moduleSpecifier.text;
      if(!spec.startsWith('.')&&!spec.startsWith('@/'))continue;
      const base=spec.startsWith('@/')?resolve(spec.slice(2)):resolve(dirname(file),spec);
      const target=[base+'.ts',base+'.tsx',base+'.js',join(base,'index.ts'),join(base,'index.tsx')].find(existsSync);
      if(target)walk(target);
    }
  }
  for(const file of entries)if(/^['"]use client['"]/m.test(readFileSync(file,'utf8')))walk(file);
});
it('streamed adapter response deadline cancels its reader',async()=>{
  vi.useFakeTimers();vi.stubEnv('BILLDESK_ENV','UAT');vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');
  vi.stubEnv('BILLDESK_ADAPTER_URL','https://fixture.example.invalid');vi.stubEnv('BILLDESK_ADAPTER_AUTH_KEY_ID','fixture');vi.stubEnv('BILLDESK_ADAPTER_AUTH_SECRET','x'.repeat(32));
  const cancel=vi.fn();const transport=vi.fn(async()=>new Response(new ReadableStream({cancel}),{headers:{'content-type':'application/jose'}}));
  const assertion=expect(adapterRequest('/uat/orders/create',{operationId:'operation-fixture-01',traceId:'TRACE',timestamp:'20261008123000',jose:'e30.e30.e30'},transport)).rejects.toThrow('TIMEOUT');
  await vi.advanceTimersByTimeAsync(20000);await assertion;expect(cancel).toHaveBeenCalledTimes(1);
});
