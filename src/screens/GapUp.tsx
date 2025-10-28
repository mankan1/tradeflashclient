import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Linking, Platform } from "react-native";
import {
  fetchAlpacaScan,
  scanPreGapUp, scanPreGapDown,
  scanRegGapUp, scanRegGapDown,
  scanPostGapUp, scanPostGapDown,
} from "../api";

type Row = {
  symbol: string;
  price: number;
  last: number;
  change_pct: number;   // 0.034 = +3.4%
  gap_pct: number;      // unified (server may send gap_session_pct / gap_open_pct)
  atr14: number;
};

const fmtNum = (n: any, d = 2) =>
  Number.isFinite(Number(n)) ? Number(n).toFixed(d) : "—";
const fmtPct = (p: any, d = 2) =>
  Number.isFinite(Number(p)) ? `${(Number(p) * 100).toFixed(d)}%` : "—";

export default function AlpacaScannerScreen() {
  const [session, setSession] = useState<"pre"|"regular"|"post">("regular");
  const [filter, setFilter]   = useState<""|"gapup"|"gapdown">("");
  const [by, setBy]           = useState<"volume"|"trades">("volume");
  const [minGap, setMinGap]   = useState<number>(0.02); // 2%
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string>("");

  const openYahoo = (sym: string) => {
    const url = `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      Linking.openURL(url).catch(() => {});
    }
  };

  const normalize = useCallback((data: any): Row[] => {
    const src = data?.groups?.most_actives ?? [];
    return (Array.isArray(src) ? src : []).map((r: any) => {
      const price = Number.isFinite(+r.price) ? +r.price : (Number.isFinite(+r.last) ? +r.last : NaN);
      const last  = Number.isFinite(+r.last)  ? +r.last  : price;
      const gapRaw = [r.gap_session_pct, r.gap_open_pct, r.gap_pct].find(v => Number.isFinite(+v));
      const gap = Number.isFinite(+gapRaw as number) ? +(gapRaw as number) : NaN;
      return {
        symbol: String(r.symbol || r.S || ""),
        price,
        last,
        change_pct: Number.isFinite(+r.change_pct) ? +r.change_pct : NaN,
        gap_pct: gap,
        atr14: Number.isFinite(+r.atr14) ? +r.atr14 : NaN,
      };
    });
  }, []);

  // Pick a helper when possible; otherwise use fetchAlpacaScan
  const pickHelper = useCallback(() => {
    if (filter === "gapup") {
      if (session === "pre")     return (mg: number, top: number) => scanPreGapUp(mg, top);
      if (session === "regular") return (mg: number, top: number) => scanRegGapUp(mg, top);
      if (session === "post")    return (mg: number, top: number) => scanPostGapUp(mg, top);
    }
    if (filter === "gapdown") {
      if (session === "pre")     return (mg: number, top: number) => scanPreGapDown(mg, top);
      if (session === "regular") return (mg: number, top: number) => scanRegGapDown(mg, top);
      if (session === "post")    return (mg: number, top: number) => scanPostGapDown(mg, top);
    }
    return null; // no specialized helper; use generic
  }, [session, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const helper = pickHelper();
      const top = 30;

      let data: any;
      if (helper) {
        // helper already sets session/filter; rank is still by `by`
        // If you want helpers to respect `by`, switch helpers to call fetchAlpacaScan internally with { by }
        data = await helper(minGap, top);
      } else {
        data = await fetchAlpacaScan({ by, top, session, filter, minGap });
      }

      setRows(normalize(data));
    } catch (e: any) {
      // small nicety for 429s
      const msg = e?.message || "";
      setErr(msg);
      setRows([]);
      if (/429|too many requests/i.test(msg)) {
        // simple backoff retry
        setTimeout(() => {
          fetchAlpacaScan({ by, top: 30, session, filter, minGap })
            .then(d => setRows(normalize(d)))
            .catch(() => {}) // swallow
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  }, [by, session, filter, minGap, normalize, pickHelper]);

  useEffect(() => { load(); }, [load]);

  const Badge = ({ label, active, onPress }: { label: string; active: boolean; onPress(): void }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1, borderColor: active ? "#111827" : "#c7c7c7",
        backgroundColor: active ? "#e5e7eb" : "#fff",
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginRight: 8
      }}>
      <Text style={{ fontWeight: active ? "800" : "600" }}>{label}</Text>
    </TouchableOpacity>
  );

  const RowItem = ({ r }: { r: Row }) => (
    <TouchableOpacity onPress={() => openYahoo(r.symbol)} style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontWeight: "800", fontSize: 16 }}>{r.symbol}</Text>
        <Text style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{fmtNum(r.price, 2)}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <Text>Last: {fmtNum(r.last, 2)}</Text>
        <Text>Δ%: {fmtPct(r.change_pct, 2)}</Text>
        <Text>Gap%: {fmtPct(r.gap_pct, 2)}</Text>
        <Text>ATR14: {fmtNum(r.atr14, 2)}</Text>
      </View>
      <Text style={{ color: "#6b7280", marginTop: 4 }}>Tap to open Yahoo chart</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Controls */}
      <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
        <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Session</Text>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <Badge label="Pre"     active={session==="pre"}     onPress={() => setSession("pre")} />
          <Badge label="Regular" active={session==="regular"} onPress={() => setSession("regular")} />
          <Badge label="Post"    active={session==="post"}    onPress={() => setSession("post")} />
        </View>

        <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Gap</Text>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <Badge label="All"      active={filter===""}        onPress={() => setFilter("")} />
          <Badge label="Gap Up"   active={filter==="gapup"}   onPress={() => setFilter("gapup")} />
          <Badge label="Gap Down" active={filter==="gapdown"} onPress={() => setFilter("gapdown")} />
        </View>

        <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Rank by</Text>
        <View style={{ flexDirection: "row", marginBottom: 10 }}>
          <Badge label="Volume"       active={by==="volume"}       onPress={() => setBy("volume")} />
          <Badge label="Trade Count"  active={by==="trades"}  onPress={() => setBy("trades")} />
        </View>

        <Text style={{ fontWeight: "800", fontSize: 16, marginBottom: 8 }}>Min Gap</Text>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          <Badge label="1%"  active={minGap===0.01} onPress={() => setMinGap(0.01)} />
          <Badge label="2%"  active={minGap===0.02} onPress={() => setMinGap(0.02)} />
          <Badge label="5%"  active={minGap===0.05} onPress={() => setMinGap(0.05)} />
        </View>

        <TouchableOpacity
          onPress={load}
          style={{ alignSelf: "flex-start", marginTop: 6, backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{loading ? "Loading…" : "Refresh"}</Text>
        </TouchableOpacity>

        {/* Quick helpers */}
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap" }}>
          <Badge label="Pre · Gap Up"    active={false} onPress={async () => { setSession("pre"); setFilter("gapup"); await load(); }} />
          <Badge label="Reg · Gap Up"    active={false} onPress={async () => { setSession("regular"); setFilter("gapup"); await load(); }} />
          <Badge label="Post · Gap Down" active={false} onPress={async () => { setSession("post"); setFilter("gapdown"); await load(); }} />
        </View>
      </View>

      <Text style={{ paddingHorizontal: 12, color: "#6b7280", marginVertical: 8 }}>
        {err ? `Error: ${err}` :
         loading ? "Loading…" :
         `Showing ${rows.length} · Session: ${session} · ${by}${filter ? ` · ${filter}` : ""} · min gap ${fmtPct(minGap)}`}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.symbol}
        renderItem={({ item }) => <RowItem r={item} />}
        ListEmptyComponent={
          !loading
            ? <Text style={{ textAlign: "center", marginTop: 30 }}>No matches.</Text>
            : null
        }
      />
    </View>
  );
}
