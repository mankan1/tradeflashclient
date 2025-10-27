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

export type ServerMsg = QuoteMsg | EquityTSMsg | OptionTSMsg | { type: "equity_ts"; symbol: string; data: any; provider?: "tradier"|"alpaca" }
  | { type: "option_ts"; symbol: string; data: any; provider?: "tradier"|"alpaca" }
  | { type: "quotes"; data: any; side?: string; side_src?: string; provider?: "tradier"|"alpaca" };

export function connectWS(handlers:{ onMsg:(m:ServerMsg)=>void; onOpen?():void; onClose?():void; onError?(e:any):void; }) {
  const ws = new WebSocket(SERVER_WS);

  ws.onopen = () => {
    ws.send('Hello from the client!')
  }

  ws.onmessage = (event) => {
    console.log('Received:', event.data)
  }

  ws.onopen = () => handlers.onOpen?.();
  ws.onclose = () => handlers.onClose?.();
  ws.onerror = (e) => handlers.onError?.(e as any);
  ws.onmessage = (e) => { try { handlers.onMsg(JSON.parse(e.data) as ServerMsg); } catch {} };
  return ws;
}
