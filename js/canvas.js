import { COLORS, FIT_PADDING, ZOOM_MIN, ZOOM_MAX } from './config.js';
import { state } from './state.js';
import { getHandles } from './regions.js';

let canvas, ctx, container, zoomLevel;

export function initCanvas() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');
  container = document.getElementById('canvas-container');
  zoomLevel = document.getElementById('zoom-level');
}

export function getCanvas() { return canvas; }
export function getCtx() { return ctx; }
export function getContainer() { return container; }

// ---- Coordinate transforms ----

export function screenToImage(sx, sy) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (sx - rect.left - state.offsetX) / state.scale,
    y: (sy - rect.top - state.offsetY) / state.scale,
  };
}

export function imageToScreen(ix, iy) {
  return {
    x: ix * state.scale + state.offsetX,
    y: iy * state.scale + state.offsetY,
  };
}

// ---- View controls ----

export function fitToView() {
  if (!state.img) return;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  state.scale = Math.min(
    (cw - FIT_PADDING) / state.img.width,
    (ch - FIT_PADDING) / state.img.height,
    1,
  );
  state.offsetX = (cw - state.img.width * state.scale) / 2;
  state.offsetY = (ch - state.img.height * state.scale) / 2;
  updateZoomLabel();
}

export function zoomBy(delta, centerX, centerY) {
  const oldScale = state.scale;
  state.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.scale * delta));
  if (centerX !== undefined) {
    state.offsetX = centerX - (centerX - state.offsetX) * (state.scale / oldScale);
    state.offsetY = centerY - (centerY - state.offsetY) * (state.scale / oldScale);
  } else {
    const cw = container.clientWidth / 2;
    const ch = container.clientHeight / 2;
    state.offsetX = cw - (cw - state.offsetX) * (state.scale / oldScale);
    state.offsetY = ch - (ch - state.offsetY) * (state.scale / oldScale);
  }
  updateZoomLabel();
  draw();
}

function updateZoomLabel() {
  zoomLevel.textContent = Math.round(state.scale * 100) + '%';
}

// ---- Drawing ----

export function resizeCanvas() {
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  draw();
}

function getDragRect() {
  const ds = state.dragStart;
  const x = Math.min(ds.x, ds.cx);
  const y = Math.min(ds.y, ds.cy);
  const w = Math.abs(ds.cx - ds.x);
  const h = Math.abs(ds.cy - ds.y);
  return { x, y, w, h };
}

export { getDragRect };

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.img) return;

  ctx.save();
  ctx.translate(state.offsetX, state.offsetY);
  ctx.scale(state.scale, state.scale);

  ctx.drawImage(state.img, 0, 0);

  state.regions.forEach((r) => {
    const isActive = r.id === state.activeRegionId;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = (isActive ? 2.5 : 1.5) / state.scale;
    ctx.setLineDash(isActive ? [] : [6 / state.scale, 4 / state.scale]);

    ctx.fillStyle = r.color + '22';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    // Label
    const fontSize = Math.max(12, 14 / state.scale);
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    const label = r.name || `Region ${r.id}`;
    const tm = ctx.measureText(label);
    const lx = r.x;
    const ly = r.y - 4 / state.scale;
    ctx.fillStyle = r.color;
    const pad = 3 / state.scale;
    ctx.fillRect(lx - pad, ly - fontSize - pad, tm.width + pad * 2, fontSize + pad * 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);

    // Resize handles
    if (isActive) {
      const hs = 6 / state.scale;
      const handles = getHandles(r, hs);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5 / state.scale;
      handles.forEach((h) => {
        ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
        ctx.strokeRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      });
    }
  });

  // Drawing preview
  if (state.dragging && state.dragStart && state.tool === 'select' && !state.resizing && !state.movingRegion) {
    const r = getDragRect();
    ctx.strokeStyle = COLORS[(state.nextId - 1) % COLORS.length];
    ctx.lineWidth = 2 / state.scale;
    ctx.setLineDash([6 / state.scale, 3 / state.scale]);
    ctx.fillStyle = ctx.strokeStyle + '22';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}
