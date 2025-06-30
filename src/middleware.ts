// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // This middleware does nothing and allows all requests to pass through.
  // You can add custom logic here in the future if needed.
  return NextResponse.next();
}

// Optionally, configure the matcher to specify which paths this middleware applies to.
// An empty array or not providing a config means it applies to no paths by default
// unless Next.js has other conventions for middleware at the root.
// To be safe and explicit that it currently does nothing for specific paths:
export const config = {
  matcher: [], // This ensures it doesn't actively match any paths.
};
