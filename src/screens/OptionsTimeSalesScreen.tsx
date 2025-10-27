import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View, Text, Switch, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { parseOCC } from "../occ";
import { startWatch } from "../api";
import { useProvider } from "../state/ProviderContext";
import ProviderChip from "../components/ProviderChip";

/* ========== Types ========== */
type Row = {
  id: string; ts: number; tstr: string;
  option: { expiry: string; strike: number; right: "C"|"P" };
  qty: number; price: number;
  side?: "BOT"|"SLD"|"—";
  side_src?: "mid"|"tick"|"none"|"uptick";
  oi?: number;
  priorVol?: number;
  at?: "bid"|"ask"|"mid"|"between";
  action?: "BTO"|"STO"|"BTC"|"STC"|"OPEN?"|"CLOSE?"|"—";
  action_conf?: "high"|"medium"|"low";
};
type EqRow = {
  id: string; ts: number; tstr: string; symbol: string; qty: number; price: number;
  side?: "BOT"|"SLD"|"—";
  side_src?: "mid"|"tick"|"none"|"uptick";
  at?: "bid"|"ask"|"mid"|"between";
};

/* ========== UI helpers ========== */
const debounce = (fn: Function, ms=300) => { let t:any; return (...a:any[]) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const sideColor = (side?: string) => side === "BOT" ? "#16a34a" : side === "SLD" ? "#dc2626" : "#6b7280";
const confColor = (c?: string) => c === "high" ? "#065f46" : c === "medium" ? "#1f2937" : "#6b7280";
const actBg = (a?: string) =>
  a === "BTO" ? "#dcfce7" : a === "STO" ? "#fee2e2" :
  a === "BTC" ? "#e0f2fe" : a === "STC" ? "#e0e7ff" :
  a === "OPEN?" ? "#fef9c3" : a === "CLOSE?" ? "#e5e7eb" : "#f3f4f6";

const SideBadge = ({ side, src }: { side?: "BOT"|"SLD"|"—"; src?: "mid"|"tick"|"none"|"uptick" }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <Text style={{ color: "white", backgroundColor: sideColor(side), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>
      {side ?? "—"}
    </Text>
    {src ? <Text style={{ color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12 }}>{src}</Text> : null}
  </View>
);
const ActionBadge = ({ action, conf }: { action?: Row["action"]; conf?: Row["action_conf"] }) => (
  <Text style={{ color: confColor(conf), backgroundColor: actBg(action), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>
    {action ?? "—"}{conf ? ` (${conf})` : ""}
  </Text>
);

const fmtK = (n?: number) => (n ?? 0) >= 1000 ? `${(n!/1000).toFixed(1)}k` : `${n ?? 0}`;
const pad2 = (n:number)=> (n<10?`0${n}`:`${n}`);
const pad3 = (n:number)=> n<10?`00${n}`:n<100?`0${n}`:`${n}`;

/* ========== Component ========== */
export default function OptionsTimeSalesScreen() {
  const { provider } = useProvider();
  const [symbol, setSymbol] = useState("SPY");
  const [equityFallback, setEquityFallback] = useState(true);
  const [minQty, setMinQty] = useState<number>(100);

  // toggles
  const [hideUnknown, setHideUnknown] = useState<boolean>(false);
  const [edgesOnly, setEdgesOnly] = useState<boolean>(false);
  const [msTime, setMsTime] = useState<boolean>(false);
  const [showNet, setShowNet] = useState<boolean>(true);

  const [rowsByRoot, setRowsByRoot] = useState<Record<string, Row[]>>({});
  const [eqRows, setEqRows] = useState<Record<string, EqRow[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const seq = useRef(0); const nextId = () => `ots_${++seq.current}`;

  // client uptick fallback (in case server misses a side)
  const lastByOCC = useRef<Record<string, number>>({});
  const lastByRootEq = useRef<Record<string, number>>({});
  const inferSideOCC = (occ: string, price: number): "BOT"|"SLD"|"—" => {
    const prev = lastByOCC.current[occ]; let side:"BOT"|"SLD"|"—"="—";
    if (typeof prev === "number") { if (price > prev) side="BOT"; else if (price < prev) side="SLD"; }
    lastByOCC.current[occ]=price; return side;
  };
  const inferSideEq = (root: string, price: number): "BOT"|"SLD"|"—" => {
    const prev = lastByRootEq.current[root]; let side:"BOT"|"SLD"|"—"="—";
    if (typeof prev === "number") { if (price > prev) side="BOT"; else if (price < prev) side="SLD"; }
    lastByRootEq.current[root]=price; return side;
  };

  const fmtTickTime = (ts:number, raw?: string) => {
    if (msTime) {
      const d = new Date(ts);
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
    }
    if (raw && raw.length >= 19) return raw.slice(11, 19);
    return new Date(ts).toLocaleTimeString();
  };

  const requestDataFor = useRef(debounce(async (root:string) => {
    const s = root.trim().toUpperCase(); if (!s) return;
    try {
      await startWatch({ symbols:[s], eqForTS:[s], backfill: 10, limit: 200, moneyness: 0.25, provider, });
    } catch (e) { console.warn("startWatch(OTS) failed:", e); }
  }, 400)).current;
  //useEffect(() => { requestDataFor(symbol); }, [symbol]);
  useEffect(() => {
    console.log(`[OTS] startWatch for ${symbol} with provider=${provider}`);
    // wipe local caches so the list reflects the new feed immediately
    setRowsByRoot({});
    setEqRows({});
    lastByOCC.current = {};
    lastByRootEq.current = {};  

    console.log(`[OTS] startWatch for ${symbol} with provider=${provider}`);
    requestDataFor(symbol);
  }, [symbol, provider]);

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        
        if (m.type === "option_ts") {
          const provider = (m as any).provider as ("tradier"|"alpaca"|undefined);
          const occ = m.symbol; const parsed = parseOCC(occ); const root = parsed?.root ?? occ;
          const price = Number(m.data.price); const qty = Number(m.data.qty);
          if (!(price > 0 && qty > 0)) return;

          // prefer server inference; fallback to client uptick
          const chosen = (m.data as any).side
            ? { side: (m.data as any).side, side_src: ((m.data as any).side_src || "mid") as any }
            : (() => ({ side: inferSideOCC(occ, price), side_src: "uptick" as const }))();

          const ts = m.data.ts ?? Date.now();
          const r: Row = {
            id: nextId(), ts, tstr: fmtTickTime(ts),
            option: {
              expiry: parsed?.expiry || m.data.option?.expiry || "",
              strike: parsed?.strike || m.data.option?.strike || 0,
              right: parsed?.right || m.data.option?.right || "C",
            },
            qty, price, ...chosen,
            oi: (m.data as any).oi,
            priorVol: (m.data as any).priorVol,
            at: (m.data as any).at,
            action: (m.data as any).action,
            action_conf: (m.data as any).action_conf, provider
          };
          setRowsByRoot(prev => ({ ...prev, [root]: [r, ...(prev[root] ?? [])].slice(0, 1200) }));
        }

        if (m.type === "equity_ts") {
          const provider = (m as any).provider as ("tradier"|"alpaca"|undefined);
          const root = m.symbol;
          const price = Number((m.data as any).price ?? (m.data as any).last ?? 0);
          const qty = Number((m.data as any).volume ?? (m.data as any).size ?? (m.data as any).qty ?? (m.data as any).quantity ?? 0);
          if (!(price > 0 && qty > 0)) return;

          const ts = Date.now();
          const chosen = (m.data as any).side
            ? { side: (m.data as any).side, side_src: ((m.data as any).side_src || "mid") as any }
            : (() => ({ side: inferSideEq(root, price), side_src: "uptick" as const }))();

          const r: EqRow = {
            id: nextId(), ts, tstr: fmtTickTime(ts, (m.data as any).time),
            symbol: root, qty, price, ...chosen, at: (m.data as any).at, provider
          };
          setEqRows(prev => ({ ...prev, [root]: [r, ...(prev[root] ?? [])].slice(0, 1200) }));
        }
      }
    });
    return () => wsRef.current?.close();
  }, [msTime]);

  const root = symbol.trim().toUpperCase();
  const optionDataAll = rowsByRoot[root] ?? [];
  const equityDataAll = eqRows[root] ?? [];

  const viewingOptions = !(equityFallback && optionDataAll.length === 0);
  const baseData = viewingOptions ? optionDataAll : equityDataAll;

  // Filters
  const filtered = useMemo(() => {
    return baseData
      .filter((r: any) => r.qty >= (minQty || 0))
      .filter((r: any) => (!hideUnknown ? true : (r.side && r.side !== "—" && r.side_src && r.side_src !== "none")))
      .filter((r: any) => (!edgesOnly ? true : (r.at === "bid" || r.at === "ask")));
  }, [baseData, minQty, hideUnknown, edgesOnly]);

  // Per-second net delta for the filtered list
  const netRows = useMemo(() => {
    if (!showNet) return [];
    const map = new Map<number, { bot: number; sld: number }>();
    for (const r of filtered) {
      const sec = Math.floor(r.ts / 1000);
      const m = map.get(sec) || { bot: 0, sld: 0 };
      if (r.side === "BOT") m.bot += Number(r.qty || 0);
      else if (r.side === "SLD") m.sld += Number(r.qty || 0);
      map.set(sec, m);
    }
    const arr = [...map.entries()]
      .sort((a,b)=>b[0]-a[0]).slice(0, 12)
      .map(([sec, v]) => {
        const delta = (v.bot - v.sld);
        return { sec, time: new Date(sec*1000), bot: v.bot, sld: v.sld, delta };
      });
    const maxAbs = arr.reduce((mx, x) => Math.max(mx, Math.abs(x.delta)), 0);
    return arr.map(x => ({ ...x, maxAbs }));
  }, [filtered, showNet]);

  const biggest = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => (b.qty || 0) - (a.qty || 0)).slice(0, 2);
  }, [filtered]);

  const bump = (delta: number) => setMinQty(q => Math.max(0, (q || 0) + delta));

  const AtPill = ({ at }: { at?: Row["at"] }) => (
    <Text style={{
      color: at === "ask" ? "#1f2937" : at === "bid" ? "#1f2937" : "#374151",
      backgroundColor: at === "ask" ? "#fde68a" : at === "bid" ? "#bfdbfe" : "#e5e7eb",
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12
    }}>
      {at ? `at ${at}` : "at —"}
    </Text>
  );

  return (
    <View style={{ flex: 1 }}>
      <SearchBar value={symbol} onChangeText={setSymbol} placeholder="Type a symbol (e.g., NVDA)" />

      {/* Toolbar */}
      <View style={s.toolbar}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Text style={s.heading}>Min Qty</Text>
          <TouchableOpacity onPress={() => bump(-100)} style={s.btn}><Text>-100</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => bump(-10)} style={s.btn}><Text>-10</Text></TouchableOpacity>
          <TextInput keyboardType="numeric" value={String(minQty ?? 0)} onChangeText={(t) => setMinQty(Number(t) || 0)} style={s.qtyInput} />
          <TouchableOpacity onPress={() => bump(+10)} style={s.btn}><Text>+10</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => bump(+100)} style={s.btn}><Text>+100</Text></TouchableOpacity>
        </View>

        <View style={{ gap: 6 }}>
          <View style={s.toggleRow}>
            <Text style={s.dim}>Hide unknown side</Text>
            <Switch value={hideUnknown} onValueChange={setHideUnknown} />
          </View>
          <View style={s.toggleRow}>
            <Text style={s.dim}>Only edge prints (at bid/ask)</Text>
            <Switch value={edgesOnly} onValueChange={setEdgesOnly} />
          </View>
          <View style={s.toggleRow}>
            <Text style={s.dim}>Millisecond timestamps</Text>
            <Switch value={msTime} onValueChange={setMsTime} />
          </View>
          <View style={s.toggleRow}>
            <Text style={s.dim}>Show per-second net delta</Text>
            <Switch value={showNet} onValueChange={setShowNet} />
          </View>
        </View>
      </View>

      {/* Legends */}
      <View style={{ gap: 6, paddingHorizontal: 12, marginTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <SideBadge side="BOT" src="mid" />
          <Text style={{ color: "#6b7280" }}>buyer-aggress (ask-side)</Text>
          <SideBadge side="SLD" src="mid" />
          <Text style={{ color: "#6b7280" }}>seller-aggress (bid-side)</Text>
          <Text style={{ color: "#6b7280" }}>src: mid &gt; tick &gt; uptick</Text>
        </View>

        {/** Options legend shows only when we’re actually viewing options (not equity fallback) */}
        {(!(equityFallback && (rowsByRoot[root]?.length ?? 0) === 0)) ? (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Text style={{ fontWeight: "700" }}>Options Action Legend</Text>
              <Text style={{ color: "#374151", backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>BTO (high)</Text>
              <Text style={{ color: "#374151", backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>STO (high)</Text>
              <Text style={{ color: "#1f2937", backgroundColor: "#e0f2fe", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>BTC (medium)</Text>
              <Text style={{ color: "#1f2937", backgroundColor: "#e0e7ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, fontWeight: "700" }}>STC (medium)</Text>
            </View>
            <Text style={{ color: "#6b7280" }}>
              logic: qty &gt; (OI + dayVol) ⇒ open; else if dayVol ≳ 80% of OI ⇒ close-lean
            </Text>
          </View>
        ) : null}
      </View>

      {/* Biggest */}
      {biggest.length === 0 ? <Text style={s.dim}>&mdash;</Text> :
        biggest.map(b => (
          <View key={b.id} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            {"option" in b ? (
              <Text style={{ fontWeight: "700" }}>
                {fmtTickTime(b.ts)} • {b.option.expiry} {b.option.strike} {b.option.right} • Qty {b.qty} @ {b.price} •{" "}
                <Text style={{ color: sideColor(b.side) }}>{b.side ?? "—"}</Text>
                {b.at ? <Text> at {b.at}</Text> : null}
                {"action" in b && b.action ? <Text> • {b.action}{b.action_conf ? ` (${b.action_conf})` : ""}</Text> : null}
              </Text>
            ) : (
              <Text style={{ fontWeight: "700" }}>
                {fmtTickTime(b.ts)} • {root} • Qty {b.qty} @ {b.price} •{" "}
                <Text style={{ color: sideColor(b.side) }}>{b.side ?? "—"}</Text>
                {b.at ? <Text> at {b.at}</Text> : null}
              </Text>
            )}
          </View>
        ))
      }

      {/* Net per-second (filtered) */}
      {showNet && netRows.length ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 6, gap: 2 }}>
          <Text style={[s.heading, { marginTop: 6 }]}>Per-second Net Delta</Text>
          {netRows.map((n) => (
            <View key={n.sec} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ width: 9*8, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color:"#6b7280" }}>
                {pad2(n.time.getHours())}:{pad2(n.time.getMinutes())}:{pad2(n.time.getSeconds())}
              </Text>
              {/* simple ascii bar */}
              <Text style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: n.delta>0?"#16a34a":n.delta<0?"#dc2626":"#6b7280" }}>
                {n.delta>0?"+":""}{n.delta}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Main list */}
      <FlatList
        data={filtered}
        keyExtractor={(i: any) => i.id}
        renderItem={({ item }) =>
          "option" in item ? (
            <View style={s.rowItem}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700" }}>{item.option.expiry} {item.option.strike} {item.option.right}</Text>
                <Text style={{ color: "#666", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtTickTime(item.ts)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text>Qty {item.qty} @ {item.price}</Text>
                <SideBadge side={item.side} src={item.side_src} />
                <Text style={s.pill}>at {item.at ?? "—"}</Text>
                {item.oi != null ? <Text style={s.pill}>OI {fmtK(item.oi)}</Text> : null}
                {item.priorVol != null ? <Text style={s.pill}>Vol prior {fmtK(item.priorVol)}</Text> : null}
                <ActionBadge action={item.action} conf={item.action_conf} />
                <ProviderChip p={(item as any).provider} />
              </View>
            </View>
          ) : (
            <View style={s.rowItem}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontWeight: "700" }}>{root}</Text>
                <Text style={{ color: "#666", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{fmtTickTime(item.ts)}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text>Qty {item.qty} @ {item.price}</Text>
                <SideBadge side={item.side} src={item.side_src} />
                <Text style={s.pill}>at {item.at ?? "—"}</Text>
                <ProviderChip p={(item as any).provider} />
              </View>
            </View>
          )
        }
        ListHeaderComponent={<Text style={[s.heading, { paddingHorizontal: 12 }]}>Time & Sales {(!(equityFallback && optionDataAll.length===0)) ? "(Options)" : "(Equity)"}</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 2, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heading: { fontWeight: "800", fontSize: 16 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dim: { color: "#777" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { borderWidth: 1, borderColor: "#ccc", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  qtyInput: { width: 80, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, textAlign: "center" },
  rowItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  pill: { color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12 }
});
