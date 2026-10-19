"use client";

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, ChevronDown, RotateCcw, Sparkles, Square } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { useSettings } from "@/contexts/settings-context";
import { nextTicketCode } from "@/lib/module-codes";
import { useModules } from "@/contexts/modules-context";
import { useStoreData } from "@/contexts/store-data-context";
import { useStores } from "@/contexts/stores-context";
import {
  ActionPreviewCard,
  type ActionProposal,
  type ActionResult,
} from "@/components/assistant/action-preview-card";
import {
  buildActionPreviews,
  extractActions,
  stripActionBlock,
  type ResolvedAction,
} from "@/lib/assistant-actions";
import {
  MAX_ITEMS_PER_STORE,
  buildAssistantContext,
  pickDetailStores,
  type StoreDetails,
} from "@/lib/assistant-context";
import { fetchStoreMaterialsPreview, fetchStoreWorkPlanPreview } from "@/lib/store-details";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";
import { apiFetch } from "@/lib/api-client";
import { searchAddresses } from "@/lib/geocode";
import { useHorizontalDrag } from "@/hooks/use-horizontal-drag";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  /** Cevapta kayıt ekleme önerisi varsa önizleme ve onay durumu */
  proposal?: ActionProposal;
};

const SUGGESTIONS = [
  "Genel durumu özetle",
  "Önümüzdeki 30 günde açılacak mağazalar hangileri?",
  "Açılış tarihi geçmiş mağazalar var mı?",
  "Hakediş ve fatura durumunu yorumla",
  "Riskli projeleri ve önerilerini listele",
  "Yeni bir ticket aç",
  "Bir mağazanın keşfine malzeme ekle",
];

/** Modelin önceki önerilerin akıbetini bilmesi için geçmişe eklenen not */
function historyContent(message: ChatMessage): string {
  const proposal = message.proposal;
  if (!proposal) return message.content;
  let note = "Bu öneri onaylanmadı; hiçbir kayıt eklenmedi.";
  if (proposal.status === "done") {
    note = `Kullanıcı onayladı. Sonuç: ${(proposal.results ?? []).map((result) => result.label).join("; ")}`;
  } else if (proposal.previews.some((preview) => preview.errors.length > 0)) {
    note = `Öneri uygulanamadı: ${proposal.previews.flatMap((preview) => preview.errors).join(" ")}`;
  }
  return `${message.content}\n\n[Sistem: ${note}]`;
}

async function geocode(query: string) {
  try {
    const [first] = await searchAddresses(query);
    return first ?? null;
  } catch {
    return null;
  }
}

/** **kalın** vurgularını işler */
function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-zinc-100">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

/** Asistan cevapları için hafif markdown: başlık, madde ve numaralı liste */
function MessageContent({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const ListTag = list.ordered ? "ol" : "ul";
    blocks.push(
      <ListTag
        key={blocks.length}
        className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}
      >
        {list.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ListTag>
    );
    list = null;
  };

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    blocks.push(
      heading ? (
        <p key={blocks.length} className="font-semibold text-zinc-100">
          {renderInline(heading[1])}
        </p>
      ) : (
        <p key={blocks.length}>{renderInline(line)}</p>
      )
    );
  }
  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

/** Seçilen mağazaların ilk kalemlerini paralel çeker; hata veren mağaza atlanır */
async function loadStoreDetails(stores: Store[]): Promise<Record<string, StoreDetails>> {
  const entries = await Promise.all(
    stores.map(async (store) => {
      try {
        const [materials, workPlan] = await Promise.all([
          fetchStoreMaterialsPreview(store.id, MAX_ITEMS_PER_STORE),
          fetchStoreWorkPlanPreview(store.id, MAX_ITEMS_PER_STORE),
        ]);
        return [[store.id, { materials, workPlan }] as const];
      } catch (err) {
        console.error("Asistan için mağaza detayı alınamadı:", err);
        return [];
      }
    })
  );
  return Object.fromEntries(entries.flat());
}

export function AssistantWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { stores, storeSummaries, contracts, progressPayments, invoices, tickets, organization } = useDb();
  const { addStore } = useStores();
  const { createTicket } = useModules();
  const { importMaterials, importWorkPlan } = useStoreData();
  const { org, prefs, prefsLoaded, isModuleEnabled } = useSettings();
  const historyKey = user ? `maps-analytics-assistant:${user.id}` : null;
  const keepHistory = prefs.assistant.keepHistory;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Panel başlığından tutularak yalnızca yatay sürüklenir; ekran dışına çıkamaz
  const { offset, dragging, reset: resetPosition, handleProps } = useHorizontalDrag({
    containerRef: wrapperRef,
    targetRef: panelRef,
  });

  /** Paneli küçültür; bir sonraki açılışta ortadan başlar */
  const collapse = useCallback(() => {
    setOpen(false);
    resetPosition();
  }, [resetPosition]);

  // Panel dışında boş bir yere tıklanınca küçülür
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      collapse();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, collapse]);

  // Tarayıcı sekmesi değişince konum ortaya döner
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") resetPosition();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [resetPosition]);

  // Başka sayfaya geçilince de ortaya döner (render sırasında, efekt zinciri olmadan)
  const [positionPath, setPositionPath] = useState(pathname);
  if (positionPath !== pathname) {
    setPositionPath(pathname);
    if (offset !== 0) resetPosition();
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Sohbet geçmişi: tercih açıksa tarayıcıda saklanır, kapatılınca silinir.
  // Tercihler yüklenince bir kez geri yüklenir (render sırasında, efekt zinciri olmadan).
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);
  if (historyKey && prefsLoaded && historyLoadedFor !== historyKey) {
    setHistoryLoadedFor(historyKey);
    if (keepHistory) {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]");
        if (Array.isArray(saved) && saved.length > 0) {
          // Yarım kalan önizlemeler geri yüklenince onaylanamaz
          setMessages(
            (saved as ChatMessage[]).map((message) =>
              message.proposal && message.proposal.status !== "done"
                ? { ...message, proposal: { ...message.proposal, status: "cancelled" } }
                : message
            )
          );
        }
      } catch {
        // Bozuk kayıt: boş sohbetle devam
      }
    }
  }

  useEffect(() => {
    if (!historyKey || historyLoadedFor !== historyKey || streaming) return;
    try {
      if (keepHistory) localStorage.setItem(historyKey, JSON.stringify(messages.slice(-40)));
      else localStorage.removeItem(historyKey);
    } catch {
      // Kota dolduysa geçmiş saklanmaz
    }
  }, [messages, historyKey, historyLoadedFor, keepHistory, streaming]);

  // Ekip sayfasında mesaj kutusunun üstüne binmesin; firma ya da kullanıcı kapattıysa gösterme
  if (!user || pathname.startsWith("/team") || !org.assistant.enabled || !prefs.assistant.visible) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    // Yanıtlanmamış önizlemeler yeni mesajla geçersiz olur: aynı kayıt iki kez eklenmesin
    const settled = messages.map((message) =>
      message.proposal && (message.proposal.status === "ready" || message.proposal.status === "preparing")
        ? { ...message, proposal: { ...message.proposal, status: "cancelled" as const } }
        : message
    );
    const history: ChatMessage[] = [
      ...settled.filter((message) => !message.error),
      { role: "user", content },
    ];
    setMessages([...settled, { role: "user", content }, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const updateLast = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) => [...current.slice(0, -1), update(current[current.length - 1])]);

    try {
      const storeDetails = await loadStoreDetails(
        pickDetailStores(stores, storeSummaries, content)
      );
      const response = await apiFetch("/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          messages: history.map((message) => ({ role: message.role, content: historyContent(message) })),
          allowActions: org.assistant.allowActions,
          context: buildAssistantContext({
            question: content,
            organizationName: organization?.name,
            userName: user.name,
            stores,
            storeSummaries,
            storeDetails,
            contracts,
            progressPayments,
            invoices,
            tickets,
          }),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const data: unknown = await response.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Asistan şu anda yanıt veremiyor.";
        updateLast(() => ({ role: "assistant", content: message, error: true }));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        updateLast((message) => ({ ...message, content: message.content + chunk }));
      }
      if (!fullText.trim()) {
        updateLast(() => ({
          role: "assistant",
          content: "Bir cevap üretilemedi. Soruyu farklı sormayı deneyin.",
          error: true,
        }));
        return;
      }

      const rawActions = org.assistant.allowActions ? extractActions(fullText) : null;
      if (rawActions) {
        updateLast((message) => ({ ...message, proposal: { status: "preparing", previews: [] } }));
        const previews = await buildActionPreviews(rawActions, { user, stores, geocode, isModuleEnabled });
        updateLast((message) =>
          message.proposal?.status === "preparing"
            ? { ...message, proposal: { status: "ready", previews } }
            : message
        );
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        updateLast((message) =>
          message.content ? message : { role: "assistant", content: "Yanıt durduruldu.", error: true }
        );
      } else {
        updateLast(() => ({
          role: "assistant",
          content: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edin.",
          error: true,
        }));
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  };

  const setProposal = (index: number, update: (proposal: ActionProposal) => ActionProposal) =>
    setMessages((current) =>
      current.map((message, i) =>
        i === index && message.proposal ? { ...message, proposal: update(message.proposal) } : message
      )
    );

  const runAction = async (action: ResolvedAction): Promise<ActionResult> => {
    const storeName = (id: string) => stores.find((store) => store.id === id)?.name ?? "mağaza";
    switch (action.type) {
      case "create_store": {
        const store = addStore(action.store, { userId: user.id, userName: user.name });
        return { ok: true, label: `"${store.name}" mağazası oluşturuldu`, href: `/stores/${store.id}` };
      }
      case "create_ticket": {
        const id = await createTicket({
          ...action.ticket,
          code: nextTicketCode(tickets, org.defaults.ticketCodePrefix),
        });
        return id
          ? { ok: true, label: `"${action.ticket.title}" ticket'ı açıldı`, href: `/tickets/${id}` }
          : { ok: false, label: "Ticket oluşturulamadı" };
      }
      case "add_work_plan": {
        const count = await importWorkPlan(action.storeId, action.rows, "append");
        return count > 0
          ? { ok: true, label: `${storeName(action.storeId)} iş planına ${count} kalem eklendi`, href: `/stores/${action.storeId}` }
          : { ok: false, label: "İş planı kalemleri eklenemedi" };
      }
      case "add_materials": {
        const count = await importMaterials(action.storeId, action.rows, "append");
        return count > 0
          ? { ok: true, label: `${storeName(action.storeId)} keşfine ${count} kalem eklendi`, href: `/stores/${action.storeId}` }
          : { ok: false, label: "Keşif kalemleri eklenemedi" };
      }
    }
  };

  const confirmProposal = async (index: number) => {
    const proposal = messages[index]?.proposal;
    if (!proposal || proposal.status !== "ready") return;
    const actions = proposal.previews.flatMap((preview) => (preview.resolved ? [preview.resolved] : []));
    if (actions.length !== proposal.previews.length) return;
    setProposal(index, (current) => ({ ...current, status: "running" }));
    const results: ActionResult[] = [];
    // Sırayla: biri hata verirse diğerleri yine denenir, sonuçlar ayrı ayrı gösterilir
    for (const action of actions) {
      try {
        results.push(await runAction(action));
      } catch (error) {
        console.error("Asistan eylemi uygulanamadı:", error);
        results.push({ ok: false, label: "İşlem sırasında beklenmeyen bir hata oluştu" });
      }
    }
    setProposal(index, (current) => ({ ...current, status: "done", results }));
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
  };

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4"
    >
      {open ? (
        <section
          ref={panelRef}
          role="dialog"
          aria-label="Maps'e Sor"
          onKeyDown={(event) => {
            if (event.key === "Escape") collapse();
          }}
          // translate (transform değil): açılış animasyonuyla çakışmaz
          style={{ translate: `${offset}px 0` }}
          className={cn(
            "slide-up-fade pointer-events-auto flex h-[min(640px,calc(100dvh-5rem))] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-(--panel-shadow)",
            dragging && "select-none"
          )}
        >
          <header
            {...handleProps}
            title="Sağa sola taşımak için sürükleyin"
            className={cn(
              "flex touch-none items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3",
              dragging ? "cursor-grabbing" : "cursor-grab"
            )}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Maps&apos;e Sor</p>
                <p className="text-[11px] text-zinc-500">Firma verilerinize göre cevaplar, onayınızla kayıt ekler</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
                  aria-label="Yeni sohbet"
                  title="Yeni sohbet"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={collapse}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-300"
                aria-label="Küçült"
                title="Küçült"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="scrollbar-themed flex-1 overflow-y-auto px-4 py-4 sm:px-6" aria-live="polite">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-lg flex-col justify-center gap-5 py-2">
                <div className="text-center">
                  <p className="text-base font-semibold text-zinc-100">
                    Merhaba {user.name.split(" ")[0]}, ne öğrenmek istersiniz?
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Mağazalar, açılış takvimi, iş planları ve finans kayıtlarınız hakkında sorun. Mağaza, ticket, iş planı
                    ya da keşif kalemi eklemesini de isteyebilirsiniz; önce önizleme gösterilir, onaylarsanız eklenir.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="rounded-full border border-zinc-800 px-3 py-1.5 text-left text-sm text-zinc-300 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-zinc-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-4">
                {messages.map((message, index) =>
                  message.role === "user" ? (
                    <div key={index} className="flex justify-end">
                      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-cyan-500/15 px-3.5 py-2 text-sm text-zinc-100">
                        {message.content}
                      </p>
                    </div>
                  ) : (
                    <div
                      key={index}
                      className={cn(
                        "space-y-3 text-sm leading-relaxed",
                        message.error
                          ? "rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-400"
                          : "text-zinc-300"
                      )}
                    >
                      {message.content ? (
                        message.error ? (
                          message.content
                        ) : (
                          <>
                            {stripActionBlock(message.content) && (
                              <MessageContent text={stripActionBlock(message.content)} />
                            )}
                            {message.proposal ? (
                              <ActionPreviewCard
                                proposal={message.proposal}
                                onConfirm={() => void confirmProposal(index)}
                                onCancel={() =>
                                  setProposal(index, (proposal) => ({ ...proposal, status: "cancelled" }))
                                }
                              />
                            ) : (
                              streaming &&
                              index === messages.length - 1 &&
                              message.content.includes("```action") && (
                                <p className="text-xs text-zinc-500">Öneri hazırlanıyor…</p>
                              )
                            )}
                          </>
                        )
                      ) : (
                        <span className="inline-flex gap-1 py-1" aria-label="Yazıyor">
                          {[0, 150, 300].map((delay) => (
                            <span
                              key={delay}
                              className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
                              style={{ animationDelay: `${delay}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="px-3 pb-3 sm:px-4"
          >
            <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-1.5 pl-3 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30">
              <Sparkles className="mb-2.5 h-4 w-4 shrink-0 text-cyan-400" aria-hidden />
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    void send(input);
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder="Maps'e bir soru sorun…"
                aria-label="Mesaj"
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none [field-sizing:content]"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700"
                  aria-label="Durdur"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Gönder"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-zinc-600">
              Yapay zekâ hata yapabilir; önemli kararlarda verileri kontrol edin.
            </p>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="group pointer-events-auto flex h-11 w-full max-w-[440px] items-center gap-2.5 rounded-full border border-zinc-700/80 bg-zinc-950/90 pl-2 pr-1.5 text-left shadow-(--panel-shadow) backdrop-blur-md transition-colors hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          </span>
          <span className="shrink-0 text-sm font-semibold text-zinc-100">Maps&apos;e Sor</span>
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
            {messages.length > 0 ? "Sohbete devam et" : "Mağazalar, açılışlar, finans…"}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-on transition-colors group-hover:bg-brand-hover">
            <ArrowUp className="h-4 w-4" />
          </span>
        </button>
      )}
    </div>
  );
}
