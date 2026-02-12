import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    // Ensure AWS SDK (and other packages) resolve to their Node.js implementations
    // instead of browser builds (which use DOMParser for XML parsing, unavailable in Node.js)
    conditions: ['node'],
    // Remove 'browser' from mainFields to prevent Vite from processing the browser
    // field in package.json (e.g., @aws-sdk/xml-builder maps xml-parser → xml-parser.browser)
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
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
        // Externalize all Node.js built-in modules (both bare and node: prefixed)
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
  },
});
