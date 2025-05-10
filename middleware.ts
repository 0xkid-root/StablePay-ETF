import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = [
  '/employer',
  '/employee',
]

// Auth routes that should redirect to dashboard if authenticated
const authRoutes = [
  '/auth',
  '/',
]

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const authToken = request.cookies.get('auth-token')?.value
  const userRole = request.cookies.get('user-role')?.value

  // Check if accessing protected routes without authentication
  if (protectedRoutes.some(route => path.startsWith(route))) {
    if (!authToken) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }

    // Redirect users to their appropriate dashboard based on role
    if (path.startsWith('/employer') && userRole !== 'employer') {
      return NextResponse.redirect(new URL('/employee', request.url))
    }
    if (path.startsWith('/employee') && userRole !== 'employee') {
      return NextResponse.redirect(new URL('/employer', request.url))
    }
  }

  // Redirect authenticated users from auth pages to their dashboard
  if (authRoutes.includes(path) && authToken && userRole) {
    return NextResponse.redirect(
      new URL(userRole === 'employer' ? '/employer' : '/employee', request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/employer/:path*',
    '/employee/:path*',
    '/auth',
    '/',
  ],
}