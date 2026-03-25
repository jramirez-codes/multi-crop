import { BG_TOLERANCE } from './config.js';
import { state } from './state.js';
import { detectBgColor, removeBgColor } from './background.js';

export function exportCrops() {
  if (!state.img || state.regions.length === 0) return;

  state.regions.forEach((r) => {
    const w = Math.round(Math.abs(r.w));
    const h = Math.round(Math.abs(r.h));
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cCtx = cropCanvas.getContext('2d');
    cCtx.drawImage(state.img, r.x, r.y, r.w, r.h, 0, 0, w, h);

    if (state.removeBg) {
      const imageData = cCtx.getImageData(0, 0, w, h);
      const bg = detectBgColor(imageData);
      if (bg) {
        removeBgColor(imageData, bg, BG_TOLERANCE);
        cCtx.putImageData(imageData, 0, 0);
      }
    }

    cropCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = (r.name || `region_${r.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      a.href = url;
      a.download = `${name}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
}
