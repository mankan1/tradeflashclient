import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { OTSRow } from "../types";

export default function OTSRowView({ r }: { r: OTSRow }) {
  const date = new Date(r.ts);
  return (
    <View style={s.row}>
      <Text style={s.time}>{date.toLocaleTimeString()}</Text>
      <Text style={s.option}>
        {new Date(r.option.expiry).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"2-digit"})}
        {" "}
        {r.option.strike} {r.option.right}
      </Text>
      <Text style={s.qty}>{r.qty}</Text>
      <Text style={s.price}>{r.price}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: "#efefef" },
  time: { width: 92, color: "#555" },
  option: { flex: 1, fontWeight: "600" },
  qty: { width: 56, textAlign: "right" },
  price: { width: 70, textAlign: "right", fontWeight: "700" },
});

