"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { canAccessRoute } from "@/lib/permissions";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { clearTableMemory } from "@/lib/table-memory";
import {
  DEFAULT_USER_PREFERENCES,
  START_PAGES,
  applyPatch,
  normalizeOrgSettings,
  normalizeUserPreferences,
  type OrgSettings,
  type OrgSettingsPatch,
  type ToggleableModule,
  type UserPreferences,
  type UserPreferencesPatch,
} from "@/lib/settings";

/** Kapatılan bildirim listesi sınırsız büyümesin */
const MAX_DISMISSED = 1000;
const DISMISSED_SAVE_DELAY_MS = 600;

type SettingsContextValue = {
  org: OrgSettings;
  prefs: UserPreferences;
  /** Kullanıcı tercihleri veritabanından okundu mu */
  prefsLoaded: boolean;
  updatePreferences: (patch: UserPreferencesPatch) => Promise<boolean>;
  updateOrgSettings: (patch: OrgSettingsPatch) => Promise<boolean>;
  dismissedIds: string[];
  updateDismissed: (update: (prev: string[]) => string[]) => void;
  isModuleEnabled: (module: string) => boolean;
  /** Tercih edilen açılış sayfası; erişilemiyorsa haritaya düşer */
  homePath: string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadLegacyDismissed(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dismissedNotifications);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, organization, updateOrganization } = useAuth();
  const userId = user?.id;
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const prefsRef = useRef(prefs);
  const dismissedTimer = useRef<number | null>(null);

  const org = useMemo(() => normalizeOrgSettings(organization?.settings), [organization?.settings]);

  // Yanıt gelmeden yapılan art arda değişiklikler birbirini ezmesin
  const orgRef = useRef(org);
  useEffect(() => {
    orgRef.current = org;
  }, [org]);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("preferences, dismissed_notifications")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        // Migration uygulanmadıysa varsayılanlarla çalışmaya devam et
        console.error("Kullanıcı tercihleri yüklenemedi:", error);
        setDismissedIds(loadLegacyDismissed());
      } else {
        setPrefs(normalizeUserPreferences(data?.preferences));
        const stored = Array.isArray(data?.dismissed_notifications)
          ? (data.dismissed_notifications as unknown[]).filter((id): id is string => typeof id === "string")
          : [];
        // Eski sürümde kapatılanlar tarayıcıda tutuluyordu: bir kez taşı
        const legacy = loadLegacyDismissed();
        if (legacy.length > 0) {
          const merged = [...new Set([...stored, ...legacy])].slice(-MAX_DISMISSED);
          setDismissedIds(merged);
          const { error: migrateError } = await supabase
            .from("user_preferences")
            .upsert({ user_id: userId, dismissed_notifications: merged, updated_at: new Date().toISOString() });
          if (!migrateError) localStorage.removeItem(STORAGE_KEYS.dismissedNotifications);
        } else {
          setDismissedIds(stored);
        }
      }
      setPrefsLoaded(true);
    };
    void load();

    return () => {
      cancelled = true;
      setPrefs(DEFAULT_USER_PREFERENCES);
      setDismissedIds([]);
      setPrefsLoaded(false);
      // Aynı sekmede başka kullanıcı oturum açarsa önceki tablo durumu görünmesin
      clearTableMemory();
    };
  }, [userId]);

  const updatePreferences = useCallback(
    async (patch: UserPreferencesPatch) => {
      if (!userId) return false;
      const next = normalizeUserPreferences(applyPatch(prefsRef.current, patch));
      prefsRef.current = next;
      setPrefs(next);
      if (!next.tableMemory) clearTableMemory();
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, preferences: next, updated_at: new Date().toISOString() });
      if (error) {
        console.error("Tercihler kaydedilemedi:", error);
        return false;
      }
      return true;
    },
    [userId]
  );

  const updateOrgSettings = useCallback(
    async (patch: OrgSettingsPatch) => {
      const next = normalizeOrgSettings(applyPatch(orgRef.current, patch));
      orgRef.current = next;
      const ok = await updateOrganization({ settings: next as unknown as Record<string, unknown> });
      if (!ok) orgRef.current = normalizeOrgSettings(organization?.settings);
      return ok;
    },
    [organization?.settings, updateOrganization]
  );

  const updateDismissed = useCallback(
    (update: (prev: string[]) => string[]) => {
      setDismissedIds((prev) => {
        const next = update(prev).slice(-MAX_DISMISSED);
        if (userId) {
          // Art arda kapatmalar tek istekte kaydedilir
          if (dismissedTimer.current) window.clearTimeout(dismissedTimer.current);
          dismissedTimer.current = window.setTimeout(() => {
            void supabase
              .from("user_preferences")
              .upsert({ user_id: userId, dismissed_notifications: next, updated_at: new Date().toISOString() })
              .then(({ error }) => {
                if (error) console.error("Kapatılan bildirimler kaydedilemedi:", error);
              });
          }, DISMISSED_SAVE_DELAY_MS);
        }
        return next;
      });
    },
    [userId]
  );

  const isModuleEnabled = useCallback(
    (module: string) => (module in org.modules ? org.modules[module as ToggleableModule] : true),
    [org.modules]
  );

  const homePath = useMemo(() => {
    const page = START_PAGES.find((item) => item.value === prefs.startPage);
    if (!page || !user || !canAccessRoute(user, page.routeKey) || !isModuleEnabled(page.routeKey)) {
      return "/map";
    }
    return page.value;
  }, [prefs.startPage, user, isModuleEnabled]);

  const value = useMemo(
    () => ({
      org,
      prefs,
      prefsLoaded,
      updatePreferences,
      updateOrgSettings,
      dismissedIds,
      updateDismissed,
      isModuleEnabled,
      homePath,
    }),
    [org, prefs, prefsLoaded, updatePreferences, updateOrgSettings, dismissedIds, updateDismissed, isModuleEnabled, homePath]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
