import { BG_TOLERANCE } from './config.js';
import { state } from './state.js';
import { detectBgColor, removeBgColor } from './background.js';

export function exportGrid() {
  if (state.regions.length === 0) return;

  const cols = state.gridCols;
  const rows = Math.ceil(state.regions.length / cols);
  const cellW = state.gridCellW;
  const cellH = state.gridCellH;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = cols * cellW;
  exportCanvas.height = rows * cellH;
  const ctx = exportCanvas.getContext('2d');

  state.regions.forEach((r, idx) => {
    if (!r.img) return;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const dx = col * cellW;
    const dy = row * cellH;

    // Draw to a temp canvas first for bg removal and fit/flip logic
    const sw = Math.round(Math.abs(r.w));
    const sh = Math.round(Math.abs(r.h));
    const tCanvas = document.createElement('canvas');
    tCanvas.width = sw;
    tCanvas.height = sh;
    const tCtx = tCanvas.getContext('2d');
    
    // Find image offset
    const imgData = state.images.find(i => i.img === r.img);
    const imgOffsetX = imgData ? imgData.x : 0;
    const imgOffsetY = imgData ? imgData.y : 0;
    
    tCtx.drawImage(r.img, r.x - imgOffsetX, r.y - imgOffsetY, r.w, r.h, 0, 0, sw, sh);

    if (state.removeBg) {
      const imageData = tCtx.getImageData(0, 0, sw, sh);
      const bg = detectBgColor(imageData);
      if (bg) {
        removeBgColor(imageData, bg, BG_TOLERANCE);
        tCtx.putImageData(imageData, 0, 0);
      }
    }

    // Now draw tCanvas to exportCanvas with fit and flip
    ctx.save();
    
    // Calculate fit dimensions
    const aspect = sw / sh;
    const cellAspect = cellW / cellH;
    let targetW, targetH;
    
    if (aspect > cellAspect) {
      targetW = cellW;
      targetH = cellW / aspect;
    } else {
      targetH = cellH;
      targetW = cellH * aspect;
    }
    
    const ox = dx + (cellW - targetW) / 2;
    const oy = dy + (cellH - targetH) / 2;

    ctx.translate(ox + targetW / 2, oy + targetH / 2);
    if (r.flipH) ctx.scale(-1, 1);
    if (r.flipV) ctx.scale(1, -1);
    
    ctx.drawImage(tCanvas, 0, 0, sw, sh, -targetW / 2, -targetH / 2, targetW, targetH);
    ctx.restore();
  });

  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spritesheet_${cols}x${rows}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
