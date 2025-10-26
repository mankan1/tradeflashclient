import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { fetchScans, ScanRow } from "../api";

type GroupKey = "popular" | "most_active_large" | "most_active_mid" | "most_active_small";

export default function ScannersScreen() {
  const [data, setData] = useState<Record<GroupKey, ScanRow[]>>({
    popular: [], most_active_large: [], most_active_mid: [], most_active_small: []
  });
  const [active, setActive] = useState<GroupKey>("popular");
  const [ts, setTs] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const go = async () => {
      try {
        const res = await fetchScans({ limit: 30, moneyness: 0.2, minVol: 500 });
        if (!alive) return;
        setData(res.groups as any);
        setTs(res.ts);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("scan failed", e);
      }
    };
    go();
    const id = setInterval(go, 30_000); // refresh every 30s
    return () => { alive = false; clearInterval(id); };
  }, []);

  const rows = useMemo(() => data[active] || [], [data, active]);

  const tabs: { key: GroupKey; label: string }[] = [
    { key: "popular", label: "Popular" },
    { key: "most_active_large", label: "Most Active (Large)" },
    { key: "most_active_mid", label: "Most Active (Mid)" },
    { key: "most_active_small", label: "Most Active (Small)" }
  ];

  const Row = ({ r }: { r: ScanRow }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={s.sym}>{r.symbol}</Text>
        <Text style={s.dim}>{r.last?.toFixed(2)}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Text style={s.pill}>Vol {r.volume.toLocaleString()}</Text>
        <Text style={s.pill}>Avg {r.avg_volume.toLocaleString()}</Text>
        <Text style={[s.pill, { backgroundColor: r.vr >= 3 ? "#dcfce7" : "#e5e7eb" }]}>VR {(r.vr || 0).toFixed(2)}x</Text>
        <Text style={[s.pill, { backgroundColor: (r.uoa_count || 0) > 0 ? "#fee2e2" : "#f3f4f6" }]}>
          UOA {r.uoa_count || 0}
        </Text>
      </View>
      {r.uoa_top?.length ? (
        <View style={{ marginTop: 4 }}>
          {r.uoa_top.map((o, i) => (
            <Text key={i} style={s.dim}>
              • {o.occ} &mdash; vol {o.vol.toLocaleString()} vs OI {o.oi.toLocaleString()} @ {o.last}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.tabrow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActive(t.key)} style={[s.tab, active===t.key && s.tabOn]}>
            <Text style={[s.tabText, active===t.key && s.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.symbol}`}
        renderItem={({ item }) => <Row r={item} />}
        ListHeaderComponent={
          <Text style={{ paddingHorizontal: 12, paddingVertical: 6, fontWeight: "800" }}>
            {tabs.find(x=>x.key===active)?.label} • refreshed {new Date(ts||Date.now()).toLocaleTimeString()}
          </Text>
        }
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>Loading scans…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabrow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#d1d5db", borderRadius: 999, backgroundColor: "white" },
  tabOn: { backgroundColor: "#111827" },
  tabText: { color: "#111827", fontWeight: "700" },
  tabTextOn: { color: "white" },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  sym: { fontWeight: "800" },
  dim: { color: "#6b7280" },
  pill: { color: "#374151", backgroundColor: "#e5e7eb", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, fontSize: 12 }
});

