import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

import maplibregl from 'maplibre-gl/dist/maplibre-gl.js'
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

// ═══ Helper: Split features by layer (matches editor/import logic) ═══

function getLayerForFeature(feature) {
  const props = feature.properties || {}
  const geomType = feature.geometry?.type
  const type = props.type || ''
  const complexID = props.complex_id || ''

  if (geomType === 'Polygon') {
    if (complexID) return 'complex'
    const buildingTypes = ['academic', 'dormitory', 'library', 'sports', 'admin', 'canteen', 'utility', 'passage']
    const zoneTypes = ['garden', 'lawn', 'parking', 'sports-ground', 'construction']
    if (buildingTypes.includes(type)) return 'buildings'
    if (zoneTypes.includes(type)) return 'zones'
    return 'zones'
  } else if (geomType === 'LineString') {
    return 'roads'
  } else if (geomType === 'Point') {
    return 'poi'
  }
  return 'zones'
}

function splitFeaturesByLayer(features) {
  const layers = {
    buildings: { type: 'FeatureCollection', features: [] },
    complex: { type: 'FeatureCollection', features: [] },
    zones: { type: 'FeatureCollection', features: [] },
    roads: { type: 'FeatureCollection', features: [] },
    poi: { type: 'FeatureCollection', features: [] },
    territory: { type: 'FeatureCollection', features: [] }
  }

  for (const f of features) {
    const layerId = getLayerForFeature(f)
    if (layers[layerId]) {
      layers[layerId].features.push(f)
    }
  }

  return layers
}

// ═══ Загрузка данных и слоёв ═══

async function loadAllLayers() {
  // Try API first
  try {
    const geoData = await api.fetchAllLayerData()
    const hasData = Object.values(geoData).some(layer => layer?.features?.length > 0)
    if (hasData) {
      console.log('Loaded data from API')
      return geoData
    }
  } catch (e) {
    console.warn('API load failed, falling back to static files:', e)
  }

  // Fallback: load individual static layer files from dist/data/
  console.log('Loading static layer files as fallback...')
  const layerFiles = ['buildings', 'complex', 'zones', 'roads', 'poi', 'territory']
  const geoData = {}

  for (const layer of layerFiles) {
    try {
      const res = await fetch(`/data/${layer}.geojson`)
      if (res.ok) {
        const raw = await res.json()
        if (raw.type === 'FeatureCollection' && raw.features?.length > 0) {
          geoData[layer] = raw
        }
      }
    } catch (e) {
      console.warn(`Failed to load ${layer}.geojson:`, e)
    }
  }

  const hasStaticData = Object.values(geoData).some(layer => layer?.features?.length > 0)
  if (hasStaticData) {
    console.log('Loaded data from static files')
    return geoData
  }

  // Last resort: empty layers
  return splitFeaturesByLayer([])
}

map.on('load', async () => {
  const geoData = await loadAllLayers()

  // Merge buildings + complex for processed 3D data
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