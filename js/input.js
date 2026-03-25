import { MIN_REGION_SIZE } from './config.js';
import { state } from './state.js';
import { getCanvas, getContainer, screenToImage, fitToView, zoomBy, draw, getDragRect } from './canvas.js';
import { getHandles, createRegion, deleteRegion, findRegionAt, findHandleAt } from './regions.js';
import { renderSidebar } from './sidebar.js';
import { exportCrops } from './export.js';

export function initInput() {
  const canvas = getCanvas();
  const container = getContainer();
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const toolBtns = document.querySelectorAll('.tool-btn');
  const removeBgToggle = document.getElementById('remove-bg-toggle');

  // ---- Image loading ----

  function loadImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newImg = new Image();
      newImg.onload = () => {
        state.img = newImg;
        state.regions = [];
        state.nextId = 1;
        state.activeRegionId = null;
        fitToView();
        dropZone.classList.remove('visible');
        renderSidebar();
        draw();
      };
      newImg.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadImage(e.target.files[0]);
  });

  // Drag & drop
  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('visible');
  });
  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) dropZone.classList.remove('visible');
    if (state.img) dropZone.classList.remove('visible');
  });
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('visible');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  });

  // Clipboard paste
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        loadImage(item.getAsFile());
        return;
      }
    }
  });

  // ---- Tool switching ----

  toolBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tool = btn.dataset.tool;
      toolBtns.forEach((b) => b.classList.toggle('active', b === btn));
      container.classList.toggle('panning', state.tool === 'pan');
    });
  });

  // ---- Remove background toggle ----

  removeBgToggle.checked = state.removeBg;
  removeBgToggle.addEventListener('change', () => {
    state.removeBg = removeBgToggle.checked;
  });

  // ---- Zoom ----

  document.getElementById('zoom-in').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoomBy(0.8));
  document.getElementById('zoom-fit').addEventListener('click', () => { fitToView(); draw(); });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    zoomBy(delta, cx, cy);
  }, { passive: false });

  // ---- Mouse interaction ----

  canvas.addEventListener('mousedown', (e) => {
    if (!state.img) return;
    const pt = screenToImage(e.clientX, e.clientY);

    // Pan with middle click or space
    if (e.button === 1 || (state.tool === 'pan' && e.button === 0) || state.spaceHeld) {
      state.panStart = { x: e.clientX, y: e.clientY };
      state.panOffsetStart = { x: state.offsetX, y: state.offsetY };
      container.classList.add('panning-active');
      e.preventDefault();
      return;
    }

    if (state.tool !== 'select' || e.button !== 0) return;

    // Check resize handles on active region
    const handleHit = findHandleAt(pt);
    if (handleHit) {
      state.resizing = {
        id: handleHit.region.id,
        handle: handleHit.handle.edge,
        startRect: { ...handleHit.region },
        startPt: pt,
      };
      state.dragging = true;
      return;
    }

    // Check if clicking inside an existing region to move it
    const hitRegion = findRegionAt(pt);
    if (hitRegion) {
      state.activeRegionId = hitRegion.id;
      state.movingRegion = { id: hitRegion.id, startPt: pt, startRect: { x: hitRegion.x, y: hitRegion.y } };
      state.dragging = true;
      renderSidebar();
      draw();
      return;
    }

    // Start new selection
    state.activeRegionId = null;
    state.dragging = true;
    state.dragStart = { x: pt.x, y: pt.y, cx: pt.x, cy: pt.y };
    renderSidebar();
    draw();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.img) return;

    // Panning
    if (state.panStart) {
      state.offsetX = state.panOffsetStart.x + (e.clientX - state.panStart.x);
      state.offsetY = state.panOffsetStart.y + (e.clientY - state.panStart.y);
      draw();
      return;
    }

    const pt = screenToImage(e.clientX, e.clientY);

    if (state.dragging && state.resizing) {
      const r = state.regions.find((rg) => rg.id === state.resizing.id);
      if (!r) return;
      const sr = state.resizing.startRect;
      const dx = pt.x - state.resizing.startPt.x;
      const dy = pt.y - state.resizing.startPt.y;
      const edge = state.resizing.handle;

      if (edge.includes('l')) { r.x = sr.x + dx; r.w = sr.w - dx; }
      if (edge.includes('r')) { r.w = sr.w + dx; }
      if (edge.includes('t')) { r.y = sr.y + dy; r.h = sr.h - dy; }
      if (edge.includes('b')) { r.h = sr.h + dy; }

      if (r.w < 0) { r.x += r.w; r.w = -r.w; }
      if (r.h < 0) { r.y += r.h; r.h = -r.h; }

      draw();
      renderSidebar();
      return;
    }

    if (state.dragging && state.movingRegion) {
      const r = state.regions.find((rg) => rg.id === state.movingRegion.id);
      if (!r) return;
      r.x = state.movingRegion.startRect.x + (pt.x - state.movingRegion.startPt.x);
      r.y = state.movingRegion.startRect.y + (pt.y - state.movingRegion.startPt.y);
      draw();
      renderSidebar();
      return;
    }

    if (state.dragging && state.dragStart) {
      state.dragStart.cx = pt.x;
      state.dragStart.cy = pt.y;
      draw();
      return;
    }

    // Cursor hints
    if (state.tool === 'select') {
      const handleHit = findHandleAt(pt);
      if (handleHit) {
        canvas.style.cursor = handleHit.handle.cursor;
        return;
      }
      const hovered = findRegionAt(pt);
      canvas.style.cursor = hovered ? 'move' : 'crosshair';
    }
  });

  window.addEventListener('mouseup', () => {
    if (state.panStart) {
      state.panStart = null;
      state.panOffsetStart = null;
      container.classList.remove('panning-active');
      return;
    }

    if (state.dragging && state.dragStart && !state.resizing && !state.movingRegion) {
      const r = getDragRect();
      if (r.w > MIN_REGION_SIZE && r.h > MIN_REGION_SIZE) {
        const region = createRegion(r);
        renderSidebar();
        setTimeout(() => {
          const input = document.querySelector(`.region-card[data-id="${region.id}"] .region-name-input`);
          if (input) input.focus();
        }, 50);
      }
    }

    state.dragging = false;
    state.dragStart = null;
    state.resizing = null;
    state.movingRegion = null;
    draw();
  });

  // ---- Keyboard ----

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      exportCrops();
      return;
    }

    if (e.key === ' ') {
      e.preventDefault();
      state.spaceHeld = true;
      container.classList.add('panning');
    }
    if (e.key === 's' || e.key === 'S') {
      state.tool = 'select';
      toolBtns.forEach((b) => b.classList.toggle('active', b.dataset.tool === 'select'));
      container.classList.remove('panning');
    }
    if (e.key === 'f' || e.key === 'F') { fitToView(); draw(); }
    if (e.key === '=' || e.key === '+') zoomBy(1.25);
    if (e.key === '-') zoomBy(0.8);
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.activeRegionId) {
      deleteRegion(state.activeRegionId);
      renderSidebar();
      draw();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      state.spaceHeld = false;
      if (state.tool !== 'pan') container.classList.remove('panning');
    }
  });

  // ---- Export button ----

  document.getElementById('save-btn').addEventListener('click', exportCrops);

  // ---- Resize ----

  window.addEventListener('resize', () => resizeCanvas());
}

// Re-export for use externally
import { resizeCanvas } from './canvas.js';
