export class EditorStore {
    constructor() {
        this._dirty = false
        this._listeners = []
    }

    markDirty() {
        if (!this._dirty) {
            this._dirty = true
            this._notify()
        }
    }

    markClean() {
        if (this._dirty) {
            this._dirty = false
            this._notify()
        }
    }

    get isDirty() { return this._dirty }

    onChange(cb) {
        this._listeners.push(cb)
    }

    _notify() {
        for (const cb of this._listeners) {
            try { cb(this._dirty) } catch (e) { console.warn('EditorStore listener error:', e) }
        }
    }
}
