import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useDataEnv } from "../state/DataEnvContext";
import { useNavigation } from "@react-navigation/native";

export default function ProviderBanner() {
  const { activeProvider } = useDataEnv();
  const nav = useNavigation<any>();

  if (activeProvider === "unknown") return null;

  const txt =
    activeProvider === "polygon" ? "Polygon (delayed)" : "Tradier (real-time)";
  const bg = activeProvider === "polygon" ? "#fef3c7" : "#e0f2fe"; // subtle
  const fg = "#111827";

  return (
    <TouchableOpacity
      onPress={() => nav.navigate("Settings")}
      activeOpacity={0.8}
      style={s.wrap}
      accessibilityRole="button"
      accessibilityLabel={`Data provider: ${txt}. Tap to open Settings.`}
    >
      <View style={[s.pill, { backgroundColor: bg, borderColor: "#e5e7eb" }]}>
        <View style={[s.dot, { backgroundColor: activeProvider === "polygon" ? "#f59e0b" : "#0ea5e9" }]} />
        <Text style={[s.txt, { color: fg }]}>{txt}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 6,
    right: 8,
    zIndex: 9999,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,       // smaller
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  txt: {
    fontSize: 12,             // smaller
    fontWeight: "700",
  },
});
