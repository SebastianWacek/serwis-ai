// Wyliczanie zakresu widoczności danych na podstawie roli — używane przez
// powierzchnie zespołowe (raporty) i osobiste (kalendarz, wiadomości).
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AppRole } from "@/lib/api-auth"

/**
 * Zakres ZESPOŁOWY — tylko dla RAPORTÓW (widok nadzoru menedżera):
 *   "all"    → Administrator (cała organizacja)
 *   string[] → Menedżer (on + doradcy przypisani przez users.manager_id) lub Doradca (on sam)
 *
 * UWAGA: osobiste powierzchnie pracy (lista klientów, pulpit, kalendarz) tego
 * NIE używają — tam każdy nie-admin widzi wyłącznie SWOICH klientów.
 */
export async function teamMemberIds(
  supabase: SupabaseClient,
  role: AppRole,
  userId: string,
): Promise<"all" | string[]> {
  if (role === "Administrator") return "all"
  if (role === "Menedżer") {
    const { data: team } = await supabase
      .from("users")
      .select("id")
      .eq("manager_id", userId)
    return [userId, ...(team ?? []).map((u) => u.id)]
  }
  return [userId] // Doradca
}

/**
 * Rozstrzyga, które rekordy widzi użytkownik na powierzchniach OSOBISTYCH.
 * Wszyscy poza Administratorem są ograniczeni do WŁASNEGO portfela.
 *
 * Zwraca:
 *   "all"    → brak filtra (Administrator)
 *   string[] → ogranicz zapytania do tych id
 *   null     → nic w zakresie → wywołujący powinien zwrócić pusty wynik
 */
export async function scopedRecordIds(
  supabase: SupabaseClient,
  role: AppRole,
  userId: string,
): Promise<"all" | string[] | null> {
  if (role === "Administrator") return "all"

  const { data: myClients } = await supabase
    .from("clients")
    .select("id")
    .eq("owner_id", userId)
  const clientIds = (myClients ?? []).map((c) => c.id)
  if (clientIds.length === 0) return null

  const { data: records } = await supabase
    .from("records")
    .select("id")
    .in("client_id", clientIds)
  const recordIds = (records ?? []).map((r) => r.id)
  if (recordIds.length === 0) return null

  return recordIds
}
