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
  // This trust boundary is valid only on Vercel's direct ingress. Local/proxied
  // deployments require a separately reviewed trust policy, never an IP from JSON.
  if (process.env.VERCEL !== '1') throw new Error('Trusted Vercel ingress required');
  if (process.env.BILLDESK_DEVICE_MAC_POLICY !== 'omit-confirmed') throw new Error('BillDesk MAC requirement needs confirmation');
  const ip = header(headers, 'x-vercel-forwarded-for', 45);
  if (!publicCustomerIP(ip)) throw new Error('Invalid customer IP');
  return { init_channel: 'internet', ip, user_agent: header(headers, 'user-agent', 1024), accept_header: header(headers, 'accept', 2048) };
}
