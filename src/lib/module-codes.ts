/** Ticket / sözleşme kod önizlemesi — DB trigger ile uyumlu prefix'ler */

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

export function nextTicketCode(existing: { code?: string }[]): string {
  const n = maxSeq(
    existing.map((t) => t.code),
    "TT"
  );
  return `TT-${String(n + 1).padStart(4, "0")}`;
}

export function nextContractCode(existing: { code?: string }[]): string {
  const n = maxSeq(
    existing.map((c) => c.code),
    "SZ"
  );
  return `SZ-${String(n + 1).padStart(4, "0")}`;
}
