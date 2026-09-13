export function formatKRW(val: number): string {
  if (Math.abs(val) >= 100000000) {
    const eok = (val / 100000000).toFixed(2);
    return `${eok}억원`;
  }
  if (Math.abs(val) >= 10000) {
    const man = Math.round(val / 10000).toLocaleString();
    return `${man}만원`;
  }
  return `${val.toLocaleString()}원`;
}

export function formatNumber(val: number, decimals: number = 0): string {
  return val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPct(val: number, decimals: number = 1): string {
  return `${(val * 100).toFixed(decimals)}%`;
}
