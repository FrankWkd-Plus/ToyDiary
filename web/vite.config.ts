import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host: true → 监听 0.0.0.0，便于同网段设备访问
  // 注意：打印的 Network 地址是局域网 IP，不是公网；大局域网常有隔离/防火墙
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    // Local dev: hit production Pages Functions so /api/analyze-entry & /api/chat work
    // without needing wrangler pages dev. Override with VITE_AI_* env if needed.
    proxy: {
      '/api': {
        target: 'https://toydairy.pages.dev',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  preview: {
    port: 4173,
    host: true,
    strictPort: true,
  },
})