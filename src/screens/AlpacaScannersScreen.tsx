import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { fetchAlpacaScan, AlpRow } from "../api";

type TabKey = "most_actives" | "gainers" | "losers" | "history";

export default function AlpacaScannersScreen() {
  const [by, setBy] = useState<"volume"|"trades">("volume");
  const [data, setData] = useState<{ [k in TabKey]: any[] }>({ most_actives: [], gainers: [], losers: [], history: [] });
  const [ts, setTs] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const go = async () => {
      try {
        const res = await fetchAlpacaScan({ by, top: 30, refresh: 1 });
        if (!alive) return;
        setTs(res.ts);
        setData({
          most_actives: res.groups.most_actives,
          gainers: res.groups.gainers,
          losers: res.groups.losers,
          history: res.history.top_hits
        });
      } catch (e) {
        console.warn("alpaca scan failed", e);
      }
    };
    go();
    const id = setInterval(go, 60_000); // refresh each minute
    return () => { alive = false; clearInterval(id); };
  }, [by]);

  const [tab, setTab] = useState<TabKey>("most_actives");
  const rows = useMemo(() => data[tab] || [], [data, tab]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "most_actives", label: `Most Active (${by === "volume" ? "Vol" : "Trades"})` },
    { key: "gainers", label: "Top Gainers" },
    { key: "losers", label: "Top Losers" },
    { key: "history", label: "7d History" },
  ];

  const Info = ({ r }: { r: AlpRow }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.sym}>{r.symbol}</Text>
        {"change_percent" in r && r.change_percent != null ? (
          <Text style={[s.pill, { backgroundColor: (r.change_percent || 0) >= 0 ? "#dcfce7" : "#fee2e2" }]}>
            {(r.change_percent! * 100).toFixed(2)}%
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {"volume" in r ? <Text style={s.pill}>Vol {Number(r.volume||0).toLocaleString()}</Text> : null}
        {"trades" in r ? <Text style={s.pill}>Trades {Number(r.trades||0).toLocaleString()}</Text> : null}
        {"vr_prev" in r ? <Text style={[s.pill, { backgroundColor: (r.vr_prev||0) >= 3 ? "#fde68a" : "#e5e7eb" }]}>
          VR(prev) {(r.vr_prev || 0).toFixed(2)}x
        </Text> : null}
      </View>
    </View>
  );

  const History = ({ h }: { h: { symbol: string; hits: number } }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.sym}>{h.symbol}</Text>
        <Text style={s.pill}>hits {h.hits}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* sub-tabs */}
      <View style={s.tabrow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[s.tab, tab===t.key && s.tabOn]}>
            <Text style={[s.tabText, tab===t.key && s.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flexDirection: "row", marginLeft: "auto", gap: 6 }}>
          <TouchableOpacity onPress={() => setBy("volume")} style={[s.tab, by==="volume" && s.tabOn]}><Text style={[s.tabText, by==="volume" && s.tabTextOn]}>By Vol</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setBy("trades")} style={[s.tab, by==="trades" && s.tabOn]}><Text style={[s.tabText, by==="trades" && s.tabTextOn]}>By Trades</Text></TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r: any, i) => ("symbol" in r ? r.symbol : `${i}`)}
        renderItem={({ item }) => tab === "history" ? <History h={item} /> : <Info r={item} />}
        ListHeaderComponent={
          <Text style={{ paddingHorizontal: 12, paddingVertical: 6, fontWeight: "800" }}>
            Alpaca • refreshed {new Date(ts || Date.now()).toLocaleTimeString()}
          </Text>
        }
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>Loading…</Text>}
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
  pill: { color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12 }
});
