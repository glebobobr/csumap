import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  login,
  getAuthToken,
  setAuthToken,
  checkHealth,
  fetchLayers,
  fetchLayerFeatures,
  fetchAdminLayerFeatures,
  createFeature,
  updateFeature,
  deleteFeature,
  publishFeature,
  publishAllDrafts,
} from './client'

describe('API Client', () => {
  beforeEach(() => {
    setAuthToken(null)
  })

  describe('login', () => {
    it('returns token on correct password', async () => {
      const token = await login('correct-password')
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
    })

    it('throws on incorrect password', async () => {
      await expect(login('wrong-password')).rejects.toThrow('Invalid password')
    })

    it('stores token globally', async () => {
      const token = await login('correct-password')
      expect(getAuthToken()).toBe(token)
    })
  })

  describe('public API', () => {
    it('fetchLayers returns layer list', async () => {
      const layers = await fetchLayers()
      expect(Array.isArray(layers)).toBe(true)
    })

    it('fetchLayerFeatures returns feature collection', async () => {
      const data = await fetchLayerFeatures('buildings')
      expect(data.type).toBe('FeatureCollection')
      expect(data.features.length).toBeGreaterThan(0)
    })

    it('fetchLayerFeatures returns empty for unknown layer', async () => {
      const data = await fetchLayerFeatures('unknown')
      expect(data.features).toHaveLength(0)
    })
  })

  describe('admin API', () => {
    it('rejects admin request without token', async () => {
      await expect(fetchAdminLayerFeatures('buildings')).rejects.toThrow()
    })

    it('returns features with auth token', async () => {
      setAuthToken('test-token')
      const data = await fetchAdminLayerFeatures('buildings')
      expect(data.type).toBe('FeatureCollection')
      expect(data.features.length).toBeGreaterThan(0)
    })

    it('createFeature returns created feature', async () => {
      setAuthToken('test-token')
      const result = await createFeature('buildings', {
        name: 'New Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [37.62, 55.75] },
      })
      expect(result.properties.name).toBe('New Feature')
    })

    it('updateFeature succeeds with auth', async () => {
      setAuthToken('test-token')
      const result = await updateFeature(1, { name: 'Updated' })
      expect(result.properties.name).toBe('Updated')
    })

    it('deleteFeature succeeds with auth', async () => {
      setAuthToken('test-token')
      await expect(deleteFeature(1)).resolves.toBeUndefined()
    })
  })

  describe('publish', () => {
    it('publishAllDrafts succeeds with auth', async () => {
      setAuthToken('test-token')
      const result = await publishAllDrafts()
      expect(result.status).toBe('all drafts published')
    })

    it('publishFeature succeeds with auth', async () => {
      setAuthToken('test-token')
      const result = await publishFeature(1)
      expect(result.status).toBe('published')
    })
  })

  describe('error handling', () => {
    it('401 clears token and dispatches auth:expired event', async () => {
      const events = []
      const handler = (e) => events.push(e.type)
      window.addEventListener('auth:expired', handler)

      setAuthToken(null)
      await expect(fetchAdminLayerFeatures('buildings')).rejects.toThrow()
      expect(getAuthToken()).toBeNull()
      expect(events).toContain('auth:expired')

      window.removeEventListener('auth:expired', handler)
    })
  })

  describe('health', () => {
    it('checkHealth returns true', async () => {
      const healthy = await checkHealth()
      expect(healthy).toBe(true)
    })
  })
})
