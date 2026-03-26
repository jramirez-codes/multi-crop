import { state } from './state.js';
import { deleteRegion, reorderRegion } from './regions.js';
import { draw } from './canvas.js';
import { BG_TOLERANCE } from './config.js';
import { detectBgColor, removeBgColor } from './background.js';

let regionList, regionCount, sidebarEmpty, cropInfo, gridPreviewCanvas, gridPreviewCtx;

export function initSidebar() {
  regionList = document.getElementById('region-list');
  regionCount = document.getElementById('region-count');
  sidebarEmpty = document.getElementById('sidebar-empty');
  cropInfo = document.getElementById('crop-info');
  gridPreviewCanvas = document.getElementById('grid-preview-canvas');
  gridPreviewCtx = gridPreviewCanvas.getContext('2d');

  // Grid settings inputs
  document.getElementById('grid-cell-w').addEventListener('input', (e) => {
    state.gridCellW = Math.max(1, parseInt(e.target.value) || 1);
    renderSidebar();
  });
  document.getElementById('grid-cell-h').addEventListener('input', (e) => {
    state.gridCellH = Math.max(1, parseInt(e.target.value) || 1);
    renderSidebar();
  });
  document.getElementById('grid-cols').addEventListener('input', (e) => {
    state.gridCols = Math.max(1, parseInt(e.target.value) || 1);
    renderSidebar();
  });

  // Reset crop size button
  document.getElementById('reset-crop-btn').addEventListener('click', () => {
    state.cropSize = null;
    state.regions = [];
    state.nextId = 1;
    state.activeRegionId = null;
    renderSidebar();
    draw();
  });
}

export function renderSidebar() {
  regionCount.textContent = state.regions.length;

  // Crop info
  if (state.cropSize) {
    cropInfo.innerHTML = `
      <input type="number" id="global-w" class="dim-input" value="${state.cropSize.w}">
      <span>&times;</span>
      <input type="number" id="global-h" class="dim-input" value="${state.cropSize.h}">
      <span style="font-size:11px; color:var(--text-muted); margin-left:4px">px</span>
    `;
    
    document.getElementById('global-w').addEventListener('change', (e) => {
      state.cropSize.w = Math.max(1, parseInt(e.target.value) || 1);
      draw();
    });
    document.getElementById('global-h').addEventListener('change', (e) => {
      state.cropSize.h = Math.max(1, parseInt(e.target.value) || 1);
      draw();
    });

    cropInfo.classList.add('visible');
    document.getElementById('reset-crop-btn').style.display = '';
    document.getElementById('grid-settings').style.display = '';
  } else {
    cropInfo.textContent = 'Not set';
    cropInfo.classList.remove('visible');
    document.getElementById('reset-crop-btn').style.display = 'none';
    document.getElementById('grid-settings').style.display = 'none';
  }

  const hasRegions = state.regions.length > 0;
  sidebarEmpty.style.display = hasRegions ? 'none' : 'flex';
  sidebarEmpty.textContent = state.cropSize
    ? 'Click on the image to stamp crop regions'
    : 'Drag on the image to define crop size';

  // Region list
  regionList.innerHTML = '';
  if (state.regions.length === 0) {
    sidebarEmpty.style.display = 'flex';
  } else {
    sidebarEmpty.style.display = 'none';
  }

  state.regions.forEach((r, idx) => {
    try {
      const card = document.createElement('div');
      card.className = 'region-card' + (r.id === state.activeRegionId ? ' active' : '');
      card.dataset.id = r.id;
      card.draggable = true;

    // Preview canvas
    const previewDiv = document.createElement('div');
    previewDiv.className = 'region-preview';
    const pc = document.createElement('canvas');
    const pw = Math.max(1, Math.round(Math.abs(r.w)));
    const ph = Math.max(1, Math.round(Math.abs(r.h)));
    const maxW = 280;
    const maxH = 50;
    const pScale = Math.min(maxW / pw, maxH / ph, 1);
    pc.width = Math.round(pw * pScale);
    pc.height = Math.round(ph * pScale);
    const pCtx = pc.getContext('2d');
    if (r.img) {
      try {
        const imgData = state.images.find(i => i.img === r.img);
        const ox = imgData ? imgData.x : 0;
        const oy = imgData ? imgData.y : 0;
        pCtx.drawImage(r.img, r.x - ox, r.y - oy, r.w, r.h, 0, 0, pc.width, pc.height);
      } catch (e) {
        console.error("Error drawing region preview:", e);
      }
    }
    previewDiv.appendChild(pc);

    // Header
    const header = document.createElement('div');
    header.className = 'region-card-header';

    const colorDot = document.createElement('div');
    colorDot.className = 'region-color';
    colorDot.style.background = r.color;

    const orderLabel = document.createElement('span');
    orderLabel.className = 'region-order';
    orderLabel.textContent = `#${idx + 1}`;

    const coords = document.createElement('div');
    coords.className = 'region-dims-group';
    coords.innerHTML = `
      <input type="number" class="dim-input" value="${Math.round(r.w)}">
      <span>&times;</span>
      <input type="number" class="dim-input" value="${Math.round(r.h)}">
    `;

    const [winp, hinp] = coords.querySelectorAll('input');
    winp.addEventListener('change', (e) => {
      r.w = Math.max(1, parseInt(e.target.value) || 1);
      renderSidebar();
      draw();
    });
    hinp.addEventListener('change', (e) => {
      r.h = Math.max(1, parseInt(e.target.value) || 1);
      renderSidebar();
      draw();
    });

    const controls = document.createElement('div');
    controls.className = 'region-controls';

    const flipH = document.createElement('button');
    flipH.className = 'region-btn' + (r.flipH ? ' active' : '');
    flipH.title = 'Flip Horizontal';
    flipH.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 2h10l-4 4-4-4zM7 22h10l-4-4-4 4zM2 7v10l4-4-4-4zM22 7v10l-4-4 4-4z"/></svg>';
    flipH.addEventListener('click', (ev) => {
      ev.stopPropagation();
      r.flipH = !r.flipH;
      renderSidebar();
      draw();
    });

    const flipV = document.createElement('button');
    flipV.className = 'region-btn' + (r.flipV ? ' active' : '');
    flipV.title = 'Flip Vertical';
    flipV.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 7v10l4-4-4-4zM22 7v10l-4-4 4-4zM7 2h10l-4 4-4-4zM7 22h10l-4-4-4 4z" style="transform:rotate(90deg); transform-origin:center;"/></svg>';
    flipV.addEventListener('click', (ev) => {
      ev.stopPropagation();
      r.flipV = !r.flipV;
      renderSidebar();
      draw();
    });

    const dup = document.createElement('button');
    dup.className = 'region-btn';
    dup.title = 'Duplicate Region';
    dup.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
    dup.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const newRegion = { ...r, id: state.nextId++ };
      state.regions.push(newRegion);
      state.activeRegionId = newRegion.id;
      renderSidebar();
      draw();
    });

    const del = document.createElement('button');
    del.className = 'region-delete';
    del.title = 'Delete Region';
    del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    del.addEventListener('click', (ev) => {
      ev.stopPropagation();
      deleteRegion(r.id);
      renderSidebar();
      draw();
    });

    controls.append(flipH, flipV, dup, del);
    header.append(colorDot, orderLabel, coords, controls);
    card.append(previewDiv, header);

    // Click to select
    card.addEventListener('click', () => {
      state.activeRegionId = r.id;
      renderSidebar();
      draw();
    });

    // Drag reorder
    card.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', r.id.toString());
      ev.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });
    card.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-over');
    });
    card.addEventListener('drop', (ev) => {
      ev.preventDefault();
      card.classList.remove('drag-over');
      const dragId = parseInt(ev.dataTransfer.getData('text/plain'));
      const dropIdx = state.regions.findIndex((rg) => rg.id === r.id);
      reorderRegion(dragId, dropIdx);
      renderSidebar();
      draw();
    });

    regionList.appendChild(card);
    } catch (err) {
      console.error("Error rendering region card:", err, r);
    }
  });

  // Update grid preview
  try {
    renderGridPreview();
  } catch (err) {
    console.error("Error rendering grid preview:", err);
  }
}

function renderGridPreview() {
  if (state.regions.length === 0) {
    gridPreviewCanvas.width = 0;
    gridPreviewCanvas.height = 0;
    return;
  }

  const cols = state.gridCols;
  const rows = Math.ceil(state.regions.length / cols);
  const cellW = state.gridCellW;
  const cellH = state.gridCellH;
  const totalW = cols * cellW;
  const totalH = rows * cellH;

  // Fit preview into sidebar width
  const maxPreviewW = 268;
  const previewScale = Math.min(maxPreviewW / totalW, 1);
  gridPreviewCanvas.width = Math.round(totalW * previewScale);
  gridPreviewCanvas.height = Math.round(totalH * previewScale);

  gridPreviewCtx.fillStyle = '#111';
  gridPreviewCtx.fillRect(0, 0, gridPreviewCanvas.width, gridPreviewCanvas.height);

  state.regions.forEach((r, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const dx = col * cellW * previewScale;
    const dy = row * cellH * previewScale;
    const dw = cellW * previewScale;
    const dh = cellH * previewScale;

    if (r.img) {
      gridPreviewCtx.save();
      
      // Calculate fit dimensions
      const aspect = r.w / r.h;
      const cellAspect = cellW / cellH;
      let targetW, targetH;
      
      if (aspect > cellAspect) {
        targetW = dw;
        targetH = dw / aspect;
      } else {
        targetH = dh;
        targetW = dh * aspect;
      }
      
      const ox = dx + (dw - targetW) / 2;
      const oy = dy + (dh - targetH) / 2;

      gridPreviewCtx.translate(ox + targetW / 2, oy + targetH / 2);
      if (r.flipH) gridPreviewCtx.scale(-1, 1);
      if (r.flipV) gridPreviewCtx.scale(1, -1);
      
      const imgData = state.images.find(i => i.img === r.img);
      const ox_img = imgData ? imgData.x : 0;
      const oy_img = imgData ? imgData.y : 0;
      
      gridPreviewCtx.drawImage(r.img, r.x - ox_img, r.y - oy_img, r.w, r.h, -targetW / 2, -targetH / 2, targetW, targetH);
      gridPreviewCtx.restore();
    }

    // Grid lines
    gridPreviewCtx.strokeStyle = '#444';
    gridPreviewCtx.lineWidth = 1;
    gridPreviewCtx.strokeRect(dx, dy, dw, dh);
  });
}

function highlightCard(id) {
  document.querySelectorAll('.region-card').forEach((c) => {
    c.classList.toggle('active', parseInt(c.dataset.id) === id);
  });
}
