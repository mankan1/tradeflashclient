// App.tsx
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

import TradeFlashScreen from "./src/screens/TradeFlashScreen";
import OptionsTimeSalesScreen from "./src/screens/OptionsTimeSalesScreen";
import OptionsOnlyTimeSalesScreen from "./src/screens/OptionsOnlyTimeSalesScreen"
import OptionsOnlyFlashScreen from "./src/screens/OptionsOnlyFlashScreen"
import ScannersScreen from "./src/screens/ScannersScreen";
import AlpacaScannersScreen from "./src/screens/AlpacaScannersScreen";
import AlpacaPopularScreen from "./src/screens/AlpacaPopularScreen";
// import EquitiesAlpaca from "./src/screens/EquitiesAlpaca";
import OptionsFlowApl from "./src/screens/OptionsFlowApl";
import UoaPopularCombinedScreen from "./src/screens/UoaPopularCombinedScreen";
import GapUp from "./src/screens/GapUp";
import SettingsScreen from "./src/screens/SettingsScreen";

import { startWatch } from "./src/api";
import { ProviderStore, useProvider } from "./src/state/ProviderContext";
import { DataEnvStore, useDataEnv } from "./src/state/DataEnvContext";
import ProviderBanner from "./src/components/ProviderBanner";

const Tab = createMaterialTopTabNavigator();
// Returns true during regular U.S. market hours (ET) Mon–Fri, 09:30–16:00
export function isMarketOpenNY(): boolean {
  const now = new Date();
  // Convert local time -> New York time without extra deps
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

  const dow = ny.getDay(); // 0=Sun ... 6=Sat
  if (dow === 0 || dow === 6) return false;

  const mins = ny.getHours() * 60 + ny.getMinutes();
  return mins >= (9 * 60 + 30) && mins < (16 * 60); // 09:30–16:00
}

function Root() {
  const { provider, ready } = useProvider();
  const { setActiveProvider } = useDataEnv();

  useEffect(() => {
    if (!ready) return; // wait until ProviderContext loaded from storage

    console.log(`[App] requesting /watch with provider=${provider}`);
    (async () => {
      try {
        // const resp = await startWatch({
        //   symbols: ["SPY", "QQQ", "NVDA"],
        //   eqForTS: ["SPY"],
        //   backfill: 10,
        //   moneyness: 0.25,
        //   limit: 200,
        //   provider, // <- ALWAYS pass current provider
        // });
        const live = isMarketOpenNY() ? 1 : 0;

        const payload: Record<string, any> = {
          symbols:   ["SPY", "QQQ", "NVDA"],
          eqForTS:   ["SPY"],
          provider,                 // "tradier" | "alpaca" | "both"
          backfill:  live ? 10 : 0,
          moneyness: 0.25,
          limit:     200,
          live,
          replay:    live ? 0 : 1,
          ...(live
            ? {}
            : { minutes: 390, speed: 60 }) // only include in replay
        };

        console.log("[startWatch] ->", payload);
        const resp = await startWatch(payload);        
        // server-confirmed provider (what’s actually active)
        const confirmed =
          (resp?.env?.provider as "tradier" | "polygon" | undefined) ||
          (resp?.provider as "tradier" | "polygon" | undefined) ||
          provider;

        console.log(`[App] /watch confirmed provider=${confirmed}`, resp?.env || resp);
        setActiveProvider(confirmed ?? "unknown", resp?.env);
      } catch (e) {
        console.warn("[App] startWatch failed:", e);
        setActiveProvider("unknown");
      }
    })();
  }, [provider, ready, setActiveProvider]); // <- re-run on toggle

  return (
    <NavigationContainer>
      <ProviderBanner />
      <Tab.Navigator>
        <Tab.Screen name="Trade Flash" component={TradeFlashScreen} />
        <Tab.Screen name="Op TimeSales" component={OptionsTimeSalesScreen} />
        <Tab.Screen name="Options T&S" component={OptionsOnlyTimeSalesScreen} />
        <Tab.Screen name="Options Flash" component={OptionsOnlyFlashScreen} />
        <Tab.Screen name="Popular" component={AlpacaPopularScreen} />
        <Tab.Screen name="Scanners" component={ScannersScreen} />
        <Tab.Screen name="AlUOA" component={AlpacaScannersScreen} />
        {/* <Tab.Screen name="EquitiesAlpaca" component={EquitiesAlpaca} /> */}
        <Tab.Screen name="OptionsFlowApl" component={OptionsFlowApl} />  
        <Tab.Screen name="UOA" component={UoaPopularCombinedScreen} />
        <Tab.Screen name="GapUp" component={GapUp} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // WRAP the app so useProvider/useDataEnv have a Provider above them
  return (
    <ProviderStore>
      <DataEnvStore>
        <Root />
      </DataEnvStore>
    </ProviderStore>
  );
}
