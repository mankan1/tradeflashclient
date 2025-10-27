// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useProvider } from "../state/ProviderContext";
import { startWatch, updateProviderCredentials } from "../api";

const Pill = ({ on, label, onPress }:{on:boolean; label:string; onPress:()=>void}) => (
  <TouchableOpacity onPress={onPress} style={[s.pill, on && s.pillOn]}>
    <Text style={[s.pillText, on && s.pillTextOn]}>{label}</Text>
  </TouchableOpacity>
);

const K_TRADIER = "settings.tradier.token";
const K_ALP_KEY = "settings.alpaca.key";
const K_ALP_SEC = "settings.alpaca.secret";

export default function SettingsScreen() {
  const { provider, setProvider } = useProvider();

  const [tradierToken, setTradierToken] = useState("");
  const [alpKey, setAlpKey] = useState("");
  const [alpSec, setAlpSec] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, k, s] = await Promise.all([
        AsyncStorage.getItem(K_TRADIER),
        AsyncStorage.getItem(K_ALP_KEY),
        AsyncStorage.getItem(K_ALP_SEC),
      ]);
      if (t) setTradierToken(t);
      if (k) setAlpKey(k);
      if (s) setAlpSec(s);
    })();
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      // Persist locally (so fields prefill next time)
      await Promise.all([
        AsyncStorage.setItem(K_TRADIER, tradierToken || ""),
        AsyncStorage.setItem(K_ALP_KEY, alpKey || ""),
        AsyncStorage.setItem(K_ALP_SEC, alpSec || ""),
      ]);

      // Send to server (only send what’s present)
      const body:any = {};
      if (tradierToken) body.tradier = { token: tradierToken };
      if (alpKey || alpSec) body.alpaca = { key: alpKey || "", secret: alpSec || "" };
      if (Object.keys(body).length) {
        const resp = await updateProviderCredentials(body);
        console.log("[Settings] credentials set:", resp);
      }

      // Immediately (re)start streaming with current provider
      const w = await startWatch({
        symbols: ["SPY", "QQQ", "NVDA"],
        eqForTS: ["SPY"],
        backfill: 10,
        moneyness: 0.25,
        limit: 200,
        provider,        // <= honor the toggle
      });
      console.log("[Settings] /watch started:", w?.env || w);
      Alert.alert("Saved", `Credentials updated. Streaming via ${provider}.`);
    } catch (e:any) {
      console.warn("Save failed:", e);
      Alert.alert("Error", String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Data Provider</Text>
      <View style={s.row}>
        <Pill on={provider==="tradier"} label="Tradier (real-time)" onPress={() => setProvider("tradier")} />
        <Pill on={provider==="polygon"} label="Polygon (delayed)" onPress={() => setProvider("polygon")} />
        <Pill on={provider==="both"} label="Both" onPress={() => setProvider("both")} />
      </View>

      <View style={s.noteBox}>
        <Text style={s.note}>
          Active: <Text style={s.bold}>{provider === "polygon" ? "Polygon (delayed)" : "Tradier (real-time)"}</Text>
        </Text>
        <Text style={[s.note, { marginTop: 6 }]}>
          Enter your keys below. They are stored locally on this device and sent once to your server to use for streaming.
        </Text>
      </View>

      <Text style={s.section}>Tradier</Text>
      <TextInput
        value={tradierToken}
        onChangeText={setTradierToken}
        placeholder="Tradier API Token"
        autoCapitalize="none"
        secureTextEntry
        style={s.input}
      />

      <Text style={s.section}>Alpaca</Text>
      <TextInput
        value={alpKey}
        onChangeText={setAlpKey}
        placeholder="Alpaca Key ID"
        autoCapitalize="none"
        style={s.input}
      />
      <TextInput
        value={alpSec}
        onChangeText={setAlpSec}
        placeholder="Alpaca Secret Key"
        autoCapitalize="none"
        secureTextEntry
        style={s.input}
      />

      <TouchableOpacity onPress={onSave} disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]}>
        <Text style={s.saveTxt}>{saving ? "Saving…" : "Save & Start Streaming"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex:1, padding:16, gap:12 },
  title: { fontSize:18, fontWeight:"800" },
  row: { flexDirection:"row", gap:10, flexWrap:"wrap" },
  pill: { paddingHorizontal:12, paddingVertical:8, borderRadius:999, borderWidth:1, borderColor:"#d1d5db" },
  pillOn: { backgroundColor:"#111827", borderColor:"#111827" },
  pillText: { color:"#111827", fontWeight:"700" },
  pillTextOn: { color:"white" },
  noteBox: { backgroundColor:"#f3f4f6", padding:10, borderRadius:8 },
  note: { color:"#374151" },
  bold: { fontWeight:"800" },
  section: { marginTop:10, fontWeight:"800" },
  input: { borderWidth:1, borderColor:"#d1d5db", borderRadius:6, paddingHorizontal:10, paddingVertical:8 },
  saveBtn: { marginTop:14, backgroundColor:"#111827", padding:12, borderRadius:8, alignItems:"center" },
  saveTxt: { color:"white", fontWeight:"800" },
});
