// Guardy własności dla tras operujących na pojedynczym rekordzie (GET/PATCH/DELETE by id).
// Endpointy listujące scope'ują zapytania same; te guardy zamykają lukę IDOR,
// w której zalogowany doradca mógłby dotknąć cudzego klienta/rekordu, zgadując id.
//
// Semantyka ról (rozdzielenie obowiązków):
//   Doradca         → odczyt+zapis, ale tylko we własnym portfelu
//   Menedżer      → odczyt+zapis wszędzie (rola nadzoru biznesowego)
//   Administrator → odczyt wszędzie, ale BEZ zapisu danych klientów
//                   (administrator zarządza kontami, nie danymi klientów)

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppRole } from "@/lib/api-auth"

export type AccessIntent = "read" | "write"

function roleAllows(role: AppRole, intent: AccessIntent): boolean | null {
  if (role === "Menedżer") return true
  if (role === "Administrator") return intent === "read"
  return null // Doradca → rozstrzyga własność poniżej
}

export async function canAccessClient(
  supabase: SupabaseClient,
  role: AppRole,
  userId: string,
  clientId: string | null | undefined,
  intent: AccessIntent = "read"
): Promise<boolean> {
  const byRole = roleAllows(role, intent)
  if (byRole !== null) return byRole
  if (!clientId) return false
  const { data } = await supabase
    .from("clients")
    .select("owner_id")
    .eq("id", clientId)
    .single()
  return data?.owner_id === userId
}

// Rekord (np. sprawa/zgłoszenie) należy do klienta — dostęp dziedziczy po kliencie.
export async function canAccessRecord(
  supabase: SupabaseClient,
  role: AppRole,
  userId: string,
  recordId: string | null | undefined,
  intent: AccessIntent = "read"
): Promise<boolean> {
  const byRole = roleAllows(role, intent)
  if (byRole !== null) return byRole
  if (!recordId) return false
  const { data: record } = await supabase
    .from("records")
    .select("client_id")
    .eq("id", recordId)
    .single()
  if (!record?.client_id) return false
  return canAccessClient(supabase, "Doradca", userId, record.client_id, intent)
}
