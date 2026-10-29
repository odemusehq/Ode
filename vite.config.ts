import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import { DevConfig } from "./src/shared/dev-config.ts";

const EVENT_STREAM = "text/event-stream";

/**
 * Proxy for the dev server: API calls and the event stream go to Ode's server in Live, at the address it prints when
 * it starts (ODE_DEV_SERVER in .env), with the token from that address.
 */
function apiProxy(): ProxyOptions {
  const address = new URL(DevConfig.load().server);
  const token = address.searchParams.get("token") ?? "";
  return {
    target: address.origin,
    headers: { Cookie: `ode=${token}` },
    changeOrigin: true,
    timeout: 0,
    proxyTimeout: 0,
    configure: (proxy) => {
      proxy.on("proxyRes", (response) => {
        if (response.headers["content-type"]?.startsWith(EVENT_STREAM)) {
          response.headers["cache-control"] = "no-cache, no-transform";
          response.headers["x-accel-buffering"] = "no";
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./src/ui", import.meta.url)),
  base: "/",
  plugins: [react()],
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  server: command === "serve" ? { proxy: { "/api": apiProxy() } } : undefined,
}));
