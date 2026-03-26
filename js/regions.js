import { COLORS } from './config.js';
import { state } from './state.js';

export function createRegion(rect) {
  // Find which image this region covers the most
  let bestImg = state.img;
  let maxArea = 0;
  
  state.images.forEach(imgData => {
    // Check if the center of the rect is within this image's bounds
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    if (cx >= imgData.x && cx <= imgData.x + imgData.w && cy >= imgData.y && cy <= imgData.y + imgData.h) {
      bestImg = imgData.img;
      maxArea = 1; // Mark as found
      return;
    }
    
    const overlapX = Math.max(0, Math.min(rect.x + rect.w, imgData.x + imgData.w) - Math.max(rect.x, imgData.x));
    const overlapY = Math.max(0, Math.min(rect.y + rect.h, imgData.y + imgData.h) - Math.max(rect.y, imgData.y));
    const area = overlapX * overlapY;
    if (area > maxArea) {
      maxArea = area;
      bestImg = imgData.img;
    }
  });

  const color = COLORS[(state.nextId - 1) % COLORS.length];
  const region = {
    id: state.nextId++,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    color,
    img: bestImg,
    flipH: false,
    flipV: false,
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

export function reorderRegion(id, newIndex) {
  const idx = state.regions.findIndex((r) => r.id === id);
  if (idx === -1 || newIndex < 0 || newIndex >= state.regions.length) return;
  const [region] = state.regions.splice(idx, 1);
  state.regions.splice(newIndex, 0, region);
}
