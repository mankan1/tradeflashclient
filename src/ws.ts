import { SERVER_WS } from "./config";

export type QuoteMsg = {
  type: "quotes";
  data: { symbol: string; last?: number; bid?: number; ask?: number; size?: number; volume?: number; trade_time?: number; };
  side?: "BOT"|"SLD"|"—";
  side_src?: "mid"|"tick"|"none";
};

export type EquityTSMsg = {
  type: "equity_ts";
  symbol: string;
  data: {
    time?: string;
    price: number;
    volume?: number; size?: number; qty?: number; quantity?: number;
    side?: "BOT"|"SLD"|"—";
    side_src?: "mid"|"tick"|"none";
    book?: { bid?: number; ask?: number; mid?: number };
    at?: "bid"|"ask"|"mid"|"between";
  };
};

export type OptionTSMsg = {
  type: "option_ts";
  symbol: string;
  data: {
    id: string; ts: number;
    option: { expiry: string; strike: number; right: "C"|"P" };
    qty: number; price: number;
    side?: "BOT"|"SLD"|"—";
    side_src?: "mid"|"tick"|"none";
    oi?: number;
    priorVol?: number;
    book?: { bid?: number; ask?: number; mid?: number };
    at?: "bid"|"ask"|"mid"|"between";
    action?: "BTO"|"STO"|"BTC"|"STC"|"OPEN?"|"CLOSE?"|"—";
    action_conf?: "high"|"medium"|"low";
  };
};
export type ServerMsg =
  | { type: "quotes";     data: any; provider?: "tradier" | "alpaca" | "polygon"; }
  | { type: "equity_ts";  symbol: string; data: any; provider?: "tradier" | "alpaca" | "polygon"; }
  | { type: "option_ts";  symbol: string; data: any; provider?: "tradier" | "alpaca" | "polygon"; }
  | { type: string;       [k: string]: any };

const ENV_WS =
  (typeof process !== "undefined" && (process as any).env?.EXPO_PUBLIC_WS_ORIGIN) ||
  (typeof window !== "undefined" && (window as any).__WS_ORIGIN);

export const SERVER_WS_BASE =
  (ENV_WS || "wss://tradeflash-ypmg.onrender.com").replace(/\/+$/, ""); // no trailing slash

function buildWsUrl(path = "/ws", qs?: Record<string, string | number | boolean>) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const q = qs ? `?${new URLSearchParams(Object.entries(qs).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return `${SERVER_WS_BASE}${p}${q}`;
}

export function connectWS(
  handlers: {
    onMsg: (m: ServerMsg) => void;
    onOpen?(): void;
    onClose?(): void;
    onError?(e: any): void;
  },
  opts?: { path?: string; qs?: Record<string, string | number | boolean> }
): WebSocket {
  const url = buildWsUrl(opts?.path ?? "/ws", opts?.qs);
  const ws = new WebSocket(url);

  // Toggle in DevTools:  window.__LOG_WS__ = true
  const shouldLog = () => (typeof window !== "undefined" ? !!(window as any).__LOG_WS__ : false);

  ws.onopen = () => {
    if (shouldLog()) console.log("[WS open]", url);
    handlers.onOpen?.();
  };

  ws.onclose = (ev) => {
    if (shouldLog()) console.log("[WS close]", { code: ev.code, reason: ev.reason });
    handlers.onClose?.();
  };

  ws.onerror = (e) => {
    if (shouldLog()) console.warn("[WS error]", e);
    handlers.onError?.(e as any);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(typeof e.data === "string" ? e.data : String(e.data));
      if (shouldLog()) console.log("[WS msg]", msg?.type, msg);
      handlers.onMsg(msg as ServerMsg);
    } catch (err) {
      if (shouldLog()) console.warn("[WS non-JSON]", e.data);
    }
  };

  return ws;
}
// export type ServerMsg = QuoteMsg | EquityTSMsg | OptionTSMsg | { type: "equity_ts"; symbol: string; data: any; provider?: "tradier"|"alpaca" }
//   | { type: "option_ts"; symbol: string; data: any; provider?: "tradier"|"alpaca" }
//   | { type: "quotes"; data: any; side?: string; side_src?: string; provider?: "tradier"|"alpaca" };

// export function connectWS(handlers:{ onMsg:(m:ServerMsg)=>void; onOpen?():void; onClose?():void; onError?(e:any):void; }) {
//   const ws = new WebSocket(SERVER_WS);

//   ws.onopen = () => {
//     ws.send('Hello from the client!')
//   }

//   ws.onmessage = (event) => {
//     console.log('Received:', event.data)
//   }

//   ws.onopen = () => handlers.onOpen?.();
//   ws.onclose = () => handlers.onClose?.();
//   ws.onerror = (e) => handlers.onError?.(e as any);
//   ws.onmessage = (e) => { try { handlers.onMsg(JSON.parse(e.data) as ServerMsg); } catch {} };
//   return ws;
// }
