import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.toydiary.app',
  appName: 'Toy Diary',
  webDir: 'dist',
  server: {
    // 开发时想「边改 React 边在模拟器里热更新」：
    // 1. npm run dev
    // 2. 把下面两行取消注释（url 换成终端里 Vite 打印的局域网地址）
    // url: 'http://localhost:5173',
    // cleartext: true,
  },
}

export default config
