// Jedno źródło prawdy dla logiki "data względem dziś". Wartości date-only w tej
// aplikacji (terminy) to dni kalendarzowe, nie chwile — naiwne
// `new Date("2026-07-03")` (parsowane jako UTC-północ) dryfuje o dzień przy
// porównaniu z lokalnym `new Date()`. Tutaj wszystko jest przypięte do
// Europe/Warsaw i liczone jako czysta matematyka dni (obie strony kotwiczone do
// UTC-północy), więc wynik jest identyczny na serwerze (Vercel = UTC) i w przeglądarce.

export const APP_TZ = "Europe/Warsaw"

// "YYYY-MM-DD" dla dziś, w strefie aplikacji (en-CA formatuje jako ISO date).
export function todayStr(tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

// Kanoniczny timestamp dnia kalendarzowego (UTC-północ) — przyjmuje date-only lub ISO.
function ymdToTs(value: string): number {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number)
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1)
}

// Pełne dni od dziś do daty: >0 przyszłość, <0 przeszłość, 0 dziś. null jeśli brak daty.
export function daysUntil(dateStr: string | null | undefined, tz: string = APP_TZ): number | null {
  if (!dateStr) return null
  return Math.round((ymdToTs(dateStr) - ymdToTs(todayStr(tz))) / 86_400_000)
}

// Dodaj (lub odejmij) pełne dni do "YYYY-MM-DD", zwracając "YYYY-MM-DD".
export function addDaysStr(base: string, days: number): string {
  const [y, m, d] = base.slice(0, 10).split("-").map(Number)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export function isPast(dateStr: string | null | undefined): boolean {
  const d = daysUntil(dateStr)
  return d != null && d < 0
}

export function isToday(dateStr: string | null | undefined): boolean {
  return daysUntil(dateStr) === 0
}

// Poprawna polska odmiana "dzień/dni".
function dniWord(n: number): string {
  return n === 1 ? "dzień" : "dni"
}

// Krótka etykieta na badge: "dziś" | "za N dni" | "N dni temu".
export function dueBadge(dateStr: string | null | undefined): string {
  const d = daysUntil(dateStr)
  if (d === null) return "—"
  if (d === 0) return "dziś"
  if (d > 0) return `za ${d} ${dniWord(d)}`
  return `${Math.abs(d)} ${dniWord(Math.abs(d))} temu`
}
