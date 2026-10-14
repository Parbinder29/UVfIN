import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseEnv, hasSupabaseEnv } from '@/lib/env'

const PUBLIC_PATHS = ['/login']

// Shown instead of a bare "Internal Server Error" when a deployment (usually a
// Vercel Preview) was built without the Supabase settings.
const NOT_CONFIGURED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>UVfIN is not connected</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;line-height:1.5;color:#111;background:#fff">
<h1 style="font-size:1.25rem">This copy of UVfIN is not connected to its database</h1>
<p>It was built without the Supabase settings. In Vercel, open <b>Settings &rarr; Environment Variables</b>, tick both Production and Preview for <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then redeploy with the build cache turned off.</p>
</body></html>`

export async function updateSession(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return new NextResponse(NOT_CONFIGURED_PAGE, {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    })
  }
  let response = NextResponse.next({ request })
  const { url, anonKey } = getSupabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        // Never let a CDN cache a response that carries auth cookies.
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // getClaims() checks the token's signature and expiry (refreshing it when it
  // is about to expire), so a forged or expired session is rejected here. With
  // Supabase's asymmetric signing keys this needs no round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims.sub ? data.claims : null

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone()
    target.pathname = path
    target.search = ''
    const redirect = NextResponse.redirect(target)
    // Carry over any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  if (!user && !isPublic) return redirectTo('/login')
  if (user && (pathname === '/login' || pathname === '/')) return redirectTo('/dashboard')

  return response
}
