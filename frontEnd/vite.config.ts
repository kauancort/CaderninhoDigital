import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { LOCAL_API_TARGET, rewriteLocalProxyOrigin } from "./dev-api-proxy";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: LOCAL_API_TARGET,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", rewriteLocalProxyOrigin);
        },
      },
    },
    port: 3000,
    strictPort: false,
  },
  preview: {
    port: 3000,
  },
});
