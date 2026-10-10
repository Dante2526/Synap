import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [tailwindcss(), react()],
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
              id.includes('node_modules/remark-') ||
              id.includes('node_modules/mdast-') ||
              id.includes('node_modules/hast-') ||
              id.includes('node_modules/vfile') ||
              id.includes('node_modules/unist-') ||
              id.includes('node_modules/micromark') ||
              id.includes('node_modules/unified')
            ) {
              return 'vendor-markdown';
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
