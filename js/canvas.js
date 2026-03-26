import { COLORS, FIT_PADDING, ZOOM_MIN, ZOOM_MAX } from './config.js';
import { state } from './state.js';

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
  if (state.images.length === 0) return;
  
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  
  // Calculate bounding box of all images
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.images.forEach(imgData => {
    minX = Math.min(minX, imgData.x);
    minY = Math.min(minY, imgData.y);
    maxX = Math.max(maxX, imgData.x + imgData.w);
    maxY = Math.max(maxY, imgData.y + imgData.h);
  });
  
  const totalW = maxX - minX;
  const totalH = maxY - minY;
  
  state.scale = Math.min(
    (cw - FIT_PADDING) / totalW,
    (ch - FIT_PADDING) / totalH,
    1,
  );
  
  state.offsetX = (cw - totalW * state.scale) / 2 - minX * state.scale;
  state.offsetY = (ch - totalH * state.scale) / 2 - minY * state.scale;
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

export function getDragRect() {
  const ds = state.dragStart;
  const x = Math.min(ds.x, ds.cx);
  const y = Math.min(ds.y, ds.cy);
  const w = Math.abs(ds.cx - ds.x);
  const h = Math.abs(ds.cy - ds.y);
  return { x, y, w, h };
}

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.images.length === 0) return;

  ctx.save();
  ctx.translate(state.offsetX, state.offsetY);
  ctx.scale(state.scale, state.scale);

  // Draw all images
  state.images.forEach(imgData => {
    ctx.drawImage(imgData.img, imgData.x, imgData.y);
  });

  // Draw existing regions
  state.regions.forEach((r, idx) => {
    // Check if region's image is still in state.images
    if (!state.images.some(imgData => imgData.img === r.img)) return;
    
    const isActive = r.id === state.activeRegionId;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = (isActive ? 2.5 : 1.5) / state.scale;
    ctx.setLineDash(isActive ? [] : [6 / state.scale, 4 / state.scale]);

    ctx.fillStyle = r.color + '22';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    // Number label
    const fontSize = Math.max(12, 14 / state.scale);
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    const label = `${idx + 1}`;
    const tm = ctx.measureText(label);
    const lx = r.x;
    const ly = r.y - 4 / state.scale;
    ctx.fillStyle = r.color;
    const pad = 3 / state.scale;
    ctx.fillRect(lx - pad, ly - fontSize - pad, tm.width + pad * 2, fontSize + pad * 2);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);

    // Resize handles and crosshair for active region
    if (isActive) {
      // Crosshair for active region
      drawCrosshair(ctx, r.x + r.w / 2, r.y + r.h / 2, 20 / state.scale, r.color);

      const handles = getResizeHandles(r);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.5 / state.scale;
      const hs = 8 / state.scale; // Handle size
      
      Object.values(handles).forEach(h => {
        ctx.fillRect(h.x - hs/2, h.y - hs/2, hs, hs);
        ctx.strokeRect(h.x - hs/2, h.y - hs/2, hs, hs);
      });
    }
  });

  // Drawing preview (defining crop size)
  if (state.dragging && state.dragStart && !state.cropSize && !state.movingRegion) {
    const r = getDragRect();
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2 / state.scale;
    ctx.setLineDash([6 / state.scale, 3 / state.scale]);
    ctx.fillStyle = '#e9456022';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);

    // Show dimensions
    const fontSize = Math.max(12, 14 / state.scale);
    ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
    ctx.fillStyle = '#e94560';
    const dimLabel = `${Math.round(r.w)}\u00d7${Math.round(r.h)}`;
    ctx.fillText(dimLabel, r.x, r.y + r.h + fontSize + 4 / state.scale);
  }

  // Stamp preview (crop size is set, hovering)
  if (state.cropSize && state.stampPreview && !state.dragging) {
    const cs = state.cropSize;
    const px = state.stampPreview.x - cs.w / 2;
    const py = state.stampPreview.y - cs.h / 2;
    ctx.strokeStyle = '#e9456088';
    ctx.lineWidth = 1.5 / state.scale;
    ctx.setLineDash([6 / state.scale, 3 / state.scale]);
    ctx.fillStyle = '#e9456015';
    ctx.fillRect(px, py, cs.w, cs.h);
    ctx.strokeRect(px, py, cs.w, cs.h);
    ctx.setLineDash([]);

    // Crosshair in center
    drawCrosshair(ctx, state.stampPreview.x, state.stampPreview.y, 20 / state.scale, '#e94560');
  }

  ctx.restore();
}

export function getResizeHandles(r) {
  return {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    sw: { x: r.x, y: r.y + r.h },
    se: { x: r.x + r.w, y: r.y + r.h }
  };
}

function drawCrosshair(ctx, x, y, size, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 / state.scale;
  ctx.beginPath();
  // Horizontal line
  ctx.moveTo(x - size / 2, y);
  ctx.lineTo(x + size / 2, y);
  // Vertical line
  ctx.moveTo(x, y - size / 2);
  ctx.lineTo(x, y + size / 2);
  ctx.stroke();
  
  // Outer circle for better visibility (optional, but looks premium)
  ctx.beginPath();
  ctx.arc(x, y, size / 4, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.restore();
}
