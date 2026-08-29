import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// Is file ki apni jagah se raasta nikalte hain — root se `npm run build --prefix client`
// chalane par bhi '@' theek se src/ pe hi jaye
const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.join(here, 'src') },
  },
  build: {
    // Ek hi mota file banne se pehli baar khulne me der lagti hai (Render free plan pe
    // aur bhi). Library wala hissa alag kar dete hain — wo har deploy pe badalta nahi,
    // isliye browser me cache pada rehta hai aur agli baar turant khulta hai.
    rollupOptions: {
      output: {
        /*
          SSR (prerender) wali build me react bahar ka module hota hai, isliye
          use chunk me daalne ki koshish build hi tod deti hai. Wo build sirf
          HTML nikalne ke liye hai — usme chunk ka koi matlab bhi nahi.
        */
        manualChunks: process.env.SSR_BUILD ? undefined : {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          qr: ['qrcode'],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: 5173,
    // App relative `/api` maangta hai — dev me vite use server (5000) pe bhej deta hai.
    // Deploy pe zarurat nahi padti kyunki dono ek hi URL pe hote hain.
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
});
