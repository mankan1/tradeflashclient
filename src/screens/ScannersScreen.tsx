// src/screens/ScannersScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { fetchScan } from "../api";
import { useProvider } from "../state/ProviderContext";

type GroupKey = "popular" | "most_active_large" | "most_active_mid" | "most_active_small";

export type ScanRow = {
  symbol: string;
  last?: number;
  // activity fields (provider-dependent)
  volume?: number;
  trade_count?: number;
  avg_volume?: number;
  vr?: number;
  change_percent?: number; // polygon gives this
  // UOA decoration (from server)
  uoa_count?: number;
  uoa_top?: { occ: string; vol: number; oi: number; last?: number }[];
};

export default function ScannersScreen() {
  const { provider } = useProvider(); // "tradier" | "polygon"
  const [groups, setGroups] = useState<Record<GroupKey, ScanRow[]>>({
    popular: [],
    most_active_large: [],
    most_active_mid: [],
    most_active_small: [],
  });
  const [active, setActive] = useState<GroupKey>("popular");
  const [ts, setTs] = useState<number>(0);

  // Sort key for “most actives” (only applies to providers that support it)
  const [by, setBy] = useState<"volume" | "trade_count">("volume");

  // --- NEW: Yahoo launcher (tap → quote, long-press → options) ---
  const openYahoo = async (symbol: string, opts?: { optionsPage?: boolean }) => {
    const enc = encodeURIComponent(symbol);
    const url = opts?.optionsPage
      ? `https://finance.yahoo.com/quote/${enc}/options?p=${enc}`
      : `https://finance.yahoo.com/quote/${enc}?p=${enc}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert("Can't open link", url);
    } catch (e: any) {
      Alert.alert("Failed to open Yahoo Finance", String(e));
    }
  };

  // Normalize server responses to the 4 buckets this screen shows.
  // - Your Alpaca/Tradier /scan returns: { popular, most_active_large, most_active_mid, most_active_small }
  // - Polygon /scan returns: { most_actives, gainers, losers } — we map most_actives -> popular
  const normalize = (resp: any): Record<GroupKey, ScanRow[]> => {
    const g = resp?.groups || {};
    if ("popular" in g || "most_active_large" in g) {
      // Already in classic shape (Alpaca/Tradier path)
      return {
        popular: g.popular || [],
        most_active_large: g.most_active_large || [],
        most_active_mid: g.most_active_mid || [],
        most_active_small: g.most_active_small || [],
      };
    }
    // Polygon shape → put most_actives under “popular” and leave others empty
    if ("most_actives" in g || "gainers" in g || "losers" in g) {
      return {
        popular: g.most_actives || [],
        most_active_large: [], // you could optionally map gainers/losers into these tabs
        most_active_mid: [],
        most_active_small: [],
      };
    }
    // Fallback (empty)
    return {
      popular: [],
      most_active_large: [],
      most_active_mid: [],
      most_active_small: [],
    };
  };

  useEffect(() => {
    let alive = true;

    const go = async () => {
      try {
        const resp = await fetchScan({ provider, by, top: 30, moneyness: 0.2, minVol: 500 });
        if (!alive) return;
        setGroups(normalize(resp));
        setTs(resp.ts || Date.now());
      } catch (e) {
        console.warn("scan failed", e);
      }
    };

    go();
    const id = setInterval(go, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [provider, by]);

  const rows = useMemo(() => groups[active] || [], [groups, active]);

  // Tabs (static labels; content may be empty if provider doesn’t supply that bucket)
  const tabs: { key: GroupKey; label: string }[] = [
    { key: "popular", label: provider === "polygon" ? `Most Actives (${by === "volume" ? "Vol" : "Trades"})` : "Popular" },
    { key: "most_active_large", label: "Most Active (Large)" },
    { key: "most_active_mid", label: "Most Active (Mid)" },
    { key: "most_active_small", label: "Most Active (Small)" },
  ];

  const Row = ({ r }: { r: ScanRow }) => (
    <View style={s.row}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        {/* CHANGED: make symbol pressable to launch Yahoo */}
        <TouchableOpacity
          onPress={() => openYahoo(r.symbol)}
          onLongPress={() => openYahoo(r.symbol, { optionsPage: true })}
          delayLongPress={250}
          accessibilityRole="link"
          accessibilityLabel={`Open ${r.symbol} on Yahoo Finance`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[s.sym, { textDecorationLine: "underline" }]}>{r.symbol}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          {typeof r.change_percent === "number" ? (
            <Text
              style={[
                s.pill,
                { backgroundColor: (r.change_percent || 0) >= 0 ? "#dcfce7" : "#fee2e2" },
              ]}
            >
              {(r.change_percent * 100).toFixed(2)}%
            </Text>
          ) : null}
          {typeof r.last === "number" ? <Text style={s.dim}>{r.last.toFixed(2)}</Text> : null}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        {"volume" in r && typeof r.volume === "number" ? (
          <Text style={s.pill}>Vol {Number(r.volume).toLocaleString()}</Text>
        ) : null}
        {"trade_count" in r && typeof r.trade_count === "number" ? (
          <Text style={s.pill}>Trades {Number(r.trade_count).toLocaleString()}</Text>
        ) : null}
        {"avg_volume" in r && typeof r.avg_volume === "number" ? (
          <Text style={s.pill}>Avg {Number(r.avg_volume).toLocaleString()}</Text>
        ) : null}
        {"vr" in r && typeof r.vr === "number" ? (
          <Text style={[s.pill, { backgroundColor: (r.vr || 0) >= 3 ? "#dcfce7" : "#e5e7eb" }]}>
            VR {(r.vr || 0).toFixed(2)}x
          </Text>
        ) : null}
        <Text
          style={[
            s.pill,
            { backgroundColor: (r.uoa_count || 0) > 0 ? "#fee2e2" : "#f3f4f6" },
          ]}
        >
          UOA {r.uoa_count || 0}
        </Text>
      </View>

      {Array.isArray(r.uoa_top) && r.uoa_top.length ? (
        <View style={{ marginTop: 4 }}>
          {r.uoa_top.map((o, i) => (
            <Text key={`${r.symbol}_uoa_${i}`} style={s.dim}>
              • {o.occ} — vol {Number(o.vol).toLocaleString()} vs OI{" "}
              {Number(o.oi).toLocaleString()}
              {typeof o.last === "number" ? ` @ ${o.last}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Tabs + by-toggle */}
      <View style={s.tabrow}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setActive(t.key)}
            style={[s.tab, active === t.key && s.tabOn]}
          >
            <Text style={[s.tabText, active === t.key && s.tabTextOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        {/* Sort-by toggle only shown when the provider supports it */}
        <View style={{ flexDirection: "row", marginLeft: "auto", gap: 6 }}>
          <TouchableOpacity
            onPress={() => setBy("volume")}
            style={[s.tab, by === "volume" && s.tabOn]}
          >
            <Text style={[s.tabText, by === "volume" && s.tabTextOn]}>By Vol</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setBy("trade_count")}
            style={[s.tab, by === "trade_count" && s.tabOn]}
          >
            <Text style={[s.tabText, by === "trade_count" && s.tabTextOn]}>By Trades</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.symbol}
        renderItem={({ item }) => <Row r={item} />}
        ListHeaderComponent={
          <Text style={{ paddingHorizontal: 12, paddingVertical: 6, fontWeight: "800" }}>
            {tabs.find((x) => x.key === active)?.label} • refreshed{" "}
            {new Date(ts || Date.now()).toLocaleTimeString()}
          </Text>
        }
        ListEmptyComponent={
          <Text style={{ textAlign: "center", marginTop: 24 }}>Loading scans…</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabrow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, alignItems: "center" },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    backgroundColor: "white",
  },
  tabOn: { backgroundColor: "#111827" },
  tabText: { color: "#111827", fontWeight: "700" },
  tabTextOn: { color: "white" },
  row: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  sym: { fontWeight: "800" },
  dim: { color: "#6b7280" },
  pill: {
    color: "#374151",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    fontSize: 12,
  },
});

