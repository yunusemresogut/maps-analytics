"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  differenceInCalendarDays,
  format,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCheck,
  Download,
  FileText,
  Info,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { useI18n } from "@/contexts/i18n-context";
import {
  requestTeamCleanup,
  TEAM_MAX_FILE_BYTES,
  useTeamChat,
} from "@/contexts/team-chat-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ALLOWED_FILE_ACCEPT, isAllowedFileType } from "@/lib/file-types";
import { getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { TeamMessage, User } from "@/types";
import { useSettings } from "@/contexts/settings-context";

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-on tabular-nums",
        className
      )}
      aria-label={`${count} okunmamış mesaj`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function AttachmentView({ message, mine }: { message: TeamMessage; mine: boolean }) {
  const { getAttachmentUrl } = useTeamChat();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = message.attachmentType?.startsWith("image/") ?? false;

  useEffect(() => {
    if (!isImage || !message.attachmentPath) return;
    let cancelled = false;
    void getAttachmentUrl(message.attachmentPath).then((url) => {
      if (!cancelled) setPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [isImage, message.attachmentPath, getAttachmentUrl]);

  const open = async () => {
    if (!message.attachmentPath) return;
    const url = await getAttachmentUrl(message.attachmentPath);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  if (isImage && previewUrl) {
    return (
      <button type="button" onClick={() => void open()} className="block overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={message.attachmentName ?? "Görsel"}
          className="max-h-60 max-w-full rounded-lg object-cover"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      className={cn(
        "flex w-full min-w-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
        mine
          ? "border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/15"
          : "border-zinc-700/80 bg-zinc-950/40 hover:bg-zinc-800/40"
      )}
    >
      <FileText className="h-5 w-5 shrink-0 text-cyan-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">
          {message.attachmentName}
        </span>
        <span className="block text-[11px] text-zinc-500">{formatFileSize(message.attachmentSize)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 text-zinc-500" />
    </button>
  );
}

function ProfilePanel({
  member,
  unread,
  lastMessageAt,
  onMessage,
}: {
  member: User;
  unread: number;
  lastMessageAt?: string;
  onMessage: () => void;
}) {
  const { organization } = useAuth();
  const { dateLocale } = useI18n();
  const rows = [
    { icon: Shield, label: "Rol", value: getRoleLabel(member.role, organization) },
    {
      icon: Mail,
      label: "E-posta",
      value: member.email,
      href: member.email ? `mailto:${member.email}` : undefined,
    },
    {
      icon: Phone,
      label: "Telefon",
      value: member.phone || "Belirtilmemiş",
      href: member.phone ? `tel:${member.phone.replace(/\s+/g, "")}` : undefined,
    },
    { icon: Users, label: "Organizasyon", value: organization?.name ?? "—" },
    {
      icon: MessageSquare,
      label: "Son mesaj",
      value: lastMessageAt
        ? format(parseISO(lastMessageAt), "d MMMM yyyy, HH:mm", { locale: dateLocale })
        : "Henüz mesajlaşmadınız",
    },
  ];

  return (
    <div className="scrollbar-themed flex h-full items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-8">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <div className="flex flex-col items-center text-center">
          <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="lg" className="h-20 w-20 text-2xl" />
          <h2 className="mt-4 text-lg font-semibold text-zinc-100">{member.name}</h2>
          <p className="mt-0.5 text-sm text-zinc-500">{getRoleLabel(member.role, organization)}</p>
          <span
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
              member.restricted
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", member.restricted ? "bg-amber-500" : "bg-emerald-500")} />
            {member.restricted ? "Erişimi kısıtlı" : "Aktif"}
          </span>
        </div>

        <dl className="mt-6 divide-y divide-zinc-800/70 border-y border-zinc-800/70">
          {rows.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex items-center gap-3 py-3">
              <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
              <dt className="w-28 shrink-0 text-sm text-zinc-500">{label}</dt>
              <dd className="min-w-0 flex-1 truncate text-right text-sm text-zinc-200">
                {href ? (
                  <a href={href} className="hover:text-cyan-400 hover:underline">
                    {value}
                  </a>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <Button className="mt-6 w-full" onClick={onMessage}>
          <MessageSquare className="h-4 w-4" />
          Mesaj yaz
          {unread > 0 && <UnreadBadge count={unread} className="ml-1" />}
        </Button>
      </div>
    </div>
  );
}

function dayLabel(iso: string, locale: Parameters<typeof format>[2]) {
  const date = parseISO(iso);
  if (isToday(date)) return "Bugün";
  if (isYesterday(date)) return "Dün";
  return format(date, "d MMMM EEEE", locale);
}

function ChatPanel({
  member,
  onShowProfile,
  onBack,
}: {
  member: User;
  onShowProfile: () => void;
  onBack: () => void;
}) {
  const { user, organization } = useAuth();
  const { org } = useSettings();
  const { dateLocale } = useI18n();
  const { messages, unreadBySender, sendMessage, markRead, deleteMessage, clearConversation } =
    useTeamChat();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<{ type: "message"; id: string } | { type: "conversation" } | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversation = useMemo(
    () =>
      messages.filter(
        (message) =>
          (message.senderId === user?.id && message.recipientId === member.id) ||
          (message.senderId === member.id && message.recipientId === user?.id)
      ),
    [messages, user?.id, member.id]
  );
  const unread = unreadBySender[member.id] ?? 0;
  const lastOwn = [...conversation].reverse().find((message) => message.senderId === user?.id);

  useEffect(() => {
    if (unread > 0 && document.visibilityState === "visible") void markRead(member.id);
  }, [unread, member.id, markRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation.length]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [member.id]);

  const pickFile = (picked: File | undefined) => {
    setError("");
    if (!picked) return;
    if (!isAllowedFileType(picked.name)) {
      setError("Bu dosya türü desteklenmiyor.");
      return;
    }
    if (picked.size > TEAM_MAX_FILE_BYTES) {
      setError("Dosya en fazla 10 MB olabilir.");
      return;
    }
    setFile(picked);
  };

  const send = async () => {
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    setError("");
    const result = await sendMessage(member.id, text, file);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setText("");
    setFile(null);
    textareaRef.current?.focus();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    const result =
      confirm.type === "message" ? await deleteMessage(confirm.id) : await clearConversation(member.id);
    setBusy(false);
    if (!result.ok) setError(result.error);
    setConfirm(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 md:hidden"
          aria-label="Kişi listesine dön"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onShowProfile}
          title="Kişi bilgileri"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-zinc-800/30"
        >
          <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-100">{member.name}</span>
            <span className="block truncate text-xs text-zinc-500">
              {getRoleLabel(member.role, organization)} · Bilgileri görmek için tıklayın
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onShowProfile}
          className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
          aria-label="Kişi bilgileri"
          title="Kişi bilgileri"
        >
          <Info className="h-4 w-4" />
        </button>
        {conversation.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirm({ type: "conversation" })}
            className="rounded-md p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
            aria-label="Sohbeti sil"
            title="Sohbeti sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <p className="border-b border-zinc-800/60 bg-zinc-900/30 px-4 py-1.5 text-center text-[11px] text-zinc-500">
        Mesajlar{org.team.fileSharing ? " ve dosyalar" : ""} {org.team.retentionDays} gün sonra otomatik olarak silinir.
      </p>

      <div ref={scrollRef} className="scrollbar-themed flex-1 overflow-y-auto px-3 py-4 sm:px-6" aria-live="polite">
        {conversation.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="h-8 w-8 text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-300">{member.name} ile sohbete başlayın</p>
            <p className="mt-1 text-xs text-zinc-500">Mesaj yazabilir veya dosya gönderebilirsiniz.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-1">
            {conversation.map((message, index) => {
              const mine = message.senderId === user?.id;
              const previous = conversation[index - 1];
              const newDay =
                !previous ||
                differenceInCalendarDays(parseISO(message.createdAt), parseISO(previous.createdAt)) !== 0;
              const grouped = !newDay && previous?.senderId === message.senderId;
              return (
                <div key={message.id}>
                  {newDay && (
                    <div className="my-4 flex items-center gap-3 text-[11px] font-medium text-zinc-500">
                      <span className="h-px flex-1 bg-zinc-800" />
                      {dayLabel(message.createdAt, { locale: dateLocale })}
                      <span className="h-px flex-1 bg-zinc-800" />
                    </div>
                  )}
                  <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start", grouped ? "mt-0.5" : "mt-3")}>
                    {mine && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ type: "message", id: message.id })}
                        className="mb-1 rounded-md p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                        aria-label="Mesajı sil"
                        title="Mesajı sil"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] space-y-1.5 rounded-2xl px-3 py-2 text-sm sm:max-w-[70%]",
                        mine
                          ? "rounded-br-md bg-cyan-500/15 text-zinc-100"
                          : "rounded-bl-md border border-zinc-800 bg-zinc-900/60 text-zinc-200"
                      )}
                    >
                      {message.attachmentPath && <AttachmentView message={message} mine={mine} />}
                      {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                      <p className={cn("flex items-center gap-1 text-[10px] text-zinc-500", mine && "justify-end")}>
                        {format(parseISO(message.createdAt), "HH:mm")}
                        {mine &&
                          (message.readAt ? (
                            <CheckCheck className="h-3 w-3 text-cyan-400" aria-label="Görüldü" />
                          ) : (
                            <Check className="h-3 w-3" aria-label="Gönderildi" />
                          ))}
                      </p>
                    </div>
                  </div>
                  {mine && message.id === lastOwn?.id && message.readAt && (
                    <p className="mt-0.5 text-right text-[10px] text-zinc-500">Görüldü</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="border-t border-zinc-800 p-3"
      >
        <div className="mx-auto max-w-3xl">
          {file && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-cyan-400" />
              <span className="min-w-0 flex-1 truncate text-zinc-200">{file.name}</span>
              <span className="shrink-0 text-xs text-zinc-500">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded p-0.5 text-zinc-500 hover:text-zinc-300"
                aria-label="Dosyayı kaldır"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mb-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-700/80 bg-zinc-900/60 p-1.5 focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/30">
            {org.team.fileSharing && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
              aria-label="Dosya ekle"
              title="Dosya ekle (en fazla 10 MB)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FILE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                pickFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={`${member.name.split(" ")[0]} kişisine mesaj yazın…`}
              aria-label="Mesaj"
              className="max-h-36 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none [field-sizing:content]"
            />
            <button
              type="submit"
              disabled={sending || (!text.trim() && !file)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-on transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Gönder"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </form>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.type === "conversation" ? "Sohbet silinsin mi?" : "Mesaj silinsin mi?"}
        description={
          confirm?.type === "conversation"
            ? `${member.name} ile tüm mesajlar ve dosyalar iki taraf için de kalıcı olarak silinir.`
            : "Mesaj ve eki iki taraf için de kalıcı olarak silinir."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
              Vazgeç
            </Button>
            <Button variant="danger" onClick={() => void runConfirm()} loading={busy} data-autofocus>
              Sil
            </Button>
          </>
        }
      >
        <p className="text-sm text-zinc-400">Bu işlem geri alınamaz.</p>
      </Modal>
    </div>
  );
}

export function TeamPage() {
  const { user, organization } = useAuth();
  const { users } = useDb();
  const { dateLocale } = useI18n();
  const { messages, unreadBySender, isReady } = useTeamChat();
  const [query, setQuery] = useState("");
  // Bildirimden gelinirse (?peer=) o kişiyle sohbet açılır
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("peer")
  );
  const [view, setView] = useState<"profile" | "chat">("chat");

  useEffect(() => {
    requestTeamCleanup();
  }, []);

  const lastMessageByPeer = useMemo(() => {
    const map: Record<string, TeamMessage> = {};
    for (const message of messages) {
      const peer = message.senderId === user?.id ? message.recipientId : message.senderId;
      map[peer] = message;
    }
    return map;
  }, [messages, user?.id]);

  const members = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return users
      .filter((member) => member.id !== user?.id)
      .filter(
        (member) =>
          !normalized ||
          member.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
          member.email.toLocaleLowerCase("tr-TR").includes(normalized)
      )
      .sort((a, b) => {
        const unreadDiff = (unreadBySender[b.id] ?? 0) - (unreadBySender[a.id] ?? 0);
        if (unreadDiff !== 0) return unreadDiff;
        const lastA = lastMessageByPeer[a.id]?.createdAt ?? "";
        const lastB = lastMessageByPeer[b.id]?.createdAt ?? "";
        if (lastA !== lastB) return lastB.localeCompare(lastA);
        return a.name.localeCompare(b.name, "tr");
      });
  }, [users, user?.id, query, unreadBySender, lastMessageByPeer]);

  const selected = users.find((member) => member.id === selectedId) ?? null;
  const teamSize = users.filter((member) => member.id !== user?.id).length;

  const selectMember = (id: string) => {
    setSelectedId(id);
    setView("chat");
  };

  const previewText = (message?: TeamMessage) => {
    if (!message) return null;
    const prefix = message.senderId === user?.id ? "Siz: " : "";
    return prefix + (message.body || `📎 ${message.attachmentName ?? "Dosya"}`);
  };

  const formatListTime = (iso: string) => {
    const date = parseISO(iso);
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return "Dün";
    return format(date, "d MMM", { locale: dateLocale });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-zinc-800 md:w-80",
          selected && "hidden md:flex"
        )}
      >
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-zinc-100">Ekip</h1>
              <p className="text-xs text-zinc-500">
                {organization?.name ? `${organization.name} · ` : ""}
                {teamSize} kişi
              </p>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kişi ara…"
              aria-label="Kişi ara"
              className="h-9 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
          </div>
        </div>

        <ul className="scrollbar-themed flex-1 overflow-y-auto p-2">
          {teamSize === 0 && (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">
              Organizasyonunuzda henüz başka kullanıcı yok. Yönetim → Kullanıcılar bölümünden ekip üyesi
              ekleyebilirsiniz.
            </li>
          )}
          {teamSize > 0 && members.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-zinc-500">Sonuç bulunamadı.</li>
          )}
          {members.map((member) => {
            const unread = unreadBySender[member.id] ?? 0;
            const last = lastMessageByPeer[member.id];
            const active = member.id === selectedId;
            return (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => selectMember(member.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    active ? "bg-cyan-500/10 ring-1 ring-cyan-500/25" : "hover:bg-zinc-800/40"
                  )}
                >
                  <UserAvatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", unread > 0 ? "font-semibold text-zinc-100" : "font-medium text-zinc-200")}>
                        {member.name}
                      </span>
                      {last && (
                        <span className={cn("shrink-0 text-[11px]", unread > 0 ? "text-cyan-400" : "text-zinc-500")}>
                          {formatListTime(last.createdAt)}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {getRoleLabel(member.role, organization)}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", unread > 0 ? "text-zinc-300" : "text-zinc-500")}>
                        {previewText(last) ?? ""}
                      </span>
                      <UnreadBadge count={unread} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={cn("min-w-0 flex-1", !selected && "hidden md:block")}>
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10">
              <Users className="h-6 w-6 text-cyan-400" />
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-200">Bir ekip üyesi seçin</p>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">
              Kişinin bilgilerini görüntüleyin ve mesajlaşmaya başlayın. {isReady ? "" : "Mesajlar yükleniyor…"}
            </p>
          </div>
        ) : view === "profile" ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={() => setView("chat")}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Sohbete dön
              </button>
              <span className="ml-auto text-sm font-medium text-zinc-200">Kişi bilgileri</span>
            </div>
            <div className="min-h-0 flex-1">
              <ProfilePanel
                member={selected}
                unread={unreadBySender[selected.id] ?? 0}
                lastMessageAt={lastMessageByPeer[selected.id]?.createdAt}
                onMessage={() => setView("chat")}
              />
            </div>
          </div>
        ) : (
          <ChatPanel
            key={selected.id}
            member={selected}
            onShowProfile={() => setView("profile")}
            onBack={() => setSelectedId(null)}
          />
        )}
      </section>
    </div>
  );
}
