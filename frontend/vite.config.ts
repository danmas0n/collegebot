import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

// Service ports
const BACKEND_URL = 'http://localhost:3001';  // Docker exposed backend port
const FIREBASE_AUTH_PORT = 9099;
const FIREBASE_FIRESTORE_PORT = 8080;
const EMULATOR_UI_PORT = 4000;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(),
      {
        name: 'html-transform',
        transformIndexHtml: {
          enforce: 'pre',
          transform(html: string) {
            return html.replace(/%VITE_GA_MEASUREMENT_ID%/g, env.VITE_GA_MEASUREMENT_ID || '');
          }
        }
      }
    ],
    clearScreen: false,
    logLevel: 'info',
    server: {
      port: 3000,
      hmr: {
        timeout: 10000, // Increase timeout to 10 seconds (default is 1000ms)
        protocol: 'ws',
        host: 'localhost',
      },
      watch: {
        usePolling: false, // Set to true if you're having issues with file changes not being detected
        interval: 100,
        ignored: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      },
      proxy: {
        '/api': {
          target: BACKEND_URL,
          changeOrigin: true,
          timeout: 120000, // 2 minutes timeout for API requests
          proxyTimeout: 120000,
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
  };
});
