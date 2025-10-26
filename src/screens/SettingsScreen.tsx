import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useProvider } from "../state/ProviderContext";

const Pill = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} style={[s.pill, on && s.pillOn]}>
    <Text style={[s.pillText, on && s.pillTextOn]}>{label}</Text>
  </TouchableOpacity>
);

export default function SettingsScreen() {
  const { provider, setProvider } = useProvider();

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Data Provider</Text>
      <View style={s.row}>
        <Pill on={provider==="tradier"} label="Tradier (real-time)" onPress={() => setProvider("tradier")} />
        <Pill on={provider==="polygon"} label="Polygon (delayed)" onPress={() => setProvider("polygon")} />
      </View>

      <View style={s.noteBox}>
        {provider === "tradier" ? (
          <Text style={s.note}>
            Using <Text style={s.bold}>Tradier</Text> for equities & options (real-time). All features enabled.
          </Text>
        ) : (
          <Text style={s.note}>
            Using <Text style={s.bold}>Polygon</Text> (15-min delayed on lower tiers). Options T&S, OI & action tags
            are supported via snapshots & trades polling.
          </Text>
        )}
      </View>
      <Pill
        on={provider==="tradier"}
        label="Tradier (real-time)"
        onPress={() => {
          console.log("[Settings] set provider -> tradier");
          setProvider("tradier");
        }}
      />
      <Pill
        on={provider==="polygon"}
        label="Polygon (delayed)"
        onPress={() => {
          console.log("[Settings] set provider -> polygon");
          setProvider("polygon");
        }}
      />      
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#d1d5db" },
  pillOn: { backgroundColor: "#111827", borderColor: "#111827" },
  pillText: { color: "#111827", fontWeight: "700" },
  pillTextOn: { color: "white" },
  noteBox: { marginTop: 16, backgroundColor: "#f3f4f6", padding: 12, borderRadius: 8 },
  note: { color: "#374151" },
  bold: { fontWeight: "800" },
});

