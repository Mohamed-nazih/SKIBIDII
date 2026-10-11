import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'SKIBIDII',
        short_name: 'SKIBIDII',
        description: 'PG Food Rotation & Peer Verification System',
        theme_color: '#f5f5f7',
        background_color: '#f5f5f7',
        display: 'standalone',
        icons: [
          {
            src: '/skibidi-icon.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/skibidi-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
});
