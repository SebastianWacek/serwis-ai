// Pulpit: wszystkie zapytania SCOPE'OWANE do własnego portfela zalogowanego
// użytkownika, pobierane RÓWNOLEGLE (Promise.all), plus wyliczenie KPI.
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/api-auth"
import { todayStr, addDaysStr } from "@/lib/dates"

export async function GET() {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const supabase = createServiceClient()

    // Wszystkie granice liczone względem "dziś" w strefie Europe/Warsaw, aby
    // porównania dat były poprawne niezależnie od (UTC) strefy serwera.
    const today = todayStr()
    const in14Days = addDaysStr(today, 14)
    const in7Days = addDaysStr(today, 7)
    const expiredSince = addDaysStr(today, -30)

    // Scope: tylko klienci przypisani do zalogowanego użytkownika.
    const { data: myClients } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_id", auth.user.id)
    const clientIds = (myClients ?? []).map((c) => c.id)

    const emptyPayload = {
      success: true,
      tasks: { overdue: [], today: [] },
      expiring: [],
      kpi: { retention: null, active: 0, urgent: 0, overdue_tasks: 0, value_month: 0 },
    }
    if (clientIds.length === 0) return NextResponse.json(emptyPayload)

    // Zadania pochodzą tylko z OTWARTYCH rekordów — zamknięte nie mogą zalegać.
    const { data: myRecords } = await supabase
      .from("records")
      .select("id, status")
      .in("client_id", clientIds)
    const openRecordIds = (myRecords ?? [])
      .filter((r) => r.status === "Nowa" || r.status === "Potencjalna")
      .map((r) => r.id)
    // Bezpieczny sentinel, by puste .in() nigdy nie dopasowało wszystkiego.
    const recFilter = openRecordIds.length
      ? openRecordIds
      : ["00000000-0000-0000-0000-000000000000"]

    // Pobranie wszystkiego RÓWNOLEGLE (wszystko scope'owane do portfela).
    const [
      { data: pendingActions },
      { data: expiring },
      { data: allRecords },
      { count: overdueTasks },
    ] = await Promise.all([
      // 1) Niezrealizowane akcje (zaległe + dziś + najbliższe 7 dni) z joinem klienta
      supabase
        .from("planned_actions")
        .select(
          "id, action_type, scheduled_at, record_id, records(id, title, due_date, client_id, clients(id, full_name, profile_color, ai_hint, phone))"
        )
        .eq("is_completed", false)
        .in("record_id", recFilter)
        .lte("scheduled_at", `${in7Days}T23:59:59`)
        .order("scheduled_at", { ascending: true }),

      // 2) Rekordy z terminem w ciągu 14 dni (i do 30 dni po terminie)
      supabase
        .from("records")
        .select("id, title, due_date, client_id, clients(id, full_name)")
        .in("client_id", clientIds)
        .in("status", ["Nowa", "Potencjalna"])
        .lte("due_date", in14Days)
        .gte("due_date", expiredSince)
        .order("due_date", { ascending: true }),

      // 3) Wszystkie rekordy do wyliczeń KPI
      supabase
        .from("records")
        .select("id, status, due_date, value")
        .in("client_id", clientIds),

      // 4) Liczba zaległych zadań
      supabase
        .from("planned_actions")
        .select("id", { count: "exact", head: true })
        .eq("is_completed", false)
        .in("record_id", recFilter)
        .lt("scheduled_at", `${today}T00:00:00`),
    ])

    // --- KPI ---
    const active = (allRecords ?? []).filter(
      (r) => r.status === "Nowa" || r.status === "Potencjalna"
    )
    const urgent = active.filter(
      (r) => r.due_date && r.due_date <= in14Days && r.due_date >= today
    )

    // Retencja: Wygrana / (Wygrana + Odrzucona) wśród zamkniętych
    const closed = (allRecords ?? []).filter(
      (r) => r.status === "Wygrana" || r.status === "Odrzucona"
    )
    const won = closed.filter((r) => r.status === "Wygrana")
    const retention = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : null

    // Suma wartości wygranych rekordów
    const valueMonth = (allRecords ?? [])
      .filter((r) => r.status === "Wygrana" && r.value != null)
      .reduce((sum, r) => sum + Number(r.value), 0)

    // Grupowanie zadań: zaległe vs dziś
    const actions = pendingActions ?? []
    const overdue = actions.filter((a) => a.scheduled_at < `${today}T00:00:00`)
    const todayTasks = actions.filter(
      (a) => a.scheduled_at >= `${today}T00:00:00` && a.scheduled_at <= `${today}T23:59:59`
    )

    return NextResponse.json({
      success: true,
      tasks: { overdue, today: todayTasks },
      expiring: expiring ?? [],
      kpi: {
        retention,
        active: active.length,
        urgent: urgent.length,
        overdue_tasks: overdueTasks ?? 0,
        value_month: valueMonth,
      },
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Wystąpił błąd serwera" },
      { status: 500 }
    )
  }
}
