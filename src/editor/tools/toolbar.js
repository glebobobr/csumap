export class Toolbar {
    constructor(onToolChange) {
        this.onToolChange = onToolChange
        this.currentTool = 'select'
        this.injectShapeButtons()
        this.setupEvents()
        this.setupKeyboard()
    }

    // Добавляем кнопки фигур в HTML тулбара
    injectShapeButtons() {
        const toolbar = document.getElementById('toolbar')

        // Кнопка перемещения — после группы редактирования
        const moveGroup = document.createElement('div')
        moveGroup.className = 'tool-group'
        moveGroup.innerHTML = `
      <button class="tool-btn" data-tool="move" title="Переместить (G)">
        <svg viewBox="0 0 24 24">
          <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
        </svg>
        <span>Двигать</span>
      </button>
    `

        // Разделитель + фигуры
        const shapeDivider = document.createElement('div')
        shapeDivider.className = 'tool-divider'

        const shapeGroup = document.createElement('div')
        shapeGroup.className = 'tool-group'
        shapeGroup.innerHTML = `
      <div class="tool-group-label">Фигуры</div>
      <div class="shape-dropdown">
        <button class="tool-btn" data-tool="rectangle" title="Прямоугольник (тянуть мышью, Ctrl — от центра, Shift — квадрат)">
          <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" stroke="currentColor" stroke-width="2" fill="none"/></svg>
          <span>Прямоуг.</span>
        </button>
        <button class="shape-menu-btn" id="shape-menu-toggle">▼</button>
        <div class="shape-menu hidden" id="shape-menu">
          <button data-tool="circle" title="Круг">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span>Круг</span>
          </button>
          <button data-tool="square" title="Квадрат">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span>Квадрат</span>
          </button>
          <button data-tool="triangle" title="Треугольник">
            <svg viewBox="0 0 24 24"><polygon points="12,3 22,21 2,21" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span>Треуголь.</span>
          </button>
          <button data-tool="ngon" title="Многоугольник">
            <svg viewBox="0 0 24 24"><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span>Многоуг.</span>
          </button>
        </div>
      </div>
    `

        // Булевы операции
        const booleanDivider = document.createElement('div')
        booleanDivider.className = 'tool-divider'

        const booleanGroup = document.createElement('div')
        booleanGroup.className = 'tool-group'
        booleanGroup.innerHTML = `
      <div class="tool-group-label">Булевы операции</div>
      <button class="tool-btn" data-tool="union" title="Объединить (Union)">
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
          <circle cx="15" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
        <span>Объединить</span>
      </button>
      <button class="tool-btn" data-tool="difference" title="Вычесть (Difference)">
        <svg viewBox="0 0 24 24">
          <circle cx="9" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M 15 6 A 6 6 0 0 1 15 18" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="2,2"/>
        </svg>
        <span>Вычесть</span>
      </button>
      <button class="tool-btn" data-tool="intersection" title="Пересечение (Intersection)">
        <svg viewBox="0 0 24 24">
          <path d="M 9 6 A 6 6 0 0 0 9 18" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="2,2"/>
          <path d="M 15 6 A 6 6 0 0 1 15 18" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="2,2"/>
          <path d="M 12 8 L 12 16" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Пересечь</span>
      </button>
      <button class="tool-btn" data-tool="xor" title="Исключающее ИЛИ (XOR)">
        <svg viewBox="0 0 24 24">
          <path d="M 9 6 A 6 6 0 0 0 9 18" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M 15 6 A 6 6 0 0 1 15 18" stroke="currentColor" stroke-width="2" fill="none"/>
          <path d="M 12 8 L 12 16" stroke="currentColor" stroke-width="2" stroke-dasharray="2,2"/>
        </svg>
        <span>XOR</span>
      </button>
    `

        // Комплекс — группировка
        const complexDivider = document.createElement('div')
        complexDivider.className = 'tool-divider'

        const complexGroup = document.createElement('div')
        complexGroup.className = 'tool-group'
        complexGroup.innerHTML = `
      <div class="tool-group-label">Комплекс</div>
      <button class="tool-btn" data-tool="group" title="Сгруппировать выбранные в комплекс">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Группа</span>
      </button>
      <button class="tool-btn" data-tool="ungroup" title="Убрать из комплекса">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>
          <line x1="16" y1="8" x2="22" y2="8" stroke="currentColor" stroke-width="2"/>
          <line x1="19" y1="5" x2="19" y2="11" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Разгруп.</span>
      </button>
    `

        // Вставляем перед последним разделителем с delete
        const deleteGroup = toolbar.querySelector('.tool-group:last-child')
        toolbar.insertBefore(complexDivider, deleteGroup)
        toolbar.insertBefore(complexGroup, deleteGroup)
        toolbar.insertBefore(moveGroup, deleteGroup)
        toolbar.insertBefore(shapeDivider, deleteGroup)
        toolbar.insertBefore(shapeGroup, deleteGroup)
        toolbar.insertBefore(booleanDivider, deleteGroup)
        toolbar.insertBefore(booleanGroup, deleteGroup)
        toolbar.insertBefore(document.createElement('div'), deleteGroup)
            .className = 'tool-divider'
    }

    setupEvents() {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool)
            })
        })

        // Выпадающее меню фигур
        const menuToggle = document.getElementById('shape-menu-toggle')
        const menu = document.getElementById('shape-menu')

        if (menuToggle && menu) {
            menuToggle.addEventListener('click', (e) => {
                e.stopPropagation()
                menu.classList.toggle('hidden')
            })

            // Клик вне меню закрывает его
            document.addEventListener('click', () => {
                menu.classList.add('hidden')
            })

            // Выбор фигуры из меню
            menu.querySelectorAll('button[data-tool]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation()
                    this.setTool(btn.dataset.tool)
                    menu.classList.add('hidden')
                })
            })
        }
    }

    setupKeyboard() {
        // Keyboard shortcuts обрабатываются в editor.js
    }

    setTool(tool) {
        this.currentTool = tool

        // Снимаем active со всех, кроме булевых операций
        const modalShapeTools = []
        const booleanTools = ['union', 'difference', 'intersection', 'xor']

        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            if (modalShapeTools.includes(tool) || booleanTools.includes(tool)) {
                // Фигура с модалкой или булева операция — не подсвечиваем кнопку
                btn.classList.remove('active')
            } else {
                btn.classList.toggle('active', btn.dataset.tool === tool)
            }
        })

        this.onToolChange(tool)
    }

    getCurrent() {
        return this.currentTool
    }
}