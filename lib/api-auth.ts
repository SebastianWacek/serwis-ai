// Uwierzytelnianie i autoryzacja rolowa (RBAC) dla tras API.
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

// Rozdzielenie obowiązków (separation of duties):
//   Doradca         → praca tylko na własnym portfelu
//   Menedżer      → nadzór biznesowy (odczyt/zapis w całym zespole)
//   Administrator → zarządza kontami (użytkownicy/role), bez zapisu danych klientów
export type AppRole = "Doradca" | "Menedżer" | "Administrator"

export interface AuthedUser {
  user: User
  role: AppRole
  profileId: string
}

/** Sprawdza, czy istnieje ważna sesja Supabase. */
export async function requireAuth(): Promise<
  { user: User; error: null } | { user: null; error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { success: false, error: "Nieautoryzowany dostęp" },
        { status: 401 }
      ),
    }
  }

  return { user, error: null }
}

/**
 * Sprawdza sesję ORAZ czy rola należy do dozwolonych.
 * Rola pobierana z tabeli public.users przez klienta service-role
 * (odczyt roli nie może zależeć od RLS tej samej tabeli).
 *
 * Użycie:
 *   const auth = await requireRole(["Administrator"])
 *   if (auth.error) return auth.error
 *   const { user, role } = auth.authed
 */
export async function requireRole(
  allowedRoles: AppRole[]
): Promise<{ authed: AuthedUser; error: null } | { authed: null; error: NextResponse }> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      authed: null,
      error: NextResponse.json(
        { success: false, error: "Nieautoryzowany dostęp" },
        { status: 401 }
      ),
    }
  }

  const service = createServiceClient()
  const { data: profile, error: profileError } = await service
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return {
      authed: null,
      error: NextResponse.json(
        { success: false, error: "Nie znaleziono profilu użytkownika" },
        { status: 403 }
      ),
    }
  }

  const userRole = profile.role as AppRole
  if (!allowedRoles.includes(userRole)) {
    return {
      authed: null,
      error: NextResponse.json(
        { success: false, error: "Brak uprawnień" },
        { status: 403 }
      ),
    }
  }

  return { authed: { user, role: userRole, profileId: profile.id }, error: null }
}
