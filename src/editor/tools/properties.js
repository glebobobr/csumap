export class PropertiesPanel {
    constructor(onApply, onDelete) {
        this.onApply = onApply
        this.onDelete = onDelete
        this.currentFeature = null

        this.panel = document.getElementById('properties-panel')
        this.setupEvents()
    }

    // Открыть панель для фичи
    open(feature) {
        this.currentFeature = feature
        this.panel.classList.remove('panel-hidden')

        const props = feature.properties || {}
        const geomType = feature.geometry.type

        // Тип геометрии
        const typeLabels = {
            Polygon: 'Полигон',
            LineString: 'Линия',
            Point: 'Точка'
        }
        document.getElementById('geometry-type').textContent =
            typeLabels[geomType] || geomType

        // Заполняем поля
        document.getElementById('prop-name').value = props.name || ''
        document.getElementById('prop-type').value = props.type || ''
        document.getElementById('prop-description').value = props.description || ''

        // Этажность — только для полигонов
        const levelsSection = document.getElementById('section-levels')
        const complexSection = document.getElementById('section-complex')
        if (geomType === 'Polygon') {
            levelsSection.style.display = 'block'
            document.getElementById('prop-levels').value = props.levels || 1
            document.getElementById('prop-floor-height').value = props.floor_height || 3.5
            document.getElementById('prop-basement').value = props.basement || 0
            document.getElementById('prop-base-height').value = props.base_height || 0
            this.updateComputedHeight()

            complexSection.style.display = 'block'
            document.getElementById('prop-complex-id').value = props.complex_id || ''
        } else {
            levelsSection.style.display = 'none'
            complexSection.style.display = 'none'
        }

        // Цвет
        const color = props.color || this.defaultColorForType(props.type)
        document.getElementById('selected-color-preview').style.background = color
        document.getElementById('selected-color-hex').textContent = color

        // Заголовок
        document.getElementById('panel-title').textContent =
            props.name || 'Новый объект'
    }

    close() {
        this.panel.classList.add('panel-hidden')
        this.currentFeature = null
    }

    updateComputedHeight() {
        const levels = parseFloat(document.getElementById('prop-levels').value) || 1
        const floorH = parseFloat(document.getElementById('prop-floor-height').value) || 3.5
        const total = (levels * floorH).toFixed(1)
        document.getElementById('computed-height').textContent = `${total} м`
    }

    defaultColorForType(type) {
        const defaults = {
            academic: '#5B8DB8',
            dormitory: '#E8A87C',
            library: '#85CDCA',
            sports: '#7ECB7E',
            admin: '#9B97B2',
            canteen: '#F0C987',
            utility: '#AAAAAA',
            passage: '#7BA8D0',
            garden: '#66BB6A',
            lawn: '#8BC34A',
            parking: '#90A4AE',
            sidewalk: '#E0E0E0',
            road: '#9E9E9E',
        }
        return defaults[type] || '#CCCCCC'
    }

    collectProps() {
        const levels = parseInt(document.getElementById('prop-levels').value) || 1
        const floorH = parseFloat(document.getElementById('prop-floor-height').value) || 3.5
        const basement = parseInt(document.getElementById('prop-basement').value) || 0
        const baseHeight = parseFloat(document.getElementById('prop-base-height').value) || 0
        const color = document.getElementById('selected-color-hex').textContent

        const complexId = document.getElementById('prop-complex-id').value.trim()

        const result = {
            name: document.getElementById('prop-name').value.trim(),
            type: document.getElementById('prop-type').value,
            description: document.getElementById('prop-description').value.trim(),
            color,
            levels,
            floor_height: floorH,
            basement,
            base_height: baseHeight,
            height: parseFloat((levels * floorH).toFixed(1)),
            min_level: basement > 0 ? -basement : 1,
            max_level: levels,
        }

        if (complexId) {
            result.complex_id = complexId
        } else {
            result.complex_id = undefined
        }

        return result
    }

    setupEvents() {
        // Пересчёт высоты при изменении этажей
        ['prop-levels', 'prop-floor-height'].forEach(id => {
            document.getElementById(id)
                .addEventListener('input', () => this.updateComputedHeight())
        })

        // Кнопки +/- для числовых полей
        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target
                const delta = parseFloat(btn.dataset.delta)
                const input = document.getElementById(targetId)
                const min = parseFloat(input.min) || 0
                const max = parseFloat(input.max) || 999
                const step = parseFloat(input.step) || 1
                const newVal = Math.min(max, Math.max(min,
                    parseFloat(input.value || 0) + delta
                ))
                input.value = Number.isInteger(step) ? newVal : newVal.toFixed(1)
                input.dispatchEvent(new Event('input'))
            })
        })

        // Создать новый комплекс
        document.getElementById('btn-new-complex').addEventListener('click', () => {
            const id = crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)
            document.getElementById('prop-complex-id').value = id
        })

        // Авто-цвет при смене типа
        document.getElementById('prop-type').addEventListener('change', (e) => {
            const color = this.defaultColorForType(e.target.value)
            document.getElementById('selected-color-preview').style.background = color
            document.getElementById('selected-color-hex').textContent = color
        })

        // Применить
        document.getElementById('btn-apply').addEventListener('click', () => {
            if (!this.currentFeature) return
            this.onApply(this.currentFeature, this.collectProps())
        })

        // Удалить
        document.getElementById('btn-delete-feature').addEventListener('click', () => {
            if (!this.currentFeature) return
            this.onDelete(this.currentFeature)
            this.close()
        })

        // Закрыть
        document.getElementById('panel-close').addEventListener('click', () => {
            this.close()
        })
    }
}