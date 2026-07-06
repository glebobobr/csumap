import { setupServer } from 'msw/node'
import { handlers } from './mocks/api'
import { afterAll, afterEach, beforeAll } from 'vitest'

// BroadcastChannel polyfill for jsdom
const _bcChannels = new Map()
class _FakeBroadcastChannel {
  constructor(name) {
    this.name = name
    this._listeners = new Set()
    if (!_bcChannels.has(name)) _bcChannels.set(name, new Set())
    _bcChannels.get(name).add(this)
  }
  postMessage(data) {
    for (const instance of (_bcChannels.get(this.name) || [])) {
      if (instance !== this) {
        for (const listener of instance._listeners) {
          try { listener({ data }) } catch (e) { /* ignore */ }
        }
      }
    }
  }
  addEventListener(type, handler) {
    if (type === 'message') this._listeners.add(handler)
  }
  removeEventListener(type, handler) {
    if (type === 'message') this._listeners.delete(handler)
  }
  close() {
    _bcChannels.get(this.name)?.delete(this)
    this._listeners.clear()
  }
}
globalThis.BroadcastChannel = _FakeBroadcastChannel

const server = setupServer(...handlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
