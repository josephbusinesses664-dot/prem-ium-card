import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tap.prem-ium.online',
  build: { inlineStylesheets: 'auto' },
  vite: {
    build: {
      /* Without this the media query ships as @media (width<=760px), which
         needs iOS Safari 16.4+. This page exists to be opened on strangers'
         iPhones, so it targets older Safari deliberately. */
      cssTarget: ['safari14', 'chrome90', 'firefox90', 'edge90'],
    },
  },
});
