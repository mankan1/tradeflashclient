import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { TradeFlashItem } from "../types";

export default function Row({ it }: { it: TradeFlashItem }) {
  const isCall = it.right === "C";
  const optText = it.expiry ? `${new Date(it.expiry).toLocaleDateString(undefined,{month:"short",day:"2-digit",year:"2-digit"})} ${it.strike} ${it.right}` : "";
  return (
    <View style={s.row}>
      <Text style={s.symbol}>{it.symbol}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.line1}>
          {it.qty.toLocaleString()} {optText ? optText : "Shares/Contracts"} @ {it.price}
        </Text>
        {optText ? <Text style={[s.opt, { color: isCall ? "#1e90ff" : "#a855f7" }]}>{optText}</Text> : null}
        {it.notional ? <Text style={s.dim}>Notional ${Math.round(it.notional).toLocaleString()}</Text> : null}
      </View>
      <Text style={[s.side, { color: it.side === "BOT" ? "#10b981" : "#ef4444" }]}>{it.side ?? ""}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  row: { padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", gap: 10, backgroundColor:"#faf9ff" },
  symbol: { width: 56, fontWeight: "700", color: "#111", marginTop: 2 },
  line1: { color: "#111" },
  opt: { fontWeight: "600" },
  dim: { color: "#666", fontSize: 12 },
  side: { fontWeight: "700" },
});

