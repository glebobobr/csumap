import { rotateFeature, scaleFeature, getFeatureCenter } from './shapes.js'

export class TransformPanel {
    constructor(getDraw) {
        this.getDraw = getDraw  // функция, возвращающая Draw instance
        this.el = null
        this.currentFeatureId = null
        this.rotateAngle = 0
        this.scaleX = 1
        this.scaleY = 1

        this.create()
    }

    create() {
        this.el = document.createElement('div')
        this.el.id = 'transform-panel'
        this.el.className = 'transform-panel hidden'
        this.el.innerHTML = `
      <div class="transform-title">Трансформация</div>

      <!-- Поворот -->
      <div class="transform-section">
        <div class="transform-label">Поворот</div>
        <div class="transform-row">
          <button class="tr-btn" id="tr-rotate-ccw" title="−15°">↺</button>
          <button class="tr-btn" id="tr-rotate-ccw5" title="−5°">↺₅</button>
          <input type="number" id="tr-angle" value="0" step="1" class="tr-input" />
          <span class="tr-unit">°</span>
          <button class="tr-btn" id="tr-rotate-cw5" title="+5°">↻₅</button>
          <button class="tr-btn" id="tr-rotate-cw" title="+15°">↻</button>
        </div>
        <button class="tr-apply-btn" id="tr-apply-rotate">Применить поворот</button>
      </div>

      <!-- Масштаб -->
      <div class="transform-section">
        <div class="transform-label">Масштаб</div>

        <div class="transform-row">
          <span class="tr-axis-label">X (ширина)</span>
          <button class="tr-btn" id="tr-scale-x-minus">−</button>
          <input type="number" id="tr-scale-x" value="1.00"
                 step="0.05" min="0.1" max="10" class="tr-input" />
          <button class="tr-btn" id="tr-scale-x-plus">+</button>
        </div>

        <div class="transform-row">
          <span class="tr-axis-label">Y (высота)</span>
          <button class="tr-btn" id="tr-scale-y-minus">−</button>
          <input type="number" id="tr-scale-y" value="1.00"
                 step="0.05" min="0.1" max="10" class="tr-input" />
          <button class="tr-btn" id="tr-scale-y-plus">+</button>
        </div>

        <label class="tr-checkbox-row">
          <input type="checkbox" id="tr-lock-ratio" checked />
          <span>Пропорционально</span>
        </label>

        <div class="transform-row tr-preset-row">
          <button class="tr-preset" data-sx="2" data-sy="1">2× шире</button>
          <button class="tr-preset" data-sx="1" data-sy="2">2× выше</button>
          <button class="tr-preset" data-sx="1.5" data-sy="1.5">×1.5</button>
          <button class="tr-preset" data-sx="0.5" data-sy="0.5">×0.5</button>
        </div>

        <button class="tr-apply-btn" id="tr-apply-scale">Применить масштаб</button>
      </div>

      <!-- Сброс -->
      <button class="tr-reset-btn" id="tr-reset">↺ Сброс трансформаций</button>
    `
        document.body.appendChild(this.el)
        this.setupEvents()
    }

    show(featureId) {
        this.currentFeatureId = featureId
        this.rotateAngle = 0
        this.scaleX = 1
        this.scaleY = 1
        document.getElementById('tr-angle').value = 0
        document.getElementById('tr-scale-x').value = '1.00'
        document.getElementById('tr-scale-y').value = '1.00'
        this.el.classList.remove('hidden')
    }

    hide() {
        this.el.classList.add('hidden')
        this.currentFeatureId = null
    }

    // Получить текущую фичу из Draw
    getFeature() {
        if (!this.currentFeatureId) return null
        return this.getDraw().get(this.currentFeatureId)
    }

    // Применить поворот
    applyRotate() {
        const feature = this.getFeature()
        if (!feature) return
        const angle = parseFloat(document.getElementById('tr-angle').value) || 0
        const rotated = rotateFeature(feature, angle)
        this.getDraw().add({ ...rotated, id: feature.id })
    }

    // Применить масштаб
    applyScale() {
        const feature = this.getFeature()
        if (!feature) return
        const sx = parseFloat(document.getElementById('tr-scale-x').value) || 1
        const sy = parseFloat(document.getElementById('tr-scale-y').value) || 1
        const scaled = scaleFeature(feature, sx, sy)
        this.getDraw().add({ ...scaled, id: feature.id })
    }

    setupEvents() {
        // Повороты
        document.getElementById('tr-rotate-ccw').onclick = () => {
            const inp = document.getElementById('tr-angle')
            inp.value = parseFloat(inp.value) - 15
        }
        document.getElementById('tr-rotate-ccw5').onclick = () => {
            const inp = document.getElementById('tr-angle')
            inp.value = parseFloat(inp.value) - 5
        }
        document.getElementById('tr-rotate-cw5').onclick = () => {
            const inp = document.getElementById('tr-angle')
            inp.value = parseFloat(inp.value) + 5
        }
        document.getElementById('tr-rotate-cw').onclick = () => {
            const inp = document.getElementById('tr-angle')
            inp.value = parseFloat(inp.value) + 15
        }
        document.getElementById('tr-apply-rotate').onclick = () => {
            this.applyRotate()
        }

        // Масштаб +/-
        const step = 0.05
        document.getElementById('tr-scale-x-minus').onclick = () => this.adjustScale('x', -step)
        document.getElementById('tr-scale-x-plus').onclick  = () => this.adjustScale('x', +step)
        document.getElementById('tr-scale-y-minus').onclick = () => this.adjustScale('y', -step)
        document.getElementById('tr-scale-y-plus').onclick  = () => this.adjustScale('y', +step)

        // Синхронизация X/Y если пропорционально
        document.getElementById('tr-scale-x').oninput = (e) => {
            if (document.getElementById('tr-lock-ratio').checked) {
                document.getElementById('tr-scale-y').value = e.target.value
            }
        }
        document.getElementById('tr-scale-y').oninput = (e) => {
            if (document.getElementById('tr-lock-ratio').checked) {
                document.getElementById('tr-scale-x').value = e.target.value
            }
        }

        // Пресеты
        document.querySelectorAll('.tr-preset').forEach(btn => {
            btn.onclick = () => {
                document.getElementById('tr-scale-x').value = btn.dataset.sx
                document.getElementById('tr-scale-y').value = btn.dataset.sy
                // Снимаем lock если разные значения
                if (btn.dataset.sx !== btn.dataset.sy) {
                    document.getElementById('tr-lock-ratio').checked = false
                }
            }
        })

        document.getElementById('tr-apply-scale').onclick = () => {
            this.applyScale()
        }

        // Сброс — перезагружаем из файла (localStorage)
        document.getElementById('tr-reset').onclick = () => {
            document.getElementById('tr-angle').value = 0
            document.getElementById('tr-scale-x').value = '1.00'
            document.getElementById('tr-scale-y').value = '1.00'
        }
    }

    adjustScale(axis, delta) {
        const inputX = document.getElementById('tr-scale-x')
        const inputY = document.getElementById('tr-scale-y')
        const locked = document.getElementById('tr-lock-ratio').checked

        if (axis === 'x') {
            const newVal = Math.max(0.1, parseFloat(inputX.value) + delta).toFixed(2)
            inputX.value = newVal
            if (locked) inputY.value = newVal
        } else {
            const newVal = Math.max(0.1, parseFloat(inputY.value) + delta).toFixed(2)
            inputY.value = newVal
            if (locked) inputX.value = newVal
        }
    }
}