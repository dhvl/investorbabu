import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Support local development subdomains like sim.localhost:3000
  let subdomain = '';
  if (hostname.includes('sim.investorbabu.com') || hostname.startsWith('sim.localhost') || hostname.includes('sim-')) {
    subdomain = 'sim';
  } else if (hostname.includes('admin.investorbabu.com') || hostname.startsWith('admin.localhost') || hostname.includes('admin-')) {
    subdomain = 'admin';
  } else if (hostname.includes('clients.investorbabu.com') || hostname.startsWith('clients.localhost') || hostname.includes('clients-')) {
    subdomain = 'clients';
  }

  // Route rewriting based on subdomain
  if (subdomain === 'sim') {
    url.pathname = `/subdomains/sim${url.pathname}`;
    return NextResponse.rewrite(url);
  } else if (subdomain === 'admin') {
    url.pathname = `/subdomains/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  } else if (subdomain === 'clients') {
    url.pathname = `/subdomains/clients${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except:
    // - api/ (shared backend routes)
    // - _next/static, _next/image (Next.js assets)
    // - favicon.ico, assets, images, etc.
    '/((?!api/|_next/|favicon.ico|assets/|public/|bg-abstract.png).*)',
  ],
};
