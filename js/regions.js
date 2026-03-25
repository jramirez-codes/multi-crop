import { COLORS } from './config.js';
import { state } from './state.js';

export function getHandles(r, hs) {
  return [
    { x: r.x, y: r.y, cursor: 'nwse-resize', edge: 'tl' },
    { x: r.x + r.w, y: r.y, cursor: 'nesw-resize', edge: 'tr' },
    { x: r.x, y: r.y + r.h, cursor: 'nesw-resize', edge: 'bl' },
    { x: r.x + r.w, y: r.y + r.h, cursor: 'nwse-resize', edge: 'br' },
    { x: r.x + r.w / 2, y: r.y, cursor: 'ns-resize', edge: 't' },
    { x: r.x + r.w / 2, y: r.y + r.h, cursor: 'ns-resize', edge: 'b' },
    { x: r.x, y: r.y + r.h / 2, cursor: 'ew-resize', edge: 'l' },
    { x: r.x + r.w, y: r.y + r.h / 2, cursor: 'ew-resize', edge: 'r' },
  ];
}

export function createRegion(rect) {
  const color = COLORS[(state.nextId - 1) % COLORS.length];
  const region = {
    id: state.nextId++,
    name: '',
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    color,
  };
  state.regions.push(region);
  state.activeRegionId = region.id;
  return region;
}

export function deleteRegion(id) {
  state.regions = state.regions.filter((r) => r.id !== id);
  if (state.activeRegionId === id) state.activeRegionId = null;
}

export function findRegionAt(pt) {
  for (let i = state.regions.length - 1; i >= 0; i--) {
    const r = state.regions[i];
    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) {
      return r;
    }
  }
  return null;
}

export function findHandleAt(pt) {
  const active = state.regions.find((r) => r.id === state.activeRegionId);
  if (!active) return null;
  const hs = 8 / state.scale;
  const handles = getHandles(active, hs);
  for (const h of handles) {
    if (Math.abs(pt.x - h.x) < hs && Math.abs(pt.y - h.y) < hs) {
      return { region: active, handle: h };
    }
  }
  return null;
}
