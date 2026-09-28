import { SignJWT, compactVerify, CompactSign } from 'jose';

export const BILLDESK_ENV = process.env.BILLDESK_ENV || 'UAT';
export const BILLDESK_MERCID = process.env.BILLDESK_MERCID || '';
export const BILLDESK_CLIENT_ID = process.env.BILLDESK_CLIENT_ID || '';
export const BILLDESK_SECRET_KEY = process.env.BILLDESK_SECRET_KEY || '';

const BASE_URL_UAT = 'https://uat1.billdesk.com/u2/payments/ve1_2';
const BASE_URL_PROD = 'https://api.billdesk.com/payments/ve1_2';

export const getBilldeskBaseUrl = () => {
  return BILLDESK_ENV === 'PROD' ? BASE_URL_PROD : BASE_URL_UAT;
};

export const auditBilldeskConfig = () => {
  if (!BILLDESK_MERCID || !BILLDESK_CLIENT_ID || !BILLDESK_SECRET_KEY) {
    throw new Error("BillDesk configuration is missing. Ensure BILLDESK_MERCID, BILLDESK_CLIENT_ID, and BILLDESK_SECRET_KEY are set.");
  }
  return { env: BILLDESK_ENV, mercid: BILLDESK_MERCID };
};

export const generateOrderId = () => {
  return `BD_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
};

export const generateTraceId = () => {
  return `TR_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
};

export const createJwsToken = async (payload: any) => {
  const secret = new TextEncoder().encode(BILLDESK_SECRET_KEY);
  
  // BillDesk requires the payload to be the exact JSON string
  const payloadString = JSON.stringify(payload);
  
  const jws = await new CompactSign(new TextEncoder().encode(payloadString))
    .setProtectedHeader({ alg: 'HS256', clientid: BILLDESK_CLIENT_ID })
    .sign(secret);
    
  return jws;
};

export const verifyJwsToken = async (jws: string) => {
  const secret = new TextEncoder().encode(BILLDESK_SECRET_KEY);
  const { payload, protectedHeader } = await compactVerify(jws, secret);
  
  return {
    payload: JSON.parse(new TextDecoder().decode(payload)),
    header: protectedHeader
  };
};

export const getBillDeskTransactionStatus = async (orderId: string) => {
  const traceId = generateTraceId();
  const reqBody = {
    mercid: BILLDESK_MERCID,
    orderid: orderId,
    refund_details: true
  };
  
  const token = await createJwsToken(reqBody);
  
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(Date.now() + offsetMs);
  const bdTimestamp = istDate.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const response = await fetch(`${getBilldeskBaseUrl()}/transactions/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/jose',
      'Accept': 'application/jose',
      'BD-Traceid': traceId,
      'BD-Timestamp': bdTimestamp
    },
    body: token
  });
  
  if (!response.ok) {
    throw new Error(`BillDesk Retrieve API failed with status ${response.status}`);
  }
  
  const responseText = await response.text();
  const verified = await verifyJwsToken(responseText);
  return verified.payload;
};
