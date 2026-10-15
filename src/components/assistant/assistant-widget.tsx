"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, RotateCcw, Sparkles, Square, X } from "lucide-react";
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

  const onMap = pathname === "/map";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!user) return null;

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
    <div
      className={cn(
        "fixed right-4 z-[90] flex items-end sm:right-5",
        onMap ? "top-[8.5rem] flex-col-reverse items-end" : "bottom-4 flex-col sm:bottom-5"
      )}
    >
      {open && (
        <section
          role="dialog"
          aria-label="Asistan"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={cn(
            "animate-in flex w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-(--panel-shadow)",
            onMap ? "mt-3 h-[min(560px,calc(100vh-11rem))]" : "mb-3 h-[min(600px,calc(100vh-7rem))]"
          )}
        >
          <header className="flex items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15">
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">Asistan</p>
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
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="scrollbar-themed flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-sm leading-relaxed text-zinc-400">
                  Merhaba {user.name.split(" ")[0]}! Mağazalarınız, açılış takvimi, iş planları ve finans
                  kayıtlarınız hakkında soru sorabilir ya da yorum isteyebilirsiniz.
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Hazır sorular</p>
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void send(suggestion)}
                      className="block w-full rounded-lg border border-zinc-800 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/5 hover:text-zinc-100"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) =>
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
                      "max-w-[95%] text-sm leading-relaxed",
                      message.error ? "rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-red-400" : "text-zinc-300"
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
              )
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="border-t border-zinc-800 p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-1.5 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30">
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
                placeholder="Bir soru yazın…"
                aria-label="Mesaj"
                className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none [field-sizing:content]"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700"
                  aria-label="Durdur"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Gönder"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-[10px] text-zinc-600">
              Yapay zekâ hata yapabilir; önemli kararlarda verileri kontrol edin.
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={open ? "Asistanı kapat" : "Asistanı aç"}
        className={cn(
          "flex items-center justify-center rounded-full shadow-(--panel-shadow) transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
          onMap ? "h-11 w-11" : "h-13 w-13",
          open ? "bg-zinc-800 text-zinc-200" : "bg-cyan-500 text-white hover:bg-cyan-600"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>
    </div>
  );
}
