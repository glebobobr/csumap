import MapboxDraw from '@mapbox/mapbox-gl-draw'

const builtin = MapboxDraw.modes.simple_select
const SimpleSelectMode = { ...builtin }

SimpleSelectMode.clickOnFeature = function(state, e) {
  this.stopExtendedInteractions(state)

  const isShiftClick = e.originalEvent.shiftKey
  const isCtrlClick = e.originalEvent.ctrlKey || e.originalEvent.metaKey
  const isAdditive = isShiftClick || isCtrlClick
  const selectedFeatureIds = this.getSelectedIds()
  const featureId = e.featureTarget.properties.id
  const isFeatureSelected = this.isSelected(featureId)

  if (!isAdditive && isFeatureSelected && this.getFeature(featureId).type !== 'Point') {
    return this.changeMode('direct_select', { featureId })
  }

  if (isFeatureSelected && isAdditive) {
    this.deselect(featureId)
    this.updateUIClasses({ mouse: 'pointer' })
  } else if (!isFeatureSelected && isAdditive) {
    this.select(featureId)
    this.updateUIClasses({ mouse: 'move' })
  } else if (!isFeatureSelected && !isAdditive) {
    selectedFeatureIds.forEach(id => this.doRender(id))
    this.setSelected(featureId)
    this.updateUIClasses({ mouse: 'move' })
  }

  this.doRender(featureId)
}

export default SimpleSelectMode
