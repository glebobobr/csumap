const PALETTE_STORAGE_KEY = 'campus-custom-colors'

// Встроенные цвета по категориям
const BUILTIN_COLORS = {
    arch: [
        { hex: '#5B8DB8', name: 'Учебный корпус' },
        { hex: '#4A7AA5', name: 'Корпус (тёмный)' },
        { hex: '#7BACD4', name: 'Корпус (светлый)' },
        { hex: '#E8A87C', name: 'Общежитие' },
        { hex: '#D4956A', name: 'Общежитие (тёмное)' },
        { hex: '#85CDCA', name: 'Библиотека' },
        { hex: '#7ECB7E', name: 'Спорткомплекс' },
        { hex: '#9B97B2', name: 'Администрация' },
        { hex: '#F0C987', name: 'Столовая' },
        { hex: '#AAAAAA', name: 'Хозяйственное' },
        { hex: '#CE93D8', name: 'Культурный объект' },
        { hex: '#F48FB1', name: 'Медицина' },
    ],
    zones: [
        { hex: '#66BB6A', name: 'Сад / Ботсад' },
        { hex: '#4CAF50', name: 'Парк' },
        { hex: '#8BC34A', name: 'Газон' },
        { hex: '#2E7D32', name: 'Лесная зона' },
        { hex: '#A5D6A7', name: 'Зелёная зона (светлая)' },
        { hex: '#90A4AE', name: 'Парковка' },
        { hex: '#78909C', name: 'Тротуар (зона)' },
        { hex: '#FFCC80', name: 'Строительная зона' },
        { hex: '#EF9A9A', name: 'Закрытая зона' },
        { hex: '#B3E5FC', name: 'Водоём' },
    ],
    paths: [
        { hex: '#E0E0E0', name: 'Тротуар' },
        { hex: '#BDBDBD', name: 'Дорожка' },
        { hex: '#9E9E9E', name: 'Дорога' },
        { hex: '#FFF176', name: 'Велодорожка' },
        { hex: '#80DEEA', name: 'Переход' },
    ]
}

export class ColorPalette {
    constructor(onSelect) {
        this.onSelect = onSelect  // callback(hexColor)
        this.selectedColor = '#5B8DB8'
        this.customColors = this.loadCustom()

        this.el = document.getElementById('color-palette')
        this.render()
        this.setupEvents()
    }

    loadCustom() {
        try {
            return JSON.parse(localStorage.getItem(PALETTE_STORAGE_KEY)) || []
        } catch {
            return []
        }
    }

    saveCustom() {
        localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(this.customColors))
    }

    // Открыть/закрыть палитру
    toggle() {
        this.el.classList.toggle('palette-hidden')
    }

    open() { this.el.classList.remove('palette-hidden') }
    close() { this.el.classList.add('palette-hidden') }

    // Установить активный цвет (вызывается снаружи)
    setSelected(hex) {
        this.selectedColor = hex
        this.updateActiveState()

        // Обновляем превью в панели свойств
        document.getElementById('selected-color-preview').style.background = hex
        document.getElementById('selected-color-hex').textContent = hex
    }

    render() {
        this.renderGroup('palette-arch', BUILTIN_COLORS.arch)
        this.renderGroup('palette-zones', BUILTIN_COLORS.zones)
        this.renderGroup('palette-paths', BUILTIN_COLORS.paths)
        this.renderCustom()
    }

    renderGroup(containerId, colors) {
        const container = document.getElementById(containerId)
        container.innerHTML = colors.map(c => this.swatchHTML(c)).join('')

        container.querySelectorAll('.palette-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const hex = swatch.dataset.hex
                this.setSelected(hex)
                this.onSelect(hex)
            })
        })
    }

    renderCustom() {
        const container = document.getElementById('palette-custom')

        if (this.customColors.length === 0) {
            container.innerHTML = `
        <span style="font-size:12px; color:#666; padding: 4px 0;">
          Нет добавленных цветов
        </span>`
            return
        }

        container.innerHTML = this.customColors.map((c, i) =>
            this.swatchHTML(c, true, i)
        ).join('')

        // Клики по свотчам
        container.querySelectorAll('.palette-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const hex = swatch.dataset.hex
                this.setSelected(hex)
                this.onSelect(hex)
            })
        })

        // Кнопки удаления
        container.querySelectorAll('.swatch-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation()
                const idx = parseInt(btn.dataset.idx)
                this.customColors.splice(idx, 1)
                this.saveCustom()
                this.renderCustom()
            })
        })
    }

    swatchHTML(color, isCustom = false, idx = 0) {
        const activeClass = color.hex === this.selectedColor ? 'active' : ''
        const customClass = isCustom ? 'custom' : ''
        const delBtn = isCustom
            ? `<div class="swatch-del" data-idx="${idx}">✕</div>`
            : ''

        return `
      <div class="palette-swatch ${activeClass} ${customClass}"
           style="background: ${color.hex}"
           data-hex="${color.hex}"
           title="${color.name}">
        ${delBtn}
      </div>
    `
    }

    updateActiveState() {
        document.querySelectorAll('.palette-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.hex === this.selectedColor)
        })
    }

    setupEvents() {
        // Кнопка закрытия
        document.getElementById('palette-close').addEventListener('click', () => {
            this.close()
        })

        // Добавить свой цвет
        document.getElementById('btn-add-color').addEventListener('click', () => {
            const hex = document.getElementById('custom-color-picker').value
            const name = document.getElementById('custom-color-name').value.trim()
                || 'Мой цвет'

            // Проверяем дубликат
            if (this.customColors.some(c => c.hex === hex)) {
                return
            }

            this.customColors.push({ hex, name })
            this.saveCustom()
            this.renderCustom()

            document.getElementById('custom-color-name').value = ''
        })

        // Открыть палитру по кнопке в панели свойств
        document.getElementById('btn-open-palette').addEventListener('click', () => {
            this.toggle()
        })
    }

    // Получить все цвета (встроенные + пользовательские) одним массивом
    getAllColors() {
        return [
            ...BUILTIN_COLORS.arch,
            ...BUILTIN_COLORS.zones,
            ...BUILTIN_COLORS.paths,
            ...this.customColors
        ]
    }
}