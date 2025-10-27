import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View, Text, Switch, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import SearchBar from "../components/SearchBar";
import { connectWS, ServerMsg } from "../ws";
import { parseOCC } from "../occ";
import { startWatch } from "../api";
import { useProvider } from "../state/ProviderContext";
import ProviderChip from "../components/ProviderChip";

type Row = {
  id: string; ts: number; tstr: string;
  option: { expiry: string; strike: number; right: "C"|"P" };
  qty: number; price: number;
  side?: "BOT"|"SLD"|"—"; side_src?: "mid"|"tick"|"none"|"uptick";
  oi?: number; priorVol?: number;
  at?: "bid"|"ask"|"mid"|"between";
  action?: "BTO"|"STO"|"BTC"|"STC"|"OPEN?"|"CLOSE?"|"—";
  action_conf?: "high"|"medium"|"low";
};

const debounce = (fn: Function, ms=300) => { let t:any; return (...a:any[]) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const sideColor = (s?: string) => s==="BOT" ? "#16a34a" : s==="SLD" ? "#dc2626" : "#6b7280";
const actBg = (a?: string) =>
  a==="BTO" ? "#dcfce7" : a==="STO" ? "#fee2e2" :
  a==="BTC" ? "#e0f2fe" : a==="STC" ? "#e0e7ff" :
  a==="OPEN?" ? "#fef9c3" : a==="CLOSE?" ? "#e5e7eb" : "#f3f4f6";

const SideBadge = ({ side, src }: { side?: Row["side"]; src?: Row["side_src"] }) => (
  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
    <Text style={{ color:"white", backgroundColor: sideColor(side), paddingHorizontal:8, paddingVertical:2, borderRadius:999, fontWeight:"700" }}>
      {side ?? "—"}
    </Text>
    {src ? <Text style={{ color:"#374151", backgroundColor:"#e5e7eb", paddingHorizontal:6, paddingVertical:2, borderRadius:999, fontSize:12 }}>{src}</Text> : null}
  </View>
);

export default function OptionsOnlyTimeSalesScreen() {
  const { provider } = useProvider();
  const [root, setRoot] = useState("SPY");
  const [minQty, setMinQty] = useState<number>(100);

  // toggles
  const [hideUnknown, setHideUnknown] = useState(false);
  const [edgesOnly, setEdgesOnly]   = useState(false);
  const [msTime, setMsTime]         = useState(false);
  const [showNet, setShowNet]       = useState(true);

  const [rows, setRows] = useState<Row[]>([]);
  const wsRef = useRef<WebSocket|null>(null);
  const seq = useRef(0); const nextId = () => `opt_ts_${++seq.current}`;

  const pad2 = (n:number)=> n<10?`0${n}`:`${n}`;
  const pad3 = (n:number)=> n<10?`00${n}`:n<100?`0${n}`:`${n}`;
  const fmtTickTime = (ts:number, raw?: string) => {
    if (msTime) {
      const d=new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
    }
    if (raw && raw.length>=19) return raw.slice(11,19);
    return new Date(ts).toLocaleTimeString();
  };

  const requestDataFor = useRef(debounce(async (sym:string) => {
    const s = sym.trim().toUpperCase(); if (!s) return;
    // ask server to (re)build OCC watchlist for this underlying
    await startWatch({ symbols:[s], backfill: 0, moneyness: 0.25, limit: 250, provider });
  }, 400)).current;

  useEffect(() => { requestDataFor(root); }, [root, provider]);

  useEffect(() => {
    wsRef.current = connectWS({
      onMsg: (m: ServerMsg) => {
        const provider = (m as any).provider as ("tradier"|"alpaca"|undefined);
        if (m.type !== "option_ts") return;
        const occ = m.symbol; const p = parseOCC(occ);
        if (!p?.root || p.root !== root.trim().toUpperCase()) return;

        const qty   = Number(m.data.qty || 0);
        const price = Number(m.data.price || 0);
        if (!(qty>0 && price>0)) return;

        const ts = m.data.ts ?? Date.now();
        setRows(prev => [{
          id: nextId(),
          ts, tstr: fmtTickTime(ts),
          option: {
            expiry: p.expiry || m.data.option?.expiry || "",
            strike: p.strike || m.data.option?.strike || 0,
            right:  p.right  || m.data.option?.right  || "C",
          },
          qty, price,
          side: m.data.side, side_src: m.data.side_src,
          oi: m.data.oi, priorVol: m.data.priorVol, at: m.data.at,
          action: m.data.action, action_conf: m.data.action_conf, provider
        }, ...prev].slice(0, 1500));
      }
    });
    return () => wsRef.current?.close();
  }, [msTime]);

  // filtering
  const filtered = useMemo(() =>
    rows
      .filter(r => r.qty >= (minQty || 0))
      .filter(r => (!hideUnknown ? true : (r.side && r.side !== "—" && r.side_src && r.side_src !== "none")))
      .filter(r => (!edgesOnly ? true : (r.at === "bid" || r.at === "ask")))
  , [rows, minQty, hideUnknown, edgesOnly]);

  // net delta (per second)
  const netRows = useMemo(() => {
    if (!showNet) return [];
    const map = new Map<number,{bot:number;sld:number}>();
    for (const r of filtered) {
      const sec = Math.floor(r.ts/1000);
      const m = map.get(sec) || { bot:0, sld:0 };
      if (r.side==="BOT") m.bot += r.qty; else if (r.side==="SLD") m.sld += r.qty;
      map.set(sec, m);
    }
    return [...map.entries()].sort((a,b)=>b[0]-a[0]).slice(0,12).map(([sec,v])=>({
      sec, time:new Date(sec*1000), delta: v.bot - v.sld
    }));
  }, [filtered, showNet]);

  const bump = (d:number)=> setMinQty(q => Math.max(0,(q||0)+d));

  const At = ({ at }: { at?: Row["at"] }) => (
    <Text style={s.pill}>at {at ?? "—"}</Text>
  );

  return (
    <View style={{ flex:1 }}>
      <SearchBar value={root} onChangeText={setRoot} placeholder="Underlying (e.g., NVDA)" />

      {/* controls */}
      <View style={s.toolbar}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
          <Text style={s.heading}>Min Qty</Text>
          <TouchableOpacity onPress={()=>bump(-100)} style={s.btn}><Text>-100</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>bump(-10)} style={s.btn}><Text>-10</Text></TouchableOpacity>
          <TextInput keyboardType="numeric" value={String(minQty||0)} onChangeText={t=>setMinQty(Number(t)||0)} style={s.qtyInput}/>
          <TouchableOpacity onPress={()=>bump(+10)} style={s.btn}><Text>+10</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>bump(+100)} style={s.btn}><Text>+100</Text></TouchableOpacity>
        </View>
        <View style={{ gap:6 }}>
          <View style={s.toggleRow}><Text style={s.dim}>Hide unknown side</Text><Switch value={hideUnknown} onValueChange={setHideUnknown}/></View>
          <View style={s.toggleRow}><Text style={s.dim}>Only edge prints (at bid/ask)</Text><Switch value={edgesOnly} onValueChange={setEdgesOnly}/></View>
          <View style={s.toggleRow}><Text style={s.dim}>Millisecond timestamps</Text><Switch value={msTime} onValueChange={setMsTime}/></View>
          <View style={s.toggleRow}><Text style={s.dim}>Show per-second net delta</Text><Switch value={showNet} onValueChange={setShowNet}/></View>
        </View>
      </View>

      {/* legend */}
      <View style={{ paddingHorizontal:12, gap:6, marginTop:2 }}>
        <View style={{ flexDirection:"row", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <SideBadge side="BOT" src="mid" /><Text style={s.dim}>buyer-aggress (ask-side)</Text>
          <SideBadge side="SLD" src="mid" /><Text style={s.dim}>seller-aggress (bid-side)</Text>
          <Text style={s.dim}>src: mid &gt; tick &gt; uptick</Text>
        </View>
        <View style={{ flexDirection:"row", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <Text style={{ fontWeight:"700" }}>Options Action</Text>
          <Text style={[s.pill,{backgroundColor:"#dcfce7"}]}>BTO (high)</Text>
          <Text style={[s.pill,{backgroundColor:"#fee2e2"}]}>STO (high)</Text>
          <Text style={[s.pill,{backgroundColor:"#e0f2fe"}]}>BTC (medium)</Text>
          <Text style={[s.pill,{backgroundColor:"#e0e7ff"}]}>STC (medium)</Text>
        </View>
        <Text style={s.dim}>logic: qty &gt; (OI + dayVol) ⇒ open; else if dayVol ≳ 80% of OI ⇒ close-lean</Text>
      </View>

      {showNet && netRows.length ? (
        <View style={{ paddingHorizontal:12, paddingBottom:6, gap:2 }}>
          <Text style={[s.heading,{marginTop:6}]}>Per-second Net Delta</Text>
          {netRows.map(n=>(
            <View key={n.sec} style={{ flexDirection:"row", gap:8 }}>
              <Text style={{ width:72, color:"#6b7280", fontFamily:"ui-monospace, Menlo" }}>
                {pad2(n.time.getHours())}:{pad2(n.time.getMinutes())}:{pad2(n.time.getSeconds())}
              </Text>
              <Text style={{ color: n.delta>0?"#16a34a":n.delta<0?"#dc2626":"#6b7280", fontFamily:"ui-monospace, Menlo" }}>
                {n.delta>0?"+":""}{n.delta}
              </Text>
            </View>
          ))}
        </View>
      ):null}

      <FlatList
        data={filtered}
        keyExtractor={(i)=>i.id}
        renderItem={({item})=>(
          <View style={s.rowItem}>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
              <Text style={{ fontWeight:"700" }}>{item.option.expiry} {item.option.strike} {item.option.right}</Text>
              <Text style={{ color:"#666", fontFamily:"ui-monospace, Menlo" }}>{fmtTickTime(item.ts)}</Text>
            </View>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <Text>Qty {item.qty} @ {item.price}</Text>
              <SideBadge side={item.side} src={item.side_src}/>
              <At at={item.at}/>
              {item.oi!=null ? <Text style={s.pill}>OI {item.oi.toLocaleString()}</Text> : null}
              {item.priorVol!=null ? <Text style={s.pill}>Vol prior {item.priorVol.toLocaleString()}</Text> : null}
              <Text style={[s.pill,{backgroundColor:actBg(item.action), fontWeight:"700"}]}>
                {item.action ?? "—"}{item.action_conf ? ` (${item.action_conf})` : ""}
              </Text>
              <ProviderChip p={(item as any).provider} />
            </View>
          </View>
        )}
        ListHeaderComponent={<Text style={[s.heading,{paddingHorizontal:12}]}>Time & Sales (Options)</Text>}
        ListEmptyComponent={<Text style={{ textAlign:"center", marginTop:24 }}>Waiting for option prints…</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  toolbar:{ paddingHorizontal:12, paddingBottom:8, paddingTop:2, flexDirection:"row", alignItems:"flex-start", justifyContent:"space-between" },
  heading:{ fontWeight:"800", fontSize:16 },
  toggleRow:{ flexDirection:"row", alignItems:"center", gap:8 },
  dim:{ color:"#6b7280" },
  btn:{ borderWidth:1, borderColor:"#d1d5db", paddingHorizontal:10, paddingVertical:6, borderRadius:6 },
  qtyInput:{ width:80, borderWidth:1, borderColor:"#d1d5db", borderRadius:6, paddingHorizontal:8, paddingVertical:6, textAlign:"center" },
  rowItem:{ paddingHorizontal:12, paddingVertical:10, borderBottomWidth:1, borderColor:"#eee" },
  pill:{ color:"#374151", backgroundColor:"#e5e7eb", paddingHorizontal:6, paddingVertical:2, borderRadius:999, fontSize:12 }
});

