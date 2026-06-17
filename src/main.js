import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

import maplibregl from 'maplibre-gl'
import { CAMPUS } from './map/config.js'
import { addAllLayers } from './map/layers.js'
import { setupInteractions } from './map/interactions.js'
import { processBuildingsToFeatures } from './map/complex/index.js'
import api from './api/client.ts'

// ═══ Создаём карту ═══

const map = new maplibregl.Map({
  container: 'map',

  // Пустой стиль — рисуем всё сами
  style: {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#e8f5e1' }
      }
    ],
    // Шрифты для подписей
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
  },

  center: CAMPUS.center,
  zoom: CAMPUS.zoom,
  minZoom: CAMPUS.minZoom,
  maxZoom: CAMPUS.maxZoom,
  maxBounds: CAMPUS.bounds,
  pitch: 55,
  bearing: -20,
  antialias: true,

  attributionControl: false
})

// ═══ Контролы MapLibre ═══

map.addControl(
  new maplibregl.NavigationControl({ showCompass: true }),
  'bottom-right'
)

map.addControl(
  new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }),
  'bottom-left'
)

map.addControl(
  new maplibregl.AttributionControl({
    compact: true,
    customAttribution: '© Университет, 2025'
  })
)

// ═══ Загрузка данных и слоёв ═══

async function loadAllLayers() {
  const data = {}

  // Use new API client to fetch all layers
  const geoData = await api.fetchAllLayerData()
  return geoData
}

map.on('load', async () => {
  const geoData = await loadAllLayers()

  // Merge buildings + complex for processed 3D data
  const buildingFeatures = [
    ...((geoData.buildings?.features) || []),
    ...((geoData.complex?.features) || [])
  ]

  if (buildingFeatures.length < 7) {
    // If API returned too few (likely failed), try static files
    for (const file of ['buildings.geojson', 'complex.geojson', 'territory.geojson', 'zones.geojson', 'roads.geojson', 'poi.geojson']) {
      try {
        const name = file.replace('.geojson', '')
        if (geoData[name]?.features?.length) continue
        const res = await fetch(`/data/${file}`)
        if (res.ok) {
          const raw = await res.json()
          if (raw.type === 'FeatureCollection') {
            geoData[name] = raw
          }
        }
      } catch { /* skip */ }
    }
  }

  const allBuildingFeatures = [
    ...((geoData.buildings?.features) || []),
    ...((geoData.complex?.features) || [])
  ]

  const buildingsData = processBuildingsToFeatures({
    type: 'FeatureCollection',
    features: allBuildingFeatures
  })

  addAllLayers(map, geoData, buildingsData)
  setupInteractions(map)

  // Активируем 3D-вид по умолчанию
  document.getElementById('btn-3d').click()

  console.log('Карта кампуса загружена')
})

document.getElementById('btn-editor').addEventListener('click', () => {
  window.location.href = '/src/editor/editor.html'
})

// Для отладки в консоли
window.map = map