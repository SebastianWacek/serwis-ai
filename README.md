# Serwis AI — wybrane wzorce implementacyjne (SaaS + AI)

Zestaw **zanonimizowanych fragmentów kodu** z komercyjnej aplikacji SaaS klasy CRM
z warstwą AI, którą zaprojektowałem i wdrożyłem end-to-end (frontend, backend,
baza danych, integracje, wdrożenie produkcyjne).

To **nie jest pełna aplikacja** — to celowo dobrany przekrój pokazujący *sposób
implementacji*: połączenie z bazą danych, model uprawnień i bezpieczeństwo,
integracje z LLM oraz strukturę ekranów. Nazwy domenowe zostały zneutralizowane,
a wszelkie dane klientów, sekrety i identyfikatory firmowe usunięte.

> **Kontekst:** oryginalny system jest objęty poufnością. Publikuję jedynie
> wzorce architektoniczne i własny styl implementacji — bez logiki biznesowej
> specyficznej dla klienta, bez danych i bez konfiguracji produkcyjnej.

---

## Co pokazuje ten kod

| Obszar | Plik(i) | Co demonstruje |
|---|---|---|
| **Połączenie z bazą (Supabase)** | `lib/supabase/server.ts`, `client.ts` | klient serwerowy (SSR, cookies) + klient service-role omijający RLS |
| **Uwierzytelnianie i sesja** | `lib/supabase/middleware.ts`, `middleware.ts` | odświeżanie sesji w middleware, bramkowanie tras, wymuszenie MFA (aal1→aal2) |
| **RBAC + role** | `lib/api-auth.ts` | `requireAuth` / `requireRole`, rozdzielenie obowiązków (Doradca / Menedżer / Administrator) |
| **Ochrona przed IDOR** | `lib/ownership.ts` | guardy własności na poziomie rekordu (doradca dotyka tylko swojego portfela) |
| **Zapytania scope'owane rolą** | `app/api/dashboard/route.ts`, `lib/action-scope.ts` | równoległe zapytania ograniczone do portfela użytkownika, wyliczanie KPI |
| **Item-route z guardem** | `app/api/records/[id]/profile/route.ts` | rola + własność + zapis do bazy |
| **AI: structured outputs** | `app/api/behavioral-profiler/route.ts`, `lib/ai.ts` | `generateObject` (JSON schema, Zod), dobór modeli Groq |
| **Anonimizacja PII przed AI** | `lib/anonymize.ts` | redakcja danych osobowych (PESEL, NIP, telefon, e-mail, IBAN, nazwiska) przed wysyłką do modelu |
| **Baza danych + RLS** | `db/schema.sql`, `db/rls-policies.sql` | reprezentatywny schemat i dynamiczne włączenie Row Level Security |
| **Ekran (Server/Client)** | `app/dashboard/page.tsx` | pobieranie danych z API, stany ładowania, render listy zadań |

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · Supabase (PostgreSQL, Auth, RLS)
· Vercel · Groq API (LLM) · Vercel AI SDK · Zod · PWA / Web Push

## Uruchomienie (opcjonalnie)

Kod jest referencyjny — nie zawiera pełnego UI ani danych. Aby podłączyć do
własnego projektu Supabase:

```bash
cp .env.example .env.local   # uzupełnij własnymi kluczami
pnpm install
pnpm dev
```

Schemat i polityki RLS znajdziesz w `db/`.

---

Autor: **Sebastian Wacek** — Fullstack / Frontend Developer
