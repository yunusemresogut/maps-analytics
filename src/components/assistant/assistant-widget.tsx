"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, ChevronDown, RotateCcw, Sparkles, Square } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { buildAssistantContext } from "@/lib/assistant-context";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string; error?: boolean };

const SUGGESTIONS = [
  "Genel durumu özetle",
  "Önümüzdeki 30 günde açılacak mağazalar hangileri?",
  "Açılış tarihi geçmiş mağazalar var mı?",
  "Hakediş ve fatura durumunu yorumla",
  "Riskli projeleri ve önerilerini listele",
];

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

export function AssistantWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { stores, storeData, contracts, progressPayments, invoices, tickets, organization } = useDb();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Ekip sayfasında mesaj kutusunun üstüne binmesin
  if (!user || pathname.startsWith("/team")) return null;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    const history: ChatMessage[] = [
      ...messages.filter((message) => !message.error),
      { role: "user", content },
    ];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const updateLast = (update: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) => [...current.slice(0, -1), update(current[current.length - 1])]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          messages: history.map(({ role, content: messageContent }) => ({ role, content: messageContent })),
          context: buildAssistantContext({
            question: content,
            organizationName: organization?.name,
            userName: user.name,
            stores,
            storeData,
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
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        updateLast((message) => ({ ...message, content: message.content + chunk }));
      }
      updateLast((message) =>
        message.content.trim()
          ? message
          : { role: "assistant", content: "Bir cevap üretilemedi. Soruyu farklı sormayı deneyin.", error: true }
      );
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

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      {open ? (
        <section
          role="dialog"
          aria-label="Maps'e Sor"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="slide-up-fade pointer-events-auto flex h-[min(640px,calc(100dvh-5rem))] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-(--panel-shadow)"
        >
          <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Maps&apos;e Sor</p>
                <p className="text-[11px] text-zinc-500">Firma verilerinize göre cevaplar</p>
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
                onClick={() => setOpen(false)}
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
                    Mağazalar, açılış takvimi, iş planları ve finans kayıtlarınız hakkında sorun ya da yorum isteyin.
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
                        "text-sm leading-relaxed",
                        message.error
                          ? "rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-400"
                          : "text-zinc-300"
                      )}
                    >
                      {message.content ? (
                        message.error ? message.content : <MessageContent text={message.content} />
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
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
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white transition-colors group-hover:bg-cyan-600">
            <ArrowUp className="h-4 w-4" />
          </span>
        </button>
      )}
    </div>
  );
}
