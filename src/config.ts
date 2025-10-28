const isBrowser = typeof window !== "undefined";
const host = isBrowser ? window.location.hostname : "localhost";
const httpProto = isBrowser ? window.location.protocol : "http:";
const wsProto = httpProto === "https:" ? "wss:" : "ws:";

export const SERVER_HTTP = "https://tradeflash-production.up.railway.app"; //"https://tradeflash-ypmg.onrender.com"; //"http://localhost:8080";
//export const SERVER_HTTP = "http://localhost:8080";
export const SERVER_WS   = "wss://tradeflash-production.up.railway.app/ws"; //"wss://tradeflash-ypmg.onrender.com/ws";  //"http://localhost:8081";
//export const SERVER_WS   = "ws://localhost:8080/ws";
