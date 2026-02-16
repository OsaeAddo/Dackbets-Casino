
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Get token from cookies (set after login)
  const token = request.cookies.get('access_token')?.value;
  
  const path = request.nextUrl.pathname;
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/' || 
                       path === '/login' || 
                       path === '/register' ||
                       path.startsWith('/games'); // Game pages might be public?
  
  // Define auth paths (login/register)
  const isAuthPath = path === '/login' || path === '/register';

  // Redirect logic
  if (!token && !isPublicPath) {
    // Not authenticated and trying to access protected route
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isAuthPath) {
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