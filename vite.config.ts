import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: fileURLToPath(new URL("./web", import.meta.url)),
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [fileURLToPath(new URL(".", import.meta.url))],
    },
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
