import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Service ports
const BACKEND_URL = 'http://localhost:3001';  // Docker exposed backend port
const FIREBASE_AUTH_PORT = 9099;
const FIREBASE_FIRESTORE_PORT = 8080;
const EMULATOR_UI_PORT = 4000;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  logLevel: 'info',
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/__/auth': {
        target: `http://localhost:${FIREBASE_AUTH_PORT}`,
        changeOrigin: true,
      },
      '/emulator': {
        target: `http://localhost:${EMULATOR_UI_PORT}`,
        changeOrigin: true,
      }
    },
  },
});
