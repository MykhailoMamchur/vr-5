import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    https: true // Required for WebXR which needs secure context
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        task1: 'task1.html',
        task2: 'task2.html',
        task3: 'task3.html',
        task4: 'task4.html'
      }
    }
  },
  optimizeDeps: {
    include: ['three']
  }
});