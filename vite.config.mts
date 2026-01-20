import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node20',
    lib: {
      entry: resolve(__dirname, 'src/extension.mts'),
      fileName: () => 'extension.js',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'vscode', 
        'path', 
        'fs', 
        'os', 
        'child_process', 
        'crypto', 
        'buffer', 
        'stream', 
        'util', 
        'events', 
        'http', 
        'https', 
        'net', 
        'tls', 
        'zlib', 
        'url', 
        'assert'
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
});
