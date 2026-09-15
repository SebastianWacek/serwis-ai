// Profiler behawioralny klienta — STRUKTURYZOWANE wyjście AI (generateObject +
// schemat Zod). Na podstawie obserwacji doradcy zwraca typ osobowości (model
// DISC) i jedną praktyczną wskazówkę do rozmowy.
import { generateObject } from "ai"
import { requireAuth } from "@/lib/api-auth"
import { structuredModel } from "@/lib/ai"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

interface ProfilerRequest {
  answers: {
    communicationStyle: string
    priority: string
    decisionTempo: string
    objectionReaction: string
  }
  clientName: string
}

const resultSchema = z.object({
  profileType: z.enum(["Czerwony", "Żółty", "Zielony", "Niebieski"]),
  tip: z.string().describe("Jednozdaniowa praktyczna wskazówka dla doradcy"),
})

const SYSTEM_PROMPT = `Jesteś ekspertem od analizy osobowości według modelu DISC w kontekście sprzedaży i obsługi klienta.

Na podstawie obserwacji doradcy dotyczących klienta:
1. Określ dominujący typ osobowości: Czerwony (Dominujący), Żółty (Inspirujący), Zielony (Wspierający) lub Niebieski (Analityczny)
2. Wygeneruj JEDNĄ krótką, praktyczną wskazówkę, jak najlepiej rozmawiać z tym klientem

Charakterystyka typów:
- CZERWONY (Dominujący): zorientowany na cel, szybkie decyzje, konkretny, niecierpliwy, ceni efektywność
- ŻÓŁTY (Inspirujący): towarzyski, entuzjastyczny, emocjonalny, lubi nowości, potrzebuje uznania
- ZIELONY (Wspierający): lojalny, cierpliwy, ostrożny, ceni bezpieczeństwo i relacje, potrzebuje czasu
- NIEBIESKI (Analityczny): dokładny, logiczny, potrzebuje danych i szczegółów, metodyczny, sceptyczny`

export async function POST(request: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error

  try {
    const body: ProfilerRequest = await request.json()
    const { answers } = body
    // clientName celowo NIE trafia do modelu — wystarczą 4 obserwacje
    // behawioralne, tożsamość klienta nie jest potrzebna.

    const userPrompt = `Obserwacje doradcy dotyczące klienta:

1. Styl komunikacji: ${answers.communicationStyle}
2. Priorytet klienta: ${answers.priority}
3. Tempo podejmowania decyzji: ${answers.decisionTempo}
4. Reakcja na obiekcje/wątpliwości: ${answers.objectionReaction}

Na podstawie tych obserwacji określ typ osobowości i podaj wskazówkę.`

    const { object } = await generateObject({
      model: structuredModel,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      schema: resultSchema,
      temperature: 0.3,
    })

    return NextResponse.json({
      success: true,
      profileType: object.profileType,
      tip: object.tip,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd"
    return NextResponse.json(
      { success: false, error: `Nie udało się przeanalizować profilu: ${message}` },
      { status: 500 }
    )
  }
}
