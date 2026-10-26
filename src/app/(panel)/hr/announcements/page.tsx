"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { CheckCheck, Eye, Megaphone, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { logActivity } from "@/lib/activity-log";
import { hrErrorMessage } from "@/lib/hr";
import {
  announcementState,
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementReads,
  fetchAnnouncements,
  markAnnouncementRead,
  refreshHrNotifications,
  updateAnnouncement,
  type Announcement,
  type AnnouncementInput,
  type AnnouncementRead,
} from "@/lib/hr-admin";
import { getRoleLabel, organizationRoles } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { User, UserRole } from "@/types";

type SubmitState = { saving: boolean; error: string };

const STATE_BADGE = {
  scheduled: { label: "Zamanlandı", style: "border-sky-500/25 bg-sky-500/10 text-sky-300" },
  expired: { label: "Yayından kalktı", style: "border-zinc-700 bg-zinc-800/60 text-zinc-500" },
} as const;

const formatStamp = (value: string) => format(parseISO(value), "d MMM yyyy HH:mm", { locale: tr });
/** datetime-local alanı için yerel saat biçimi */
const toLocalInput = (value: string) => format(value ? parseISO(value) : new Date(), "yyyy-MM-dd'T'HH:mm");

/** Duyurunun hedef kitlesindeki kullanıcılar */
function audienceUsers(announcement: Pick<Announcement, "audienceRoles">, users: User[]) {
  return announcement.audienceRoles.length === 0 ? users : users.filter((u) => announcement.audienceRoles.includes(u.role));
}

function AnnouncementsContent() {
  const { user, users, organization } = useAuth();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("announcements");
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<{ announcement: Announcement | null } | null>(null);
  const [readsFor, setReadsFor] = useState<Announcement | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [marking, setMarking] = useState<string | null>(null);

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchAnnouncements(userId)
      .then((rows) => {
        if (cancelled) return;
        setAnnouncements(rows);
        setLoadError("");
      })
      .catch((err) => {
        console.error("Duyurular yüklenemedi:", err);
        if (!cancelled) setLoadError("Duyurular yüklenemedi. Veritabanı güncellemesi (İK Faz 4 migration'ı) uygulanmamış olabilir.");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  const log = useCallback(
    (action: string, message: string, target: { id?: string; title: string }) => {
      if (!user) return;
      logActivity({ category: "hr", action, message, actorId: user.id, actorName: user.name, targetId: target.id, targetLabel: target.title });
    },
    [user]
  );

  const markRead = async (announcement: Announcement) => {
    setMarking(announcement.id);
    try {
      await markAnnouncementRead(announcement.id);
      setAnnouncements((prev) =>
        (prev ?? []).map((item) => (item.id === announcement.id ? { ...item, readAt: new Date().toISOString() } : item))
      );
      refreshHrNotifications();
    } catch (err) {
      flash("error", hrErrorMessage(err, "Okundu bilgisi kaydedilemedi."));
    } finally {
      setMarking(null);
    }
  };

  const remove = async (announcement: Announcement) => {
    if (!confirm(`"${announcement.title}" duyurusu ve okuma kayıtları silinsin mi?`)) return;
    try {
      await deleteAnnouncement(announcement.id);
      log("delete", `Duyuru silindi: ${announcement.title}`, announcement);
      setVersion((v) => v + 1);
      refreshHrNotifications();
    } catch (err) {
      flash("error", hrErrorMessage(err, "Duyuru silinemedi."));
    }
  };

  const unreadCount = (announcements ?? []).filter((a) => !a.readAt && announcementState(a) === "live").length;

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Duyurular</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} okunmamış duyuru` : "Firma duyuruları, talimatlar ve bilgilendirmeler."}
          </p>
        </div>
        {canAdd && (
          <Button
            onClick={() => {
              setSubmit({ saving: false, error: "" });
              setEditing({ announcement: null });
            }}
          >
            <Plus className="h-4 w-4" />
            Yeni duyuru
          </Button>
        )}
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {loadError}
        </p>
      )}

      {announcements === null && !loadError ? (
        <ul className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </ul>
      ) : (announcements ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          <Megaphone className="mx-auto mb-2 h-6 w-6 text-zinc-600" aria-hidden />
          Henüz duyuru yok.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {(announcements ?? []).map((announcement) => {
            const state = announcementState(announcement);
            const audience = audienceUsers(announcement, users);
            return (
              <li
                key={announcement.id}
                className={cn(
                  "rounded-xl border bg-zinc-900/40 px-5 py-4",
                  !announcement.readAt && state === "live" ? "border-cyan-500/40" : "border-zinc-800"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-zinc-100">
                      {announcement.pinned && <Pin className="h-4 w-4 text-amber-400" aria-label="Sabitlendi" />}
                      {announcement.title}
                      {state !== "live" && (
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", STATE_BADGE[state].style)}>
                          {STATE_BADGE[state].label}
                        </span>
                      )}
                    </h2>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {announcement.createdByName} · {formatStamp(announcement.publishAt)}
                      {announcement.audienceRoles.length > 0 &&
                        ` · ${announcement.audienceRoles.map((role) => getRoleLabel(role, organization)).join(", ")}`}
                      {announcement.expiresAt && ` · ${formatStamp(announcement.expiresAt)} tarihine kadar`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {canView && (
                      <Button size="sm" variant="ghost" onClick={() => setReadsFor(announcement)}>
                        <Eye className="h-3.5 w-3.5" />
                        Okuma durumu
                        <span className="tabular-nums text-zinc-500">· {audience.length} kişi</span>
                      </Button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        aria-label="Düzenle"
                        title="Düzenle"
                        onClick={() => {
                          setSubmit({ saving: false, error: "" });
                          setEditing({ announcement });
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        aria-label="Sil"
                        title="Sil"
                        onClick={() => void remove(announcement)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {announcement.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{announcement.body}</p>}
                {state === "live" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-3">
                    {announcement.readAt ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                        {announcement.requiresAck ? "Okudum, anladım" : "Okundu"} · {formatStamp(announcement.readAt)}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant={announcement.requiresAck ? "default" : "outline"}
                        loading={marking === announcement.id}
                        onClick={() => void markRead(announcement)}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        {announcement.requiresAck ? "Okudum, anladım" : "Okundu olarak işaretle"}
                      </Button>
                    )}
                    {announcement.requiresAck && !announcement.readAt && (
                      <span className="text-xs text-zinc-500">Bu duyuru için okuma onayınız kayıt altına alınır.</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <AnnouncementModal
          announcement={editing.announcement}
          state={submit}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            setSubmit({ saving: true, error: "" });
            const existing = editing.announcement;
            const task = existing ? updateAnnouncement(existing.id, input) : createAnnouncement(input);
            task
              .then(() => {
                log(existing ? "update" : "create", `Duyuru ${existing ? "güncellendi" : "yayınlandı"}: ${input.title}`, {
                  id: existing?.id,
                  title: input.title,
                });
                setEditing(null);
                setVersion((v) => v + 1);
                refreshHrNotifications();
                flash("success", existing ? "Duyuru güncellendi." : "Duyuru yayınlandı.");
              })
              .catch((err) => {
                console.error("Duyuru kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, "Duyuru kaydedilemedi.") });
              });
          }}
        />
      )}
      {readsFor && <ReadsModal announcement={readsFor} users={audienceUsers(readsFor, users)} onClose={() => setReadsFor(null)} />}
    </div>
  );
}

function AnnouncementModal({
  announcement,
  state,
  onClose,
  onSubmit,
}: {
  announcement: Announcement | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: AnnouncementInput) => void;
}) {
  const formId = useId();
  const { organization } = useAuth();
  const roles = organizationRoles(organization);
  const [form, setForm] = useState<AnnouncementInput>({
    title: announcement?.title ?? "",
    body: announcement?.body ?? "",
    audienceRoles: announcement?.audienceRoles ?? [],
    pinned: announcement?.pinned ?? false,
    requiresAck: announcement?.requiresAck ?? false,
    publishAt: toLocalInput(announcement?.publishAt ?? ""),
    expiresAt: announcement?.expiresAt ? toLocalInput(announcement.expiresAt) : "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const toggleRole = (role: UserRole) =>
    set("audienceRoles", form.audienceRoles.includes(role) ? form.audienceRoles.filter((r) => r !== role) : [...form.audienceRoles, role]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next.title = "Başlık zorunludur";
    if (!form.body.trim()) next.body = "Duyuru metni zorunludur";
    if (!form.publishAt) next.publishAt = "Yayın zamanı zorunludur";
    if (form.expiresAt && form.publishAt && form.expiresAt <= form.publishAt) next.expiresAt = "Bitiş yayından sonra olmalı";
    return next;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={announcement ? "Duyuruyu düzenle" : "Yeni duyuru"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {announcement ? "Kaydet" : "Yayınla"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const next = validate();
          setErrors(next);
          if (Object.keys(next).length === 0) onSubmit(form);
        }}
      >
        {(state.error || Object.keys(errors).length > 0) && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error || "Lütfen işaretli alanları kontrol edin."}
          </p>
        )}
        <FormField label="Başlık" required error={errors.title}>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} aria-invalid={!!errors.title} />
        </FormField>
        <FormField label="Duyuru" required error={errors.body}>
          <Textarea rows={6} value={form.body} onChange={(e) => set("body", e.target.value)} aria-invalid={!!errors.body} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Yayın zamanı" required error={errors.publishAt} hint="İleri bir tarih seçilirse o an yayınlanır">
            <Input type="datetime-local" value={form.publishAt} onChange={(e) => set("publishAt", e.target.value)} aria-invalid={!!errors.publishAt} />
          </FormField>
          <FormField label="Yayından kalkış" error={errors.expiresAt} hint="Boşsa süresiz">
            <Input type="datetime-local" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} aria-invalid={!!errors.expiresAt} />
          </FormField>
        </div>
        <FormField label="Kimler görsün" hint={form.audienceRoles.length === 0 ? "Seçim yoksa tüm kullanıcılar görür" : undefined}>
          <div className="flex flex-wrap gap-1.5">
            {roles.map((role) => {
              const selected = form.audienceRoles.includes(role);
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selected ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {getRoleLabel(role, organization)}
                </button>
              );
            })}
          </div>
        </FormField>
        <div className="flex flex-col gap-3">
          <Switch checked={form.pinned} onChange={(value) => set("pinned", value)} label="Listenin başına sabitle" />
          <Switch
            checked={form.requiresAck}
            onChange={(value) => set("requiresAck", value)}
            label="“Okudum, anladım” onayı iste (İSG talimatı, yönetmelik tebliği vb.)"
          />
        </div>
      </form>
    </Modal>
  );
}

function ReadsModal({ announcement, users, onClose }: { announcement: Announcement; users: User[]; onClose: () => void }) {
  const [reads, setReads] = useState<AnnouncementRead[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAnnouncementReads(announcement.id)
      .then((rows) => !cancelled && setReads(rows))
      .catch((err) => console.error("Okuma kayıtları yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [announcement.id]);

  const unread = useMemo(() => {
    const readIds = new Set((reads ?? []).map((read) => read.userId));
    return users.filter((u) => !readIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [reads, users]);

  return (
    <Modal open onClose={onClose} className="sm:max-w-xl" title="Okuma durumu" description={announcement.title}>
      {reads === null ? (
        <p className="text-sm text-zinc-500">Yükleniyor…</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-400">
              {announcement.requiresAck ? "Onaylayanlar" : "Okuyanlar"} ({reads.length})
            </h3>
            <ul className="space-y-1.5 text-sm">
              {reads.length === 0 && <li className="text-zinc-500">Henüz kimse yok.</li>}
              {reads.map((read) => (
                <li key={read.userId} className="text-zinc-200">
                  {read.userName || "—"}
                  <span className="block text-xs text-zinc-500">{formatStamp(read.readAt)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-400">Henüz okumayanlar ({unread.length})</h3>
            <ul className="space-y-1.5 text-sm">
              {unread.length === 0 && <li className="text-zinc-500">Herkes okudu.</li>}
              {unread.map((u) => (
                <li key={u.id} className="text-zinc-300">
                  {u.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function AnnouncementsPage() {
  return (
    <AuthGuard routeKey="announcements">
      <AnnouncementsContent />
    </AuthGuard>
  );
}
