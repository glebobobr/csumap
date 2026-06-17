import maplibregl from 'maplibre-gl'
import { CAMPUS } from './config.js'

export function setupInteractions(map) {
  setupBuildingClick(map)
  setupComplexClick(map)
  setupPOIClick(map)
  setupHoverCursors(map)
  setupViewToggle(map)
  setupResetButton(map)
  setupEmptyClick(map)
}

// ═══ Клик по зданию ═══

function setupBuildingClick(map) {
  map.on('click', 'buildings-fill', (e) => {
    const props = e.features[0].properties

    // Заполняем сайдбар
    const panel = document.getElementById('building-info')
    panel.classList.remove('hidden')
    document.querySelector('.hint').classList.add('hidden')

    document.getElementById('info-name').textContent = props.name
    document.getElementById('info-desc').textContent =
      props.description || ''
    document.getElementById('info-levels').textContent =
      props.levels ? `Этажей: ${props.levels}` : ''

    // Летим к зданию
    map.flyTo({
      center: e.lngLat,
      zoom: 18,
      duration: 800
    })
  })
}

// ═══ Клик по комплексу ═══

function setupComplexClick(map) {
  function handleComplexClick(e) {
    const props = e.features[0].properties

    const panel = document.getElementById('building-info')
    panel.classList.remove('hidden')
    document.querySelector('.hint').classList.add('hidden')

    const typeLabel = {
      building: 'Корпус',
      transition: 'Переход'
    }[props.type] || ''

    document.getElementById('info-name').textContent = props.name
    document.getElementById('info-desc').textContent =
      (typeLabel ? typeLabel + '. ' : '') + (props.description || '')
    document.getElementById('info-levels').textContent =
      props.levels ? `Этажей: ${props.levels}` : ''

    map.flyTo({
      center: e.lngLat,
      zoom: 18,
      duration: 800
    })
  }

  map.on('click', 'complex-3d', handleComplexClick)
  map.on('click', 'complex-fill', handleComplexClick)
}

// ═══ Клик по POI ═══

function setupPOIClick(map) {
  map.on('click', 'poi-circles', (e) => {
    const props = e.features[0].properties

    new maplibregl.Popup({ offset: 12, closeButton: false })
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title">${props.name}</div>
        ${props.description
          ? `<div>${props.description}</div>`
          : ''
        }
        <div class="popup-category">${categoryLabel(props.category)}</div>
      `)
      .addTo(map)
  })
}

function categoryLabel(cat) {
  const labels = {
    cafe: '☕ Кафе',
    entrance: '🚪 Вход',
    bus_stop: '🚌 Остановка',
    toilet: '🚻 Туалет',
    library: '📚 Библиотека',
    medical: '🏥 Медпункт',
    parking: '🅿️ Парковка',
    sport: '⚽ Спорт',
    atm: '🏧 Банкомат'
  }
  return labels[cat] || '📍 Точка интереса'
}

// ═══ Курсор при наведении ═══

function setupHoverCursors(map) {
  const interactiveLayers = ['buildings-fill', 'poi-circles', 'complex-3d', 'complex-fill']

  interactiveLayers.forEach(layer => {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = ''
    })
  })

  // Подсветка здания при наведении
  map.on('mousemove', 'buildings-fill', (e) => {
    if (e.features.length > 0) {
      // Если нужно подсветить конкретное здание,
      // можно использовать feature-state:
      // map.setFeatureState(...)
    }
  })
}

// ═══ Переключение 2D / 3D ═══

function setupViewToggle(map) {
  const btn2d = document.getElementById('btn-2d')
  const btn3d = document.getElementById('btn-3d')

  function set2D() {
    map.setLayoutProperty('complex-fill', 'visibility', 'visible')
    map.setLayoutProperty('complex-outline-2d', 'visibility', 'visible')
    map.setLayoutProperty('complex-3d', 'visibility', 'none')
    map.setLayoutProperty('complex-outline', 'visibility', 'none')
    map.setLayoutProperty('complex-label', 'visibility', 'none')
    map.setLayoutProperty('buildings-fill', 'visibility', 'visible')
    map.setLayoutProperty('buildings-outline', 'visibility', 'visible')
    map.setLayoutProperty('buildings-label', 'visibility', 'visible')
    map.setLayoutProperty('buildings-3d', 'visibility', 'none')
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 })
  }

  function set3D() {
    map.setLayoutProperty('complex-fill', 'visibility', 'none')
    map.setLayoutProperty('complex-outline-2d', 'visibility', 'none')
    map.setLayoutProperty('complex-3d', 'visibility', 'visible')
    map.setLayoutProperty('complex-outline', 'visibility', 'none')
    map.setLayoutProperty('complex-label', 'visibility', 'visible')
    map.setLayoutProperty('buildings-fill', 'visibility', 'none')
    map.setLayoutProperty('buildings-outline', 'visibility', 'none')
    map.setLayoutProperty('buildings-label', 'visibility', 'visible')
    map.setLayoutProperty('buildings-3d', 'visibility', 'visible')
    map.easeTo({ pitch: 60, bearing: -20, duration: 500 })
  }

  btn2d.addEventListener('click', () => {
    btn2d.classList.add('active')
    btn3d.classList.remove('active')
    set2D()
  })

  btn3d.addEventListener('click', () => {
    btn3d.classList.add('active')
    btn2d.classList.remove('active')
    set3D()
  })
}

// ═══ Кнопка сброса вида ═══

function setupResetButton(map) {
  const btn = document.getElementById('btn-reset')
  if (!btn) return
  btn.addEventListener('click', () => {
    map.flyTo({
      center: CAMPUS.center,
      zoom: CAMPUS.zoom,
      pitch: 0,
      bearing: 0,
      duration: 1000
    })
    closeBuildingPanel()
  })
}

// ═══ Клик на пустое место ═══

function setupEmptyClick(map) {
    map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['buildings-fill', 'poi-circles', 'complex-3d', 'complex-fill']
    })

    if (features.length === 0) {
      closeBuildingPanel()
    }
  })
}

function closeBuildingPanel() {
  document.getElementById('building-info').classList.add('hidden')
  document.querySelector('.hint').classList.remove('hidden')
}