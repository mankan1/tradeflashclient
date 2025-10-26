const isBrowser = typeof window !== "undefined";
const host = isBrowser ? window.location.hostname : "localhost";
const httpProto = isBrowser ? window.location.protocol : "http:";
const wsProto = httpProto === "https:" ? "wss:" : "ws:";

export const SERVER_HTTP = "http://localhost:8080";
export const SERVER_WS   = "ws://localhost:8081";
