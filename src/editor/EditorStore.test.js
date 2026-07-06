import { describe, it, expect, beforeEach } from 'vitest'
import { EditorStore } from './EditorStore'

describe('EditorStore', () => {
  let store

  beforeEach(() => {
    store = new EditorStore()
  })

  it('starts clean', () => {
    expect(store.isDirty).toBe(false)
  })

  it('markDirty sets dirty flag', () => {
    store.markDirty()
    expect(store.isDirty).toBe(true)
  })

  it('markClean resets dirty flag', () => {
    store.markDirty()
    store.markClean()
    expect(store.isDirty).toBe(false)
  })

  it('multiple markDirty calls only set once', () => {
    store.markDirty()
    store.markDirty()
    store.markDirty()
    expect(store.isDirty).toBe(true)
  })

  it('onChange callback receives dirty state', () => {
    const calls = []
    store.onChange((dirty) => calls.push(dirty))
    store.markDirty()
    expect(calls).toEqual([true])
  })

  it('onChange fires on markClean', () => {
    store.markDirty()
    const calls = []
    store.onChange((dirty) => calls.push(dirty))
    store.markClean()
    expect(calls).toEqual([false])
  })

  it('supports multiple listeners', () => {
    const results = []
    store.onChange((dirty) => results.push('a:' + dirty))
    store.onChange((dirty) => results.push('b:' + dirty))
    store.markDirty()
    expect(results).toEqual(['a:true', 'b:true'])
  })

  it('continues after listener throws', () => {
    const results = []
    store.onChange(() => { throw new Error('listener error') })
    store.onChange((dirty) => results.push(dirty))
    expect(() => store.markDirty()).not.toThrow()
    expect(results).toEqual([true])
    expect(store.isDirty).toBe(true)
  })

  it('does not notify when already dirty', () => {
    store.markDirty()
    const calls = []
    store.onChange((dirty) => calls.push(dirty))
    store.markDirty()
    expect(calls).toHaveLength(0)
  })

  it('does not notify when already clean', () => {
    const calls = []
    store.onChange((dirty) => calls.push(dirty))
    store.markClean()
    expect(calls).toHaveLength(0)
  })
})
