import React, { createContext, useContext, useMemo, useState } from "react";

export type ActiveProvider = "tradier" | "polygon" | "unknown";

type EnvInfo = {
  activeProvider: ActiveProvider;
  env?: any; // whatever /watch returns (env field)
};

type Ctx = EnvInfo & {
  setActiveProvider: (p: ActiveProvider, env?: any) => void;
};

const C = createContext<Ctx>({
  activeProvider: "unknown",
  env: undefined,
  setActiveProvider: () => {},
});

export function DataEnvStore({ children }: { children: React.ReactNode }) {
  const [activeProvider, setProv] = useState<ActiveProvider>("unknown");
  const [env, setEnv] = useState<any>(undefined);

  const setActiveProvider = (p: ActiveProvider, e?: any) => {
    setProv(p);
    if (e !== undefined) setEnv(e);
  };

  const value = useMemo(() => ({ activeProvider, env, setActiveProvider }), [activeProvider, env]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useDataEnv() {
  return useContext(C);
}

