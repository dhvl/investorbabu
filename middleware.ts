import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host') || '';

  // Support local development subdomains like sim.localhost:3000, admin.localhost:3000
  let subdomain = '';
  if (hostname.includes('sim.investorbabu.com') || hostname.startsWith('sim.localhost') || hostname.includes('sim-')) {
    subdomain = 'sim';
  } else if (hostname.includes('admin.investorbabu.com') || hostname.startsWith('admin.localhost') || hostname.includes('admin-')) {
    subdomain = 'admin';
  } else if (hostname.includes('clients.investorbabu.com') || hostname.startsWith('clients.localhost') || hostname.includes('clients-')) {
    subdomain = 'clients';
  }

  // Admin Subdomain Authentication Gate
  if (subdomain === 'admin' || url.pathname.startsWith('/subdomains/admin')) {
    const adminSession = req.cookies.get('admin_session');
    const isAuthenticated = adminSession && adminSession.value.startsWith('authenticated_');
    const isLoginPage = url.pathname === '/login' || url.pathname === '/subdomains/admin/login';

    if (!isAuthenticated && !isLoginPage) {
      // Unauthenticated visitor trying to access protected admin resources -> Redirect to /login
      if (subdomain === 'admin') {
        url.pathname = '/login';
        return NextResponse.redirect(url);
      } else {
        url.pathname = '/subdomains/admin/login';
        return NextResponse.redirect(url);
      }
    }

    if (isAuthenticated && isLoginPage) {
      // Already logged in -> Redirect to dashboard
      url.pathname = subdomain === 'admin' ? '/dashboard' : '/subdomains/admin/dashboard';
      return NextResponse.redirect(url);
    }

    // Rewrite admin routes
    if (subdomain === 'admin') {
      if (url.pathname === '/' || url.pathname === '') {
        url.pathname = '/subdomains/admin/dashboard';
      } else {
        url.pathname = `/subdomains/admin${url.pathname}`;
      }
      return NextResponse.rewrite(url);
    }
  }

  // Route rewriting based on subdomain
  if (subdomain === 'sim') {
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/subdomains/sim/dashboard';
    } else {
      url.pathname = `/subdomains/sim${url.pathname}`;
    }
    return NextResponse.rewrite(url);
  } else if (subdomain === 'clients') {
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = '/subdomains/clients/dashboard';
    } else {
      url.pathname = `/subdomains/clients${url.pathname}`;
    }
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
