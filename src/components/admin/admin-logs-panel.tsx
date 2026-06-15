"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Filter, Trash2 } from "lucide-react";
import { useActivityLogs } from "@/hooks/use-activity-logs";
import { clearActivityLogs } from "@/lib/activity-log";
import { Button } from "@/components/ui/button";
import type { ActivityCategory } from "@/types";

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  auth: "Oturum",
  user: "Kullanıcı",
  permission: "Yetki",
  region: "Bölge",
  store: "Konum",
  system: "Sistem",
};

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  auth: "text-cyan-400 bg-cyan-500/10",
  user: "text-violet-400 bg-violet-500/10",
  permission: "text-amber-400 bg-amber-500/10",
  region: "text-emerald-400 bg-emerald-500/10",
  store: "text-pink-400 bg-pink-500/10",
  system: "text-zinc-400 bg-zinc-500/10",
};

export function AdminLogsPanel() {
  const logs = useActivityLogs();
  const [category, setCategory] = useState<ActivityCategory | "all">("all");

  const filtered = useMemo(() => {
    if (category === "all") return logs;
    return logs.filter((l) => l.category === category);
  }, [logs, category]);

  const handleClear = () => {
    if (confirm("Tüm aktivite logları silinsin mi?")) {
      clearActivityLogs();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ActivityCategory | "all")
            }
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
          >
            <option value="all">Tüm kategoriler</option>
            {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-600">{filtered.length} kayıt</span>
        </div>
        {logs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleClear}>
            <Trash2 className="h-3.5 w-3.5" />
            Logları temizle
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="scrollbar-themed max-h-[calc(100vh-18rem)] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-zinc-950/95 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tarih</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">İşlem</th>
                <th className="px-4 py-3 font-medium">Detay</th>
                <th className="px-4 py-3 font-medium">Kullanıcı</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-600">
                    Henüz log kaydı yok
                  </td>
                </tr>
              )}
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-zinc-800/80 hover:bg-white/[0.02]"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                    {format(parseISO(log.createdAt), "d MMM yyyy, HH:mm", {
                      locale: tr,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLORS[log.category]}`}
                    >
                      {CATEGORY_LABELS[log.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{log.action}</td>
                  <td className="px-4 py-3 text-zinc-300">{log.message}</td>
                  <td className="px-4 py-3 text-zinc-500">{log.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
