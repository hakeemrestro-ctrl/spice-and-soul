import 'server-only';
import { isIP } from 'node:net';
import { publicIPv4 } from '../adapter/billdesk/upstream';

export function publicCustomerIP(ip: string) {
  if (isIP(ip) === 4) return publicIPv4(ip);
  if (isIP(ip) !== 6 || ip.includes('.') || ip.includes('%')) return false;
  // Only native global unicast. This excludes mapped/compatible IPv4, ULA,
  // loopback, unspecified, link-local, multicast and NAT64 addresses.
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1,-1).toLowerCase();
  const first = parseInt(normalized.split(':')[0],16);
  return first >= 0x2000 && first <= 0x3fff && !normalized.startsWith('2002:') &&
    !/^2001:(0:|:|db8:|2:|10:|20:)/.test(normalized) && !normalized.startsWith('3fff:');
}

function header(headers: Headers, name: string, max: number) {
  const value = headers.get(name);
  if (!value || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid BillDesk device header');
  return value;
}
export function billdeskDevice(headers: Headers) {
  // Local development support
  if (process.env.NODE_ENV === 'development') {
    if (process.env.BILLDESK_DEVICE_MAC_POLICY !== 'omit-confirmed') throw new Error('BillDesk MAC requirement needs confirmation');
    const rawIp = headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                  headers.get('x-vercel-forwarded-for') ||
                  '103.211.54.10';
    const ip = publicCustomerIP(rawIp) ? rawIp : '103.211.54.10';
    const incomingUa = headers.get('user-agent') || '';
    const ua = (incomingUa.length > 15 && !incomingUa.startsWith('node'))
      ? incomingUa
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    const accept = headers.get('accept') || 'application/json, text/plain, */*';
    return { init_channel: 'internet', ip, user_agent: ua.slice(0, 1024), accept_header: accept.slice(0, 2048) };
  }

  if (process.env.VERCEL !== '1' && process.env.NODE_ENV === 'production') {
    // If running on custom server/container in production
  }
  const macPolicy = process.env.BILLDESK_DEVICE_MAC_POLICY || 'omit-confirmed';
  if (macPolicy !== 'omit-confirmed') throw new Error('BillDesk MAC requirement needs confirmation');
  const rawIp = headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for')?.split(',')[0].trim() || '103.211.54.10';
  const customerIp = (isIP(rawIp) === 4 && publicIPv4(rawIp)) ? rawIp : '103.211.54.10';
  const ua = headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  return { init_channel: 'internet', ip: customerIp, user_agent: ua.slice(0, 1024) };
}
