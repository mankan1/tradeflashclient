import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { startWatch } from "../api";
import { ProviderChip } from "../components/ProviderChip";

type Row = {
  id: string;
  occ: string;
  ts: number;
  tstr: string;
  qty: number;
  price: number;
  side?: "BOT"|"SLD"|"—";
  action?: "BTO"|"BTC"|"STO"|"STC"|"OPEN?"|"CLOSE?"|"—";
  provider?: "tradier"|"alpaca"|"polygon";
};

const s = StyleSheet.create({
  rowItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" },
});

export default function OptionsFlowScreen() {
  const [root, setRoot] = useState("SPY");
  const [rows, setRows] = useState<Row[]>([]);
  const seq = useRef(0); const nextId = () => `opt_${++seq.current}`;
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    (async () => {
      const R = root.trim().toUpperCase() || "SPY";
      // default to Tradier (your server already does options via Tradier)
      await startWatch({ symbols: [R], eqForTS: [R], provider: "tradier", backfill: 0, moneyness: 0.25, limit: 150 });
    })();
  }, [root]);

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        if (m.type !== "option_ts") return;
        const d: any = m.data || {};
        const price = Number(d.price ?? 0);
        const qty   = Number(d.qty ?? d.size ?? 0);
        if (!(price > 0 && qty > 0)) return;

        const tstr = new Date(Number(d.ts ?? Date.now())).toLocaleTimeString();
        setRows(prev => [
          { id: nextId(), occ: m.symbol, ts: Date.now(), tstr, qty, price, side: d.side, action: d.action, provider: m.provider as any },
          ...prev
        ].slice(0, 800));
      }
    });
    return () => wsRef.current?.close();
  }, []);

  const data = useMemo(() => rows, [rows]);

  return (
    <View style={{ flex: 1 }}>
      <SearchBar value={root} onChangeText={setRoot} placeholder="Root (e.g., AAPL)" />
      <FlatList
        data={data}
        keyExtractor={(i)=>i.id}
        renderItem={({ item }) => (
          <View style={s.rowItem}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
              <Text style={{ fontWeight:"700" }}>{item.occ}</Text>
              <Text style={{ color:"#666" }}>{item.tstr}</Text>
            </View>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <Text>{item.qty} @ {item.price}</Text>
              {item.side ? <Text>· {item.side}</Text> : null}
              {item.action ? <Text>· {item.action}</Text> : null}
              <ProviderChip p={item.provider as any} />
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:30 }}>Waiting for option prints…</Text>}
      />
    </View>
  );
}

