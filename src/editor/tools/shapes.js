// Генераторы геометрических фигур
// Все функции возвращают GeoJSON Polygon coordinates

import { makeRoundedRectangle, makeThickLine, makeRing } from './primitives.js'

// ═══ Вспомогательные ═══

// Метры → приблизительные градусы (для широты ~55°)
const M_PER_DEG_LAT = 111320
const M_PER_DEG_LNG = 111320 * Math.cos(55.177 * Math.PI / 180) // ~63900

function mToLng(meters) { return meters / M_PER_DEG_LNG }
function mToLat(meters) { return meters / M_PER_DEG_LAT }

// Экспортируем примитивы
export { makeRoundedRectangle, makeThickLine, makeRing }

// Повернуть точку [lng, lat] вокруг центра на angle радиан
function rotatePoint(point, center, angle) {
    const dx = point[0] - center[0]
    const dy = point[1] - center[1]

    // Учитываем разницу масштаба lng/lat
    const dxM = dx * M_PER_DEG_LNG
    const dyM = dy * M_PER_DEG_LAT

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    return [
        center[0] + (dxM * cos - dyM * sin) / M_PER_DEG_LNG,
        center[1] + (dxM * sin + dyM * cos) / M_PER_DEG_LAT
    ]
}

// ═══ Фигуры ═══

/**
 * Круг
 * @param {[number, number]} center  [lng, lat]
 * @param {number} radiusM   радиус в метрах
 * @param {number} steps     количество точек
 */
export function makeCircle(center, radiusM = 30, steps = 48) {
    const coords = []
    for (let i = 0; i <= steps; i++) {
        const angle = (2 * Math.PI * i) / steps
        coords.push([
            center[0] + mToLng(radiusM) * Math.cos(angle),
            center[1] + mToLat(radiusM) * Math.sin(angle)
        ])
    }
    return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Квадрат
 * @param {[number, number]} center  [lng, lat]
 * @param {number} sideM    сторона в метрах
 * @param {number} angleDeg поворот в градусах
 */
export function makeSquare(center, sideM = 40, angleDeg = 0) {
    return makeRectangle(center, sideM, sideM, angleDeg)
}

/**
 * Прямоугольник
 */
export function makeRectangle(center, widthM = 60, heightM = 30, angleDeg = 0) {
    const angle = angleDeg * Math.PI / 180
    const w = widthM / 2
    const h = heightM / 2

    const corners = [
        [center[0] - mToLng(w), center[1] - mToLat(h)],
        [center[0] + mToLng(w), center[1] - mToLat(h)],
        [center[0] + mToLng(w), center[1] + mToLat(h)],
        [center[0] - mToLng(w), center[1] + mToLat(h)],
        [center[0] - mToLng(w), center[1] - mToLat(h)]  // замыкаем
    ]

    if (angleDeg !== 0) {
        return {
            type: 'Polygon',
            coordinates: [corners.map(p => rotatePoint(p, center, angle))]
        }
    }

    return { type: 'Polygon', coordinates: [corners] }
}

/**
 * Треугольник (равносторонний)
 */
export function makeTriangle(center, sideM = 40, angleDeg = 0) {
    const r = (sideM / Math.sqrt(3))
    const angle = angleDeg * Math.PI / 180
    const coords = []

    for (let i = 0; i <= 3; i++) {
        const a = (2 * Math.PI * i) / 3 - Math.PI / 2 + angle
        coords.push([
            center[0] + mToLng(r) * Math.cos(a),
            center[1] + mToLat(r) * Math.sin(a)
        ])
    }

    return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Правильный многоугольник (n-угольник)
 */
export function makeNgon(center, radiusM = 30, sides = 6, angleDeg = 0) {
    const angle = angleDeg * Math.PI / 180
    const coords = []

    for (let i = 0; i <= sides; i++) {
        const a = (2 * Math.PI * i) / sides + angle
        coords.push([
            center[0] + mToLng(radiusM) * Math.cos(a),
            center[1] + mToLat(radiusM) * Math.sin(a)
        ])
    }

    return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Получить центр GeoJSON-фичи
 */
export function getFeatureCenter(feature) {
    const coords = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.type === 'LineString'
            ? feature.geometry.coordinates
            : [feature.geometry.coordinates]

    const lngs = coords.map(c => c[0])
    const lats = coords.map(c => c[1])

    return [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2
    ]
}

/**
 * Повернуть фичу вокруг её центра
 * @param {object} feature  GeoJSON Feature
 * @param {number} angleDeg угол в градусах
 */
export function rotateFeature(feature, angleDeg) {
    const angle = angleDeg * Math.PI / 180
    const center = getFeatureCenter(feature)

    function rotateCoords(coords) {
        if (Array.isArray(coords[0])) {
            return coords.map(rotateCoords)
        }
        return rotatePoint(coords, center, angle)
    }

    return {
        ...feature,
        geometry: {
            ...feature.geometry,
            coordinates: rotateCoords(feature.geometry.coordinates)
        }
    }
}

/**
 * Масштабировать фичу (равномерно или по осям)
 * @param {object} feature
 * @param {number} sx  масштаб по X (longitude)
 * @param {number} sy  масштаб по Y (latitude), если null = sx
 */
export function scaleFeature(feature, sx, sy = null) {
    if (sy === null) sy = sx
    const center = getFeatureCenter(feature)

    function scaleCoords(coords) {
        if (Array.isArray(coords[0])) {
            return coords.map(scaleCoords)
        }
        return [
            center[0] + (coords[0] - center[0]) * sx,
            center[1] + (coords[1] - center[1]) * sy
        ]
    }

    return {
        ...feature,
        geometry: {
            ...feature.geometry,
            coordinates: scaleCoords(feature.geometry.coordinates)
        }
    }
}