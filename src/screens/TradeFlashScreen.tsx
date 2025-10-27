import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { startWatch } from "../api";
import { useProvider } from "../state/ProviderContext";
import ProviderChip from "../components/ProviderChip";

// ===================== Types =====================
type FlashItem = {
  id: string;
  ts: number; // epoch millis when received (client)
  rawTime?: string; // raw provider timestamp string when available
  symbol: string;
  qty: number;
  price: number;
  notional?: number;
  side?: "BOT" | "SLD" | "—";
  side_src?: "mid" | "tick" | "none" | "uptick";
  edge?: "bid" | "ask" | undefined; // whether print is at the inside
};

type NBBO = { bid?: number; ask?: number };

const debounce = (fn: Function, ms = 300) => { let t: any; return (...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Badges / Legend ----------
const sideColor = (side?: string) =>
  side === "BOT" ? "#16a34a" : side === "SLD" ? "#dc2626" : "#6b7280";

const SideBadge = ({ side, src }: { side?: "BOT"|"SLD"|"—"; src?: "mid"|"tick"|"none"|"uptick" }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <Text style={{
      color: "white",
      backgroundColor: sideColor(side),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      fontWeight: "700",
      overflow: "hidden"
    }}>
      {side ?? "—"}
    </Text>
    {src ? (
      <Text style={{
        color: "#374151",
        backgroundColor: "#e5e7eb",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        fontSize: 12
      }}>
        {src}
      </Text>
    ) : null}
  </View>
);

const Toggle = ({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) => (
  <TouchableOpacity onPress={onToggle} style={[s.toggle, value && s.toggleOn]}>
    <Text style={[s.toggleText, value && s.toggleTextOn]}>{label}</Text>
  </TouchableOpacity>
);

export default function TradeFlashScreen() {
  const { provider } = useProvider(); 
  const [symbol, setSymbol] = useState("SPY");
  const [minQty, setMinQty] = useState<number>(100);
  const [items, setItems] = useState<FlashItem[]>([]);
  const seq = useRef(0); const nextId = () => `row_${++seq.current}`;
  const wsRef = useRef<WebSocket | null>(null);

  // ---------- New toggles ----------
  const [hideUnknown, setHideUnknown] = useState(false); // Hide unknown side (—)
  const [onlyEdge, setOnlyEdge] = useState(false);       // Only at bid/ask
  const [showMs, setShowMs] = useState(false);           // Millisecond timestamps
  const [showPerSecDelta, setShowPerSecDelta] = useState(true); // Per-second net delta

  // client uptick fallback cache
  const lastTradeBySym = useRef<Record<string, number>>({});

  // NBBO cache (best effort; populated from quote messages)
  const nbboBySym = useRef<Record<string, NBBO>>({});

  // subscribe/backfill ANY typed symbol
  const requestDataFor = useRef(debounce(async (root: string) => {
    const s = root.trim().toUpperCase(); if (!s) return;
    try {
      await startWatch({ symbols: [s], eqForTS: [s], backfill: 10, limit: 200, moneyness: 0.25, provider });
    } catch (e) { console.warn("startWatch(TF) failed:", e); }
  }, 400)).current;
  useEffect(() => { requestDataFor(symbol); }, [symbol, provider]);

  // Render-time formatter: respects the ms toggle instantly
  const fmtTickTime = (raw?: string, fallbackTs?: number) => {
    if (raw && raw.length >= 19) {
      // ISO-like: 2025-10-25T12:34:56.789Z
      const hhmmss = raw.slice(11, 19);
      if (!showMs) return hhmmss;
      const msecMatch = raw.match(/\.(\d{1,3})/);
      return msecMatch ? `${hhmmss}.${msecMatch[1].padEnd(3, "0")}` : `${hhmmss}.000`;
    }
    const d = new Date(fallbackTs ?? Date.now());
    const base = d.toLocaleTimeString();
    return showMs ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
  };

  const inferSideClient = (sym: string, price: number): { side:"BOT"|"SLD"|"—"; side_src:"uptick" } => {
    const prev = lastTradeBySym.current[sym];
    let side: "BOT"|"SLD"|"—" = "—";
    if (typeof prev === "number") { if (price > prev) side = "BOT"; else if (price < prev) side = "SLD"; }
    lastTradeBySym.current[sym] = price;
    return { side, side_src: "uptick" };
  };

  const classifyEdge = (sym: string, px: number, explicitBid?: number, explicitAsk?: number): FlashItem["edge"] => {
    // Prefer explicit bid/ask if provided on the message
    const bid = explicitBid ?? nbboBySym.current[sym]?.bid;
    const ask = explicitAsk ?? nbboBySym.current[sym]?.ask;
    if (bid == null || ask == null) return undefined;
    // Use small epsilon to account for floats
    const eps = Math.max(1e-6, Math.min(ask, bid) * 1e-6);
    if (Math.abs(px - bid) <= eps) return "bid";
    if (Math.abs(px - ask) <= eps) return "ask";
    return undefined;
  };

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        const provider = (m as any).provider as ("tradier"|"alpaca"|undefined);

        // ----- Quotes (NBBO + trade-like last/size) -----
        if (m.type === "quotes") {
          const q: any = m.data;
          if (q?.bid != null || q?.ask != null) {
            const sym = q.symbol;
            const entry = nbboBySym.current[sym] || {};
            if (typeof q.bid === "number") entry.bid = q.bid;
            if (typeof q.ask === "number") entry.ask = q.ask;
            nbboBySym.current[sym] = entry;
          }
          // Some feeds echo trade-like fields on quotes
          if (q?.last && q?.size && q.size > 0) {
            const sym = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(q.symbol)
              ? q.symbol.replace(/\d{6}[CP]\d{8}$/, "")
              : q.symbol;
            const price = Number(q.last);
            const qty = Number(q.size);
            const chosen = (m as any).side
              ? { side: (m as any).side, side_src: (((m as any).side_src || "mid") as any) }
              : inferSideClient(sym, price);
            const edge = classifyEdge(sym, price);
            setItems(prev => [
              { id: nextId(), ts: Date.now(), rawTime: q.time, symbol: sym, qty, price, notional: price*qty, edge, ...chosen, provider },
              ...prev
            ].slice(0, 800));
          }
          return;
        }

        // ----- Equity Trade & Sale (T&S) -----
        if (m.type === "equity_ts") {
          const d: any = m.data;
          const price = Number(d.price ?? d.last ?? 0);
          const qty = Number(d.volume ?? d.size ?? d.qty ?? d.quantity ?? 0);
          if (!(price > 0 && qty > 0)) return;
          const chosen = d.side
            ? { side: d.side as FlashItem["side"], side_src: ((d.side_src || "mid") as any) }
            : inferSideClient(m.symbol, price);
          const edge = classifyEdge(m.symbol, price, d.bid, d.ask);
          setItems(prev => [
            { id: nextId(), ts: Date.now(), rawTime: d.time, symbol: m.symbol, qty, price, notional: price * qty, edge, ...chosen, provider },
            ...prev
          ].slice(0, 800));
          return;
        }
      }
    });
    return () => wsRef.current?.close();
  }, []); // no dependency on showMs; timestamps are formatted at render-time

  // ---------- Filtering ----------
  const data = useMemo(() => {
    const root = symbol.trim().toUpperCase();
    return items.filter(i => {
      if (root && !i.symbol.includes(root)) return false;
      if (i.qty < (minQty || 0)) return false;
      if (hideUnknown && (i.side === "—" || !i.side)) return false;
      if (onlyEdge && !i.edge) return false;
      return true;
    });
  }, [items, symbol, minQty, hideUnknown, onlyEdge]);

  // ---------- Per-second net delta ----------
  const perSecondDelta = useMemo(() => {
    if (!showPerSecDelta) return [] as { second: number; net: number }[];
    const buckets: Record<number, number> = {};
    for (const i of data) {
      const sec = Math.floor(i.ts / 1000);
      const dir = i.side === "BOT" ? 1 : i.side === "SLD" ? -1 : 0;
      buckets[sec] = (buckets[sec] || 0) + dir * i.qty;
    }
    return Object.keys(buckets)
      .map(k => ({ second: Number(k), net: buckets[Number(k)] }))
      .sort((a,b) => b.second - a.second)
      .slice(0, 15);
  }, [data, showPerSecDelta]);

  const bump = (delta: number) => setMinQty(q => Math.max(0, (q || 0) + delta));

  return (
    <View style={{ flex: 1 }}>
      <SearchBar value={symbol} onChangeText={setSymbol} placeholder="Type a symbol (e.g., NVDA)" />

      {/* Controls */}
      <View style={s.toolbar}>
        <View style={{ gap: 6 }}>
          <Text style={s.heading}>Min Qty</Text>
          <View style={s.row}>
            <TouchableOpacity onPress={() => bump(-100)} style={s.btn}><Text>-100</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => bump(-10)} style={s.btn}><Text>-10</Text></TouchableOpacity>
            <TextInput keyboardType="numeric" value={String(minQty ?? 0)} onChangeText={(t) => setMinQty(Number(t) || 0)} style={s.qtyInput} />
            <TouchableOpacity onPress={() => bump(+10)} style={s.btn}><Text>+10</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => bump(+100)} style={s.btn}><Text>+100</Text></TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ gap: 6, maxWidth: 260 }}>
          <Text style={s.heading}>Toggles</Text>
          <View style={[s.row, { flexWrap: 'wrap' }]}> 
            <Toggle label="Hide unknown side" value={hideUnknown} onToggle={() => setHideUnknown(v => !v)} />
            <Toggle label="Only edge prints" value={onlyEdge} onToggle={() => setOnlyEdge(v => !v)} />
            <Toggle label="ms timestamps" value={showMs} onToggle={() => setShowMs(v => !v)} />
            <Toggle label="per-sec net Δ" value={showPerSecDelta} onToggle={() => setShowPerSecDelta(v => !v)} />
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <SideBadge side="BOT" src="mid" />
        <Text style={{ color: "#6b7280" }}>buyer-aggress</Text>
        <SideBadge side="SLD" src="mid" />
        <Text style={{ color: "#6b7280" }}>seller-aggress</Text>
        <Text style={{ color: "#6b7280" }}>src: mid › tick › uptick</Text>
        {onlyEdge ? <Text style={{ color: "#2563eb", fontWeight: "600" }}>(filtering to NBBO edge)</Text> : null}
      </View>

      {/* Optional per-second net delta panel */}
      {showPerSecDelta && perSecondDelta.length > 0 ? (
        <View style={s.deltaPanel}>
          <Text style={s.deltaTitle}>Per-second Net Δ (qty)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {perSecondDelta.map(({ second, net }) => (
              <View key={second} style={[s.deltaChip, net>0 ? s.deltaBuy : net<0 ? s.deltaSell : s.deltaFlat]}>
                <Text style={s.deltaChipText}>{new Date(second*1000).toLocaleTimeString()} · {net>0?`+${net}`:net}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={s.rowItem}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: 'center' }}>
              <Text style={{ fontWeight: "700" }}>{item.symbol}</Text>
              <Text style={{ color: "#666", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {fmtTickTime(item.rawTime, item.ts)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: 'wrap' }}>
              <Text>{item.qty} Shares/Contracts @ {item.price}</Text>
              <SideBadge side={item.side} src={item.side_src} />
              {item.edge ? (
                <Text style={[s.edgeTag, item.edge === 'ask' ? s.edgeAsk : s.edgeBid]}>{item.edge.toUpperCase()}</Text>
              ) : null}
              <ProviderChip p={(item as any).provider} />
            </View>
            {item.notional ? <Text>Notional ${Math.round(item.notional).toLocaleString()}</Text> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 30 }}>Waiting for prints…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heading: { fontWeight: "800", fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { borderWidth: 1, borderColor: "#ccc", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  qtyInput: { width: 80, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, textAlign: "center" },
  rowItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },

  // toggles
  toggle: { borderWidth: 1, borderColor: "#d1d5db", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  toggleOn: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  toggleText: { color: "#374151", fontWeight: "600" },
  toggleTextOn: { color: "#fff" },

  // delta chips
  deltaPanel: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#eee", backgroundColor: "#fafafa" },
  deltaTitle: { fontWeight: '700', marginBottom: 6 },
  deltaChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  deltaBuy: { borderColor: '#16a34a' },
  deltaSell: { borderColor: '#dc2626' },
  deltaFlat: { borderColor: '#9ca3af' },
  deltaChipText: { fontVariant: ['tabular-nums'] },

  edgeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '700', overflow: 'hidden', color: '#fff' },
  edgeBid: { backgroundColor: '#111827' },
  edgeAsk: { backgroundColor: '#111827' },
});
