import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const atgPort = process.env.ATG_PORT || "8080";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: Number(process.env.WEB_PORT || 5173),
    proxy: {
      "/api": `http://localhost:${atgPort}`,
      "/healthz": `http://localhost:${atgPort}`,
    },
  },
});
