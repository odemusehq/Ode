import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { ProxyOptions } from "vite";
import { loadConfig } from "./src/shared/config";

const EVENT_STREAM = "text/event-stream";

/** Proxy for the dev server: API calls and the event stream go to the local Ode server. */
function apiProxy(): ProxyOptions {
  const { host, port } = loadConfig();
  return {
    target: `http://${host}:${port}`,
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
