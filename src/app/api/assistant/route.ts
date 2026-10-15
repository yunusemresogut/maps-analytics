import { createClient } from "@supabase/supabase-js";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 60000;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Sen "Maps Analytics" adlı mağaza ağı ve saha operasyonları uygulamasının asistanısın.
Kullanıcılar mağaza açılışlarını, proje durumlarını (Proje, İhale, Şantiye, Açılış, Hakediş, Fatura), iş planlarını, malzemeleri, sözleşmeleri, hakedişleri, faturaları ve tadilat taleplerini takip eder.

Kurallar:
- Her zaman Türkçe, kısa ve net cevap ver. Gerekirse madde işaretleri ve **kalın** vurgu kullan.
- Sayısal sorularda yalnızca aşağıdaki "Firma verisi" bölümüne dayan; veri yoksa bunu açıkça söyle, uydurma.
- Tutarları TRY olarak, tarihleri gün ay yıl biçiminde yaz.
- Riskleri ve öncelikleri yorumlarken gerekçesini veriyle göster.
- Uygulamanın nasıl kullanılacağı sorulursa genel yönlendirme yap.`;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0
  );
}

export async function POST(request: Request) {
  // Yalnızca giriş yapmış kullanıcılar: API anahtarının kötüye kullanımını önler
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return errorResponse("Oturum bulunamadı.", 401);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return errorResponse("Oturum geçersiz.", 401);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return errorResponse("Asistan henüz yapılandırılmadı (GEMINI_API_KEY eksik).", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Geçersiz istek.", 400);
  }
  const { messages, context } = (body ?? {}) as { messages?: unknown; context?: unknown };
  if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isChatMessage)) {
    return errorResponse("Mesaj bulunamadı.", 400);
  }
  const history = messages
    .slice(-MAX_MESSAGES)
    .map((message) => ({ ...message, content: message.content.slice(0, MAX_MESSAGE_CHARS) }));
  if (history[history.length - 1].role !== "user") {
    return errorResponse("Son mesaj kullanıcıdan gelmeli.", 400);
  }
  const contextText = typeof context === "string" ? context.slice(0, MAX_CONTEXT_CHARS) : "";

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\n# Firma verisi\n${contextText || "Veri yok."}` }],
        },
        contents: history.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      }),
      signal: request.signal,
    }
  );

  if (!geminiResponse.ok || !geminiResponse.body) {
    const detail = await geminiResponse.text().catch(() => "");
    console.error("Gemini isteği başarısız", geminiResponse.status, detail.slice(0, 500));
    if (geminiResponse.status === 429) {
      return errorResponse("Ücretsiz kullanım limiti doldu. Bir süre sonra tekrar deneyin.", 429);
    }
    if (geminiResponse.status === 400 || geminiResponse.status === 403) {
      return errorResponse("Asistan yapılandırması geçersiz. API anahtarını kontrol edin.", 502);
    }
    return errorResponse("Asistan şu anda yanıt veremiyor. Lütfen tekrar deneyin.", 502);
  }

  // Gemini SSE akışını düz metin akışına çevir
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const stream = geminiResponse.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith("data:")) continue;
            try {
              const payload = JSON.parse(line.slice(5).trim());
              const text = (payload?.candidates?.[0]?.content?.parts ?? [])
                .map((part: { text?: string; thought?: boolean }) => (part.thought ? "" : part.text ?? ""))
                .join("");
              if (text) controller.enqueue(encoder.encode(text));
            } catch {
              // Yarım kalmış satır: bir sonraki parçada tamamlanır
            }
          }
        }
      },
    })
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
