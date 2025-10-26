// trade-flash/src/occ.ts
// Very light OCC parser (best-effort)
export function parseOCC(occ: string) {
  // ROOT(1-6) + YYMMDD + C/P + 8-digit strike
  const m = occ.match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/i);
  if (!m) return null;
  const [_, root, ymd, right, strike8] = m;
  const y = '20' + ymd.slice(0,2), mo = ymd.slice(2,4), d = ymd.slice(4,6);
  const strike = Number(strike8) / 1000;
  return { root, expiry: `${y}-${mo}-${d}`, right: right as 'C'|'P', strike };
}

