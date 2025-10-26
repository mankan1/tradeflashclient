import { SERVER_HTTP } from "./config";

export async function startWatch(params: {
  symbols: string[];
  eqForTS?: string[];
  limit?: number;
  moneyness?: number;
  backfill?: number;
  expiries?: string[];
  fullDay?: boolean;
}) {
  const q = new URLSearchParams();
  q.set("symbols", params.symbols.join(","));
  if (params.eqForTS) q.set("eqForTS", params.eqForTS.join(","));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.moneyness) q.set("moneyness", String(params.moneyness));
  if (params.backfill != null) q.set("backfill", String(params.backfill));
  if (params.expiries?.length) q.set("expiries", params.expiries.join(","));
  if (params.fullDay) q.set("fullday", "true");

  const res = await fetch(`${SERVER_HTTP}/watch?${q.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

