// orval.config.ts — конфиг генератора TypeScript клиента
import { defineConfig } from 'orval'

export default defineConfig({
  geomap: {
    input: './api/openapi.yaml',
    output: {
      mode: 'tags-split',               // разбивает по тегам (tiles.ts, photos.ts...)
      target: './frontend/src/api/generated/',
      client: 'fetch',                  // нативный fetch
      baseUrl: '/api/v1',               // ← относительный, работает везде
      schemas: './frontend/src/api/model/',
    },
  },
})