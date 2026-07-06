import { getAuthToken, createFeature, updateFeature, deleteFeature, publishAllDrafts } from '../api/client.js'

export class SaveService {
    constructor(draw, setStatus) {
        this._draw = draw
        this._setStatus = setStatus
        this._saving = false
    }

    async saveAll() {
        if (this._saving) return
        this._saving = true
        try {
            const token = getAuthToken()
            if (!token) { this._setStatus('❌ Требуется авторизация'); return }

            const all = this._draw.getAll()
            if (!all.features.length) { this._setStatus('Нет объектов для сохранения'); return }

            console.log(`[SaveService] Starting save of ${all.features.length} features`)
            all.features.forEach((f, i) => {
                console.log(`[SaveService]   [${i}] id=${f.id} layer=${getLayer(f)} serverId=${f.properties?.serverId} name=${f.properties?.name}`)
            })

            this._setStatus(`⏳ Сохраняю ${all.features.length} объектов...`)
            let saved = 0
            const errors = []

            for (const feature of all.features) {
                const layerId = getLayer(feature)
                const props = feature.properties || {}
                const isNew = !props.serverId
                const serverId = isNew ? '(new)' : String(props.serverId)

                // skip features that were removed from Draw during save
                const stillInDraw = this._draw.get(feature.id)
                if (!stillInDraw) {
                    console.log(`[SaveService]   skipping feature ${feature.id} — no longer in Draw`)
                    continue
                }

                const url = isNew
                    ? `POST /api/v1/admin/layers/${layerId}/features`
                    : `PUT /api/v1/admin/features/${Number(props.serverId)}`
                const body = {
                    feature_id: String(isNew ? feature.id : props.serverId),
                    name: props.name || '',
                    properties: { ...props, status: 'draft' },
                    geometry: feature.geometry,
                    is_visible: props.is_visible !== false,
                    min_zoom: props.min_zoom ?? 0,
                    max_zoom: props.max_zoom ?? 22,
                }
                console.log(`[SaveService] → feature.id=${feature.id} isNew=${isNew} serverId=${serverId} url=${url}`)
                try {
                    const result = isNew
                        ? await createFeature(layerId, body)
                        : await updateFeature(Number(props.serverId), body)
                    if (result?.id) {
                        console.log(`[SaveService] ✓ saved, got id=${result.id}`)
                        try {
                            this._draw.setFeatureProperty(feature.id, 'serverId', result.id)
                        } catch (ignored) {
                            // feature was removed from Draw during async save
                        }
                    } else {
                        console.warn(`[SaveService] ✓ saved but result.id is missing (null/undefined)`, result)
                    }
                    saved++
                } catch (e) {
                    console.error(`[SaveService] ✗ error [${feature.id}]:`, e)
                    errors.push(`${props.name || '#' + feature.id}`)
                    if (!isNew) {
                        console.log(`[SaveService]   clearing serverId for feature ${feature.id} because update failed`)
                        try {
                            this._draw.setFeatureProperty(feature.id, 'serverId', null)
                        } catch (ignored) {
                            // feature already removed from Draw (e.g. deleted during save)
                        }
                    }
                    if (e instanceof TypeError) {
                        console.error(`[SaveService]   TypeError details:`, { serverId: props.serverId, isNew, url, body })
                    }
                }
            }
            console.log(`[SaveService] Done: ${saved}/${all.features.length} saved, ${errors.length} errors`)
            if (errors.length) {
                this._setStatus(`⚠ Сохранено ${saved}/${all.features.length}, ошибок: ${errors.length}`)
            } else {
                this._setStatus(`💾 Сохранено: ${saved} объектов`)
            }
            return errors.length === 0
        } finally {
            this._saving = false
        }
    }

    async saveOne(feature) {
        const token = getAuthToken()
        if (!token) return null
        const layerId = getLayer(feature)
        const props = feature.properties || {}
        const isNew = !props.serverId
        const body = {
            feature_id: String(isNew ? feature.id : props.serverId),
            name: props.name || '',
            properties: { ...props, status: 'draft' },
            geometry: feature.geometry,
            is_visible: props.is_visible !== false,
            min_zoom: props.min_zoom ?? 0,
            max_zoom: props.max_zoom ?? 22,
        }
        try {
            const result = isNew
                ? await createFeature(layerId, body)
                : await updateFeature(Number(props.serverId), body)
            if (result?.id) this._draw.setFeatureProperty(feature.id, 'serverId', result.id)
            return result?.id || null
        } catch (e) {
            console.error(`SaveOne error [${feature.id}]:`, e)
            return null
        }
    }

    async deleteOne(featureId) {
        try {
            await deleteFeature(featureId)
            return true
        } catch (e) {
            console.error(`Delete error [${featureId}]:`, e)
            return false
        }
    }

    async publishAll() {
        const token = getAuthToken()
        if (!token) { this._setStatus('❌ Требуется авторизация'); return false }
        this._setStatus('🚀 Публикую черновики...')
        try {
            const result = await publishAllDrafts()
            this._setStatus(`✅ ${result.message || 'Опубликовано'}`)
            return true
        } catch (e) {
            this._setStatus(`❌ ${e.message}`)
            return false
        }
    }
}

function getLayer(feature) {
    const props = feature.properties || {}
    const t = props.type || ''
    const g = feature.geometry?.type
    if (props._layer) return props._layer
    if (g === 'Polygon') {
        if (props.complex_id) return 'complex'
        if (['academic', 'dormitory', 'library', 'sports', 'admin', 'canteen', 'utility', 'passage'].includes(t)) return 'buildings'
        return 'zones'
    }
    if (g === 'LineString') return 'roads'
    if (g === 'Point') return 'poi'
    return 'zones'
}
