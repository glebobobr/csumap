import 'maplibre-gl/dist/maplibre-gl.css'
import './editor.css'

import maplibregl from 'maplibre-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

import { CAMPUS } from '../map/config.js'
import { Toolbar } from './tools/toolbar.js'
import { PropertiesPanel } from './tools/properties.js'
import { ColorPalette } from './tools/palette.js'
import { TransformPanel } from './tools/transform-panel.js'
import { ShapeModal } from './tools/shape-modal.js'
import { FeatureStore } from './store/features.js'
import { union, difference, intersection, xor, areAllPolygons, explodeFeature } from './tools/boolean-ops.js'
import { initDrawingHints } from './tools/drawing-hints.js'
import { UndoRedoManager } from './store/undo-redo.js'
import { 
  login, 
  fetchLayerFeaturesForEdit, 
  replaceLayerFeatures, 
  setAuthToken, 
  getAuthToken,
  createFeature,
  updateFeature,
  deleteFeature,
  fetchAdminLayerFeatures,
  publishFeature,
  publishAllDrafts
} from '../api/client.js'

const API_BASE = '/api/v1'

// Custom draw modes
import DrawShapeMode from './modes/DrawShapeMode.js'
import DrawLineMode from './modes/DrawLineMode.js'
import DrawPolygonMode from './modes/DrawPolygonMode.js'
import SimpleSelectMode from './modes/SimpleSelectMode.js'
import DirectSelectMode from './modes/DirectSelectMode.js'
import PanMode from './modes/PanMode.js'

// ═══════════════════════════════════════
//  Карта — реальные координаты кампуса
// ═══════════════════════════════════════

const map = new maplibregl.Map({
    container: 'editor-map',
    style: {
        version: 8,
        sources: {
            satellite: {
                type: 'raster',
                tiles: [
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                tileSize: 256,
                maxzoom: 19
            },
            osm: {
                type: 'raster',
                tiles: [
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                maxzoom: 19,
                attribution: '© OpenStreetMap contributors'
            }
        },
        layers: [
            {
                id: 'satellite',
                type: 'raster',
                source: 'satellite',
                paint: { 'raster-opacity': 0.75 }
            },
            {
                id: 'osm',
                type: 'raster',
                source: 'osm',
                layout: { 'visibility': 'none' },
                paint: { 'raster-opacity': 1 }
            }
        ],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
    },
    center: CAMPUS.center,   // [61.318987, 55.177196]
    zoom: CAMPUS.zoom,
    maxZoom: CAMPUS.maxZoom
})

map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left')

// Инициализируем систему подсказок
initDrawingHints(map)

// ═══════════════════════════════════════
//  Draw
// ═══════════════════════════════════════

const Draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {},
    modes: {
        ...MapboxDraw.modes,
        simple_select: SimpleSelectMode,
        direct_select: DirectSelectMode,
        draw_shape: DrawShapeMode,
        draw_polygon: DrawPolygonMode,
        draw_line_string: DrawLineMode,
        hand: PanMode
    },
    styles: [
        {
            id: 'gl-draw-polygon-fill-inactive',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'],
                ['==', 'active', 'false'], ['!=', 'mode', 'static']],
            paint: {
                'fill-color': ['coalesce', ['get', 'user_color'], '#5B8DB8'],
                'fill-opacity': 0.35
            }
        },
        {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
            paint: {
                'fill-color': ['coalesce', ['get', 'user_color'], '#5B8DB8'],
                'fill-opacity': 0.5
            }
        },
        {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'],
                ['==', 'active', 'false'], ['!=', 'mode', 'static']],
            paint: {
                'line-color': ['coalesce', ['get', 'user_color'], '#5B8DB8'],
                'line-width': 2
            }
        },
        {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
            paint: {
                'line-color': ['coalesce', ['get', 'user_color'], '#5B8DB8'],
                'line-width': 2.5,
                'line-dasharray': [2, 1]
            }
        },
        {
            id: 'gl-draw-polygon-midpoint',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
            paint: {
                'circle-radius': 4,
                'circle-color': '#5B8DB8',
                'circle-opacity': 0.7
            }
        },
        {
            id: 'gl-draw-line-inactive',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'false']],
            paint: {
                'line-color': ['coalesce', ['get', 'user_color'], '#E0E0E0'],
                'line-width': 3
            }
        },
        {
            id: 'gl-draw-line-active',
            type: 'line',
            filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
            paint: {
                'line-color': ['coalesce', ['get', 'user_color'], '#E0E0E0'],
                'line-width': 3,
                'line-dasharray': [2, 1]
            }
        },
        {
            id: 'gl-draw-point-inactive',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'],
                ['==', 'active', 'false'],
                ['!in', 'meta', 'midpoint', 'vertex']],
            paint: {
                'circle-radius': 8,
                'circle-color': ['coalesce', ['get', 'user_color'], '#E67E22'],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        },
        {
            id: 'gl-draw-point-active',
            type: 'circle',
            filter: ['all', ['==', '$type', 'Point'],
                ['==', 'active', 'true'],
                ['!in', 'meta', 'midpoint', 'vertex']],
            paint: {
                'circle-radius': 10,
                'circle-color': ['coalesce', ['get', 'user_color'], '#E67E22'],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#fff'
            }
        },
        {
            id: 'gl-draw-vertex',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            paint: {
                'circle-radius': 5,
                'circle-color': '#fff',
                'circle-stroke-color': '#5B8DB8',
                'circle-stroke-width': 2
            }
        }
    ]
})

map.addControl(Draw)

const history = new UndoRedoManager(Draw)

document.getElementById('btn-undo').addEventListener('click', () => {
    if (history.undo()) {
        goToSelect()
        setStatus('Отмена')
    }
})

document.getElementById('btn-redo').addEventListener('click', () => {
    if (history.redo()) {
        goToSelect()
        setStatus('Возврат')
    }
})

// ═══════════════════════════════════════
//  API: работа с сервером
// ═══════════════════════════════════════

let isAuthenticated = false

async function authenticate() {
    if (isAuthenticated) return true
    
    // Проверяем, есть ли сохранённый токен
    const savedToken = getAuthToken()
    if (savedToken) {
        isAuthenticated = true
        return true
    }
    
    // Запрашиваем пароль
    const password = prompt('Введите пароль редактора:')
    if (!password) return false
    
    try {
        await login(password)
        isAuthenticated = true
        return true
    } catch (e) {
        alert('Неверный пароль')
        return false
    }
}

function featureToRequest(feature) {
    const props = feature.properties || {}
    const isNew = !props.serverId
    return {
        feature_id: isNew ? feature.id : props.serverId,
        name: props.name || '',
        properties: { ...props, status: 'draft' },
        geometry: feature.geometry,
        is_visible: props.is_visible !== false,
        min_zoom: props.min_zoom ?? 0,
        max_zoom: props.max_zoom ?? 22,
    }
}

function getLayerForFeature(feature) {
    const props = feature.properties || {}
    const type = props.type || ''
    const geomType = feature.geometry?.type

    if (geomType === 'Polygon') {
        if (props.complex_id) return 'complex'
        const buildingTypes = ['academic','dormitory','library','sports','admin','canteen','utility','passage']
        const zoneTypes = ['garden','lawn','parking','sports-ground','construction']
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

async function saveAll() {
    if (!await authenticate()) {
        setStatus('❌ Требуется авторизация')
        return
    }
    
    history.save()
    const all = Draw.getAll()
    
    console.log('saveAll: total features in Draw:', all.features.length)
    all.features.forEach((f, i) => console.log(`  Feature ${i}:`, f.id, f.geometry?.type, f.properties))

    let totalSaved = 0
    const errors = []

    for (const feature of all.features) {
        const layerId = getLayerForFeature(feature)
        const request = featureToRequest(feature)
        const props = feature.properties || {}
        const isNew = !props.serverId

        try {
            let result
            if (isNew) {
                result = await createFeature(layerId, request)
            } else {
                result = await updateFeature(props.serverId, request)
            }
            
            // Save server ID back to feature for future updates
            if (result?.id) {
                Draw.setFeatureProperty(feature.id, 'serverId', result.id)
            }
            totalSaved++
            setStatus(`✓ ${layerId}: ${isNew ? 'создан' : 'обновлён'} ${props.name || 'объект'}`)
        } catch (e) {
            console.error(`Failed to save feature ${feature.id}:`, e)
            errors.push(`${props.name || 'объект'}: ${e.message}`)
        }
    }

    // Тоже в localStorage как бэкап
    FeatureStore.save(all)
    
    if (errors.length > 0) {
        setStatus(`⚠ Сохранено ${totalSaved}, ошибок: ${errors.length}`)
    } else {
        setStatus(`💾 Сохранено как черновики: ${totalSaved} объектов`)
    }
}

// ═══════════════════════════════════════
//  Загрузка данных при старте
// ═══════════════════════════════════════

map.on('load', async () => {
    const layerMap = {
        buildings: 'buildings',
        complex:   'complex',
        roads:     'roads',
        poi:       'poi',
        zones:     'zones',
    }

    // Check auth - prompt if not logged in
    const hasToken = getAuthToken()
    if (!hasToken) {
        const password = prompt('Введите пароль редактора для загрузки данных:')
        if (password) {
            try {
                await login(password)
            } catch (e) {
                alert('Неверный пароль. Данные будут загружены только из localStorage.')
            }
        }
    }

    let totalFeatures = 0
    let loadErrors = 0
    
    for (const [key, layerId] of Object.entries(layerMap)) {
        try {
            // Load all features (both published and draft) from admin endpoint
            const fc = await fetchAdminLayerFeatures(layerId)
            if (fc.features?.length > 0) {
                // Mark status for styling and preserve server ID
                fc.features.forEach(f => {
                    const status = f.properties.status || 'draft'
                    const userColor = status === 'published' ? '#3388ff' : '#ff8800'
                    f.properties = { 
                        ...f.properties, 
                        _status: status,
                        serverId: f.id,
                        user_color: userColor  // Draw styles use this property
                    }
                })
                Draw.add(fc)
                totalFeatures += fc.features.length
            }
        } catch (e) {
            console.warn(`Failed to load ${layerId}:`, e)
            loadErrors++
        }
    }

    if (totalFeatures > 0) {
        setStatus(`Загружено: ${totalFeatures} объектов (published + draft)${loadErrors > 0 ? `, ошибок: ${loadErrors}` : ''}`)
    } else {
        // Fallback — из localStorage
        const saved = FeatureStore.load()
        if (saved.features.length > 0) {
            Draw.add(saved)
            setStatus(`Загружено ${saved.features.length} объектов (localStorage)`)
        } else {
            setStatus('Выберите инструмент и начните рисовать')
        }
    }

    history.save()
})

// ═══════════════════════════════════════
//  UI Компоненты
// ═══════════════════════════════════════

const palette = new ColorPalette((selectedHex) => {
    const selected = Draw.getSelected()
    if (selected.features.length > 0) {
        selected.features.forEach(f => {
            Draw.setFeatureProperty(f.id, 'user_color', selectedHex)
        })
        Draw.set(Draw.getAll())
    }
})

// Сохранить только в localStorage (для кнопки "Применить")
function saveLocal() {
    const all = Draw.getAll()
    FeatureStore.save(all)
    setStatus('💾 Сохранено локально')
}

const propsPanel = new PropertiesPanel(
    (feature, properties) => {
        Object.entries(properties).forEach(([k, v]) => {
            Draw.setFeatureProperty(feature.id, k, v)
        })
        Draw.setFeatureProperty(feature.id, 'user_color', properties.color)
        setStatus(`✓ ${properties.name || 'объект'} обновлён`)
        saveAll()
    },
    (feature) => {
        Draw.delete(feature.id)
        transformPanel.hide()
        setStatus('Объект удалён')
        saveAll()
    }
)

const transformPanel = new TransformPanel(() => Draw)

const shapeModal = new ShapeModal((geometry) => {
    // Вставляем фигуру в центре карты
    const feature = {
        type: 'Feature',
        properties: { user_color: palette.selectedColor },
        geometry
    }
    const ids = Draw.add(feature)

    // Выбираем и открываем свойства
    Draw.changeMode('simple_select', { featureIds: ids })
    const added = Draw.get(ids[0])
    if (added) propsPanel.open(added)

    setStatus('Фигура добавлена. Заполните свойства.')
    saveAll()
})

// ═══════════════════════════════════════
//  Тулбар и инструменты
// ═══════════════════════════════════════

function goToSelect() {
    Draw.changeMode('simple_select')
    map.getCanvas().style.cursor = ''
    toolbar.setTool('select')
    setStatus('Кликните на объект для выбора')
}

const toolbar = new Toolbar((tool) => {
    // Скрываем трансформации при смене инструмента (кроме select)
    if (!['select', 'edit'].includes(tool)) {
        transformPanel.hide()
    }

    switch (tool) {
        case 'select':
            Draw.changeMode('simple_select')
            map.getCanvas().style.cursor = ''
            setStatus('Кликните на объект для выбора')
            break

        case 'polygon':
            Draw.changeMode('draw_polygon')
            map.getCanvas().style.cursor = 'crosshair'
            setStatus('Кликайте для точек. Enter — завершить, Escape — отменить')
            break

        case 'circle':
            Draw.changeMode('draw_shape', { shapeType: 'circle' })
            setStatus('Тяните мышью для создания круга')
            break

        case 'rectangle':
            Draw.changeMode('draw_shape', { shapeType: 'rectangle' })
            setStatus('Тяните мышью. Ctrl — от центра, Shift — квадрат')
            break

        case 'square':
            Draw.changeMode('draw_shape', { shapeType: 'rectangle' })
            setStatus('Тяните мышью с Shift для квадрата')
            break

        case 'triangle':
            Draw.changeMode('draw_shape', { shapeType: 'triangle' })
            map.getCanvas().style.cursor = 'crosshair'
            setStatus('Тяните мышью для создания треугольника')
            break

        case 'ngon':
            Draw.changeMode('draw_shape', { shapeType: 'ngon', sides: 6 })
            map.getCanvas().style.cursor = 'crosshair'
            setStatus('Тяните мышью для создания многоугольника')
            break

        case 'line':
            Draw.changeMode('draw_line_string')
            map.getCanvas().style.cursor = 'crosshair'
            setStatus('Кликайте для точек. Enter — завершить, Escape — отменить')
            break

        case 'point':
            Draw.changeMode('draw_point')
            map.getCanvas().style.cursor = 'crosshair'
            setStatus('Кликните для установки точки')
            break

        case 'edit':
            const sel = Draw.getSelected()
            if (sel.features.length > 0) {
                Draw.changeMode('direct_select', { featureId: sel.features[0].id })
                map.getCanvas().style.cursor = ''
                setStatus('Перетаскивайте вершины. Серые точки — добавить вершину')
            } else {
                setStatus('Сначала выберите объект (V)')
                toolbar.setTool('select')
            }
            break

        case 'move':
            setStatus('Перетащите объект в нужное место')
            // Перемещение — это simple_select + drag
            Draw.changeMode('simple_select')
            map.getCanvas().style.cursor = 'grab'
            break

        case 'hand':
            Draw.changeMode('hand')
            map.getCanvas().style.cursor = 'grab'
            setStatus('Перетащите карту для перемещения')
            break

        case 'delete':
            const selected = Draw.getSelected()
            if (selected.features.length > 0) {
                const names = selected.features
                    .map(f => f.properties.name || 'объект')
                    .join(', ')
                if (confirm(`Удалить: ${names}?`)) {
                    Draw.trash()
                    propsPanel.close()
                    transformPanel.hide()
                    saveAll()
                    setStatus('Удалено')
                }
            } else {
                setStatus('Выберите объект для удаления')
            }
            toolbar.setTool('select')
            break

        // Группировка комплекса
        case 'group': {
            const sel = Draw.getSelected()
            if (sel.features.length < 2) {
                setStatus('Выберите минимум 2 здания для группировки в комплекс')
                toolbar.setTool('select')
                break
            }
            const complexId = crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)
            sel.features.forEach(f => {
                Draw.setFeatureProperty(f.id, 'complex_id', complexId)
            })
            Draw.set(Draw.getAll())
            setStatus(`Создан комплекс (${sel.features.length} зданий)`)
            saveAll()
            toolbar.setTool('select')
            break
        }

        case 'ungroup': {
            const sel = Draw.getSelected()
            if (sel.features.length === 0) {
                setStatus('Выберите объекты для удаления из комплекса')
                toolbar.setTool('select')
                break
            }
            sel.features.forEach(f => {
                Draw.setFeatureProperty(f.id, 'complex_id', undefined)
            })
            Draw.set(Draw.getAll())
            setStatus('Объекты удалены из комплекса')
            saveAll()
            toolbar.setTool('select')
            break
        }

        // Булевы операции
        case 'union':
        case 'difference':
        case 'intersection':
        case 'xor': {
            const selected = Draw.getSelected()
            if (selected.features.length < 2) {
                setStatus('Выберите минимум 2 объекта для булевой операции')
                toolbar.setTool('select')
                break
            }

            if (!areAllPolygons(selected.features)) {
                setStatus('Булевы операции работают только с полигонами')
                toolbar.setTool('select')
                break
            }

            try {
                let result
                const opNames = {
                    union: 'Объединение',
                    difference: 'Вычитание',
                    intersection: 'Пересечение',
                    xor: 'XOR'
                }

                if (tool === 'union') {
                    result = union(selected.features)
                } else if (tool === 'difference') {
                    result = difference(selected.features)
                } else if (tool === 'intersection') {
                    result = intersection(selected.features)
                } else if (tool === 'xor') {
                    result = xor(selected.features)
                }

                if (result) {
                    // Удаляем исходные объекты
                    selected.features.forEach(f => Draw.delete(f.id))

                    // Разделяем MultiPolygon на отдельные полигоны
                    const parts = explodeFeature(result)

                    // Добавляем результат(ы)
                    const ids = parts.map(p => Draw.add(p)).flat()

                    Draw.changeMode('simple_select', { featureIds: ids })

                    setStatus(`${opNames[tool]} выполнено`)
                    saveAll()
                } else {
                    setStatus('Результат операции пустой')
                }
            } catch (error) {
                setStatus(`Ошибка: ${error.message}`)
            }

            toolbar.setTool('select')
            break
        }
    }
})

// ═══════════════════════════════════════
//  События Draw
// ═══════════════════════════════════════

// Объект создан — возвращаемся в Select, открываем свойства
map.on('draw.create', (e) => {
    if (history.isRestoring()) return

    const feature = e.features[0]

    // Снимаем курсор и возвращаемся в select
    Draw.changeMode('simple_select', { featureIds: [feature.id] })
    map.getCanvas().style.cursor = ''
    toolbar.setTool('select')

    // Устанавливаем цвет из палитры
    Draw.setFeatureProperty(feature.id, 'color', palette.selectedColor)

    propsPanel.open(feature)
    setStatus('Объект создан. Заполните свойства.')
    saveAll()
})

// Выбор изменился
map.on('draw.selectionchange', (e) => {
    if (e.features.length > 0) {
        const feature = e.features[0]
        propsPanel.open(feature)
        transformPanel.show(feature.id)

        const color = feature.properties.user_color || feature.properties.color || '#5B8DB8'
        palette.setSelected(color)
    } else {
        propsPanel.close()
        transformPanel.hide()
    }
})

// Объект изменён
map.on('draw.update', () => {
    if (history.isRestoring()) return
    const sel = Draw.getSelected()
    if (sel.features.length > 0) {
        propsPanel.open(sel.features[0])
    }
    saveAll()
})

// Объект удалён
map.on('draw.delete', () => {
    if (history.isRestoring()) return
    propsPanel.close()
    transformPanel.hide()
    saveAll()
})

// Мод изменился (завершили рисование → Select)
map.on('draw.modechange', (e) => {
    if (e.mode === 'simple_select') {
        map.getCanvas().style.cursor = ''
    }
})

// ═══════════════════════════════════════
//  Кнопки шапки
// ═══════════════════════════════════════

// Переключение слоёв карты
let currentLayer = 'satellite'
document.getElementById('btn-layer-switch').addEventListener('click', () => {
    if (currentLayer === 'satellite') {
        // Переключаемся на OSM
        map.setLayoutProperty('satellite', 'visibility', 'none')
        map.setLayoutProperty('osm', 'visibility', 'visible')
        currentLayer = 'osm'
        document.getElementById('btn-layer-switch').textContent = '🗺️ OSM'
        setStatus('Слой: OpenStreetMap')
    } else {
        // Переключаемся на Satellite
        map.setLayoutProperty('satellite', 'visibility', 'visible')
        map.setLayoutProperty('osm', 'visibility', 'none')
        currentLayer = 'satellite'
        document.getElementById('btn-layer-switch').textContent = '🗺️ Satellite'
        setStatus('Слой: ESRI Satellite')
    }
})

document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = '/'
})

document.getElementById('btn-login').addEventListener('click', async () => {
    const password = prompt('Введите пароль редактора:')
    if (!password) return
    
    try {
        await login(password)
        isAuthenticated = true
        document.getElementById('btn-login').textContent = '🔓 Выйти'
        document.getElementById('btn-login').title = 'Выйти из редактора'
        setStatus('✓ Авторизован как редактор')
    } catch (e) {
        alert('Неверный пароль')
    }
})

document.getElementById('btn-save').addEventListener('click', () => {
    saveAll()
})

document.getElementById('btn-export').addEventListener('click', () => {
    const all = Draw.getAll()
    FeatureStore.exportFile(all)
    setStatus(`Экспортировано ${all.features.length} объектов`)
})

document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-input').click()
})

document.getElementById('import-input').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
        try {
            const geojson = JSON.parse(ev.target.result)
            if (geojson.type !== 'FeatureCollection') throw new Error()

            const replace = confirm(
                `Импортировать ${geojson.features.length} объектов?\n` +
                `OK — заменить, Отмена — добавить`
            )
            if (replace) Draw.deleteAll()
            Draw.add(geojson)
            saveAll()
            setStatus(`Импортировано: ${geojson.features.length} объектов`)
        } catch {
            alert('Ошибка: неверный формат файла')
        }
        e.target.value = ''
    }
    reader.readAsText(file)
})

document.getElementById('btn-publish').addEventListener('click', async () => {
    if (!await authenticate()) return
    
    if (!confirm('Опубликовать ВСЕ черновики? Это действие необратимо.')) return
    
    try {
        // First: migrate any localStorage features to database as draft
        const saved = FeatureStore.load()
        if (saved.features.length > 0) {
            setStatus('📦 Миграция localStorage в БД...')
            const layerMap = {
                buildings: 'buildings',
                complex:   'complex',
                roads:     'roads',
                poi:       'poi',
                zones:     'zones',
            }
            
            for (const [key, layerId] of Object.entries(layerMap)) {
                const layerFeatures = saved.features.filter(f => {
                    const props = f.properties || {}
                    const type = props.type || ''
                    const geomType = f.geometry?.type
                    
                    if (geomType === 'Polygon') {
                        if (props.complex_id) return layerId === 'complex'
                        const buildingTypes = ['academic','dormitory','library','sports','admin','canteen','utility','passage']
                        const zoneTypes = ['garden','lawn','parking','sports-ground','construction']
                        if (buildingTypes.includes(type)) return layerId === 'buildings'
                        if (zoneTypes.includes(type)) return layerId === 'zones'
                        return layerId === 'zones'
                    } else if (geomType === 'LineString') {
                        return layerId === 'roads'
                    } else if (geomType === 'Point') {
                        return layerId === 'poi'
                    }
                    return false
                })
                
                if (layerFeatures.length === 0) continue
                
                const features = layerFeatures.map(f => ({
                    name: f.properties?.name || '',
                    properties: f.properties || {},
                    geometry: f.geometry,
                    is_visible: f.properties?.is_visible !== false,
                    min_zoom: f.properties?.min_zoom ?? 0,
                    max_zoom: f.properties?.max_zoom ?? 22,
                }))
                
                try {
                    await replaceLayerFeatures(layerId, features)
                    setStatus(`✓ ${layerId}: мигрировано ${features.length} объектов`)
                } catch (e) {
                    console.error(`Failed to migrate ${layerId}:`, e)
                    setStatus(`⚠ Ошибка миграции ${layerId}: ${e.message}`)
                }
            }
        }
        
        setStatus('🚀 Публикация черновиков...')
        const result = await publishAllDrafts()
        setStatus(`✓ ${result.message}`)
        
        // Reload features to update colors
        setTimeout(() => {
            window.location.reload()
        }, 1000)
    } catch (e) {
        console.error('Failed to publish:', e)
        setStatus(`❌ Ошибка публикации: ${e.message}`)
    }
})

// ═══════════════════════════════════════
//  Клавиатура
// ═══════════════════════════════════════

let clipboard = null

function offsetCoords(coords, dx, dy) {
    if (typeof coords[0] === 'number' && !isNaN(coords[0])) {
        return [coords[0] + dx, coords[1] + dy]
    }
    return coords.map(c => offsetCoords(c, dx, dy))
}

function handleUndoRedo(e) {
    if (!(e.ctrlKey || e.metaKey)) return
    if (e.code === 'KeyZ') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (history.undo()) {
            goToSelect()
            setStatus('Отмена')
        }
        return
    }
    if (e.code === 'KeyY') {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (history.redo()) {
            goToSelect()
            setStatus('Возврат')
        }
        return
    }
    if (e.code === 'KeyS') {
        e.preventDefault()
        e.stopImmediatePropagation()
        saveAll()
        return
    }
    if (e.code === 'KeyC') {
        const sel = Draw.getSelected()
        if (sel.features.length === 0) return
        e.preventDefault()
        e.stopImmediatePropagation()
        clipboard = JSON.parse(JSON.stringify(sel.features))
        setStatus(`Скопировано: ${clipboard.length} объект(ов)`)
        return
    }
    if (e.code === 'KeyV') {
        if (!clipboard || clipboard.length === 0) return
        e.preventDefault()
        e.stopImmediatePropagation()
        const pasted = JSON.parse(JSON.stringify(clipboard))
        const offset = 0.0003
        pasted.forEach(f => {
            delete f.id
            f.properties = { ...f.properties }
            f.geometry.coordinates = offsetCoords(f.geometry.coordinates, offset, -offset)
        })
        Draw.add({ type: 'FeatureCollection', features: pasted })
        history.save()
        setStatus(`Вставлено: ${pasted.length} объект(ов)`)
    }
}

document.addEventListener('keydown', handleUndoRedo, { capture: true })

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

    // Escape — выйти из режима
    if (e.key === 'Escape') {
        const mode = Draw.getMode()
        // В draw-режимах Escape обрабатывается самим режимом (onKeyUp)
        if (!['draw_polygon', 'draw_line_string', 'draw_shape', 'direct_select'].includes(mode)) {
            e.preventDefault()
            goToSelect()
        }
        return
    }

    const shortcuts = {
        'v': 'select',
        'V': 'select',
        'p': 'polygon',
        'P': 'polygon',
        'l': 'line',
        'L': 'line',
        't': 'point',
        'T': 'point',
        'e': 'edit',
        'E': 'edit',
        'g': 'move',
        'G': 'move',
        'h': 'hand',
        'H': 'hand',
    }

    if (shortcuts[e.key]) {
        e.preventDefault()
        toolbar.setTool(shortcuts[e.key])
        return
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        const mode = Draw.getMode()
        // Backspace в режиме рисования — удалить последнюю точку
        if (mode === 'draw_polygon' || mode === 'draw_line_string') {
            // MapboxDraw обрабатывает это автоматически
            return
        }
        // В остальных случаях — удалить выбранный объект
        toolbar.setTool('delete')
        return
    }

    // S — спутник
    if (e.key === 's' || e.key === 'S') {
        const current = map.getPaintProperty('satellite', 'raster-opacity')
        const next = current > 0 ? 0 : 0.75
        map.setPaintProperty('satellite', 'raster-opacity', next)
        setStatus(next > 0 ? 'Спутник: вкл' : 'Спутник: выкл')
    }
})

// ═══════════════════════════════════════
//  Статус
// ═══════════════════════════════════════

function setStatus(text) {
    document.getElementById('status-text').textContent = text
}

window.editorMap = map
window.Draw = Draw