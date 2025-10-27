import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { startWatch } from "../api";
import ProviderChip from "../components/ProviderChip";

type Row = {
  id: string;
  tstr: string;
  symbol: string;
  qty: number;
  price: number;
  provider?: "alpaca"|"tradier"|"polygon";
};

const s = StyleSheet.create({
  rowItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
  qtyInput: { width: 80, borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, textAlign: "center" },
  btn: { borderWidth: 1, borderColor: "#ccc", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontWeight: "800", fontSize: 16 },
  toolbar: { paddingHorizontal: 12, paddingBottom: 8, paddingTop: 6, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
});

export default function EquitiesAlpacaScreen() {
  const [symbol, setSymbol] = useState("SPY");
  const [minQty, setMinQty] = useState<number>(100);
  const [rows, setRows] = useState<Row[]>([]);
  const seq = useRef(0); const nextId = () => `alp_${++seq.current}`;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    (async () => {
      const root = symbol.trim().toUpperCase(); if (!root) return;
      await startWatch({ symbols: [root], eqForTS: [root], provider: "alpaca", backfill: 0 });
    })();
  }, [symbol]);

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        if (m.type !== "equity_ts") return;
        if (m.provider && m.provider !== "alpaca") return; // keep this screen pure-Alpaca
        const d: any = m.data || {};
        const price = Number(d.price ?? d.last ?? 0);
        const qty   = Number(d.size  ?? d.volume ?? d.qty ?? 0);
        if (!(price > 0 && qty > 0)) return;
        const tstr = typeof d.time === "string"
          ? d.time.slice(11, 19)
          : new Date(Number(d.time ?? Date.now())).toLocaleTimeString();

        setRows(prev => [
          { id: nextId(), symbol: m.symbol || d.symbol || symbol, tstr, price, qty, provider: m.provider as any },
          ...prev
        ].slice(0, 800));
      }
    });
    return () => wsRef.current?.close();
  }, []);

  const data = useMemo(() => {
    const root = symbol.trim().toUpperCase();
    return rows.filter(r => (!root || r.symbol.includes(root)) && r.qty >= (minQty || 0));
  }, [rows, symbol, minQty]);

  const bump = (d: number) => setMinQty(q => Math.max(0, (q || 0) + d));

  return (
    <View style={{ flex: 1 }}>
      <SearchBar value={symbol} onChangeText={setSymbol} placeholder="Type a symbol (e.g., NVDA)" />
      <View style={s.toolbar}>
        <View>
          <Text style={s.heading}>Min Qty</Text>
          <View style={s.row}>
            <TouchableOpacity onPress={() => bump(-100)} style={s.btn}><Text>-100</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => bump(-10)}  style={s.btn}><Text>-10</Text></TouchableOpacity>
            <TextInput keyboardType="numeric" value={String(minQty ?? 0)} onChangeText={(t)=>setMinQty(Number(t)||0)} style={s.qtyInput}/>
            <TouchableOpacity onPress={() => bump(+10)}  style={s.btn}><Text>+10</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => bump(+100)} style={s.btn}><Text>+100</Text></TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(i)=>i.id}
        renderItem={({ item }) => (
          <View style={s.rowItem}>
            <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
              <Text style={{ fontWeight:"700" }}>{item.symbol}</Text>
              <Text style={{ color:"#666", fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace" }}>{item.tstr}</Text>
            </View>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <Text>{item.qty} @ {item.price}</Text>
              <ProviderChip p={item.provider as any} />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:30 }}>Waiting for Alpaca prints…</Text>}
      />
    </View>
  );
}

