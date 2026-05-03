import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (!path.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (path === '/admin/login') {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;
  const session = request.cookies.get('admin_session')?.value;

  if (password && session === password) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/admin/login';
  url.searchParams.set('next', path);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*'],
};
