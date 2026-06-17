import MapboxDraw from '@mapbox/mapbox-gl-draw'

const DrawPolygonMode = {}

DrawPolygonMode.onSetup = function() {
    const polygon = this.newFeature({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [[]]
        }
    })

    this.addFeature(polygon)
    this.clearSelectedFeatures()
    this.updateUIClasses({ mouse: 'add' })
    this.setActionableState({ trash: true })

    return {
        polygon,
        currentVertexPosition: 0,
        previewPosition: null
    }
}

DrawPolygonMode.onMouseMove = function(state, e) {
    state.previewPosition = [e.lngLat.lng, e.lngLat.lat]
    state.polygon.setCoordinates(state.polygon.coordinates)
}

DrawPolygonMode.onClick = function(state, e) {
    state.polygon.coordinates[0].push([e.lngLat.lng, e.lngLat.lat])
    state.currentVertexPosition++
}

DrawPolygonMode.onKeyUp = function(state, e) {
    if (e.keyCode === 13) {
        return this.completePolygon(state)
    }
    if (e.keyCode === 27) {
        this.deleteFeature([state.polygon.id], { silent: true })
        return this.changeMode('simple_select')
    }
}

DrawPolygonMode.onStop = function(state) {
    this.updateUIClasses({ mouse: 'none' })
    const coords = state.polygon.coordinates[0]
    if (coords.length < 3) {
        this.deleteFeature([state.polygon.id], { silent: true })
    }
}

DrawPolygonMode.completePolygon = function(state) {
    const coords = state.polygon.coordinates[0]

    if (coords.length < 3) {
        return
    }

    if (coords[0][0] !== coords[coords.length - 1][0] ||
        coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0])
    }

    this.map.fire('draw.create', {
        features: [state.polygon.toGeoJSON()]
    })

    return this.changeMode('simple_select', { featureIds: [state.polygon.id] })
}

DrawPolygonMode.toDisplayFeatures = function(state, geojson, display) {
    const isActivePolygon = geojson.properties.id === state.polygon.id
    geojson.properties.active = isActivePolygon ? 'true' : 'false'

    if (!isActivePolygon || !state.previewPosition) {
        display(geojson)
        return
    }

    const coords = state.polygon.coordinates[0]
    if (coords.length === 0) return

    const displayCoords = [...coords, state.previewPosition]
    if (displayCoords.length >= 3) {
        displayCoords.push(displayCoords[0])
    }

    display({
        type: 'Feature',
        properties: geojson.properties,
        geometry: {
            type: 'Polygon',
            coordinates: [displayCoords]
        }
    })
}

DrawPolygonMode.onTrash = function(state) {
    this.deleteFeature([state.polygon.id], { silent: true })
    this.changeMode('simple_select')
}

export default DrawPolygonMode
