export class UndoRedoManager {
  constructor(draw) {
    this.draw = draw
    this.undoStack = []
    this.redoStack = []
    this.maxLength = 5
    this._restoring = false
  }

  isRestoring() {
    return this._restoring
  }

  save() {
    if (this._restoring) return
    const snapshot = this._clone()
    const lastState = this.undoStack[this.undoStack.length - 1]
    if (lastState && JSON.stringify(lastState) === JSON.stringify(snapshot)) {
      return
    }
    this.undoStack.push(snapshot)
    this.redoStack = []
    if (this.undoStack.length > this.maxLength + 1) {
      this.undoStack.shift()
    }
  }

  undo() {
    if (this.undoStack.length < 2) return false
    this.redoStack.push(this.undoStack.pop())
    this._restore(this.undoStack[this.undoStack.length - 1])
    return true
  }

  redo() {
    if (this.redoStack.length === 0) return false
    this.undoStack.push(this.redoStack.pop())
    this._restore(this.undoStack[this.undoStack.length - 1])
    return true
  }

  _clone() {
    return JSON.parse(JSON.stringify(this.draw.getAll()))
  }

  _restore(fc) {
    this._restoring = true
    this.draw.deleteAll()
    if (fc.features.length > 0) {
      this.draw.add(fc)
    }
    this.draw.changeMode('simple_select')
    this._restoring = false
  }
}
