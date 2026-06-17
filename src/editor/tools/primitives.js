// Векторные примитивы с расширенными параметрами
// Все функции возвращают GeoJSON Polygon coordinates

const M_PER_DEG_LAT = 111320
const M_PER_DEG_LNG = 111320 * Math.cos(55.177 * Math.PI / 180)

function mToLng(meters) { return meters / M_PER_DEG_LNG }
function mToLat(meters) { return meters / M_PER_DEG_LAT }

function rotatePoint(point, center, angle) {
    const dx = point[0] - center[0]
    const dy = point[1] - center[1]
    const dxM = dx * M_PER_DEG_LNG
    const dyM = dy * M_PER_DEG_LAT
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    return [
        center[0] + (dxM * cos - dyM * sin) / M_PER_DEG_LNG,
        center[1] + (dxM * sin + dyM * cos) / M_PER_DEG_LAT
    ]
}

/**
 * Прямоугольник со скруглёнными углами
 * @param {[number, number]} center [lng, lat]
 * @param {number} widthM ширина в метрах
 * @param {number} heightM высота в метрах
 * @param {number} radiusM радиус скругления в метрах
 * @param {number} angleDeg поворот в градусах
 */
export function makeRoundedRectangle(center, widthM = 60, heightM = 30, radiusM = 5, angleDeg = 0) {
    const w = widthM / 2
    const h = heightM / 2
    const r = Math.min(radiusM, w, h)
    const angle = angleDeg * Math.PI / 180

    const coords = []
    const segments = 8

    // Правый верхний угол
    for (let i = 0; i <= segments; i++) {
        const a = (Math.PI / 2) * i / segments
        coords.push([
            center[0] + mToLng(w - r + r * Math.cos(a)),
            center[1] + mToLat(h - r + r * Math.sin(a))
        ])
    }

    // Левый верхний угол
    for (let i = 0; i <= segments; i++) {
        const a = Math.PI / 2 + (Math.PI / 2) * i / segments
        coords.push([
            center[0] + mToLng(-w + r + r * Math.cos(a)),
            center[1] + mToLat(h - r + r * Math.sin(a))
        ])
    }

    // Левый нижний угол
    for (let i = 0; i <= segments; i++) {
        const a = Math.PI + (Math.PI / 2) * i / segments
        coords.push([
            center[0] + mToLng(-w + r + r * Math.cos(a)),
            center[1] + mToLat(-h + r + r * Math.sin(a))
        ])
    }

    // Правый нижний угол
    for (let i = 0; i <= segments; i++) {
        const a = 3 * Math.PI / 2 + (Math.PI / 2) * i / segments
        coords.push([
            center[0] + mToLng(w - r + r * Math.cos(a)),
            center[1] + mToLat(-h + r + r * Math.sin(a))
        ])
    }

    coords.push(coords[0])

    if (angleDeg !== 0) {
        return {
            type: 'Polygon',
            coordinates: [coords.map(p => rotatePoint(p, center, angle))]
        }
    }

    return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Линия с толщиной (выдавливание радиуса)
 * @param {Array<[number, number]>} points массив точек [lng, lat]
 * @param {number} thicknessM толщина в метрах
 * @param {string} capStyle стиль концов: 'butt', 'round', 'square'
 */
export function makeThickLine(points, thicknessM = 3, capStyle = 'round') {
    if (points.length < 2) return null

    const halfThickness = thicknessM / 2
    const leftSide = []
    const rightSide = []

    for (let i = 0; i < points.length; i++) {
        const curr = points[i]
        const prev = i > 0 ? points[i - 1] : null
        const next = i < points.length - 1 ? points[i + 1] : null

        let perpAngle

        if (!prev) {
            const dx = next[0] - curr[0]
            const dy = next[1] - curr[1]
            perpAngle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG) + Math.PI / 2
        } else if (!next) {
            const dx = curr[0] - prev[0]
            const dy = curr[1] - prev[1]
            perpAngle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG) + Math.PI / 2
        } else {
            const dx1 = curr[0] - prev[0]
            const dy1 = curr[1] - prev[1]
            const a1 = Math.atan2(dy1 * M_PER_DEG_LAT, dx1 * M_PER_DEG_LNG)

            const dx2 = next[0] - curr[0]
            const dy2 = next[1] - curr[1]
            const a2 = Math.atan2(dy2 * M_PER_DEG_LAT, dx2 * M_PER_DEG_LNG)

            perpAngle = (a1 + a2) / 2 + Math.PI / 2
        }

        leftSide.push([
            curr[0] + mToLng(halfThickness * Math.cos(perpAngle)),
            curr[1] + mToLat(halfThickness * Math.sin(perpAngle))
        ])

        rightSide.push([
            curr[0] - mToLng(halfThickness * Math.cos(perpAngle)),
            curr[1] - mToLat(halfThickness * Math.sin(perpAngle))
        ])
    }

    const coords = [...leftSide]

    if (capStyle === 'round') {
        const endPoint = points[points.length - 1]
        const segments = 8
        for (let i = 0; i <= segments; i++) {
            const lastLeft = leftSide[leftSide.length - 1]
            const lastRight = rightSide[rightSide.length - 1]
            const dx = lastLeft[0] - endPoint[0]
            const dy = lastLeft[1] - endPoint[1]
            const startAngle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG)
            const angle = startAngle + Math.PI * i / segments
            coords.push([
                endPoint[0] + mToLng(halfThickness * Math.cos(angle)),
                endPoint[1] + mToLat(halfThickness * Math.sin(angle))
            ])
        }
    } else if (capStyle === 'square') {
        const lastLeft = leftSide[leftSide.length - 1]
        const lastRight = rightSide[rightSide.length - 1]
        const endPoint = points[points.length - 1]
        const dx = endPoint[0] - points[points.length - 2][0]
        const dy = endPoint[1] - points[points.length - 2][1]
        const angle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG)

        coords.push([
            lastLeft[0] + mToLng(halfThickness * Math.cos(angle)),
            lastLeft[1] + mToLat(halfThickness * Math.sin(angle))
        ])
        coords.push([
            lastRight[0] + mToLng(halfThickness * Math.cos(angle)),
            lastRight[1] + mToLat(halfThickness * Math.sin(angle))
        ])
    }

    coords.push(...rightSide.reverse())

    if (capStyle === 'round') {
        const startPoint = points[0]
        const segments = 8
        for (let i = 0; i <= segments; i++) {
            const firstRight = rightSide[rightSide.length - 1]
            const firstLeft = leftSide[0]
            const dx = firstRight[0] - startPoint[0]
            const dy = firstRight[1] - startPoint[1]
            const startAngle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG)
            const angle = startAngle + Math.PI * i / segments
            coords.push([
                startPoint[0] + mToLng(halfThickness * Math.cos(angle)),
                startPoint[1] + mToLat(halfThickness * Math.sin(angle))
            ])
        }
    } else if (capStyle === 'square') {
        const firstLeft = leftSide[0]
        const firstRight = rightSide[rightSide.length - 1]
        const startPoint = points[0]
        const dx = points[0][0] - points[1][0]
        const dy = points[0][1] - points[1][1]
        const angle = Math.atan2(dy * M_PER_DEG_LAT, dx * M_PER_DEG_LNG)

        coords.push([
            firstRight[0] + mToLng(halfThickness * Math.cos(angle)),
            firstRight[1] + mToLat(halfThickness * Math.sin(angle))
        ])
        coords.push([
            firstLeft[0] + mToLng(halfThickness * Math.cos(angle)),
            firstLeft[1] + mToLat(halfThickness * Math.sin(angle))
        ])
    }

    coords.push(coords[0])

    return { type: 'Polygon', coordinates: [coords] }
}

/**
 * Круг с выдавливанием (кольцо)
 * @param {[number, number]} center [lng, lat]
 * @param {number} outerRadiusM внешний радиус в метрах
 * @param {number} innerRadiusM внутренний радиус в метрах (0 = обычный круг)
 * @param {number} steps количество точек
 */
export function makeRing(center, outerRadiusM = 30, innerRadiusM = 0, steps = 48) {
    const outer = []
    for (let i = 0; i <= steps; i++) {
        const angle = (2 * Math.PI * i) / steps
        outer.push([
            center[0] + mToLng(outerRadiusM) * Math.cos(angle),
            center[1] + mToLat(outerRadiusM) * Math.sin(angle)
        ])
    }

    if (innerRadiusM === 0) {
        return { type: 'Polygon', coordinates: [outer] }
    }

    const inner = []
    for (let i = steps; i >= 0; i--) {
        const angle = (2 * Math.PI * i) / steps
        inner.push([
            center[0] + mToLng(innerRadiusM) * Math.cos(angle),
            center[1] + mToLat(innerRadiusM) * Math.sin(angle)
        ])
    }

    return { type: 'Polygon', coordinates: [outer, inner] }
}
