const SERVER_HTTP = "https://tradeflash-production.up.railway.app"; //"https://tradeflash-ypmg.onrender.com"; // process.env.EXPO_PUBLIC_SERVER_HTTP || "http://localhost:8080";
//const SERVER_HTTP = "http://localhost:8080";
// import { SERVER_HTTP } from "./config";

export async function updateProviderCredentials(body: {
  tradier?: { token: string };
  alpaca?: { key: string; secret: string };
}) {
  const r = await fetch(`${SERVER_HTTP}/settings/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchPopularCombinedSymbols(top = 40) {
  const SERVER = "https://tradeflash-production.up.railway.app"; //"https://tradeflash-ypmg.onrender.com"; // process.env.EXPO_PUBLIC_SERVER || 'http://localhost:8080';
  //const SERVER = 'http://localhost:8080';
  const r = await fetch(`${SERVER}/popular/combined?top=${top}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ ok: true; ts: number; symbols: string[]; source: string }>;
}

export async function fetchScan(opts: { provider?: "alpaca"|"polygon"; by?: "volume"|"trades"; top?: number; moneyness?: number; minVol?: number }) {
  const p = new URLSearchParams();
  if (opts.provider)  p.set("provider", opts.provider);
  if (opts.by)        p.set("by", opts.by);
  if (opts.top != null)        p.set("top", String(opts.top));
  if (opts.moneyness != null)  p.set("moneyness", String(opts.moneyness));
  if (opts.minVol != null)     p.set("minVol", String(opts.minVol));
  const r = await fetch(`${SERVER_HTTP}/scan?${p.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchScanForSymbolsC(symbols: string[], opts?: { limit?: number; moneyness?: number; minVol?: number }) {
  const SERVER = "https://tradeflash-production.up.railway.app"; //"https://tradeflash-ypmg.onrender.com"; // process.env.EXPO_PUBLIC_SERVER || 'http://localhost:8080';
  //const SERVER = 'http://localhost:8080';
  const p = new URLSearchParams();
  if (symbols?.length) p.set('symbols', symbols.join(','));
  if (opts?.limit != null) p.set('limit', String(opts.limit));
  if (opts?.moneyness != null) p.set('moneyness', String(opts.moneyness));
  if (opts?.minVol != null) p.set('minVol', String(opts.minVol));
  const r = await fetch(`${SERVER}/scan?${p.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/**
export async function startWatch(body: {
  symbols: string[]; eqForTS?: string[]; limit?: number; moneyness?: number; backfill?: number; day?: string; expiries?: string[];
}) {
  const params = new URLSearchParams();
  params.set("symbols", body.symbols.join(","));
  if (body.eqForTS?.length) params.set("eqForTS", body.eqForTS.join(","));
  if (body.limit != null) params.set("limit", String(body.limit));
  if (body.moneyness != null) params.set("moneyness", String(body.moneyness));
  if (body.backfill != null) params.set("backfill", String(body.backfill));
  if (body.day) params.set("day", body.day);
  if (body.expiries?.length) params.set("expiries", body.expiries.join(","));
  const url = `${SERVER_HTTP}/watch?${params.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
// */
export async function startWatch(body: {
  symbols: string[];
  eqForTS?: string[];
  limit?: number;
  moneyness?: number;
  backfill?: number;
  day?: string;
  expiries?: string[];
  provider?: "tradier"|"alpaca"|"polygon"|"both";
  live?: 0|1;
  replay?: 0|1;
  minutes?: number;
  speed?: number;
}) {
  const qs = new URLSearchParams();
  const set = (k: string, v: any) => { if (v != null) qs.set(k, String(v)); };
  const setCSV = (k: string, arr?: string[]) => { if (arr?.length) qs.set(k, arr.join(",")); };

  setCSV("symbols", body.symbols);
  setCSV("eqForTS", body.eqForTS);
  set("limit", body.limit);
  set("moneyness", body.moneyness);
  set("backfill", body.backfill);
  set("day", body.day);
  setCSV("expiries", body.expiries);
  set("provider", body.provider);
  set("live", body.live);
  set("replay", body.replay);
  set("minutes", body.minutes);
  set("speed", body.speed);

  const url = `${SERVER_HTTP}/watch?${qs.toString()}`;

  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 15_000);

  try {
    const res = await fetch(url, { method: "GET", signal: ctl.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    // Surface nicer message for CORS/timeout
    if (err?.name === "AbortError") throw new Error("Request timed out");
    throw new Error(`startWatch failed: ${err?.message || String(err)}`);
  } finally {
    clearTimeout(timeout);
  }
}
// export async function startWatch(body: {
//   symbols: string[];
//   eqForTS?: string[];
//   limit?: number;
//   moneyness?: number;
//   backfill?: number;
//   day?: string;
//   expiries?: string[];
//   provider?: "tradier"|"alpaca"|"polygon"|"both";
// }) {
//   const params = new URLSearchParams();
//   params.set("symbols", body.symbols.join(","));
//   if (body.eqForTS?.length) params.set("eqForTS", body.eqForTS.join(","));
//   if (body.limit != null) params.set("limit", String(body.limit));
//   if (body.moneyness != null) params.set("moneyness", String(body.moneyness));
//   if (body.backfill != null) params.set("backfill", String(body.backfill));
//   if (body.day) params.set("day", body.day);
//   if (body.expiries?.length) params.set("expiries", body.expiries.join(","));
//   if (body.provider) params.set("provider", body.provider); // NEW

//   const url = `${SERVER_HTTP}/watch?${params.toString()}`;
//   const r = await fetch(url);
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }

// --- add below your other exports ---

export async function fetchPopularSymbols() {
  const r = await fetch(`${SERVER_HTTP}/popular`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ ok: true; ts: number; symbols: string[] }>;
}

export async function fetchScanForSymbols(symbols: string[], opts?: { limit?: number; moneyness?: number; minVol?: number }) {
  const p = new URLSearchParams();
  if (symbols?.length) p.set('symbols', symbols.join(','));
  if (opts?.limit != null) p.set('limit', String(opts.limit));
  if (opts?.moneyness != null) p.set('moneyness', String(opts.moneyness));
  if (opts?.minVol != null) p.set('minVol', String(opts.minVol));

  const r = await fetch(`${SERVER_HTTP}/scan?${p.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{
    ok: true;
    ts: number;
    groups: {
      popular: any[];
      most_active_large: any[];
      most_active_mid: any[];
      most_active_small: any[];
    };
    params: any;
  }>;
}

// --- Alpaca Popular (proxied by our server) ---
// export async function fetchPopular() {
//   const r = await fetch(`${SERVER_HTTP}/popular`);
//   const text = await r.text();
//   let json: any;
//   try { json = JSON.parse(text); } catch { json = { ok:false, data:text }; }
//   if (!r.ok || !json.ok) throw json;
//   return json as { ok:true; ts:number; symbols:string[]; source:string };
// }

export async function fetchPopular(provider?: "alpaca"|"polygon") {
  const p = new URLSearchParams();
  if (provider) p.set("provider", provider);
  const r = await fetch(`${SERVER_HTTP}/popular?${p.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchScans(opts?: { symbols?: string[]; limit?: number; moneyness?: number; minVol?: number }) {
  const p = new URLSearchParams();
  if (opts?.symbols?.length) p.set("symbols", opts.symbols.join(","));
  if (opts?.limit != null) p.set("limit", String(opts.limit));
  if (opts?.moneyness != null) p.set("moneyness", String(opts.moneyness));
  if (opts?.minVol != null) p.set("minVol", String(opts.minVol));
  const r = await fetch(`${SERVER_HTTP}/scan?${p.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{
    ok: boolean; ts: number; params: any;
    groups: {
      popular: ScanRow[]; most_active_large: ScanRow[]; most_active_mid: ScanRow[]; most_active_small: ScanRow[];
    }
  }>;
}

export type ScanRow = {
  symbol: string; last: number; volume: number; avg_volume: number; vr: number;
  uoa_count?: number; uoa_top?: { occ: string; vol: number; oi: number; last: number }[];
};

export type AlpRow = {
  symbol: string;
  volume?: number;
  trades?: number;
  change?: number;
  change_percent?: number;
  vol_today?: number;
  vol_prev?: number;
  vr_prev?: number; // today vs prev-day volume ratio
};

// export async function fetchAlpacaScan(opts?: { by?: "volume"|"trade_count"; top?: number; refresh?: 0|1 }) {
//   const p = new URLSearchParams();
//   if (opts?.by) p.set("by", opts.by);
//   if (opts?.top != null) p.set("top", String(opts.top));
//   if (opts?.refresh != null) p.set("refresh", String(opts.refresh));
//   const r = await fetch(`${SERVER_HTTP}/alpaca/scan?${p.toString()}`);
//   if (!r.ok) throw new Error(await r.text());
//   return r.json() as Promise<{
//     ok: boolean;
//     ts: number;
//     params: { by: string; top: number };
//     groups: { most_actives: AlpRow[]; gainers: AlpRow[]; losers: AlpRow[] };
//     history: { days: number; samples: number; top_hits: { symbol: string; hits: number }[] };
//   }>;
// }
// export async function fetchAlpacaScan(opts: {
//   by?: "volume"|"trade_count";
//   top?: number;
//   session?: "pre"|"regular"|"post";
//   filter?: ""|"gapup"|"gapdown";
//   minGap?: number; // e.g., 0.02 = 2%
// }) {
//   const qs = new URLSearchParams();
//   if (opts.by) qs.set("by", opts.by);
//   if (opts.top != null) qs.set("top", String(opts.top));
//   if (opts.session) qs.set("session", opts.session);
//   if (opts.filter != null) qs.set("filter", opts.filter);
//   if (opts.minGap != null) qs.set("minGap", String(opts.minGap));
//   const url = `${SERVER_HTTP}/alpaca/scan?${qs.toString()}`;
//   const r = await fetch(url);
//   if (!r.ok) throw new Error(await r.text());
//   return r.json();
// }
export async function fetchAlpacaScan(opts: {
  by?: "volume"|"trades";
  top?: number;
  session?: "pre"|"regular"|"post";
  filter?: ""|"gapup"|"gapdown";
  minGap?: number;
  refresh?: 0|1;
}) {
  const qs = new URLSearchParams();
  if (opts.by) qs.set("by", opts.by);
  if (opts.top != null) qs.set("top", String(opts.top));
  if (opts.session) qs.set("session", opts.session);
  if (opts.filter != null) qs.set("filter", opts.filter);
  if (opts.minGap != null) qs.set("minGap", String(opts.minGap));
  if (opts.refresh != null) qs.set("refresh", String(opts.refresh));
  const r = await fetch(`${SERVER_HTTP}/alpaca/scan?${qs.toString()}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// Shorthand “methods”
export const scanPreGapUp    = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"pre",    filter:"gapup",   minGap, top });
export const scanPreGapDown  = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"pre",    filter:"gapdown", minGap, top });
export const scanRegGapUp    = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"regular",filter:"gapup",   minGap, top });
export const scanRegGapDown  = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"regular",filter:"gapdown", minGap, top });
export const scanPostGapUp   = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"post",   filter:"gapup",   minGap, top });
export const scanPostGapDown = (minGap=0.02, top=50) => fetchAlpacaScan({ session:"post",   filter:"gapdown", minGap, top });
