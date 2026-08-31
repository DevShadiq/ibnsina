import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: process.env.LOCAL_API_TARGET || 'http://localhost:3003',
        changeOrigin: true
      }
    }
  }
});
