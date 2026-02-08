import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authLimiter, apiLimiter, aiLimiter, checkRateLimit } from "@/lib/rate-limit";

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = getClientIp(request);

  // --- Rate Limiting ---
  const authPaths = ["/login", "/signup", "/forgot-password", "/auth/callback"];
  const isAuthPath = authPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAiApi = pathname.startsWith("/api/ai/") || pathname.startsWith("/api/ai");
  const isApi = pathname.startsWith("/api/");

  if (isAuthPath) {
    const { success } = await checkRateLimit(authLimiter, `auth:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  } else if (isAiApi) {
    const { success } = await checkRateLimit(aiLimiter, `ai:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  } else if (isApi) {
    const { success } = await checkRateLimit(apiLimiter, `api:${ip}`);
    if (!success) {
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
