export const state = {
  img: null,
  images: [], // { img, x, y, w, h }
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  regions: [],
  activeRegionId: null,
  nextId: 1,

  // Crop size (set by first drag)
  cropSize: null, // { w, h }

  // Interaction
  tool: 'select',
  dragging: false,
  dragStart: null,
  panStart: null,
  panOffsetStart: null,
  spaceHeld: false,
  movingRegion: null,
  resizingRegion: null,
  resizeHandle: null, // 'nw', 'ne', 'sw', 'se'


  // Grid settings
  gridCellW: 64,
  gridCellH: 64,
  gridCols: 4,

  // Settings
  removeBg: true,
};
