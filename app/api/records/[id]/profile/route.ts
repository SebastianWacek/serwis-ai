// Trasa item-level: rola (RBAC) + guard własności (IDOR) + zapis do bazy.
// Zapisuje wynik profilera behawioralnego na karcie klienta.
import { createServiceClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/api-auth"
import { canAccessClient } from "@/lib/ownership"
import { NextRequest, NextResponse } from "next/server"

interface UpdateProfileRequest {
  profileColor: "Czerwony" | "Żółty" | "Zielony" | "Niebieski"
  aiHint: string
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(["Doradca", "Menedżer", "Administrator"])
  if (auth.error) return auth.error
  const { authed } = auth

  try {
    const { id } = await params

    // Własność: doradca może profilować wyłącznie własnych klientów.
    const service = createServiceClient()
    if (!(await canAccessClient(service, authed.role, authed.user.id, id, "write"))) {
      return NextResponse.json(
        { success: false, error: "Brak dostępu do tego klienta" },
        { status: 403 }
      )
    }

    const body: UpdateProfileRequest = await request.json()
    const { profileColor, aiHint } = body
    if (!profileColor || !aiHint) {
      return NextResponse.json(
        { success: false, error: "Typ profilu i wskazówka są wymagane" },
        { status: 400 }
      )
    }

    const { error } = await service
      .from("clients")
      .update({ profile_color: profileColor, ai_hint: aiHint })
      .eq("id", id)

    if (error) {
      return NextResponse.json(
        { success: false, error: "Nie udało się zaktualizować profilu klienta" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: "Wystąpił błąd serwera" },
      { status: 500 }
    )
  }
}
