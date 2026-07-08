"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Coins,
  Check,
  Edit2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useStores } from "@/contexts/stores-context";
import { useStoreData } from "@/contexts/store-data-context";
import { formatCurrency } from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminBudgetsPanel() {
  const { stores, updateStore } = useStores();
  const { getStoreData } = useStoreData();
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState("");
  const [message, setMessage] = useState("");

  // Map stores with dynamic calculated spent amounts from materials lists
  const storesData = stores.map((store) => {
    const sData = getStoreData(store.id);
    const spentAmount = sData.materials.reduce(
      (sum, m) => sum + m.quantity * m.unitPrice,
      0
    );
    const remainingBudget = store.totalBudget - spentAmount;
    const isOverrun = spentAmount > store.totalBudget;
    const percentSpent =
      store.totalBudget > 0 ? (spentAmount / store.totalBudget) * 100 : 0;

    return {
      ...store,
      spentAmount,
      remainingBudget,
      isOverrun,
      percentSpent,
    };
  });

  // Calculate overall metrics
  const totalBudget = storesData.reduce((sum, s) => sum + s.totalBudget, 0);
  const totalSpent = storesData.reduce((sum, s) => sum + s.spentAmount, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overrunStores = storesData.filter((s) => s.isOverrun);
  const totalOverrunBudgetStores = overrunStores.length;

  const startEdit = (storeId: string, currentBudget: number) => {
    setEditingStoreId(storeId);
    setEditBudgetValue(String(currentBudget));
    setMessage("");
  };

  const saveBudget = (storeId: string) => {
    const parsedBudget = Number(editBudgetValue);
    if (isNaN(parsedBudget) || parsedBudget < 0) {
      setMessage("Geçersiz bütçe değeri");
      return;
    }

    updateStore(storeId, { totalBudget: parsedBudget });
    setEditingStoreId(null);
    setMessage("Bütçe güncellendi");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Toplam Bütçe"
          value={formatCurrency(totalBudget)}
          accent="violet"
        />
        <MetricCard
          icon={TrendingUp}
          label="Toplam Harcanan"
          value={formatCurrency(totalSpent)}
          accent="amber"
        />
        <MetricCard
          icon={TrendingDown}
          label="Kalan Bütçe"
          value={formatCurrency(totalRemaining)}
          accent={totalRemaining >= 0 ? "emerald" : "red"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Bütçe Aşımı Olan Şantiye"
          value={`${totalOverrunBudgetStores} / ${stores.length}`}
          accent={totalOverrunBudgetStores > 0 ? "red" : "cyan"}
        />
      </div>

      {/* Visual Chart Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">Bütçe Kullanım Analizi</h2>
          <div className="space-y-3">
            {storesData
              .slice(0, 5)
              .sort((a, b) => b.percentSpent - a.percentSpent)
              .map((store) => {
                const isOver = store.isOverrun;
                return (
                  <div key={store.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-300">{store.name}</span>
                      <span className={isOver ? "text-red-400 font-semibold" : "text-zinc-400"}>
                        %{Math.round(store.percentSpent)} ({formatCurrency(store.spentAmount)})
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? "bg-red-500" : "bg-violet-500"
                        }`}
                        style={{ width: `${Math.min(store.percentSpent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">Genel Finansal Özet</h2>
            <div className="mt-4 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Ortalama Bütçe</span>
                <span className="font-semibold text-zinc-300">
                  {formatCurrency(stores.length ? totalBudget / stores.length : 0)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Bütçe Verimliliği (Spent/Budget)</span>
                <span className="font-semibold text-zinc-300">
                  %{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Kritik Limit Şantiyeleri (&gt;%90)</span>
                <span className="font-semibold text-zinc-300">
                  {storesData.filter((s) => s.percentSpent >= 90).length}
                </span>
              </div>
            </div>
          </div>
          {message && (
            <div className="mt-4 rounded-lg bg-zinc-950/60 p-2 text-center text-xs text-emerald-400 border border-emerald-500/10">
              {message}
            </div>
          )}
        </section>
      </div>

      {/* Stores Budgets List Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-medium text-zinc-200">Şantiye Bütçe Listesi ({stores.length})</h2>
        </div>
        <div className="overflow-x-auto scrollbar-themed">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-950/40 text-zinc-500 uppercase tracking-wider text-[10px]">
              <tr className="border-b border-zinc-800">
                <th className="px-5 py-3 font-medium">Şantiye / Mağaza</th>
                <th className="px-4 py-3 font-medium">Şehir</th>
                <th className="px-4 py-3 font-medium text-right">Toplam Bütçe</th>
                <th className="px-4 py-3 font-medium text-right">Harcanan Tutar</th>
                <th className="px-4 py-3 font-medium text-right">Kalan Tutar</th>
                <th className="px-4 py-3 font-medium text-center">Bütçe Durumu</th>
                <th className="px-5 py-3 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {storesData.map((store) => {
                const isEditing = editingStoreId === store.id;
                const isOver = store.isOverrun;

                return (
                  <tr
                    key={store.id}
                    className="border-b border-zinc-800/60 hover:bg-white/[0.01] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-200">{store.name}</td>
                    <td className="px-4 py-3.5 text-zinc-400">{store.city}</td>
                    <td className="px-4 py-3.5 text-right font-medium">
                      {isEditing ? (
                        <div className="flex justify-end">
                          <Input
                            type="number"
                            value={editBudgetValue}
                            onChange={(e) => setEditBudgetValue(e.target.value)}
                            className="h-7 w-28 text-right text-xs bg-zinc-950"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="text-zinc-200">{formatCurrency(store.totalBudget)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-400 font-medium">
                      {formatCurrency(store.spentAmount)}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-medium ${
                        store.remainingBudget < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {formatCurrency(store.remainingBudget)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-400 animate-pulse">
                          Bütçe Aşımı!
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveBudget(store.id)}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                            title="Kaydet"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStoreId(null)}
                            className="p-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 cursor-pointer"
                            title="İptal"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] cursor-pointer"
                          onClick={() => startEdit(store.id, store.totalBudget)}
                        >
                          <Edit2 className="h-3 w-3 mr-1" />
                          Düzenle
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "cyan" | "violet" | "emerald" | "amber" | "red";
}) {
  const colorMap = {
    cyan: { icon: "text-cyan-400", bg: "bg-cyan-500/10" },
    violet: { icon: "text-violet-400", bg: "bg-violet-500/10" },
    emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { icon: "text-amber-400", bg: "bg-amber-500/10" },
    red: { icon: "text-red-400", bg: "bg-red-500/10 animate-pulse" },
  } as const;
  const colors = colorMap[accent];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-750">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">{label}</p>
        <div className={`rounded-lg p-1.5 ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.icon}`} />
        </div>
      </div>
      <p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
