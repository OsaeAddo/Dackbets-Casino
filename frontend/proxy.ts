
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Non-secret marker set with the HttpOnly auth cookies. The access cookie
  // expires before the refresh cookie, so the marker decides whether the app
  // should be allowed to attempt a rotation instead of bouncing to /login.
  const hasSession = Boolean(
    request.cookies.get('casino_session')?.value ||
    request.cookies.get('casino_access')?.value
  );
  const hasAccess = Boolean(request.cookies.get('casino_access')?.value);
  
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/' || 
                       path === '/login' || 
                       path === '/register' ||
                       path.startsWith('/games'); 
  
  // Define auth paths (login/register)
  const isAuthPath = path === '/login' || path === '/register';

  // Redirect logic
  if (!hasSession && !isPublicPath) {
    // Not authenticated and trying to access protected route
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasAccess && isAuthPath) {
    // Already authenticated and trying to access login/register
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};