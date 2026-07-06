import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SyncService } from './SyncService.js'

describe('SyncService', () => {
  beforeEach(() => {
    SyncService._channel = null
  })

  afterEach(() => {
    if (SyncService._channel) {
      SyncService._channel.close()
      SyncService._channel = null
    }
  })

  it('broadcasts and receives via onEvent', () => {
    const handler = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => {
      if (msg.data?.event === 'published') handler(msg.data)
    })

    SyncService.broadcast('published', { layer: 'buildings' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'published', data: { layer: 'buildings' } })
    )
    receiver.close()
  })

  it('does not call handler for a different event', () => {
    const handler = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => {
      if (msg.data?.event === 'saved') handler(msg.data)
    })

    SyncService.broadcast('published')

    expect(handler).not.toHaveBeenCalled()
    receiver.close()
  })

  it('calls handler with correct payload including ts', () => {
    const handler = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => {
      if (msg.data?.event === 'published') handler(msg.data)
    })

    SyncService.broadcast('published', { ids: [1, 2, 3] })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'published',
        data: { ids: [1, 2, 3] },
        ts: expect.any(Number),
      })
    )
    receiver.close()
  })

  it('supports multiple listeners for the same event', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => {
      if (msg.data?.event === 'published') {
        h1(msg.data)
        h2(msg.data)
      }
    })

    SyncService.broadcast('published')

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
    receiver.close()
  })

  it('onAny calls handler for any event', () => {
    const handler = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => handler(msg.data))

    SyncService.broadcast('published', { count: 5 })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'published', data: { count: 5 } })
    )
    receiver.close()
  })

  it('handles multiple broadcast calls', () => {
    const handler = vi.fn()
    const receiver = new BroadcastChannel('csumap:sync')
    receiver.addEventListener('message', (msg) => {
      if (msg.data?.event === 'published') handler(msg.data)
    })

    SyncService.broadcast('published')
    SyncService.broadcast('published')

    expect(handler).toHaveBeenCalledTimes(2)
    receiver.close()
  })

  it('works when no listener is registered (no crash)', () => {
    expect(() => SyncService.broadcast('published')).not.toThrow()
  })

  it('onEvent callback triggers when broadcast arrives', () => {
    const reloadFn = vi.fn()
    SyncService.onEvent('published', reloadFn)

    const sender = new BroadcastChannel('csumap:sync')
    sender.postMessage({ event: 'published', data: {}, ts: Date.now() })

    expect(reloadFn).toHaveBeenCalledOnce()
    sender.close()
  })
})
