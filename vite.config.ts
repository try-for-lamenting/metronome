import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.svg'],
  define: {
    __APP_VERSION__: JSON.stringify(String(Date.now())),
  },
  build: {
    outDir: 'dist',
  },
});
