/**
 * API Client wrapper using generated TypeScript client
 * Provides a clean interface for the frontend to use the generated API
 */

import { listPhotos, getNearbyPhotos, getPhoto } from '@/../frontend/src/api/generated/photos/photos.ts'
import { getMVTTileUrl, getTileJSONUrl } from '@/../frontend/src/api/generated/tiles/tiles.ts'
import { getNearestPanoramas, getPannellumConfig } from '@/../frontend/src/api/generated/panoramas/panoramas.ts'
import { getMascotSkin } from '@/../frontend/src/api/generated/mascot/mascot.ts'

import type {
  Photo,
  PhotoCollection,
  PhotoFeature,
  PanoramaBrief,
  PannellumConfig,
  MascotSkin,
  TileJSON
} from '@/../frontend/src/api/model/index.ts'

// Layer feature types for the map
export interface LayerFeatures {
  type: 'FeatureCollection'
  features: Array<{
    id?: string
    type: 'Feature'
    properties: Record<string, any>
    geometry: GeoJSON.Geometry
  }>
}

// Request/response types for editor
export interface CreateFeatureRequest {
  feature_id?: string
  name: string
  properties: Record<string, any>
  geometry: GeoJSON.Geometry
  is_visible?: boolean
  min_zoom?: number
  max_zoom?: number
}

export interface ReplaceFeaturesRequest {
  features: CreateFeatureRequest[]
}

export interface ReplaceFeaturesResponse {
  ok: boolean
  count: number
}

// API base URL (handled by Vite proxy)
const API_BASE = '/api/v1'

// Auth token storage (persisted in localStorage)
const AUTH_KEY = 'csumap:auth_token'

function loadToken(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY)
  } catch {
    return null
  }
}

let authToken: string | null = loadToken()

export function setAuthToken(token: string) {
  authToken = token
  try {
    localStorage.setItem(AUTH_KEY, token)
  } catch { /* ignore */ }
}

export function getAuthToken(): string | null {
  return authToken
}

export function clearAuthToken() {
  authToken = null
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch { /* ignore */ }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`
  }
  return headers
}

/**
 * Fetch layers list
 */
export async function fetchLayers(): Promise<Array<{
  id: string
  name: string
  slug: string
  description?: string
  featureCount: number
  updatedAt: string
}>> {
  const res = await fetch(`${API_BASE}/layers`)
  if (!res.ok) throw new Error('Failed to fetch layers')
  return res.json()
}

/**
 * Fetch features for a specific layer
 */
export async function fetchLayerFeatures(layerId: string): Promise<LayerFeatures> {
  const res = await fetch(`${API_BASE}/layers/${layerId}/features`)
  if (!res.ok) throw new Error(`Failed to fetch features for layer ${layerId}`)
  return res.json()
}

/**
 * Fetch all layers and their features (for initial map load)
 */
export async function fetchAllLayerData(): Promise<Record<string, LayerFeatures>> {
  const layers = await fetchLayers()
  const data: Record<string, LayerFeatures> = {}

  for (const layer of layers) {
    try {
      data[layer.id] = await fetchLayerFeatures(layer.id)
    } catch (err) {
      console.warn(`Failed to load layer ${layer.id}:`, err)
    }
  }

  return data
}

/**
 * Get MVT tile URL for a layer
 */
export function getTileUrl(layer: string, z: number, x: number, y: number): string {
  // The generated client provides URL builders
  return `/tiles/${layer}/${z}/${x}/${y}.mvt`
}

/**
 * Get TileJSON metadata for a layer
 */
export async function fetchTileJSON(layer: string): Promise<TileJSON> {
  const res = await fetch(`${API_BASE}/tilejson/${layer}`)
  if (!res.ok) throw new Error(`Failed to fetch TileJSON for ${layer}`)
  return res.json()
}

/**
 * Photo API functions using generated client
 */
export async function fetchNearbyPhotos(lon: number, lat: number, radius: number = 500): Promise<PhotoCollection> {
  const result = await getNearbyPhotos({ lon, lat, radius })
  return result.data
}

export async function fetchPhotoById(id: number): Promise<Photo> {
  const result = await getPhoto(id)
  if (result.status === 404) throw new Error('Photo not found')
  return result.data
}

export async function fetchPhotosByBBox(bbox: string, limit: number = 50): Promise<PhotoCollection> {
  const result = await listPhotos({ bbox, limit })
  return result.data
}

/**
 * Panorama API functions
 */
export async function fetchNearestPanoramas(lon: number, lat: number, radius: number = 50): Promise<PanoramaBrief[]> {
  const result = await getNearestPanoramas({ lon, lat, radius })
  return result.data
}

export async function fetchPannellumConfig(id: number): Promise<PannellumConfig> {
  const result = await getPannellumConfig(id)
  return result.data
}

/**
 * Mascot API functions
 */
export async function fetchMascotSkin(name: string): Promise<MascotSkin> {
  const result = await getMascotSkin(name)
  return result.data
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch('/health')
    return res.ok
  } catch {
    return false
  }
}

/**
 * Editor API functions
 */
export async function fetchLayerFeaturesForEdit(layerId: string): Promise<LayerFeatures> {
  const res = await authFetch(`${API_BASE}/layers/${layerId}/features`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch features for layer ${layerId}`)
  return res.json()
}

export async function replaceLayerFeatures(layerId: string, features: CreateFeatureRequest[]): Promise<ReplaceFeaturesResponse> {
  const res = await authFetch(`${API_BASE}/layers/${layerId}/features/replace`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ features }),
  })
  if (!res.ok) throw new Error(`Failed to replace features for layer ${layerId}`)
  return res.json()
}

/**
 * Wrapped fetch that dispatches 'auth:expired' on 401
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, options)
  if (res.status === 401) {
    clearAuthToken()
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }
  return res
}

export async function createFeature(layerId: string, feature: CreateFeatureRequest) {
  const res = await authFetch(`${API_BASE}/admin/layers/${layerId}/features`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(feature),
  })
  if (!res.ok) throw new Error(`Failed to create feature`)
  return res.json()
}

export async function updateFeature(featureId: number, updates: Partial<CreateFeatureRequest>) {
  const res = await authFetch(`${API_BASE}/admin/features/${featureId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error(`Failed to update feature`)
  return res.json()
}

export async function deleteFeature(featureId: number) {
  const res = await authFetch(`${API_BASE}/admin/features/${featureId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to delete feature`)
}

/**
 * Admin API functions
 */
export async function fetchAdminLayerFeatures(layerId: string): Promise<LayerFeatures> {
  const res = await authFetch(`${API_BASE}/admin/layers/${layerId}/features`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to fetch admin features for layer ${layerId}`)
  return res.json()
}

export async function publishFeature(featureId: number): Promise<any> {
  const res = await authFetch(`${API_BASE}/admin/features/${featureId}/publish`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to publish feature`)
  return res.json()
}

export async function publishAllDrafts(): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE}/admin/features/publish-all`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to publish drafts`)
  return res.json()
}

export async function listChangesets(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/changesets`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to list changesets`)
  return res.json()
}

/**
 * Login and get JWT token
 */
export async function login(password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error('Invalid password')
  const data = await res.json()
  setAuthToken(data.token)
  return data.token
}

export default {
  fetchLayers,
  fetchLayerFeatures,
  fetchAllLayerData,
  getTileUrl,
  fetchTileJSON,
  fetchNearbyPhotos,
  fetchPhotoById,
  fetchPhotosByBBox,
  fetchNearestPanoramas,
  fetchPannellumConfig,
  fetchMascotSkin,
  checkHealth,
}