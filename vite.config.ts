import { defineConfig } from 'vite';

export default defineConfig({
  assetsInclude: ['**/*.svg'],
  build: {
    outDir: 'dist',
  },
});
