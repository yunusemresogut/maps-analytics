import { getRequestCaller } from "@/lib/server-auth";

// Ücretsiz katmanda modeller zaman zaman "yoğun talep" (503) ya da kota (429)
// döndürür; sırayla yedek modeller denenir. Kotalar model başına ayrıdır.
const GEMINI_MODELS = [
  ...new Set([
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
  ]),
];
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;
const MAX_CONTEXT_CHARS = 60000;

type ChatMessage = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `Sen "Maps Analytics" adlı mağaza ağı ve saha operasyonları uygulamasının asistanısın.
Kullanıcılar mağaza açılışlarını, proje durumlarını (Proje, İhale, Şantiye, Açılış, Hakediş, Fatura), iş planlarını, keşifleri (malzeme listeleri), sözleşmeleri, hakedişleri, faturaları ve tadilat taleplerini takip eder.

Kurallar:
- Her zaman Türkçe, kısa ve net cevap ver. Gerekirse madde işaretleri ve **kalın** vurgu kullan.
- Sayısal sorularda yalnızca aşağıdaki "Firma verisi" bölümüne dayan; veri yoksa bunu açıkça söyle, uydurma.
- "Malzeme" ile "keşif kalemi" aynı şeydir; kullanıcı hangisini derse desin keşif verisini kullan.
- Mağaza ve keşif kalemi adlarını büyük/küçük harf ve ek farklarına (örn. "Yunus Mağaza'sındaki") takılmadan eşleştir.
- Tutarları verideki kendi para birimiyle (TRY, USD, EUR, GBP, CHF) yaz; kur çevrimi yapma, farklı birimdeki tutarları toplamak yerine birim başına ayrı ver. Tarihleri gün ay yıl biçiminde yaz.
- Riskleri ve öncelikleri yorumlarken gerekçesini veriyle göster.
- Uygulamanın nasıl kullanılacağı sorulursa genel yönlendirme yap.`;

const ACTIONS_DISABLED_PROMPT = `# Kayıt ekleme
Bu firmada asistanla kayıt ekleme kapalı. Kullanıcı kayıt eklemek isterse bunu uygulamadaki ilgili sayfadan yapması gerektiğini söyle; asla \`\`\`action bloğu üretme.`;

const ACTIONS_PROMPT = `# Kayıt ekleme
Kullanıcı mağaza oluşturmak, ticket (tadilat talebi) açmak, bir mağazanın iş planına ya da keşfine (malzeme listesine) kalem eklemek isterse kaydı sen eklemezsin: bir öneri hazırlarsın, uygulama kullanıcıya önizleme gösterir ve kullanıcı onaylarsa ekler.
- Önce 1-2 cümleyle ne hazırladığını ve varsaydığın değerleri söyle, ardından mesajın EN SONUNA tek bir \`\`\`action kod bloğu koy. Bloğun içi yalnızca geçerli JSON olsun: {"actions":[...]}.
- Zorunlu bilgi eksikse blok koyma; eksik bilgileri kısa bir soruyla iste. Zorunlu olmayan alanlara makul varsayılanlar verebilirsin.
- Kaydın eklendiğini asla söyleme; "onaylarsanız eklenecek" de. Onaydan sonraki durum sohbette [Sistem: ...] notuyla bildirilir.
- Tarihler YYYY-MM-DD biçiminde. "Yarın", "gelecek ay" gibi göreli tarihleri "Bugün" bilgisine göre hesapla.
- storeName için Firma verisindeki mağaza adını aynen yaz. Yalnızca mevcut mağazalara kalem eklenebilir; aynı blokta yeni oluşturulacak mağazaya kalem ekleme, önce mağazanın oluşturulmasını öner.
- Silme ve güncelleme desteklenmez; istenirse bunun uygulamadan yapılması gerektiğini söyle.
- Kullanıcı birden fazla şey isterse aynı blokta en fazla 5 eylem olabilir.

Eylem şemaları (? işaretli alanlar isteğe bağlı):
- {"type":"create_store","name":"…","city":"…","address":"… (haritada bulunabilecek açık adres)","openingDate":"YYYY-MM-DD","projectStatus?":"proje|ihale|santiye|acilis|hakedis|fatura","locationType?":"avm|cadde|outdoor","grossM2?":0,"floorCount?":1,"totalBudget?":0,"budgetCurrency?":"TRY|USD|EUR|GBP|CHF","contractorCompany?":"…","siteManager?":"…","phone?":"…"}
  Zorunlu: name, city, address, openingDate.
- {"type":"create_ticket","title":"…","description?":"…","priority?":"low|medium|high","storeName?":"…"}
  Zorunlu: title.
- {"type":"add_work_plan","storeName":"…","items":[{"description":"…","startDate":"YYYY-MM-DD","endDate?":"YYYY-MM-DD","responsible?":"…","status?":"yapilacak|devam_ediyor|tamamlandi","percentComplete?":0}]}
  Zorunlu: storeName, her kalemde description ve startDate.
- {"type":"add_materials","storeName":"…","items":[{"pozNo?":"…","name":"…","quantity":1,"unit?":"adet","unitPrice?":0,"currency?":"TRY|USD|EUR|GBP|CHF"}]}
  Zorunlu: storeName, her kalemde name ve quantity (> 0). Birim fiyat bilinmiyorsa sor ya da 0 bırakıp belirt.`;

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
  // Yalnızca giriş yapmış, aktif oturumu olan kullanıcılar: API anahtarının kötüye kullanımını önler
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;

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
  const { messages, context, allowActions } = (body ?? {}) as {
    messages?: unknown;
    context?: unknown;
    allowActions?: unknown;
  };
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

  const requestBody = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text: `${SYSTEM_PROMPT}\n\n${allowActions === false ? ACTIONS_DISABLED_PROMPT : ACTIONS_PROMPT}\n\n# Firma verisi\n${contextText || "Veri yok."}`,
        },
      ],
    },
    contents: history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    // Uzun keşif/iş planı listeleri action bloğuna sığsın diye
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
  });

  let geminiResponse: Response | null = null;
  let lastStatus = 0;
  attempts: for (const model of GEMINI_MODELS) {
    // Her model için bir kez kısa beklemeyle yeniden dene
    for (let attempt = 0; attempt < 2; attempt++) {
      if (request.signal.aborted) return errorResponse("İstek iptal edildi.", 499);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: requestBody,
          signal: request.signal,
        }
      );
      if (response.ok && response.body) {
        geminiResponse = response;
        break attempts;
      }
      lastStatus = response.status;
      const detail = await response.text().catch(() => "");
      console.error("Gemini isteği başarısız", model, response.status, detail.slice(0, 300));
      if (!RETRYABLE_STATUSES.has(response.status)) break attempts;
      // Kota dolduysa aynı modeli tekrar denemenin anlamı yok
      if (response.status === 429) break;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  if (!geminiResponse?.body) {
    if (lastStatus === 429) {
      return errorResponse("Ücretsiz kullanım limiti doldu. Bir süre sonra tekrar deneyin.", 429);
    }
    if (lastStatus === 400 || lastStatus === 403 || lastStatus === 404) {
      return errorResponse("Asistan yapılandırması geçersiz. API anahtarını kontrol edin.", 502);
    }
    if (lastStatus === 503 || lastStatus === 500 || lastStatus === 504) {
      return errorResponse(
        "Yapay zekâ servisi şu anda çok yoğun. Birkaç saniye sonra tekrar deneyin.",
        503
      );
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
