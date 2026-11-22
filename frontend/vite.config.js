import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The slide deck lives in public/presentation (copied into dist/ on build).
// In dev, send /presentation and /presentation/ to its index.html instead of the React app.
const presentation = {
  name: 'presentation-index',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/presentation' || req.url === '/presentation/') req.url = '/presentation/index.html'
      next()
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [presentation, react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
