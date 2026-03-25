export const state = {
  img: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  regions: [],
  activeRegionId: null,
  nextId: 1,

  // Interaction
  tool: 'select',
  dragging: false,
  dragStart: null,
  panStart: null,
  panOffsetStart: null,
  spaceHeld: false,
  resizing: null,
  movingRegion: null,

  // Settings
  removeBg: true,
};
