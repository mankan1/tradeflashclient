import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { fetchAlpacaScan } from "../api";

// Minimal row types we actually render
type MostActiveRow = {
  symbol?: string;
  volume?: number;
  trades?: number;
  vr_prev?: number;         // volume ratio vs prev day (server-enriched)
  change_percent?: number;  // may appear on gainers/losers
};

type HitRow = { symbol: string; hits: number };
type TabKey = "most_actives" | "gainers" | "losers" | "history";

export default function AlpacaScannersScreen() {
  // UI state
  const [by, setBy] = useState<"volume" | "trades">("volume");
  const [tab, setTab] = useState<TabKey>("most_actives");

  // Data state
  const [data, setData] = useState<{ [k in TabKey]: any[] }>({
    most_actives: [],
    gainers: [],
    losers: [],
    history: [],
  });
  const [ts, setTs] = useState<number>(0);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let alive = true;

    const go = async () => {
      setErr("");
      try {
        // Map UI -> API param
        const byParam = by === "trades" ? "trades" : "volume";

        const res = await fetchAlpacaScan({
          by: byParam as "volume" | "trades",
          top: 30,
          // you can add session/filter/minGap here later if you wire those controls
          refresh: 1,
        });

        if (!alive) return;

        // Defensive guards — server may omit groups/history or return ok:false
        const groups = (res && res.groups) || {};
        const history = (res && res.history && res.history.top_hits) || [];

        setTs(Number(res?.ts || Date.now()));
        setData({
          most_actives: Array.isArray(groups.most_actives) ? groups.most_actives : [],
          gainers: Array.isArray(groups.gainers) ? groups.gainers : [],
          losers: Array.isArray(groups.losers) ? groups.losers : [],
          history: Array.isArray(history) ? history : [],
        });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load scan");
        setData({ most_actives: [], gainers: [], losers: [], history: [] });
      }
    };

    go();
    const id = setInterval(go, 60_000); // refresh each minute
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [by]);

  const rows = useMemo(() => data[tab] || [], [data, tab]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "most_actives", label: `Most Active (${by === "volume" ? "Vol" : "Trades"})` },
    { key: "gainers", label: "Top Gainers" },
    { key: "losers", label: "Top Losers" },
    { key: "history", label: "7d History" },
  ];

  const Info = ({ r }: { r: MostActiveRow }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.sym}>{String((r as any).symbol || "")}</Text>
        {"change_percent" in r && r.change_percent != null ? (
          <Text style={[s.pill, { backgroundColor: (r.change_percent || 0) >= 0 ? "#dcfce7" : "#fee2e2" }]}>
            {((r.change_percent || 0) * 100).toFixed(2)}%
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
        {"volume" in r ? <Text style={s.pill}>Vol {Number(r.volume || 0).toLocaleString()}</Text> : null}
        {"trades" in r ? <Text style={s.pill}>Trades {Number((r as any).trades || 0).toLocaleString()}</Text> : null}
        {"vr_prev" in r ? (
          <Text style={[s.pill, { backgroundColor: (r.vr_prev || 0) >= 3 ? "#fde68a" : "#e5e7eb" }]}>
            VR(prev) {(r.vr_prev || 0).toFixed(2)}x
          </Text>
        ) : null}
      </View>
    </View>
  );

  const History = ({ h }: { h: HitRow }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.sym}>{h.symbol}</Text>
        <Text style={s.pill}>hits {h.hits}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* sub-tabs + by-toggle */}
      <View style={s.tabrow}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[s.tab, tab === t.key && s.tabOn]}>
            <Text style={[s.tabText, tab === t.key && s.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flexDirection: "row", marginLeft: "auto", gap: 6 }}>
          <TouchableOpacity onPress={() => setBy("volume")} style={[s.tab, by === "volume" && s.tabOn]}>
            <Text style={[s.tabText, by === "volume" && s.tabTextOn]}>By Vol</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setBy("trades")} style={[s.tab, by === "trades" && s.tabOn]}>
            <Text style={[s.tabText, by === "trades" && s.tabTextOn]}>By Trades</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ paddingHorizontal: 12, paddingVertical: 6, color: "#6b7280" }}>
        {err ? `Error: ${err}` : `Alpaca • refreshed ${new Date(ts || Date.now()).toLocaleTimeString()}`}
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(r: any, i) => (r && typeof r.symbol === "string" ? r.symbol : String(i))}
        renderItem={({ item }) => (tab === "history" ? <History h={item as HitRow} /> : <Info r={item as MostActiveRow} />)}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>{err ? "No data." : "Loading…"}</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabrow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, alignItems: "center" },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 999, backgroundColor: "white" },
  tabOn: { backgroundColor: "#111827" },
  tabText: { color: "#111827", fontWeight: "700" },
  tabTextOn: { color: "white" },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  sym: { fontWeight: "800" },
  pill: { color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12 },
});
