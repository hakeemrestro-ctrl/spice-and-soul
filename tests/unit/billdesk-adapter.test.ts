// @vitest-environment node
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { createHash, createHmac } from 'node:crypto';
import { authHeaders, authenticate, envelope, operation, operationForEnvironment, readLimited, deadline, DESTINATIONS, MAX_BYTES, type Envelope } from '../../adapter/billdesk/protocol';
import { NonceStore, Limits } from '../../adapter/billdesk/store';
import { createAdapter } from '../../adapter/billdesk/service';
import { decodeResponse, resolveUpstream, sendBilldesk, verifyObservedEgress, publicIPv4 } from '../../adapter/billdesk/upstream';
import { adapterRequest, adapterOrigin } from '../../lib/billdesk-adapter-client';
import { billdeskDevice } from '../../lib/billdesk-device';

const key='fixture-app', secret='fixture-only-'.repeat(4), now=1800000000000;
const path='/uat/orders/create' as const;
const data: Envelope={operationId:'operation-fixture-0001',traceId:'TRACE1',timestamp:'20260101000000',jose:'e30.e30.c2ln'};
const body=Buffer.from(JSON.stringify(data));
const signed=(at=now, nonce='nonce-fixture-00001')=>new Headers({'content-type':'application/json',...authHeaders(key,secret,path,body,at,nonce)});
let dir: string; let store: NonceStore;
beforeEach(()=>{
  vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','false');vi.stubEnv('BILLDESK_ENV','UAT');
  vi.stubEnv('BILLDESK_ADAPTER_URL','https://adapter.example.invalid');vi.stubEnv('BILLDESK_ADAPTER_AUTH_KEY_ID',key);vi.stubEnv('BILLDESK_ADAPTER_AUTH_SECRET',secret);
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('External network forbidden');}));
  dir=mkdtempSync(join(tmpdir(),'billdesk-adapter-test-'));store=new NonceStore(join(dir,'state.sqlite'));
});
afterEach(()=>{try{store.close();}catch{}rmSync(dir,{recursive:true,force:true});vi.useRealTimers();vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('valid HMAC accepted',()=>expect(authenticate(signed(),'POST',path,body,key,secret,now)).toBe('nonce-fixture-00001'));
it('HMAC canonical string matches deployed adapter v1 format and rejects legacy 1 format',()=>{
  const timestamp = String(Math.floor(now / 1000));
  const nonce = 'nonce-fixture-00001';
  const v1Canonical = ['v1', key, 'POST', path, timestamp, nonce, createHash('sha256').update(body).digest('hex')].join('\n');
  const expectedSig = createHmac('sha256', secret).update(v1Canonical).digest('hex');
  const headers = authHeaders(key, secret, path, body, now, nonce);
  expect(headers['x-adapter-signature']).toBe(expectedSig);

  const legacyCanonical = ['1', key, 'POST', path, timestamp, nonce, createHash('sha256').update(body).digest('hex')].join('\n');
  const legacySig = createHmac('sha256', secret).update(legacyCanonical).digest('hex');
  const legacyHeaders = new Headers(headers);
  legacyHeaders.set('x-adapter-signature', legacySig);
  expect(()=>authenticate(legacyHeaders, 'POST', path, body, key, secret, now)).toThrow();
});
for(const [name,value] of [['x-adapter-signature','0'.repeat(64)],['x-adapter-key-id','wrong'],['x-adapter-version','2']])it(`rejects ${name}`,()=>{
  const h=signed();h.set(name,value);expect(()=>authenticate(h,'POST',path,body,key,secret,now)).toThrow();
});
for(const delta of [-121000,121000])it(`rejects timestamp offset ${delta}`,()=>expect(()=>authenticate(signed(now+delta),'POST',path,body,key,secret,now)).toThrow());
it('rejects missing authentication',()=>expect(()=>authenticate(new Headers(),'POST',path,body,key,secret,now)).toThrow());
it('signature binds exact bytes, method and operation',()=>{
  for(const args of [['GET',path,body],['POST','/uat/transactions/get',body],['POST',path,Buffer.concat([body,Buffer.from(' ')])]] as const)
    expect(()=>authenticate(signed(),args[0],args[1],args[2],key,secret,now)).toThrow();
});
it('nonce survives restart and is atomic across connections',()=>{
  store.consume(key,'nonce',now);store.close();store=new NonceStore(join(dir,'state.sqlite'));
  const second=new NonceStore(join(dir,'state.sqlite'));
  try{expect(()=>second.consume(key,'nonce',now)).toThrow('REPLAY');}finally{second.close();}
});
it('nonce storage unavailable fails closed',()=>{store.close();expect(()=>store.consume(key,'nonce',now)).toThrow('NONCE_STORE_UNAVAILABLE');});
it('operation identifiers dedupe independently of nonce',()=>{store.claim(key,data.operationId,'hash');expect(()=>store.claim(key,data.operationId,'different')).toThrow('OPERATION_ALREADY_ATTEMPTED');});
it('disabled adapter authenticates, consumes nonce, never reaches upstream',async()=>{
  const handle=createAdapter(store,key,secret);
  await expect(handle('POST',path,signed(),body,now)).rejects.toThrow('UPSTREAM_DISABLED');
  await expect(handle('POST',path,signed(),body,now)).rejects.toThrow('REPLAY');
  expect(fetch).not.toHaveBeenCalled();
});
it('upstream transport itself is disabled before DNS or HTTP',async()=>{await expect(sendBilldesk(path,data)).rejects.toThrow('UPSTREAM_DISABLED');expect(fetch).not.toHaveBeenCalled();});
it('rejects caller authorization header',async()=>{const h=signed();h.set('authorization','fixture');await expect(createAdapter(store,key,secret)('POST',path,h,body,now)).rejects.toThrow('FORBIDDEN_HEADER');});
it('missing upstream flag also fails closed',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED',undefined);await expect(sendBilldesk(path,data)).rejects.toThrow('UPSTREAM_DISABLED');});
it('service rejects nonce used as operation ID',async()=>{const b=Buffer.from(JSON.stringify({...data,operationId:'nonce-fixture-00001'}));const h=new Headers({'content-type':'application/json',...authHeaders(key,secret,path,b,now,'nonce-fixture-00001')});await expect(createAdapter(store,key,secret)('POST',path,h,b,now)).rejects.toThrow('OPERATION_NONCE_COLLISION');});
it('application rejects an environment/path mismatch before the adapter call',async()=>{vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');await expect(sendBilldesk(path,data)).rejects.toThrow('ENVIRONMENT_OPERATION_MISMATCH');expect(fetch).not.toHaveBeenCalled();});
it('maps each environment to fixed adapter operations and BillDesk destinations',()=>{
  expect(operationForEnvironment('orders/create')).toBe('/uat/orders/create');
  vi.stubEnv('BILLDESK_ENV','PROD');expect(operationForEnvironment('orders/create')).toBe('/prod/orders/create');
  expect(operationForEnvironment('transactions/get')).toBe('/prod/transactions/get');
  expect(DESTINATIONS['/prod/orders/create']).toBe('https://api.billdesk.com/payments/ve1_2/orders/create');
});
for(const bad of ['/','/uat/orders/create?url=x','https://example.invalid','/uat/refunds/create'])it(`rejects invalid path ${bad}`,()=>expect(()=>operation(bad)).toThrow());
for(const field of ['url','host','hostname','port','path','proxy','authorization','redirect','headers'])it(`rejects caller ${field}`,()=>expect(()=>envelope(Buffer.from(JSON.stringify({...data,[field]:'forbidden'})))).toThrow());
it('rejects oversized streamed request',async()=>{await expect(readLimited(Readable.from([Buffer.alloc(MAX_BYTES),Buffer.from('x')]))).rejects.toThrow('SIZE_LIMIT');});
it('total deadline aborts hanging work',async()=>{
  vi.useFakeTimers();let signal: AbortSignal|undefined;
  const result=deadline(async s=>{signal=s;return new Promise(()=>{});},15000);
  const check=expect(result).rejects.toThrow('TIMEOUT');await vi.advanceTimersByTimeAsync(15000);await check;expect(signal?.aborted).toBe(true);
});
it('rejects upstream redirect',async()=>{await expect(decodeResponse(302,'application/jose','',Readable.from(['x']))).rejects.toThrow('REDIRECT_REJECTED');});
it('limits plain upstream response',async()=>{await expect(decodeResponse(200,'application/jose','',Readable.from([Buffer.alloc(MAX_BYTES+1)]))).rejects.toThrow('RESPONSE_TOO_LARGE');});
it('limits decompressed upstream response',async()=>{await expect(decodeResponse(200,'application/jose','gzip',Readable.from([gzipSync(Buffer.alloc(MAX_BYTES+1))]))).rejects.toThrow('RESPONSE_TOO_LARGE');});
it('decodes bounded compressed response',async()=>{expect(await decodeResponse(200,'application/jose','gzip',Readable.from([gzipSync('fixture')]))).toBe('fixture');});
it('concurrency limit four and release is idempotent',()=>{const l=new Limits();const exits=Array.from({length:4},()=>l.enter(key,now));expect(()=>l.enter(key,now)).toThrow('CONCURRENCY_LIMIT');exits[0]();exits[0]();const done=l.enter(key,now);done();exits.slice(1).forEach(f=>f());});
it('burst five and refill at thirty per minute',()=>{const l=new Limits();for(let i=0;i<5;i++)l.enter(key,now)();expect(()=>l.enter(key,now)).toThrow('RATE_LIMIT');expect(()=>l.enter(key,now+1999)).toThrow();l.enter(key,now+2000)();});
for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','100.64.0.1','::1','224.0.0.1'])it(`rejects unsafe DNS fixture ${ip}`,async()=>{
  expect(publicIPv4(ip)).toBe(false);await expect(resolveUpstream('uat1.billdesk.com',async()=>[ip])).rejects.toThrow('UNSAFE_DNS');
});
it('egress observer verifies expected public IPv4 without a network call',async()=>{expect(await verifyObservedEgress(async()=> '64.225.85.27')).toBe(true);expect(await verifyObservedEgress(async()=> '168.144.220.21')).toBe(false);});
it('application adapter success uses only configured adapter',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');
  const fake=vi.fn<typeof fetch>(async()=>new Response('synthetic-response',{headers:{'content-type':'application/jose'}}));
  expect(await adapterRequest(path,data,fake)).toBe('synthetic-response');
  expect(fake).toHaveBeenCalledTimes(1);expect(fake.mock.calls[0][0]).toBe('https://adapter.example.invalid'+path);
});
it('adapter unavailable never falls back',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');const fake=vi.fn(async()=>{throw new Error('offline');});await expect(adapterRequest(path,data,fake)).rejects.toThrow('ADAPTER_UNAVAILABLE');expect(fake).toHaveBeenCalledTimes(1);expect(fetch).not.toHaveBeenCalled();});
it('application surfaces upstream disabled',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');await expect(adapterRequest(path,data,async()=>new Response('{"error":"UPSTREAM_DISABLED"}',{status:503}))).rejects.toThrow('UPSTREAM_DISABLED');});
it('application rejects adapter redirect without following it',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');const fake=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://elsewhere.invalid'}}));await expect(adapterRequest(path,data,fake)).rejects.toThrow('REDIRECT_REJECTED');expect(fake).toHaveBeenCalledTimes(1);});
it('application timeout never falls back',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');
  vi.useFakeTimers();const fake=vi.fn(()=>new Promise<Response>(()=>{}));const check=expect(adapterRequest(path,data,fake)).rejects.toThrow('TIMEOUT');await vi.advanceTimersByTimeAsync(20000);await check;expect(fake).toHaveBeenCalledTimes(1);
});
it('application rejects oversized adapter response',async()=>{vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','true');await expect(adapterRequest(path,data,async()=>new Response('x'.repeat(MAX_BYTES+1),{headers:{'content-type':'application/jose'}}))).rejects.toThrow('SIZE_LIMIT');});
for(const url of ['http://example.invalid','https://user:pass@example.invalid','https://example.invalid/path','https://127.0.0.1','https://example.invalid?url=x'])it(`rejects adapter URL fixture ${url}`,()=>expect(()=>adapterOrigin(url)).toThrow());

function deviceHeaders(){return new Headers({'x-vercel-forwarded-for':'8.8.8.8','user-agent':'Fixture Browser','accept':'text/html'});}
function deviceConfig(){vi.stubEnv('VERCEL','1');vi.stubEnv('BILLDESK_DEVICE_MAC_POLICY','omit-confirmed');}
it('device uses trusted IP, actual browser headers and no MAC',()=>{deviceConfig();const h=deviceHeaders();h.set('x-forwarded-for','1.1.1.1');const value=billdeskDevice(h);expect(value.ip).toBe('8.8.8.8');expect(value.user_agent).toBe('Fixture Browser');expect(value.accept_header).toBe('text/html');expect(value).not.toHaveProperty('mac');});
it('browser JSON cannot override customer IP',()=>{deviceConfig();const req=new Request('https://fixture.invalid',{method:'POST',headers:deviceHeaders(),body:JSON.stringify({ip:'1.1.1.1',device:{ip:'1.1.1.1'}})});expect(billdeskDevice(req.headers).ip).toBe('8.8.8.8');});
for(const ip of ['invalid','8.8.8.8, 1.1.1.1','','127.0.0.1'])it(`rejects device IP fixture ${ip}`,()=>{deviceConfig();const h=deviceHeaders();h.set('x-vercel-forwarded-for',ip);expect(()=>billdeskDevice(h)).toThrow();});
for(const name of ['user-agent','accept'])it(`requires bounded ${name}`,()=>{deviceConfig();const h=deviceHeaders();h.delete(name);expect(()=>billdeskDevice(h)).toThrow();h.set(name,'x'.repeat(2049));expect(()=>billdeskDevice(h)).toThrow();h.set(name,'bad\tvalue');expect(()=>billdeskDevice(h)).toThrow();});
it('device rejects untrusted local ingress or unconfirmed MAC policy',()=>{deviceConfig();vi.stubEnv('VERCEL','0');expect(()=>billdeskDevice(deviceHeaders())).toThrow();vi.stubEnv('VERCEL','1');vi.stubEnv('BILLDESK_DEVICE_MAC_POLICY','');expect(()=>billdeskDevice(deviceHeaders())).toThrow();});
