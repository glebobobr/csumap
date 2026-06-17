// Хранилище объектов в localStorage

const STORAGE_KEY = 'campus-editor-features'

export const FeatureStore = {

    // Загрузить все объекты
    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return { type: 'FeatureCollection', features: [] }
            return JSON.parse(raw)
        } catch {
            return { type: 'FeatureCollection', features: [] }
        }
    },

    // Сохранить все объекты
    save(geojson) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(geojson))
    },

    // Экспорт в файл
    exportFile(geojson, filename = 'campus-data.geojson') {
        const blob = new Blob(
            [JSON.stringify(geojson, null, 2)],
            { type: 'application/geo+json' }
        )
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }
}