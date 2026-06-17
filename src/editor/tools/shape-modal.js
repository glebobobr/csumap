import { makeCircle, makeSquare, makeRectangle, makeTriangle, makeNgon, makeRoundedRectangle, makeThickLine, makeRing } from './shapes.js'

const SHAPES = {
    circle: {
        label: '⬤ Круг',
        params: [
            { id: 'radius', label: 'Радиус', min: 5, max: 200, step: 5, value: 30, unit: 'м' }
        ],
        generate: (center, p) => makeCircle(center, p.radius, 48)
    },
    ring: {
        label: '◯ Кольцо',
        params: [
            { id: 'outerRadius', label: 'Внешний радиус', min: 10, max: 200, step: 5, value: 40, unit: 'м' },
            { id: 'innerRadius', label: 'Внутренний радиус', min: 5, max: 195, step: 5, value: 25, unit: 'м' }
        ],
        generate: (center, p) => makeRing(center, p.outerRadius, p.innerRadius, 48)
    },
    square: {
        label: '■ Квадрат',
        params: [
            { id: 'side', label: 'Сторона', min: 5, max: 300, step: 5, value: 40, unit: 'м' },
            { id: 'angle', label: 'Поворот', min: 0, max: 90, step: 5, value: 0, unit: '°' }
        ],
        generate: (center, p) => makeSquare(center, p.side, p.angle)
    },
    rectangle: {
        label: '▬ Прямоугольник',
        params: [
            { id: 'width',  label: 'Ширина',  min: 5, max: 400, step: 5, value: 60, unit: 'м' },
            { id: 'height', label: 'Высота',  min: 5, max: 400, step: 5, value: 30, unit: 'м' },
            { id: 'angle',  label: 'Поворот', min: 0, max: 90, step: 5, value: 0,  unit: '°' }
        ],
        generate: (center, p) => makeRectangle(center, p.width, p.height, p.angle)
    },
    roundedRect: {
        label: '▢ Скруглённый прямоугольник',
        params: [
            { id: 'width',  label: 'Ширина',  min: 10, max: 400, step: 5, value: 60, unit: 'м' },
            { id: 'height', label: 'Высота',  min: 10, max: 400, step: 5, value: 30, unit: 'м' },
            { id: 'radius', label: 'Радиус скругления', min: 0, max: 50, step: 1, value: 5, unit: 'м' },
            { id: 'angle',  label: 'Поворот', min: 0, max: 90, step: 5, value: 0,  unit: '°' }
        ],
        generate: (center, p) => makeRoundedRectangle(center, p.width, p.height, p.radius, p.angle)
    },
    triangle: {
        label: '▲ Треугольник',
        params: [
            { id: 'side',  label: 'Сторона',  min: 5, max: 200, step: 5, value: 40, unit: 'м' },
            { id: 'angle', label: 'Поворот',  min: 0, max: 120, step: 5, value: 0,  unit: '°' }
        ],
        generate: (center, p) => makeTriangle(center, p.side, p.angle)
    },
    ngon: {
        label: '⬡ Многоугольник',
        params: [
            { id: 'sides',  label: 'Сторон',   min: 3, max: 12, step: 1, value: 6,  unit: '' },
            { id: 'radius', label: 'Радиус',   min: 5, max: 200, step: 5, value: 30, unit: 'м' },
            { id: 'angle',  label: 'Поворот',  min: 0, max: 60, step: 5, value: 0,  unit: '°' }
        ],
        generate: (center, p) => makeNgon(center, p.radius, p.sides, p.angle)
    }
}

export class ShapeModal {
    constructor(onInsert) {
        this.onInsert = onInsert  // callback(geometry)
        this.mapCenter = [61.318987, 55.177196]
        this.currentShape = null

        this.el = document.createElement('div')
        this.el.id = 'shape-modal'
        this.el.className = 'hidden'
        document.body.appendChild(this.el)
    }

    open(shapeKey, mapCenter) {
        this.currentShape = shapeKey
        this.mapCenter = mapCenter
        const shape = SHAPES[shapeKey]
        if (!shape) return

        const paramsHTML = shape.params.map(p => `
      <div class="shape-param">
        <label>
          <span>${p.label}</span>
          <span class="shape-param-value" id="val-${p.id}">
            ${p.value}${p.unit}
          </span>
        </label>
        <input type="range"
               id="param-${p.id}"
               min="${p.min}" max="${p.max}"
               step="${p.step}" value="${p.value}"
               data-unit="${p.unit}" />
      </div>
    `).join('')

        this.el.innerHTML = `
      <div class="shape-modal-content">
        <div class="shape-modal-title">
          ${shape.label}
          <button class="shape-modal-close" id="shape-close">✕</button>
        </div>
        <div class="shape-params">${paramsHTML}</div>
        <div class="shape-modal-actions">
          <button class="btn-primary" id="shape-insert" style="flex:1">
            Вставить на карту
          </button>
          <button class="btn-secondary" id="shape-cancel">Отмена</button>
        </div>
      </div>
    `

        this.el.classList.remove('hidden')

        // Обновление значений при перемещении ползунка
        shape.params.forEach(p => {
            const slider = document.getElementById(`param-${p.id}`)
            const valEl = document.getElementById(`val-${p.id}`)
            slider.oninput = () => {
                valEl.textContent = `${slider.value}${p.unit}`
            }
        })

        // Вставить
        document.getElementById('shape-insert').onclick = () => {
            const values = {}
            shape.params.forEach(p => {
                values[p.id] = parseFloat(document.getElementById(`param-${p.id}`).value)
            })
            const geometry = shape.generate(this.mapCenter, values)
            this.onInsert(geometry)
            this.close()
        }

        document.getElementById('shape-close').onclick = () => this.close()
        document.getElementById('shape-cancel').onclick = () => this.close()

        // Клик вне модалки
        this.el.onclick = (e) => {
            if (e.target === this.el) this.close()
        }
    }

    close() {
        this.el.classList.add('hidden')
    }
}