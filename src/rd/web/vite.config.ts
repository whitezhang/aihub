import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
  server: {
    port: 5172,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8082",
        changeOrigin: true,
      },
    },
  },
  build: {
    // 仓根 output/：本机构建后提交；服务器 deploy 直接用，不再 vite build
    outDir: path.resolve(root, "../../../output"),
    emptyOutDir: true,
  },
});

