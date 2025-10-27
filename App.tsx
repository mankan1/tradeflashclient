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
import EquitiesAlpaca from "./src/screens/EquitiesAlpaca";
import OptionsFlowApl from "./src/screens/OptionsFlowApl";
import UoaPopularCombinedScreen from "./src/screens/UoaPopularCombinedScreen";
import SettingsScreen from "./src/screens/SettingsScreen";

import { startWatch } from "./src/api";
import { ProviderStore, useProvider } from "./src/state/ProviderContext";
import { DataEnvStore, useDataEnv } from "./src/state/DataEnvContext";
import ProviderBanner from "./src/components/ProviderBanner";

const Tab = createMaterialTopTabNavigator();

function Root() {
  const { provider, ready } = useProvider();
  const { setActiveProvider } = useDataEnv();

  useEffect(() => {
    if (!ready) return; // wait until ProviderContext loaded from storage

    console.log(`[App] requesting /watch with provider=${provider}`);
    (async () => {
      try {
        const resp = await startWatch({
          symbols: ["SPY", "QQQ", "NVDA"],
          eqForTS: ["SPY"],
          backfill: 10,
          moneyness: 0.25,
          limit: 200,
          provider, // <- ALWAYS pass current provider
        });

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
        <Tab.Screen name="Options Time & Sales" component={OptionsTimeSalesScreen} />
        <Tab.Screen name="Options T&S (opt)" component={OptionsOnlyTimeSalesScreen} />
        <Tab.Screen name="Options Flash" component={OptionsOnlyFlashScreen} />
        <Tab.Screen name="Alpaca Popular" component={AlpacaPopularScreen} />
        <Tab.Screen name="Scanners" component={ScannersScreen} />
        <Tab.Screen name="Alpaca" component={AlpacaScannersScreen} />
        <Tab.Screen name="EquitiesAlpaca" component={EquitiesAlpaca} />
        <Tab.Screen name="OptionsFlowApl" component={OptionsFlowApl} />  
        <Tab.Screen name="UOA • Popular Combo" component={UoaPopularCombinedScreen} />
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
