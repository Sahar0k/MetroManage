import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
    proxy: {
      '/api/gosreestr': {
        target: 'https://fgis.gost.ru',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gosreestr/, '/fundmetrology'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://fgis.gost.ru/fundmetrology/cm/mits',
        },
      },
    },
  },
});
