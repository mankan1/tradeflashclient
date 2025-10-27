import React from "react";
import { Text } from "react-native";

export default function ProviderChip({ p }: { p?: "tradier" | "alpaca" }) {
  return (
    <Text
      style={{
        color: p === "alpaca" ? "#155e75" : "#111827",
        backgroundColor: p === "alpaca" ? "#e0f2fe" : "#e5e7eb",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      {p ?? "—"}
    </Text>
  );
}

