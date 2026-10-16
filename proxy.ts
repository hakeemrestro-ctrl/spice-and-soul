import { NextRequest, NextResponse } from 'next/server';

// Website-only UAT release. Removing this gate needs a separate payment-test approval.
// Non-UAT deployments retain their existing routes and behavior.
export function proxy(request: NextRequest) {
  if (process.env.BILLDESK_ENV !== 'UAT' || process.env.UAT_SITE_PREVIEW === 'false') {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const restricted = ['/api', '/admin', '/checkout', '/gift', '/resend'].some(
    prefix => path === prefix || path.startsWith(`${prefix}/`),
  );
  if (restricted || !['GET', 'HEAD'].includes(request.method)) {
    const response = path === '/api' || path.startsWith('/api/')
      ? NextResponse.json({ error: 'UAT_PREVIEW_ONLY' }, { status: 503 })
      : new NextResponse(
        '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UAT preview</title><body><main><h1>UAT website preview</h1><p>Payments, email delivery and account changes are disabled.</p><a href="/courses">Browse courses</a></main></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }
  const response = NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
