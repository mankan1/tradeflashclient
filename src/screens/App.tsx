// App.tsx
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

import TradeFlashScreen from "./src/screens/TradeFlashScreen";
import OptionsTimeSalesScreen from "./src/screens/OptionsTimeSalesScreen";
import ScannersScreen from "./src/screens/ScannersScreen";
import AlpacaScannersScreen from "./src/screens/AlpacaScannersScreen";
import { startWatch } from "./src/api";

const Tab = createMaterialTopTabNavigator();

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await startWatch({
          symbols: ["SPY", "QQQ", "NVDA"],
          eqForTS: ["SPY"],
          limit: 200,
          moneyness: 0.25,
          backfill: 15,
          day: "2025-10-24",
        });
      } catch (e) {
        console.warn("startWatch failed:", e);
      }
    })();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Trade Flash" component={TradeFlashScreen} />
        <Tab.Screen name="Options Time & Sales" component={OptionsTimeSalesScreen} />
        <Tab.Screen name="Scanners" component={ScannersScreen} />
        <Tab.Screen name="Alpaca" component={AlpacaScannersScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

