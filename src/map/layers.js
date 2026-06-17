import { BUILDING_COLORS, POI_COLORS } from './config.js'

export function addAllLayers(map, geoData, processedBuildings) {
  addTerritory(map, geoData.territory)
  addZones(map, geoData.zones)
  addRoads(map, geoData.roads)
  addBuildings(map, processedBuildings)
  addBuildings3D(map)
  addComplex3D(map, processedBuildings)
  addPOI(map, geoData.poi)
  addLabels(map, processedBuildings)
}

// ═══ Территория ═══

function addTerritory(map, data) {
  if (!data) data = '/data/territory.geojson'
  map.addSource('territory', {
    type: 'geojson',
    data
  })

  map.addLayer({
    id: 'territory-fill',
    type: 'fill',
    source: 'territory',
    paint: {
      'fill-color': '#d4e8c2',
      'fill-opacity': 0.5
    }
  })

  map.addLayer({
    id: 'territory-border',
    type: 'line',
    source: 'territory',
    paint: {
      'line-color': '#8FBC8F',
      'line-width': 2,
      'line-dasharray': [4, 2]
    }
  })
}

// ═══ Зоны (парки, парковки) ═══

function addZones(map, data) {
  if (!data) data = '/data/zones.geojson'
  map.addSource('zones', {
    type: 'geojson',
    data
  })

  map.addLayer({
    id: 'zones-fill',
    type: 'fill',
    source: 'zones',
    paint: {
      'fill-color': ['coalesce', ['get', 'fill-color'], '#66BB6A'],
      'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.3]
    }
  })

  map.addLayer({
    id: 'zones-border',
    type: 'line',
    source: 'zones',
    paint: {
      'line-color': ['coalesce', ['get', 'fill-color'], '#66BB6A'],
      'line-width': 1,
      'line-opacity': 0.5
    }
  })

  map.addLayer({
    id: 'zones-label',
    type: 'symbol',
    source: 'zones',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 12
    },
    paint: {
      'text-color': '#2E7D32',
      'text-halo-color': '#fff',
      'text-halo-width': 1
    }
  })
}

// ═══ Дорожки ═══

function addRoads(map, data) {
  if (!data) data = '/data/roads.geojson'
  map.addSource('roads', {
    type: 'geojson',
    data
  })

  // Обводка (широкая, тёмная — имитация бордюра)
  map.addLayer({
    id: 'roads-casing',
    type: 'line',
    source: 'roads',
    paint: {
      'line-color': '#999',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        14, 2,
        18, 7
      ],
      'line-opacity': 0.3
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  })

  // Основная линия (светлая)
  map.addLayer({
    id: 'roads-line',
    type: 'line',
    source: 'roads',
    paint: {
      'line-color': '#E0E0E0',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        14, 1,
        18, 5
      ]
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  })

  // Подписи дорожек (на близком зуме)
  map.addLayer({
    id: 'roads-label',
    type: 'symbol',
    source: 'roads',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'symbol-placement': 'line',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#777',
      'text-halo-color': '#fff',
      'text-halo-width': 1
    },
    minzoom: 17
  })
}

// ═══ Здания (2D) ═══

function addBuildings(map, data) {
  map.addSource('buildings', {
    type: 'geojson',
    data
  })

  map.addLayer({
    id: 'buildings-fill',
    type: 'fill',
    source: 'buildings',
    paint: {
      'fill-color': BUILDING_COLORS,
      'fill-opacity': [
        'interpolate', ['linear'], ['zoom'],
        14, 0.6,
        18, 0.8
      ]
    }
  })

  map.addLayer({
    id: 'buildings-outline',
    type: 'line',
    source: 'buildings',
    paint: {
      'line-color': '#444',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        14, 0.5,
        18, 2
      ]
    }
  })

}

// ═══ Здания (3D экструзия) ═══

function addBuildings3D(map) {
  map.addLayer({
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: 'buildings',
    layout: {
      visibility: 'none'
    },
    paint: {
      'fill-extrusion-color': [
        'coalesce',
        ['get', 'color'],
        BUILDING_COLORS
      ],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 0.85,
      'fill-extrusion-vertical-gradient': false
    }
  })
}

// ═══ Комплекс корпусов (связная 2D+3D-композиция) ═══

function addComplex3D(map, allBuildings) {
  const complexFeatures = allBuildings.features.filter(
    f => f.properties?.complex_id
  )

  const data = complexFeatures.length > 0
    ? { type: 'FeatureCollection', features: complexFeatures }
    : { type: 'FeatureCollection', features: [] }

  map.addSource('complex', {
    type: 'geojson',
    data
  })

  map.addLayer({
    id: 'complex-fill',
    type: 'fill',
    source: 'complex',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.75
    }
  })

  map.addLayer({
    id: 'complex-outline-2d',
    type: 'line',
    source: 'complex',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#2c3e50',
      'line-width': 1.5,
      'line-opacity': 0.3
    }
  })

  map.addLayer({
    id: 'complex-3d',
    type: 'fill-extrusion',
    source: 'complex',
    layout: { visibility: 'none' },
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': [
        'case',
        ['==', ['get', 'type'], 'transition'],
        7,
        ['get', 'height']
      ],
      'fill-extrusion-base': [
        'case',
        ['==', ['get', 'type'], 'transition'],
        3.5,
        0
      ],
      'fill-extrusion-opacity': 0.88,
      'fill-extrusion-vertical-gradient': false
    }
  })

  map.addLayer({
    id: 'complex-outline',
    type: 'line',
    source: 'complex',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#2c3e50',
      'line-width': 1,
      'line-opacity': 0.2
    }
  })
}

// ═══ Точки интереса ═══

function addPOI(map, data) {
  if (!data) data = '/data/poi.geojson'
  map.addSource('poi', {
    type: 'geojson',
    data
  })

  map.addLayer({
    id: 'poi-circles',
    type: 'circle',
    source: 'poi',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        14, 3,
        18, 8
      ],
      'circle-color': POI_COLORS,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff'
    }
  })

  map.addLayer({
    id: 'poi-label',
    type: 'symbol',
    source: 'poi',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#444',
      'text-halo-color': '#fff',
      'text-halo-width': 1
    },
    minzoom: 16
  })
}

// ═══ Подписи зданий (поверх всего) ═══

function addLabels(map) {
  map.addLayer({
    id: 'buildings-label',
    type: 'symbol',
    source: 'buildings',
    filter: ['!has', 'complex_id'],
    layout: {
      'text-field': ['get', 'name'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        14, 0,
        15, 10,
        18, 14
      ],
      'text-anchor': 'center',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#222',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5
    }
  })

  map.addLayer({
    id: 'complex-label',
    type: 'symbol',
    source: 'complex',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        14, 0,
        15, 10,
        18, 14
      ],
      'text-anchor': 'center',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': '#1a1a2e',
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  })
}