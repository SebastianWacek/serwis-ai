// Odświeżanie sesji Supabase w middleware + bramkowanie tras i wymuszenie MFA.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // WAŻNE: nie umieszczać kodu między createServerClient a getUser() —
  // subtelny błąd potrafi powodować losowe wylogowania użytkowników.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Ścieżki publiczne (bez logowania)
  const publicPaths = ['/login', '/auth', '/api', '/verify']
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  )

  // Niezalogowany + trasa chroniona → przekieruj na /login
  if (!user && !isPublicPath && request.nextUrl.pathname !== '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Zalogowany → sprawdź poziom MFA (aal1 → aal2)
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    // Ma MFA, ale nie potwierdził drugiego składnika → wymuś /verify
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
      if (request.nextUrl.pathname === '/verify') return supabaseResponse
      if (!isPublicPath && request.nextUrl.pathname !== '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/verify'
        return NextResponse.redirect(url)
      }
    }

    // W pełni uwierzytelniony na /login lub /verify → przekieruj do aplikacji
    if (aal?.currentLevel === aal?.nextLevel || aal?.currentLevel === 'aal2') {
      if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/verify') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
