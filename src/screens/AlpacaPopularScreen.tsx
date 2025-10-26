import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, TextInput, Switch } from "react-native";
import { fetchPopularSymbols, fetchScanForSymbols } from "../api";

type GroupKey = "popular" | "most_active_large" | "most_active_mid" | "most_active_small";
type Row = { symbol: string; last?: number; volume?: number; avg_volume?: number; vr?: number; uoa_count?: number; uoa_top?: any[] };

export default function AlpacaPopularScreen() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [data, setData] = useState<Record<GroupKey, Row[]>>({
    popular: [], most_active_large: [], most_active_mid: [], most_active_small: []
  });
  const [ts, setTs] = useState<number>(0);
  const [err, setErr] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // controls
  const [limit, setLimit] = useState<number>(25);
  const [moneyness, setMoneyness] = useState<number>(0.2);
  const [minVol, setMinVol] = useState<number>(500);

  // auto refresh
  const [auto, setAuto] = useState(true);
  const [intervalSec, setIntervalSec] = useState<number>(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inflight = useRef(false);

  const groups: { key: GroupKey; label: string }[] = [
    { key: "popular", label: "Popular (Alpaca)" },
    { key: "most_active_large", label: "Most Active • Large" },
    { key: "most_active_mid",   label: "Most Active • Mid" },
    { key: "most_active_small", label: "Most Active • Small" },
  ];
  const [tab, setTab] = useState<GroupKey>("popular");
  const rows = useMemo(() => data[tab] || [], [data, tab]);

  const load = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setErr(undefined);
    try {
      // 1) get fresh Alpaca popular symbols
      const pop = await fetchPopularSymbols();
      const roots = pop.symbols || [];
      setSymbols(roots);

      // 2) run our server-side scan on just these symbols
      const scan = await fetchScanForSymbols(roots, { limit, moneyness, minVol });
      setData(scan.groups as any);
      setTs(scan.ts);
    } catch (e: any) {
      setErr(e?.message || "load failed");
      setData({ popular: [], most_active_large: [], most_active_mid: [], most_active_small: [] });
    } finally {
      inflight.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []); // initial

  // reload when knobs change
  useEffect(() => { load(); }, [limit, moneyness, minVol]);

  // auto refresh
  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (auto) {
      const ms = Math.max(10, intervalSec) * 1000;
      timerRef.current = setInterval(load, ms);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto, intervalSec, limit, moneyness, minVol]);

  const onPull = async () => { setRefreshing(true); await load(); };

  const RowView = ({ r }: { r: Row }) => (
    <View style={s.row}>
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
        <Text style={s.sym}>{r.symbol}</Text>
        {"vr" in r && r.vr != null ? (
          <Text style={[s.pill, { backgroundColor: (r.vr||0) >= 3 ? "#fde68a" : "#e5e7eb" }]}>
            VR {(r.vr || 0).toFixed(2)}x
          </Text>
        ) : null}
      </View>
      <View style={{ flexDirection:"row", gap:10, flexWrap:"wrap" }}>
        {"last" in r && r.last != null ? <Text style={s.pill}>Last {r.last}</Text> : null}
        {"volume" in r ? <Text style={s.pill}>Vol {Number(r.volume||0).toLocaleString()}</Text> : null}
        {"avg_volume" in r ? <Text style={s.pill}>Avg {Number(r.avg_volume||0).toLocaleString()}</Text> : null}
        {"uoa_count" in r ? <Text style={s.pill}>UOA {r.uoa_count}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex:1 }}>
      {/* Tabs */}
      <View style={s.tabrow}>
        {groups.map(g => (
          <TouchableOpacity key={g.key} onPress={()=>setTab(g.key)} style={[s.tab, tab===g.key && s.tabOn]}>
            <Text style={[s.tabText, tab===g.key && s.tabTextOn]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Controls */}
      <View style={s.controls}>
        <View style={s.inline}>
          <Text style={s.dim}>Limit</Text>
          <TextInput
            value={String(limit)} keyboardType="numeric"
            onChangeText={(t)=> setLimit(Math.max(5, Number(t)||25))}
            style={s.input}
          />
          <Text style={s.dim}>± Moneyness</Text>
          <TextInput
            value={String(moneyness)} keyboardType="numeric"
            onChangeText={(t)=> setMoneyness(Math.max(0.05, Number(t)||0.2))}
            style={s.input}
          />
          <Text style={s.dim}>Min Opt Vol</Text>
          <TextInput
            value={String(minVol)} keyboardType="numeric"
            onChangeText={(t)=> setMinVol(Math.max(0, Number(t)||500))}
            style={s.input}
          />
        </View>
        <View style={s.inline}>
          <Text style={s.dim}>Auto refresh</Text>
          <Switch value={auto} onValueChange={setAuto} />
          <Text style={s.dim}>Interval (s)</Text>
          <TextInput
            value={String(intervalSec)} keyboardType="numeric"
            onChangeText={(t)=> setIntervalSec(Math.max(10, Number(t)||60))}
            style={s.input}
          />
        </View>
        <Text style={[s.dim, { marginTop:4 }]}>
          {err ? `Error: ${err}` : `Alpaca symbols: ${symbols.slice(0,12).join(", ")}${symbols.length>12?"…":""}`}
        </Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r:any, i)=> r?.symbol || String(i)}
        renderItem={({ item }) => <RowView r={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} />}
        ListHeaderComponent={
          <Text style={{ paddingHorizontal: 12, paddingVertical: 6, fontWeight: "800" }}>
            Alpaca Popular • refreshed {new Date(ts || Date.now()).toLocaleTimeString()}
          </Text>
        }
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:24, color:"#777" }}>Loading…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  tabrow:{ flexDirection:"row", flexWrap:"wrap", gap:8, padding:8, alignItems:"center" },
  tab:{ paddingHorizontal:10, paddingVertical:6, borderWidth:1, borderColor:"#d1d5db", borderRadius:999, backgroundColor:"white" },
  tabOn:{ backgroundColor:"#111827" },
  tabText:{ color:"#111827", fontWeight:"700" },
  tabTextOn:{ color:"white" },
  controls:{ paddingHorizontal:12, gap:6, marginBottom:6 },
  inline:{ flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" },
  input:{ width:80, borderWidth:1, borderColor:"#ccc", borderRadius:6, paddingHorizontal:8, paddingVertical:6, textAlign:"center" },
  row:{ paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderColor:"#eee" },
  sym:{ fontWeight:"800" },
  pill:{ color:"#374151", backgroundColor:"#e5e7eb", paddingHorizontal:6, paddingVertical:2, borderRadius:999, fontSize:12 },
  dim:{ color:"#6b7280" },
});

