/** Tadilat talebi / sözleşme kod önizlemesi — DB trigger ile uyumlu prefix'ler */

function maxSeq(codes: (string | undefined)[], prefix: string): number {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of codes) {
    if (!code) continue;
    const m = code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** prefix firma ayarlarından gelir (varsayılan TT); kod boş gönderilirse DB trigger'ı TT- üretir */
export function nextTicketCode(existing: { code?: string }[], prefix = "TT"): string {
  const n = maxSeq(
    existing.map((t) => t.code),
    prefix
  );
  return `${prefix}-${String(n + 1).padStart(4, "0")}`;
}

export function nextContractCode(existing: { code?: string }[], prefix = "SZ"): string {
  const n = maxSeq(
    existing.map((c) => c.code),
    prefix
  );
  return `${prefix}-${String(n + 1).padStart(4, "0")}`;
}
