import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput,
  RefreshControl, Switch, Linking, Alert
} from "react-native";
import { fetchPopularCombinedSymbols, fetchScanForSymbolsC } from "../api";

type Row = {
  symbol: string;
  last?: number;
  volume?: number;
  avg_volume?: number;
  vr?: number;
  uoa_count?: number;
  uoa_top?: { occ: string; vol: number; oi: number; last: number }[];
};

export default function UoaPopularCombinedScreen() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [ts, setTs] = useState<number>(0);
  const [err, setErr] = useState<string|undefined>();
  const [refreshing, setRefreshing] = useState(false);

  // knobs
  const [top, setTop] = useState(40);
  const [limit, setLimit] = useState(50);
  const [moneyness, setMoneyness] = useState(0.2);
  const [minVol, setMinVol] = useState(500);
  const [onlyUoa, setOnlyUoa] = useState(true);

  // auto refresh
  const [auto, setAuto] = useState(true);
  const [intervalSec, setIntervalSec] = useState(60);
  const inflight = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // NEW: open Yahoo for a symbol (options page variant commented below)
  const openYahoo = async (symbol: string) => {
    const enc = encodeURIComponent(symbol);
    const url = `https://finance.yahoo.com/quote/${enc}?p=${enc}`;
    // const url = `https://finance.yahoo.com/quote/${enc}/options?p=${enc}`; // <- use for options directly
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert("Can't open link", url);
    } catch (e:any) {
      Alert.alert("Failed to open Yahoo Finance", String(e));
    }
  };

  const load = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setErr(undefined);
    try {
      const pop = await fetchPopularCombinedSymbols(top);
      const syms = pop.symbols || [];
      setSymbols(syms);

      const scan = await fetchScanForSymbolsC(syms, { limit, moneyness, minVol });
      const g = scan.groups || {};
      const all: Row[] = [
        ...(g.popular || []),
        ...(g.most_active_large || []),
        ...(g.most_active_mid || []),
        ...(g.most_active_small || []),
      ];
      const uniq = new Map<string, Row>();
      for (const r of all) uniq.set(r.symbol, r);
      let list = [...uniq.values()];
      if (onlyUoa) list = list.filter(r => (r.uoa_count || 0) > 0);
      list.sort((a,b) => (b.uoa_count||0) - (a.uoa_count||0) || (b.vr||0) - (a.vr||0));

      setRows(list);
      setTs(scan.ts || Date.now());
    } catch (e:any) {
      setErr(e?.message || 'load failed');
      setRows([]);
    } finally {
      inflight.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [top, limit, moneyness, minVol, onlyUoa]);

  useEffect(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (auto) {
      const ms = Math.max(10, intervalSec) * 1000;
      timerRef.current = setInterval(load, ms);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [auto, intervalSec, top, limit, moneyness, minVol, onlyUoa]);

  const onPull = async () => { setRefreshing(true); await load(); };

  const RowView = ({ r }: { r: Row }) => (
    <View style={s.row}>
      <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
        {/* CHANGED: make symbol a link */}
        <TouchableOpacity
          onPress={() => openYahoo(r.symbol)}
          accessibilityRole="link"
          accessibilityLabel={`Open ${r.symbol} on Yahoo Finance`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={[s.sym, { textDecorationLine: "underline" }]}>{r.symbol}</Text>
        </TouchableOpacity>

        {r.uoa_count != null && (
          <Text style={[s.pill, { backgroundColor: r.uoa_count > 0 ? "#fde68a" : "#e5e7eb" }]}>
            UOA {r.uoa_count}
          </Text>
        )}
      </View>

      <View style={{ flexDirection:"row", gap:10, flexWrap:"wrap" }}>
        {"last" in r && r.last != null ? <Text style={s.pill}>Last {r.last}</Text> : null}
        {"volume" in r ? <Text style={s.pill}>Vol {Number(r.volume||0).toLocaleString()}</Text> : null}
        {"avg_volume" in r ? <Text style={s.pill}>Avg {Number(r.avg_volume||0).toLocaleString()}</Text> : null}
        {"vr" in r ? <Text style={s.pill}>VR {(r.vr||0).toFixed(2)}x</Text> : null}
      </View>

      {!!r.uoa_top?.length && (
        <View style={{ marginTop:6, gap:4 }}>
          {r.uoa_top.slice(0,3).map((o, idx) => (
            <Text key={idx} style={s.note}>
              {o.occ} • vol {o.vol} • OI {o.oi} • last {o.last}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex:1 }}>
      {/* Controls */}
      <View style={s.controls}>
        <View style={s.inline}>
          <Text style={s.dim}>Popular Top</Text>
          <TextInput value={String(top)} keyboardType="numeric"
            onChangeText={(t)=> setTop(Math.max(10, Number(t)||40))}
            style={s.input} />
          <Text style={s.dim}>Scan Limit</Text>
          <TextInput value={String(limit)} keyboardType="numeric"
            onChangeText={(t)=> setLimit(Math.max(10, Number(t)||50))}
            style={s.input} />
          <Text style={s.dim}>± Moneyness</Text>
          <TextInput value={String(moneyness)} keyboardType="numeric"
            onChangeText={(t)=> setMoneyness(Math.max(0.05, Number(t)||0.2))}
            style={s.input} />
          <Text style={s.dim}>Min Opt Vol</Text>
          <TextInput value={String(minVol)} keyboardType="numeric"
            onChangeText={(t)=> setMinVol(Math.max(0, Number(t)||500))}
            style={s.input} />
        </View>
        <View style={s.inline}>
          <Text style={s.dim}>Auto refresh</Text>
          <Switch value={auto} onValueChange={setAuto} />
          <Text style={s.dim}>Interval (s)</Text>
          <TextInput value={String(intervalSec)} keyboardType="numeric"
            onChangeText={(t)=> setIntervalSec(Math.max(10, Number(t)||60))}
            style={s.input} />
          <Text style={s.dim}>Only UOA</Text>
          <Switch value={onlyUoa} onValueChange={setOnlyUoa} />
        </View>
        <Text style={[s.dim, { marginTop:4 }]}>
          {err ? `Error: ${err}` : `Roots (${symbols.length}): ${symbols.slice(0,12).join(", ")}${symbols.length>12?"…":""}`}
        </Text>
        <Text style={[s.dim]}>Refreshed {new Date(ts || Date.now()).toLocaleTimeString()}</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => r.symbol || String(i)}
        renderItem={({ item }) => <RowView r={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} />}
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:24, color:"#777" }}>Loading…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  controls:{ paddingHorizontal:12, gap:6, marginBottom:6 },
  inline:{ flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" },
  input:{ width:80, borderWidth:1, borderColor:"#ccc", borderRadius:6, paddingHorizontal:8, paddingVertical:6, textAlign:"center" },
  row:{ paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderColor:"#eee" },
  sym:{ fontWeight:"800" },
  pill:{ color:"#374151", backgroundColor:"#e5e7eb", paddingHorizontal:6, paddingVertical:2, borderRadius:999, fontSize:12 },
  dim:{ color:"#6b7280" },
  note:{ color:"#374151" }
});

