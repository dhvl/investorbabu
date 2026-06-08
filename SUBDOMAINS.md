# Next.js Multi-Subdomain Routing Architecture

To handle the division of subdomains (`sim.investorbabu.com`, `admin.investorbabu.com`, and `clients.investorbabu.com`) in a clean, scalable way, we recommend a **Single-Project Multi-Tenant Routing** pattern using Next.js Middleware. 

This approach keeps code sharing (for components, Tailwind design system, Supabase connection clients, and types) extremely easy while cleanly segregating page routing.

---

## 1. Directory Structure

We organize the pages in the Next.js `app/` directory by tenant namespaces:

```text
investorbabu/
├── app/
│   ├── middleware.ts            # Inspects host header and rewrites routing
│   ├── (admin)/                 # Group for admin.investorbabu.com
│   │   ├── page.tsx             # Root home page for Admin dashboard
│   │   └── settings/            # Admin settings panel
│   ├── (clients)/               # Group for clients.investorbabu.com
│   │   ├── page.tsx             # Client portal landing page
│   │   └── profile/             # Profile & API credentials management
│   ├── (sim)/                   # Group for sim.investorbabu.com
│   │   ├── dashboard/           # Simulation dashboard & P&L stats
│   │   └── page.tsx             # Simulator landing page
│   └── api/                     # Shared REST API routes (api.investorbabu.com)
│       ├── simulation/
│       ├── clients/
│       └── status/
```

*Note: The parenthesis `(admin)`, `(clients)`, and `(sim)` use Next.js Route Groups to avoid adding prefixes to the URLs, meaning `(sim)/dashboard/page.tsx` will map directly to `/dashboard` when loaded via `sim.investorbabu.com`.*

---

## 2. Next.js Middleware Routing Code

Create or update the file `middleware.ts` in the root of your Next.js project to rewrite requests dynamically based on the subdomain:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Define target subdomains
  const SIM_HOST = 'sim.investorbabu.com';
  const ADMIN_HOST = 'admin.investorbabu.com';
  const CLIENTS_HOST = 'clients.investorbabu.com';

  // Extract path and query parameters
  const path = url.pathname;

  // 1. Rewrite for sim.investorbabu.com
  if (hostname.includes(SIM_HOST)) {
    url.pathname = `/(sim)${path}`;
    return NextResponse.rewrite(url);
  }

  // 2. Rewrite for admin.investorbabu.com
  if (hostname.includes(ADMIN_HOST)) {
    url.pathname = `/(admin)${path}`;
    return NextResponse.rewrite(url);
  }

  // 3. Rewrite for clients.investorbabu.com
  if (hostname.includes(CLIENTS_HOST)) {
    url.pathname = `/(clients)${path}`;
    return NextResponse.rewrite(url);
  }

  // Fallback / standard domain routing
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all pathnames except for:
    // - api/ (shared API routes)
    // - _next/ (internal Next.js resources)
    // - static files (images, css, favicon)
    '/((?!api|_next/static|_next/image|favicon.ico|assets|ccb-assets).*)',
  ],
};
```

---

## 3. Benefits of this Setup
1. **Shared Components & Contexts**: The Admin, Simulator, and Clients dashboards can all import from `@/components/ui/` or `@/lib/supabase` directly without duplicate workspace syncing.
2. **Unified Build Process**: Runs as a single Next.js app, meaning you only need to run a single Node/Nginx instance on the server.
3. **Flexible Deployment**: If you later decide to separate the dashboards physically, you can easily copy and paste the respective Route Groups into dedicated Next.js project repositories.
