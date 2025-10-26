// src/state/ProviderContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Provider = "tradier" | "polygon";
const KEY = "tradeflash.provider";

type Ctx = {
  provider: Provider;
  setProvider: (p: Provider) => void;
  ready: boolean;                  // <-- NEW
};

const C = createContext<Ctx>({ provider: "tradier", setProvider: () => {}, ready: false });

export function ProviderStore({ children }: { children: React.ReactNode }) {
  const [provider, setProviderState] = useState<Provider>("tradier");
  const [ready, setReady] = useState(false); // <-- NEW

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved === "tradier" || saved === "polygon") setProviderState(saved);
      } finally {
        setReady(true); // we have a value (saved or default)
      }
    })();
  }, []);

  const setProvider = (p: Provider) => {
    setProviderState(p);
    AsyncStorage.setItem(KEY, p).catch(() => {});
  };

  const value = useMemo(() => ({ provider, setProvider, ready }), [provider, ready]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useProvider() {
  return useContext(C);
}
