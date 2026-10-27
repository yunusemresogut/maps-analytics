"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { isAllowedFileType } from "@/lib/file-types";
import { supabase } from "@/lib/supabase";
import type { TeamMessage } from "@/types";
import { apiFetch } from "@/lib/api-client";
import { t } from "@/i18n/runtime";

export const TEAM_FILES_BUCKET = "team-files";
export const TEAM_MAX_FILE_BYTES = 10 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

type ActionResult = { ok: true } | { ok: false; error: string };

type TeamChatContextValue = {
  /** Kullanıcının taraf olduğu, saklama süresindeki tüm mesajlar (eskiden yeniye) */
  messages: TeamMessage[];
  unreadBySender: Record<string, number>;
  totalUnread: number;
  isReady: boolean;
  sendMessage: (peerId: string, body: string, file?: File | null) => Promise<ActionResult>;
  markRead: (peerId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<ActionResult>;
  clearConversation: (peerId: string) => Promise<ActionResult>;
  getAttachmentUrl: (path: string) => Promise<string | null>;
};

const TeamChatContext = createContext<TeamChatContextValue | null>(null);

function mapMessage(row: Record<string, unknown>): TeamMessage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    senderId: String(row.sender_id),
    recipientId: String(row.recipient_id),
    body: typeof row.body === "string" ? row.body : "",
    attachmentPath: typeof row.attachment_path === "string" ? row.attachment_path : undefined,
    attachmentName: typeof row.attachment_name === "string" ? row.attachment_name : undefined,
    attachmentSize: row.attachment_size != null ? Number(row.attachment_size) : undefined,
    attachmentType: typeof row.attachment_type === "string" ? row.attachment_type : undefined,
    createdAt: String(row.created_at),
    readAt: typeof row.read_at === "string" ? row.read_at : undefined,
  };
}

function isFresh(message: TeamMessage, retentionDays: number, now = Date.now()) {
  return now - new Date(message.createdAt).getTime() < retentionDays * DAY_MS;
}

function upsert(list: TeamMessage[], message: TeamMessage): TeamMessage[] {
  const index = list.findIndex((item) => item.id === message.id);
  if (index === -1) {
    return [...list, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const next = [...list];
  next[index] = message;
  return next;
}

export function TeamChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const organizationId = user?.organizationId;
  const { org } = useSettings();
  const retentionDays = org.team.retentionDays;
  const fileSharing = org.team.fileSharing;
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        // Migration uygulanmadıysa sessizce boş kal
        console.error("Ekip mesajları yüklenemedi:", error);
      } else {
        setMessages((data ?? []).map(mapMessage));
      }
      setIsReady(true);
    };
    void load();

    const channel = supabase
      .channel(`team-messages-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "team_messages" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const id = (payload.old as { id?: string }).id;
            if (id) setMessages((current) => current.filter((message) => message.id !== id));
            return;
          }
          const message = mapMessage(payload.new as Record<string, unknown>);
          if (message.senderId !== userId && message.recipientId !== userId) return;
          setMessages((current) => upsert(current, message));
        }
      )
      .subscribe();

    // Saklama süresi dolan mesajları açık ekranda da gizle
    const prune = window.setInterval(() => {
      setMessages((current) => {
        const fresh = current.filter((message) => isFresh(message, retentionDays));
        return fresh.length === current.length ? current : fresh;
      });
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(prune);
      void supabase.removeChannel(channel);
      setMessages([]);
      setIsReady(false);
    };
  }, [userId, retentionDays]);

  const unreadBySender = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const message of messages) {
      if (message.recipientId === userId && !message.readAt) {
        counts[message.senderId] = (counts[message.senderId] ?? 0) + 1;
      }
    }
    return counts;
  }, [messages, userId]);

  const totalUnread = useMemo(
    () => Object.values(unreadBySender).reduce((sum, count) => sum + count, 0),
    [unreadBySender]
  );

  const sendMessage = useCallback(
    async (peerId: string, body: string, file?: File | null): Promise<ActionResult> => {
      if (!userId || !organizationId) return { ok: false, error: t("system.teamChat.noSession") };
      const text = body.trim();
      if (!text && !file) return { ok: false, error: t("system.teamChat.emptyMessage") };
      if (text.length > 4000) return { ok: false, error: t("system.teamChat.messageTooLong") };

      let attachment: Record<string, unknown> = {};
      let uploadedPath: string | null = null;
      if (file) {
        if (!fileSharing) return { ok: false, error: t("system.teamChat.fileSharingDisabled") };
        if (!isAllowedFileType(file.name)) return { ok: false, error: t("system.teamChat.fileTypeNotSupported") };
        if (file.size > TEAM_MAX_FILE_BYTES) return { ok: false, error: t("system.teamChat.fileTooLarge") };
        const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
        uploadedPath = `${organizationId}/${userId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(TEAM_FILES_BUCKET)
          .upload(uploadedPath, file, { upsert: false, contentType: file.type || undefined });
        if (uploadError) {
          console.error("Ekip dosyası yüklenemedi:", uploadError);
          return { ok: false, error: t("system.teamChat.fileUploadFailed") };
        }
        attachment = {
          attachment_path: uploadedPath,
          attachment_name: file.name,
          attachment_size: file.size,
          attachment_type: file.type || null,
        };
      }

      const { data, error } = await supabase
        .from("team_messages")
        .insert({ recipient_id: peerId, body: text, ...attachment })
        .select("*")
        .single();
      if (error || !data) {
        console.error("Ekip mesajı gönderilemedi:", error);
        if (uploadedPath) await supabase.storage.from(TEAM_FILES_BUCKET).remove([uploadedPath]);
        return { ok: false, error: t("system.teamChat.sendFailed") };
      }
      setMessages((current) => upsert(current, mapMessage(data)));
      return { ok: true };
    },
    [userId, organizationId, fileSharing]
  );

  const markRead = useCallback(
    async (peerId: string) => {
      if (!userId) return;
      const now = new Date().toISOString();
      setMessages((current) =>
        current.map((message) =>
          message.senderId === peerId && message.recipientId === userId && !message.readAt
            ? { ...message, readAt: now }
            : message
        )
      );
      const { error } = await supabase.rpc("mark_team_messages_read", { p_sender: peerId });
      if (error) console.error("Mesajlar okundu işaretlenemedi:", error);
    },
    [userId]
  );

  const removeLocally = (predicate: (message: TeamMessage) => boolean) =>
    setMessages((current) => current.filter((message) => !predicate(message)));

  const deleteMessage = useCallback(async (messageId: string): Promise<ActionResult> => {
    const response = await apiFetch("/api/team/messages", {
      method: "DELETE",
      body: JSON.stringify({ messageId }),
    });
    if (!response.ok) return { ok: false, error: t("system.teamChat.deleteMessageFailed") };
    removeLocally((message) => message.id === messageId);
    return { ok: true };
  }, []);

  const clearConversation = useCallback(
    async (peerId: string): Promise<ActionResult> => {
      const response = await apiFetch("/api/team/messages", {
        method: "DELETE",
        body: JSON.stringify({ peerId }),
      });
      if (!response.ok) return { ok: false, error: t("system.teamChat.clearConversationFailed") };
      removeLocally(
        (message) =>
          (message.senderId === peerId && message.recipientId === userId) ||
          (message.senderId === userId && message.recipientId === peerId)
      );
      return { ok: true };
    },
    [userId]
  );

  const getAttachmentUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage
      .from(TEAM_FILES_BUCKET)
      .createSignedUrl(path, 60 * 10);
    if (error) {
      console.error("Dosya bağlantısı oluşturulamadı:", error);
      return null;
    }
    return data.signedUrl;
  }, []);

  return (
    <TeamChatContext.Provider
      value={{
        messages,
        unreadBySender,
        totalUnread,
        isReady,
        sendMessage,
        markRead,
        deleteMessage,
        clearConversation,
        getAttachmentUrl,
      }}
    >
      {children}
    </TeamChatContext.Provider>
  );
}

export function useTeamChat() {
  const context = useContext(TeamChatContext);
  if (!context) throw new Error("useTeamChat must be used within TeamChatProvider");
  return context;
}

/** Sayfa açıldığında firmanın süresi dolan mesajlarını kalıcı sil (arka planda) */
export function requestTeamCleanup() {
  void apiFetch("/api/team/cleanup", { method: "POST" }).catch(() => undefined);
}
