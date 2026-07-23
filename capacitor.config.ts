import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.duitaku',
  appName: 'duitaku',
  // webDir is required by Capacitor but unused when server.url is set
  webDir: 'public',
  server: {
    // Load the live Vercel deployment — no static export needed
    url: 'https://duitaku.vercel.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0a0a',
    // Allow navigation within the app domain only
    allowsLinkPreview: false,
  },
}

export default config
