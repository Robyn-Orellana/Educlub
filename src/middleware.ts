import { NextResponse, NextRequest } from 'next/server';

export const config = { matcher: ['/dashboard/:path*', '/perfil/:path*', '/cursos/:path*'] };

export function middleware(req: NextRequest) {
  const sid = req.cookies.get('sid')?.value;
  if (!sid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}