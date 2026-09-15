-- ============================================================
-- Włączenie RLS na wszystkich tabelach schematu public.
-- ============================================================
-- Dynamiczne — NIE odwołuje się do żadnej sztywnej nazwy kolumny,
-- więc błąd "column does not exist" jest niemożliwy.
--
-- Jak działa:
--  1) Włącza RLS na KAŻDEJ tabeli w schemacie public.
--  2) Jeśli tabela ma kolumnę user_id LUB owner_id → dodaje politykę
--     "właściciel widzi swoje" (dla roli authenticated).
--  3) Tabele bez takiej kolumny dostają RLS bez polityki = dostęp tylko
--     przez service_role (którego używa backend). Aplikacja działa dalej.
--
-- Bezpieczne do wielokrotnego uruchomienia (DROP POLICY IF EXISTS).
-- ============================================================

DO $$
DECLARE
  r          record;
  owner_col  text;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    -- 1) Włącz RLS (idempotentne, nie rusza danych)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);

    -- 2) Wykryj kolumnę właściciela (preferuj user_id, potem owner_id)
    SELECT column_name INTO owner_col
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = r.tablename
      AND column_name  IN ('user_id', 'owner_id')
    ORDER BY CASE column_name WHEN 'user_id' THEN 1 WHEN 'owner_id' THEN 2 END
    LIMIT 1;

    -- 3) Dodaj politykę właściciela, jeśli jest po czym scope'ować
    IF owner_col IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "owner_all" ON public.%I', r.tablename);
      EXECUTE format(
        'CREATE POLICY "owner_all" ON public.%I FOR ALL TO authenticated '
        || 'USING (%I = auth.uid()) WITH CHECK (%I = auth.uid())',
        r.tablename, owner_col, owner_col
      );
    END IF;
  END LOOP;
END $$;

-- Weryfikacja: stan RLS dla wszystkich tabel public
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
