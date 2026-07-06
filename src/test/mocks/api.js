import { http, HttpResponse } from 'msw'

const API_BASE = '/api/v1'
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.test'

export const handlers = [
  // Login
  http.post(`${API_BASE}/auth/token`, async ({ request }) => {
    const body = await request.json()
    if (body.password === 'correct-password') {
      return HttpResponse.json({ token: FAKE_TOKEN })
    }
    return HttpResponse.json({ error: 'invalid password' }, { status: 401 })
  }),

  // Layers list
  http.get(`${API_BASE}/layers`, () => {
    return HttpResponse.json([
      { id: 'buildings', name: 'Buildings', slug: 'buildings', description: '', featureCount: 5, updatedAt: new Date().toISOString() },
      { id: 'poi', name: 'POI', slug: 'poi', description: '', featureCount: 3, updatedAt: new Date().toISOString() },
    ])
  }),

  // Public feature endpoint
  http.get(`${API_BASE}/layers/:layerId/features`, ({ params }) => {
    if (params.layerId === 'buildings') {
      return HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            id: '1',
            type: 'Feature',
            properties: { name: 'Building A', status: 'published' },
            geometry: { type: 'Point', coordinates: [37.62, 55.75] },
          },
        ],
      })
    }
    return HttpResponse.json({ type: 'FeatureCollection', features: [] })
  }),

  // Admin feature endpoint
  http.get(`${API_BASE}/admin/layers/:layerId/features`, ({ request, params }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (params.layerId === 'buildings') {
      return HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            id: '1',
            type: 'Feature',
            properties: { name: 'Building A', status: 'draft' },
            geometry: { type: 'Point', coordinates: [37.62, 55.75] },
          },
        ],
      })
    }
    return HttpResponse.json({ type: 'FeatureCollection', features: [] })
  }),

  // Create feature
  http.post(`${API_BASE}/admin/layers/:layerId/features`, async ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    return HttpResponse.json({
      type: 'Feature',
      id: 'new-feature',
      properties: { name: body.name, status: 'draft' },
      geometry: body.geometry,
    }, { status: 201 })
  }),

  // Update feature
  http.put(`${API_BASE}/admin/features/:id`, async ({ request, params }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    return HttpResponse.json({
      type: 'Feature',
      id: params.id,
      properties: { name: body.name, status: 'draft' },
      geometry: body.geometry,
    })
  }),

  // Publish feature
  http.post(`${API_BASE}/admin/features/:id/publish`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({ status: 'published' })
  }),

  // Publish all
  http.post(`${API_BASE}/admin/features/publish-all`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    return HttpResponse.json({ status: 'all drafts published' })
  }),

  // Delete feature
  http.delete(`${API_BASE}/admin/features/:id`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // Health
  http.get('/health', () => {
    return new HttpResponse('OK', { status: 200 })
  }),
]
