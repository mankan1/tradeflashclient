export type TradeFlashItem = {
  id: string;
  ts: number;                 // epoch ms
  symbol: string;             // e.g., SPY
  occ?: string;               // OCC option symbol, optional
  expiry?: string;            // 2025-10-24
  right?: "C" | "P";
  strike?: number;
  qty: number;                // contracts
  price: number;              // option price
  notional?: number;          // qty * price * multiplier
  side?: "BOT" | "SLD";       // inferred if you have aggressor data
  venue?: string;             // optional
};

export type OTSRow = {
  id: string;
  ts: number;
  option: { expiry: string; strike: number; right: "C"|"P" };
  qty: number;
  price: number;
};

