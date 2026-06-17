// Булевы операции над полигонами
import polygonClipping from 'polygon-clipping'

/**
 * Конвертация GeoJSON координат в формат polygon-clipping
 * @param {object} feature GeoJSON Feature с Polygon или MultiPolygon
 * @returns {Array} массив полигонов для polygon-clipping
 */
function featureToPolygonClipping(feature) {
    const geom = feature.geometry

    if (geom.type === 'Polygon') {
        return [geom.coordinates]
    } else if (geom.type === 'MultiPolygon') {
        return geom.coordinates
    }

    throw new Error('Поддерживаются только Polygon и MultiPolygon')
}

/**
 * Конвертация результата polygon-clipping обратно в GeoJSON
 * @param {Array} result результат от polygon-clipping
 * @returns {object} GeoJSON geometry (Polygon или MultiPolygon)
 */
function polygonClippingToGeometry(result) {
    if (result.length === 0) {
        return null
    }

    if (result.length === 1) {
        return {
            type: 'Polygon',
            coordinates: result[0]
        }
    }

    return {
        type: 'MultiPolygon',
        coordinates: result
    }
}

/**
 * Объединение (Union) - объединяет все выбранные полигоны в один
 * @param {Array<object>} features массив GeoJSON Features
 * @returns {object|null} новая GeoJSON Feature или null
 */
export function union(features) {
    if (features.length < 2) {
        throw new Error('Для объединения нужно минимум 2 объекта')
    }

    try {
        const polygons = features.map(f => featureToPolygonClipping(f))
        const result = polygonClipping.union(...polygons)
        const geometry = polygonClippingToGeometry(result)

        if (!geometry) return null

        // Берём свойства первого объекта
        return {
            type: 'Feature',
            properties: { ...features[0].properties },
            geometry
        }
    } catch (error) {
        console.error('Ошибка объединения:', error)
        throw new Error('Не удалось объединить объекты')
    }
}

/**
 * Вычитание (Difference) - вычитает все последующие из первого
 * @param {Array<object>} features массив GeoJSON Features
 * @returns {object|null} новая GeoJSON Feature или null
 */
export function difference(features) {
    if (features.length < 2) {
        throw new Error('Для вычитания нужно минимум 2 объекта')
    }

    try {
        let result = featureToPolygonClipping(features[0])

        for (let i = 1; i < features.length; i++) {
            const subtractor = featureToPolygonClipping(features[i])
            result = polygonClipping.difference(result, ...subtractor)

            if (result.length === 0) {
                return null
            }
        }

        const geometry = polygonClippingToGeometry(result)
        if (!geometry) return null

        return {
            type: 'Feature',
            properties: { ...features[0].properties },
            geometry
        }
    } catch (error) {
        console.error('Ошибка вычитания:', error)
        throw new Error('Не удалось вычесть объекты')
    }
}

/**
 * Пересечение (Intersection) - оставляет только общую область
 * @param {Array<object>} features массив GeoJSON Features
 * @returns {object|null} новая GeoJSON Feature или null
 */
export function intersection(features) {
    if (features.length < 2) {
        throw new Error('Для пересечения нужно минимум 2 объекта')
    }

    try {
        const polygons = features.map(f => featureToPolygonClipping(f))
        const result = polygonClipping.intersection(...polygons)
        const geometry = polygonClippingToGeometry(result)

        if (!geometry) return null

        return {
            type: 'Feature',
            properties: { ...features[0].properties },
            geometry
        }
    } catch (error) {
        console.error('Ошибка пересечения:', error)
        throw new Error('Не удалось найти пересечение')
    }
}

/**
 * Исключающее ИЛИ (XOR) - области, где объекты НЕ пересекаются
 * @param {Array<object>} features массив GeoJSON Features
 * @returns {object|null} новая GeoJSON Feature или null
 */
export function xor(features) {
    if (features.length < 2) {
        throw new Error('Для XOR нужно минимум 2 объекта')
    }

    try {
        const polygons = features.map(f => featureToPolygonClipping(f))
        const result = polygonClipping.xor(...polygons)
        const geometry = polygonClippingToGeometry(result)

        if (!geometry) return null

        return {
            type: 'Feature',
            properties: { ...features[0].properties },
            geometry
        }
    } catch (error) {
        console.error('Ошибка XOR:', error)
        throw new Error('Не удалось выполнить XOR')
    }
}

/**
 * Проверка, являются ли все фичи полигонами
 * @param {Array<object>} features массив GeoJSON Features
 * @returns {boolean}
 */
export function areAllPolygons(features) {
    return features.every(f =>
        f.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
    )
}

/**
 * Разделение MultiPolygon на массив отдельных Polygon-фич
 * @param {object} feature GeoJSON Feature (Polygon или MultiPolygon)
 * @returns {Array<object>} массив GeoJSON Feature (только Polygon)
 */
export function explodeFeature(feature) {
    const geom = feature.geometry
    if (geom.type === 'Polygon') return [feature]

    return geom.coordinates.map((coords, i) => ({
        type: 'Feature',
        properties: { ...feature.properties, name: (feature.properties.name || 'объект') + '_' + (i + 1) },
        geometry: { type: 'Polygon', coordinates: coords }
    }))
}
