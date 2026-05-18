import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
    middlewareMode: false,
    watch: {
      ignored: [
        '**/src/assets/Character Art + Sprites/**',
        '**/src/assets/Movies/**',
        '**/src/assets/Music/**',
        '**/src/assets/Sound Effects/**',
        '**/src/assets/Backgrounds/**',
        '**/src/assets/Accessories/**',
        '**/src/assets/App Icons/**',
        '**/src/assets/UI/**',
        '**/src/assets/Voices [English]/**',
        '**/src/assets/Voices [Japanese]/**',
        '**/src/assets/Weapon Sprites/**',
        '**/src/assets/Maps/Story/**',
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  publicDir: 'public',
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.mp4', '**/*.mp3'],
});
