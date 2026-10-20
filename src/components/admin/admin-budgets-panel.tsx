"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Edit2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useStores } from "@/contexts/stores-context";
import { useDb } from "@/contexts/db-context";
import { useTableState } from "@/hooks/use-table-state";
import {
  addMoney,
  DEFAULT_CURRENCY,
  formatMoney,
  formatMoneyTotals,
  mergeMoneyTotals,
  moneyEntries,
  roundMoney,
  sumMoney,
  type CurrencyCode,
  type MoneyTotals,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import {
  SortableTh,
  TablePagination,
} from "@/components/modules/module-table";
import type { Store } from "@/types";

/**
 * Kur çevrimi yok: harcanan ve kalan, bütçenin para birimindeki keşif
 * toplamıyla hesaplanır. Başka birimdeki keşif ayrıca gösterilir.
 */
type BudgetRow = Store & {
  spentAmount: number;
  /** Bütçeyle karşılaştırılamayan, başka para birimindeki keşif toplamları */
  otherSpent: MoneyTotals;
  remainingBudget: number;
  isOverrun: boolean;
  percentSpent: number;
};

type SortKey =
  | "name"
  | "city"
  | "totalBudget"
  | "spentAmount"
  | "remainingBudget"
  | "percentSpent";

export function AdminBudgetsPanel() {
  const { stores, updateStore } = useStores();
  const { storeSummaries } = useDb();
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState<number | null>(null);
  const [editBudgetCurrency, setEditBudgetCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [message, setMessage] = useState("");

  const storesData = useMemo(
    () =>
      stores.map((store) => {
        const { [store.budgetCurrency]: spent = 0, ...otherSpent } =
          storeSummaries[store.id]?.materialTotals ?? {};
        const spentAmount = spent;
        const remainingBudget = roundMoney(store.totalBudget - spentAmount);
        const isOverrun = spentAmount > store.totalBudget;
        const percentSpent =
          store.totalBudget > 0 ? (spentAmount / store.totalBudget) * 100 : 0;

        return {
          ...store,
          spentAmount,
          otherSpent,
          remainingBudget,
          isOverrun,
          percentSpent,
        };
      }),
    [stores, storeSummaries]
  );

  const getSortValue = useCallback((item: BudgetRow, key: SortKey) => {
    return item[key];
  }, []);

  const table = useTableState<BudgetRow, SortKey>({
    memoryKey: "admin-budgets",
    items: storesData,
    initialSort: { key: "percentSpent", direction: "desc" },
    getSortValue,
  });

  // Toplamlar para birimine göre; kalan = aynı birimdeki bütçe − harcanan
  const totalBudget = sumMoney(storesData, (s) => s.budgetCurrency, (s) => s.totalBudget);
  const totalSpent = mergeMoneyTotals(
    ...storesData.map((s) => addMoney(s.otherSpent, s.budgetCurrency, s.spentAmount))
  );
  const totalRemaining = moneyEntries(totalSpent).reduce(
    (remaining, [currency, spent]) => addMoney(remaining, currency, -spent),
    totalBudget
  );
  const hasDeficit = moneyEntries(totalRemaining).some(([, amount]) => amount < 0);
  const overrunStores = storesData.filter((s) => s.isOverrun);
  const totalOverrunBudgetStores = overrunStores.length;

  const averageBudget = formatMoneyTotals(
    Object.fromEntries(
      moneyEntries(totalBudget).map(([currency, amount]) => [
        currency,
        amount / storesData.filter((s) => s.budgetCurrency === currency).length,
      ])
    )
  );
  // Oran yalnızca aynı birimdeki bütçe ve harcamadan hesaplanır
  const efficiency =
    moneyEntries(totalBudget)
      .map(([currency, budget]) => {
        const spent = storesData
          .filter((s) => s.budgetCurrency === currency)
          .reduce((sum, s) => sum + s.spentAmount, 0);
        const percent = `%${Math.round((spent / budget) * 100)}`;
        return moneyEntries(totalBudget).length > 1 ? `${percent} (${currency})` : percent;
      })
      .join(" · ") || "%0";

  const startEdit = (store: BudgetRow) => {
    setEditingStoreId(store.id);
    setEditBudgetValue(store.totalBudget);
    setEditBudgetCurrency(store.budgetCurrency);
    setMessage("");
  };

  const saveBudget = async (storeId: string) => {
    if (editBudgetValue === null || editBudgetValue < 0) {
      setMessage("Geçersiz bütçe değeri");
      return;
    }

    const ok = await updateStore(storeId, {
      totalBudget: editBudgetValue,
      budgetCurrency: editBudgetCurrency,
    });
    if (!ok) {
      setMessage("Bütçe kaydedilemedi");
      return;
    }
    setEditingStoreId(null);
    setMessage("Bütçe güncellendi");
    setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Toplam Bütçe"
          value={formatMoneyTotals(totalBudget)}
          accent="violet"
        />
        <MetricCard
          icon={TrendingUp}
          label="Toplam Harcanan"
          value={formatMoneyTotals(totalSpent)}
          accent="amber"
        />
        <MetricCard
          icon={TrendingDown}
          label="Kalan Bütçe"
          value={formatMoneyTotals(totalRemaining)}
          accent={hasDeficit ? "red" : "emerald"}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Bütçe Aşımı Olan Şantiye"
          value={`${totalOverrunBudgetStores} / ${stores.length}`}
          accent={totalOverrunBudgetStores > 0 ? "red" : "cyan"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-zinc-300">
            Bütçe Kullanım Analizi
          </h2>
          <div className="space-y-3">
            {[...storesData]
              .sort((a, b) => b.percentSpent - a.percentSpent)
              .slice(0, 5)
              .map((store) => {
                const isOver = store.isOverrun;
                return (
                  <div key={store.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-300">
                        {store.name}
                      </span>
                      <span
                        className={
                          isOver
                            ? "text-red-400 font-semibold"
                            : "text-zinc-400"
                        }
                      >
                        %{Math.round(store.percentSpent)} (
                        {formatMoney(store.spentAmount, store.budgetCurrency)})
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isOver ? "bg-red-500" : "bg-violet-500"
                        }`}
                        style={{
                          width: `${Math.min(store.percentSpent, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-300">
              Genel Finansal Özet
            </h2>
            <div className="mt-4 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">Ortalama Bütçe</span>
                <span className="font-semibold text-zinc-300">
                  {averageBudget}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">
                  Bütçe Verimliliği (Spent/Budget)
                </span>
                <span className="font-semibold text-zinc-300">
                  {efficiency}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500">
                  Kritik Limit Şantiyeleri (&gt;%90)
                </span>
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

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="border-b border-zinc-800 px-5 py-4 flex items-center justify-between">
          <h2 className="font-medium text-zinc-200">
            Şantiye Bütçe Listesi ({stores.length})
          </h2>
        </div>
        <div className="overflow-x-auto scrollbar-themed">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-950/40 text-zinc-500 uppercase tracking-wider text-[10px]">
              <tr className="border-b border-zinc-800">
                <SortableTh
                  columnKey="name"
                  label="Şantiye / Mağaza"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                  className="px-5"
                />
                <SortableTh
                  columnKey="city"
                  label="Şehir"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
                <SortableTh
                  columnKey="totalBudget"
                  label="Toplam Bütçe"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                  className="text-right"
                />
                <SortableTh
                  columnKey="spentAmount"
                  label="Harcanan Tutar"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                  className="text-right"
                />
                <SortableTh
                  columnKey="remainingBudget"
                  label="Kalan Tutar"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                  className="text-right"
                />
                <SortableTh
                  columnKey="percentSpent"
                  label="Bütçe Durumu"
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                  className="text-center"
                />
                <th className="px-5 py-3 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {table.pageItems.map((store) => {
                const isEditing = editingStoreId === store.id;
                const isOver = store.isOverrun;

                return (
                  <tr
                    key={store.id}
                    className="border-b border-zinc-800/60 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-200">
                      {store.name}
                    </td>
                    <td className="px-4 py-3.5 text-zinc-400">{store.city}</td>
                    <td className="px-4 py-3.5 text-right font-medium">
                      {isEditing ? (
                        <div className="flex justify-end">
                          <MoneyInput
                            size="sm"
                            value={editBudgetValue}
                            onValueChange={setEditBudgetValue}
                            currency={editBudgetCurrency}
                            onCurrencyChange={setEditBudgetCurrency}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveBudget(store.id);
                              if (e.key === "Escape") setEditingStoreId(null);
                            }}
                            aria-label={`${store.name} bütçesi`}
                            className="w-48 bg-zinc-950"
                            autoFocus
                          />
                        </div>
                      ) : (
                        <span className="text-zinc-200">
                          {formatMoney(store.totalBudget, store.budgetCurrency)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right text-zinc-400 font-medium">
                      {formatMoney(store.spentAmount, store.budgetCurrency)}
                      {moneyEntries(store.otherSpent).length > 0 && (
                        <span
                          className="mt-0.5 block text-[10px] font-normal text-amber-400/80"
                          title="Bütçeden farklı para birimindeki keşif; kur çevrimi olmadığı için bütçeye sayılmaz"
                        >
                          + {formatMoneyTotals(store.otherSpent)}
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-medium ${
                        store.remainingBudget < 0
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {formatMoney(store.remainingBudget, store.budgetCurrency)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {isOver ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-400">
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
                          onClick={() => startEdit(store)}
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
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          onPageChange={table.setPage}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
        />
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
    red: { icon: "text-red-400", bg: "bg-red-500/10" },
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
