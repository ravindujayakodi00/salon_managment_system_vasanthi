import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** First path segment for routes that moved under `/admin` (backwards compatibility). */
const LEGACY_ADMIN_SEGMENTS = new Set([
    'login',
    'select-branch',
    'dashboard',
    'appointments',
    'pos',
    'inventory',
    'staff',
    'customers',
    'earnings',
    'financial',
    'petty-cash',
    'segments',
    'promos',
    'loyalty',
    'notifications',
    'campaigns',
    'reports',
    'settings',
]);

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.') // static files
    ) {
        return NextResponse.next();
    }

    const first = pathname.split('/').filter(Boolean)[0];
    if (first && LEGACY_ADMIN_SEGMENTS.has(first)) {
        const url = request.nextUrl.clone();
        url.pathname = `/admin${pathname}`;
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
