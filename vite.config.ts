import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import process from 'node:process';
import { webuiRuBuildIdentity } from './scripts/webuiRu-build-identity.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __WEBUI_RU_BUILD_IDENTITY__: JSON.stringify(webuiRuBuildIdentity(pkg.version, process.env)),
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    {
      name: 'emit-app-manifest',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'stalwart-app.json',
          source: JSON.stringify({
            id: 'webui',
            version: pkg.version,
            minServerVersion: pkg.stalwart.minServerVersion,
          }),
        });
      },
    },
  ],
  build: {
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
