import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const nextPath = request.nextUrl.pathname === '/app/scanner' ? '/app/orders' : request.nextUrl.pathname;
  if (!request.cookies.get('rto_access')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', nextPath);
    return NextResponse.redirect(url);
  }
  if (nextPath !== request.nextUrl.pathname) {
    const url = request.nextUrl.clone();
    url.pathname = nextPath;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/app/:path*'] };
