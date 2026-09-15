// Ekran pulpitu (Client Component): pobranie danych z /api/dashboard, stan
// ładowania, wyliczone KPI i lista zadań "zaległe / dziś". UI uproszczone do
// czystego JSX + Tailwind, aby fragment był samowystarczalny.
"use client"

import { useCallback, useEffect, useState } from "react"

interface TaskAction {
  id: string
  action_type: string
  scheduled_at: string
  records: {
    title: string | null
    due_date: string | null
    clients: { full_name: string; profile_color: string | null; ai_hint: string | null } | null
  } | null
}

interface DashboardData {
  tasks: { overdue: TaskAction[]; today: TaskAction[] }
  kpi: {
    retention: number | null
    active: number
    urgent: number
    overdue_tasks: number
    value_month: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? "Błąd pobierania")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nieznany błąd")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="p-6 text-sm text-neutral-500">Ładowanie pulpitu...</p>
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>
  if (!data) return null

  const { kpi, tasks } = data

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Retencja" value={kpi.retention != null ? `${kpi.retention}%` : "—"} />
        <Kpi label="Aktywne" value={kpi.active} />
        <Kpi label="Pilne (14 dni)" value={kpi.urgent} />
        <Kpi label="Zaległe zadania" value={kpi.overdue_tasks} />
      </section>

      <TaskList title="Zaległe" tasks={tasks.overdue} tone="overdue" />
      <TaskList title="Na dziś" tasks={tasks.today} tone="today" />
    </main>
  )
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}

function TaskList({ title, tasks, tone }: { title: string; tasks: TaskAction[]; tone: "overdue" | "today" }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-neutral-400">Brak zadań.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                tone === "overdue" ? "border-red-200 dark:border-red-900/40" : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div>
                <span className="font-medium">{t.records?.clients?.full_name ?? "—"}</span>
                <span className="ml-2 text-neutral-500">{t.action_type}</span>
                {t.records?.clients?.ai_hint && (
                  <p className="text-xs text-neutral-400">{t.records.clients.ai_hint}</p>
                )}
              </div>
              <time className="text-xs text-neutral-500">
                {new Date(t.scheduled_at).toLocaleDateString("pl-PL")}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
