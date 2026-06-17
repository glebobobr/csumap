// Визуальные подсказки для режимов рисования
// Показывает размеры фигуры рядом с курсором

export class DrawingHints {
    constructor(map) {
        this.map = map
        this.el = null
        this.create()
    }

    create() {
        this.el = document.createElement('div')
        this.el.id = 'drawing-hints'
        this.el.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
            pointer-events: none;
            z-index: 1000;
            display: none;
            white-space: nowrap;
        `
        document.body.appendChild(this.el)
    }

    show(x, y, text) {
        this.el.textContent = text
        this.el.style.left = `${x + 15}px`
        this.el.style.top = `${y + 15}px`
        this.el.style.display = 'block'
    }

    hide() {
        this.el.style.display = 'none'
    }

    destroy() {
        if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el)
        }
    }
}

// Добавляем глобальный экземпляр для использования в modes
let hintsInstance = null

export function initDrawingHints(map) {
    if (!hintsInstance) {
        hintsInstance = new DrawingHints(map)
    }
    return hintsInstance
}

export function getDrawingHints() {
    return hintsInstance
}
