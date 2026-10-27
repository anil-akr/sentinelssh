import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Développement : React tourne sur le port 5173, Flask sur le port 5000.
// Le proxy transmet tout ce qui commence par /api à Flask : pour le
// navigateur, tout vient de la même origine, donc pas de problème de CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  build: {
    // Le fichier JS pèse environ 1,4 Mo, surtout à cause des contours des
    // pays (world-atlas), inclus pour que la carte marche sans Internet.
    // Application locale : ce poids est acceptable, on relève le seuil
    // de l'avertissement (500 ko par défaut).
    chunkSizeWarningLimit: 1600,
  },
})
