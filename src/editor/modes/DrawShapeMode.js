import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { makeCircle, makeRectangle, makeTriangle, makeNgon } from '../tools/shapes.js'
import { getDrawingHints } from '../tools/drawing-hints.js'

// Универсальный режим рисования фигур
const DrawShapeMode = {}

DrawShapeMode.onSetup = function(opts) {
    const shapeType = opts.shapeType || 'rectangle'

    const polygon = this.newFeature({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [[]]
        }
    })

    this.addFeature(polygon)

    this.clearSelectedFeatures()
    this.updateUIClasses({ mouse: 'add' })
    this.activateUIButton()
    this.setActionableState({ trash: true })

    // Отключаем перетаскивание карты
    this.map.dragPan.disable()

    return {
        shapeType,
        polygon,
        startPoint: null,
        sides: opts.sides || 6
    }
}

DrawShapeMode.onMouseDown = function(state, e) {
    if (state.startPoint) return

    state.startPoint = [e.lngLat.lng, e.lngLat.lat]
}

DrawShapeMode.onDrag = function(state, e) {
    if (!state.startPoint) return

    const current = [e.lngLat.lng, e.lngLat.lat]
    const ctrlKey = e.originalEvent.ctrlKey || e.originalEvent.metaKey
    const shiftKey = e.originalEvent.shiftKey

    let geometry

    if (state.shapeType === 'circle') {
        const dx = (current[0] - state.startPoint[0]) * 63900
        const dy = (current[1] - state.startPoint[1]) * 111320
        const radius = Math.sqrt(dx * dx + dy * dy)

        geometry = makeCircle(state.startPoint, Math.max(1, radius), 48)

        const hints = getDrawingHints()
        if (hints) {
            hints.show(e.originalEvent.clientX, e.originalEvent.clientY,
                `Радиус: ${radius.toFixed(1)}м`)
        }

    } else if (state.shapeType === 'triangle') {
        const dx = (current[0] - state.startPoint[0]) * 63900
        const dy = (current[1] - state.startPoint[1]) * 111320
        const radius = Math.sqrt(dx * dx + dy * dy)

        geometry = makeTriangle(state.startPoint, Math.max(2, radius * Math.sqrt(3)))

        const hints = getDrawingHints()
        if (hints) {
            hints.show(e.originalEvent.clientX, e.originalEvent.clientY,
                `Сторона: ${(radius * Math.sqrt(3)).toFixed(1)}м`)
        }

    } else if (state.shapeType === 'ngon') {
        const dx = (current[0] - state.startPoint[0]) * 63900
        const dy = (current[1] - state.startPoint[1]) * 111320
        const radius = Math.sqrt(dx * dx + dy * dy)

        const sides = state.sides || 6
        geometry = makeNgon(state.startPoint, Math.max(1, radius), sides)

        const hints = getDrawingHints()
        if (hints) {
            hints.show(e.originalEvent.clientX, e.originalEvent.clientY,
                `Радиус: ${radius.toFixed(1)}м, сторон: ${sides}`)
        }

    } else {
        let dx = (current[0] - state.startPoint[0]) * 63900
        let dy = (current[1] - state.startPoint[1]) * 111320

        if (ctrlKey) {
            dx *= 2
            dy *= 2
        }

        let width = Math.abs(dx)
        let height = Math.abs(dy)

        if (shiftKey) {
            const size = Math.max(width, height)
            width = size
            height = size
        }

        const center = ctrlKey
            ? state.startPoint
            : [
                state.startPoint[0] + (current[0] - state.startPoint[0]) / 2,
                state.startPoint[1] + (current[1] - state.startPoint[1]) / 2
            ]

        geometry = makeRectangle(center, Math.max(1, width), Math.max(1, height), 0)

        const hints = getDrawingHints()
        if (hints) {
            const mods = []
            if (ctrlKey) mods.push('Ctrl: от центра')
            if (shiftKey) mods.push('Shift: квадрат')
            hints.show(e.originalEvent.clientX, e.originalEvent.clientY,
                `${width.toFixed(1)}м × ${height.toFixed(1)}м${mods.length ? ' | ' + mods.join(', ') : ''}`)
        }
    }

    // Обновляем координаты полигона
    state.polygon.incomingCoords(geometry.coordinates)
}

DrawShapeMode.onMouseUp = function(state, e) {
    const hints = getDrawingHints()
    if (hints) hints.hide()

    if (!state.startPoint) {
        return this.changeMode('simple_select')
    }

    // Проверяем что фигура имеет размер
    const coords = state.polygon.coordinates[0]
    if (!coords || coords.length < 4) {
        this.deleteFeature([state.polygon.id], { silent: true })
        this.map.dragPan.enable()
        return this.changeMode('simple_select')
    }

    this.map.fire('draw.create', {
        features: [state.polygon.toGeoJSON()]
    })

    this.map.dragPan.enable()
    this.changeMode('simple_select', { featureIds: [state.polygon.id] })
}

DrawShapeMode.onStop = function(state) {
    const hints = getDrawingHints()
    if (hints) hints.hide()

    this.updateUIClasses({ mouse: 'none' })
    this.activateUIButton()

    this.map.dragPan.enable()

    // Удаляем незавершённую фигуру
    if (state.polygon && (!state.startPoint || state.polygon.coordinates[0].length < 4)) {
        this.deleteFeature([state.polygon.id], { silent: true })
    }
}

DrawShapeMode.toDisplayFeatures = function(state, geojson, display) {
    const isActivePolygon = geojson.properties.id === state.polygon.id
    geojson.properties.active = isActivePolygon ? 'true' : 'false'
    if (!isActivePolygon) return display(geojson)

    // Показываем только если есть координаты
    if (geojson.geometry.coordinates[0].length > 0) {
        display(geojson)
    }
}

DrawShapeMode.onTrash = function(state) {
    this.deleteFeature([state.polygon.id], { silent: true })
    this.changeMode('simple_select')
}

DrawShapeMode.onKeyUp = function(state, e) {
    if (e.keyCode === 27) {
        this.deleteFeature([state.polygon.id], { silent: true })
        this.changeMode('simple_select')
    }
}

export default DrawShapeMode
