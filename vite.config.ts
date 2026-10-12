import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rolldownOptions: {
      output: {
        // React and the data layer in chunks of their own: the main chunk stays
        // under Vite's 500 kB warning, and a change to the game does not
        // invalidate cached libraries. PixiJS is left to its own split — it
        // already loads its renderer and extensions on demand, and grouping it
        // would merge those back into one large chunk. (Rolldown's
        // `codeSplitting` is the successor to `manualChunks`.)
        codeSplitting: {
          groups: [
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'data', test: /[\\/]node_modules[\\/](@tanstack|axios)[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
