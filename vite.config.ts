import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

function cssFallbackPlugin() {
  return {
    name: 'css-fallback-plugin',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (id === './index.css' || id === '/src/index.css' || id.endsWith('index.css')) {
        const root = import.meta.dirname || '.';
        const candidates = [
          path.resolve(root, 'src/index.css'),
          path.resolve(root, 'index.css'),
          path.resolve(root, 'src/index.css.txt'),
          path.resolve(root, 'index.css.txt'),
          path.resolve(root, 'src/globals.css'),
          path.resolve(root, 'src/style.css'),
        ];
        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            return cand;
          }
        }
        return '\0virtual-index.css';
      }
      return null;
    },
    load(id: string) {
      if (id === '\0virtual-index.css') {
        return '@import "tailwindcss";';
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [cssFallbackPlugin(), tailwindcss(), react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-lucide';
            }
            if (
              id.includes('node_modules/react-markdown/') ||
              id.includes('node_modules/remark-gfm/') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/unified')
            ) {
              return 'vendor-markdown';
            }
            if (id.includes('node_modules/react-diff-viewer-continued/')) {
              return 'vendor-diff';
            }
            if (id.includes('node_modules/motion/')) {
              return 'vendor-motion';
            }
          },
        },
      },
    },
  };
});
