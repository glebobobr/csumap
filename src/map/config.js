export const CAMPUS = {
  // Ваши реальные координаты [longitude, latitude]
  center: [61.318987, 55.177196],

  bounds: [
    [61.310000, 55.172000],   // юго-запад (с запасом)
    [61.330000, 55.183000]    // северо-восток
  ],

  zoom: 17,
  minZoom: 14,
  maxZoom: 21
}

export const BUILDING_COLORS = [
  'match', ['get', 'type'],
  'academic',  '#5B8DB8',
  'dormitory', '#E8A87C',
  'library',   '#85CDCA',
  'sports',    '#7ECB7E',
  'admin',     '#9B97B2',
  'canteen',   '#F0C987',
  'utility',   '#AAAAAA',
  'passage',   '#7BA8D0',
  'transition','#7BA8D0',
  '#CCCCCC'
]

export const COMPLEX_COLORS = {
  building: '#5B8DB8',
  transition: '#7BA8D0',
  gallery: '#8BB5D8'
}

export const POI_COLORS = [
  'match', ['get', 'category'],
  'cafe',      '#E67E22',
  'entrance',  '#2ECC71',
  'bus_stop',  '#3498DB',
  'toilet',    '#95A5A6',
  'library',   '#8E44AD',
  'medical',   '#E74C3C',
  'parking',   '#7F8C8D',
  '#3498DB'
]