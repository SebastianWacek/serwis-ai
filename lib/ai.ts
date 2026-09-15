// Centralny dobór modeli AI dla aplikacji. Zmiana dostawcy/modelu wymaga
// edycji tylko w tym pliku.
import { groq } from "@ai-sdk/groq"

// Model do funkcji ze STRUKTURYZOWANYM wyjściem (JSON schema): profiler
// behawioralny, ekstrakcja danych z dokumentów (OCR), generatory wariantów.
// gpt-oss-120b (Groq) wspiera json_schema, na którym opiera się generateObject.
export const structuredModel = groq("openai/gpt-oss-120b")

// Model konwersacyjny dla asystenta (czat). Celowo mniejszy i szybki
// (llama-3.1-8b-instant): czat to najwyższy wolumen zapytań, a mniejszy model
// ma wyższe limity i niższy koszt, więc nie zagładza generatorów strukturalnych.
export const chatModel = groq("llama-3.1-8b-instant")
