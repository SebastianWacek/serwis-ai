// Heurystyczna redakcja polskich danych osobowych (PII) w tekście wolnym /
// dokumentach ZANIM zostaną wysłane do zewnętrznego modelu AI.
//
// UCZCIWA UWAGA: redakcja oparta o wyrażenia regularne to mocna PIERWSZA
// warstwa dla danych ustrukturyzowanych (PESEL, NIP, daty, telefon, e-mail,
// IBAN, nr dowodu, kod pocztowy) i nazwisk zakotwiczonych etykietą, ale nie
// gwarantuje usunięcia każdego fragmentu imienia/nazwiska. Dlatego docelowo
// UI pokazuje zredagowany tekst do zatwierdzenia przez użytkownika przed
// wysyłką — ta funkcja to obrona w głąb (defense-in-depth), nie substytut
// tego przeglądu.

// Etykiety pól, po których zwykle występuje imię i nazwisko osoby.
const LABEL_NAME_FIELDS = [
  "Klient", "Właściciel", "Współwłaściciel", "Posiadacz", "Użytkownik",
  "Imię i nazwisko", "Nazwisko i imię", "Kontrahent", "Przedstawiciel",
  "Pełnomocnik", "Sprzedawca", "Kupujący", "Zgłaszający",
]

// Częste końcówki polskich nazwisk — heurystyka o umiarkowanej pewności,
// łapie pary "Imię Nazwisko" bez rozpoznawalnej etykiety. Skróty pisane
// wielkimi literami nie pasują (wymagany Titlecase). Wiele realnych nazwisk
// (np. "Wacek", "Nowak", "Kowal") nie pasuje do żadnego z tych wzorców —
// dlatego istnieje niezależny wyzwalacz COMMON_FIRST_NAMES poniżej.
const SURNAME_SUFFIX = /(ski|cki|dzki|ska|cka|dzka|wicz|owicz|ewicz|czyk|czak|iak|ak|ek|yk|ik|uk|czuk|ko)$/i

// Częste polskie imiona (lista skrócona, przykładowa). Zbiór imion jest o
// wiele mniejszy i bardziej domknięty niż nazwisk, więc to pewniejsza
// kotwica: "Sebastian Wacek" zostanie złapane tutaj (Sebastian jest znany),
// mimo że "Wacek" nie pasuje do żadnej końcówki nazwiska powyżej.
const COMMON_FIRST_NAMES = new Set([
  "jan", "piotr", "andrzej", "krzysztof", "tomasz", "paweł", "marek", "marcin",
  "michał", "grzegorz", "jerzy", "adam", "tadeusz", "wojciech", "łukasz",
  "mariusz", "rafał", "sebastian", "jacek", "robert", "artur", "damian",
  "radosław", "przemysław", "sławomir", "karol", "dawid", "filip", "kamil",
  "patryk", "maciej", "szymon", "bartosz", "bartłomiej", "roman", "jakub",
  "mateusz", "konrad", "hubert", "emil", "oskar", "aleksander",
  "anna", "maria", "katarzyna", "małgorzata", "agnieszka", "barbara", "ewa",
  "joanna", "magdalena", "monika", "aleksandra", "beata", "dorota", "marta",
  "karolina", "paulina", "natalia", "sylwia", "alicja", "julia", "zuzanna",
  "emilia", "klaudia", "patrycja", "izabela", "gabriela", "ewelina",
])

export function anonymizeText(text: string): string {
  let out = text

  // --- Nazwiska zakotwiczone etykietą: "Klient: Jan Kowalski" ---
  const labelPattern = new RegExp(
    `\\b(${LABEL_NAME_FIELDS.join("|")})\\s*[:\\-]?\\s*([A-ZŁŚŻŹĆŃÓĘĄ][\\p{L}'-]+(?:\\s+[A-ZŁŚŻŹĆŃÓĘĄ][\\p{L}'-]+){1,2})`,
    "gu"
  )
  out = out.replace(labelPattern, (_m, label) => `${label}: [USUNIĘTO-DANE OSOBOWE]`)

  // --- Pary "Imię Nazwisko" — redakcja, gdy pierwszy człon to znane imię
  //     LUB drugi wygląda na nazwisko. ---
  out = out.replace(
    /\b([A-ZŁŚŻŹĆŃÓĘĄ][\p{Ll}]+)\s+([A-ZŁŚŻŹĆŃÓĘĄ][\p{Ll}]+)\b/gu,
    (m, first, second) => {
      const isKnownFirstName = COMMON_FIRST_NAMES.has(first.toLowerCase())
      const looksLikeSurname = SURNAME_SUFFIX.test(second)
      return isKnownFirstName || looksLikeSurname ? "[USUNIĘTO-DANE OSOBOWE]" : m
    }
  )

  // --- IBAN / nr konta — przed PESEL, by 26-cyfrowy nr konta nie został
  //     pomylony z 11-cyfrowym PESEL-em. ---
  out = out.replace(/\bPL\s?\d{2}(\s?\d{4}){6}\b/gi, "[USUNIĘTO-KONTO]")
  out = out.replace(/\b\d{2}(\s?\d{4}){6}\b/g, "[USUNIĘTO-KONTO]")

  // --- PESEL — 11 cyfr ---
  out = out.replace(/\bPESEL[:\s]*\d{11}\b/gi, "PESEL: [USUNIĘTO]")
  out = out.replace(/\b\d{11}\b/g, "[USUNIĘTO-PESEL]")

  // --- NIP — 10 cyfr (opcjonalnie z myślnikami) ---
  out = out.replace(/\bNIP[:\s]*[\d\-]{10,13}\b/gi, "NIP: [USUNIĘTO]")
  out = out.replace(/\b\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}\b/g, "[USUNIĘTO-NIP]")

  // --- Dowód osobisty: 3 litery + 6 cyfr ---
  out = out.replace(/\b[A-Z]{3}\s?\d{6}\b/g, "[USUNIĘTO-DOWÓD]")

  // --- Kod pocztowy (XX-XXX) ---
  out = out.replace(/\b\d{2}-\d{3}\b/g, "[KOD-POCZTOWY]")

  // --- Daty — dd.mm.yyyy, dd-mm-yyyy, dd/mm/yyyy, yyyy-mm-dd ---
  out = out.replace(/\b\d{2}[.\-\/]\d{2}[.\-\/]\d{4}\b/g, "[DATA]")
  out = out.replace(/\b\d{4}[-\/]\d{2}[-\/]\d{2}\b/g, "[DATA]")

  // --- Telefon (formaty PL) — dwa osobne wzorce zamiast jednego z opcjonalnym
  //     prefiksem, by "+48" (jednoznaczny marker) nie wymagał kotwicy \b, a
  //     forma "gołych" cyfr dopasowywała się tylko na granicy tokenu. ---
  out = out.replace(/\+48[ \-]?(\d[ \-]?){9}\b/g, "[TELEFON]")
  out = out.replace(/\b(\d[ \-]?){9}\b/g, "[TELEFON]")

  // --- E-mail ---
  out = out.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[EMAIL]")

  // --- Adresy — linie z ul./al./os./pl. + nazwa + numer ---
  out = out.replace(/\b(ul\.|al\.|os\.|pl\.)\s+[^\n,]{3,40},?\s*\d+[a-zA-Z]?\s*(\/\s*\d+[a-zA-Z]?)?\b/gi, "[ADRES]")

  return out
}

// Maksymalna liczba znaków realnie wysyłana do modelu — krok "skanu"
// przycina tekst do tej długości, by podgląd zatwierdzany przez użytkownika
// odpowiadał realnemu payloadowi.
export const TEXT_LIMIT = 8000
