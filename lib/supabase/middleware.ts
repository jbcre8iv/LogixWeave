import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthLimiter, getApiLimiter, getAiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security/get-client-ip";
import { isIpBlocked } from "@/lib/security/ip-blocklist";
import { logSecurityEvent } from "@/lib/security/monitor";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  // --- IP Blocklist Check (first operation, before everything else) ---
  if (isIpBlocked(ip)) {
    return NextResponse.json(
      { error: "Access denied" },
      { status: 403 }
    );
  }

  // --- Rate Limiting ---
  const authPaths = ["/login", "/signup", "/forgot-password", "/auth/callback"];
  const isAuthPath = authPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAiApi = pathname.startsWith("/api/ai/") || pathname.startsWith("/api/ai");
  const isApi = pathname.startsWith("/api/");

  if (isAuthPath) {
    const { success } = await checkRateLimit(getAuthLimiter(), `auth:${ip}`);
    if (!success) {
      logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "medium",
        ip,
        description: `Auth rate limit exceeded for ${pathname}`,
        metadata: { path: pathname },
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  } else if (isAiApi) {
    const { success } = await checkRateLimit(getAiLimiter(), `ai:${ip}`);
    if (!success) {
      logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "medium",
        ip,
        description: `AI API rate limit exceeded for ${pathname}`,
        metadata: { path: pathname },
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  } else if (isApi) {
    const { success } = await checkRateLimit(getApiLimiter(), `api:${ip}`);
    if (!success) {
      logSecurityEvent({
        eventType: "rate_limit_exceeded",
        severity: "medium",
        ip,
        description: `API rate limit exceeded for ${pathname}`,
        metadata: { path: pathname },
      });
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  // --- Supabase Auth ---
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Define public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/legal", "/auth/callback", "/verify-email"];
  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith("/auth/")
  );

  // --- Banned User Check ---
  if (user?.banned_until) {
    const bannedUntil = new Date(user.banned_until);
    if (bannedUntil > new Date()) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "account_disabled");
      const redirectResponse = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
  }

  // --- Email Verification Check ---
  const emailExemptPaths = ["/verify-email", "/auth/callback", "/login", "/signup", "/forgot-password", "/reset-password", "/legal", "/"];
  const isEmailExempt = emailExemptPaths.some(
    (route) =>
      pathname === route ||
      pathname.startsWith("/auth/")
  );

  if (user && !user.email_confirmed_at && !isEmailExempt) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    const redirectResponse = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  if (!user && !isPublicRoute) {
    // No user and trying to access protected route, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    // User is logged in and trying to access auth pages, redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
