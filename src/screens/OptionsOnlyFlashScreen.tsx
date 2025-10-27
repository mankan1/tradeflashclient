import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { parseOCC } from "../occ";
import { startWatch } from "../api";
import { useProvider } from "../state/ProviderContext";

type Row = {
  id: string; ts: number; tstr: string; occ: string;
  qty: number; price: number;
  side?: "BOT"|"SLD"|"—"; side_src?: "mid"|"tick"|"none"|"uptick";
  action?: "BTO"|"STO"|"BTC"|"STC"|"OPEN?"|"CLOSE?"|"—"; action_conf?: "high"|"medium"|"low";
};

const debounce = (fn: Function, ms=300) => { let t:any; return (...a:any[]) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const sideColor = (s?: string) => s==="BOT" ? "#16a34a" : s==="SLD" ? "#dc2626" : "#6b7280";

export default function OptionsOnlyFlashScreen() {
  const { provider } = useProvider();
  const [root, setRoot] = useState("SPY");
  const [minQty, setMinQty] = useState<number>(100);
  const [rows, setRows] = useState<Row[]>([]);
  const wsRef = useRef<WebSocket|null>(null);
  const seq = useRef(0); const nextId = () => `opt_flash_${++seq.current}`;

  const requestDataFor = useRef(debounce(async (sym:string) => {
    const s = sym.trim().toUpperCase(); if (!s) return;
    await startWatch({ symbols:[s], backfill:0, moneyness:0.25, limit:250, provider });
  }, 400)).current;
  useEffect(()=>{ requestDataFor(root); }, [root, provider]);

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        if (m.type !== "option_ts") return;
        const p = parseOCC(m.symbol); if (!p?.root || p.root !== root.trim().toUpperCase()) return;
        const qty = Number(m.data.qty||0), price = Number(m.data.price||0);
        if (!(qty>0 && price>0)) return;

        setRows(prev => [{
          id: nextId(),
          ts: m.data.ts ?? Date.now(),
          tstr: new Date().toLocaleTimeString(),
          occ: m.symbol,
          qty, price,
          side: m.data.side, side_src: m.data.side_src,
          action: m.data.action, action_conf: m.data.action_conf
        }, ...prev].slice(0, 1200));
      }
    });
    return () => wsRef.current?.close();
  }, []);

  const data = useMemo(
    () => rows.filter(r => r.qty >= (minQty||0)),
    [rows, minQty]
  );
  const bump = (d:number)=> setMinQty(q=>Math.max(0,(q||0)+d));

  return (
    <View style={{ flex:1 }}>
      <SearchBar value={root} onChangeText={setRoot} placeholder="Underlying (e.g., AAPL)" />

      <View style={s.toolbar}>
        <Text style={s.heading}>Min Qty</Text>
        <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
          <TouchableOpacity onPress={()=>bump(-100)} style={s.btn}><Text>-100</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>bump(-10)}  style={s.btn}><Text>-10</Text></TouchableOpacity>
          <TextInput keyboardType="numeric" value={String(minQty||0)} onChangeText={t=>setMinQty(Number(t)||0)} style={s.qtyInput}/>
          <TouchableOpacity onPress={()=>bump(+10)}  style={s.btn}><Text>+10</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>bump(+100)} style={s.btn}><Text>+100</Text></TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={data}
        keyExtractor={(r)=>r.id}
        renderItem={({ item }) => (
          <View style={s.rowItem}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
              <Text style={{ fontWeight:"800" }}>{item.occ}</Text>
              <Text style={{ color:"#6b7280" }}>{item.tstr}</Text>
            </View>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <Text>{item.qty} @ {item.price}</Text>
              <Text style={{ color:"white", backgroundColor: sideColor(item.side), paddingHorizontal:8, paddingVertical:2, borderRadius:999, fontWeight:"700" }}>
                {item.side ?? "—"}
              </Text>
              {item.action ? (
                <Text style={{ backgroundColor:"#f3f4f6", paddingHorizontal:8, paddingVertical:2, borderRadius:999, fontWeight:"700" }}>
                  {item.action}{item.action_conf ? ` (${item.action_conf})` : ""}
                </Text>
              ) : null}
            </View>
          </View>
        )}
        ListHeaderComponent={<Text style={[s.heading, { paddingHorizontal:12 }]}>Options Flash</Text>}
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:24 }}>Waiting for option prints…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar:{ paddingHorizontal:12, paddingBottom:8, flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  heading:{ fontWeight:"800", fontSize:16 },
  btn:{ borderWidth:1, borderColor:"#d1d5db", paddingHorizontal:10, paddingVertical:6, borderRadius:6 },
  qtyInput:{ width:80, borderWidth:1, borderColor:"#d1d5db", borderRadius:6, paddingHorizontal:8, paddingVertical:6, textAlign:"center" },
  rowItem:{ paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderColor:"#eee" }
});

