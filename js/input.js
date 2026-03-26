import { MIN_REGION_SIZE } from './config.js';
import { state } from './state.js';
import { getCanvas, getContainer, screenToImage, fitToView, zoomBy, draw, getDragRect, getResizeHandles } from './canvas.js';
import { createRegion, deleteRegion, findRegionAt } from './regions.js';
import { renderSidebar } from './sidebar.js';
import { exportGrid } from './export.js';

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
        const spacing = 40;
        let nextX = 0;
        if (state.images.length > 0) {
          const lastImg = state.images[state.images.length - 1];
          nextX = lastImg.x + lastImg.w + spacing;
        }

        const imgData = {
          img: newImg,
          x: nextX,
          y: 0,
          w: newImg.width,
          h: newImg.height,
        };

        state.images.push(imgData);
        state.img = newImg; // Current image for stamping context

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
    renderSidebar();
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

    // If crop size is set, check if clicking on a resize handle or existing region
    if (state.cropSize) {
      const activeReg = state.regions.find(r => r.id === state.activeRegionId);
      if (activeReg) {
        const handles = getResizeHandles(activeReg);
        const hs = 8 / state.scale;
        for (const [key, h] of Object.entries(handles)) {
          if (Math.abs(pt.x - h.x) < hs && Math.abs(pt.y - h.y) < hs) {
            state.resizingRegion = { id: activeReg.id, handle: key, startPt: pt, startRect: { ...activeReg } };
            state.dragging = true;
            return;
          }
        }
      }

      const hitRegion = findRegionAt(pt);
      if (hitRegion) {
        state.activeRegionId = hitRegion.id;
        state.movingRegion = { id: hitRegion.id, startPt: pt, startRect: { x: hitRegion.x, y: hitRegion.y } };
        state.dragging = true;
        renderSidebar();
        draw();
        return;
      }

      // Stamp a new region at click point
      const cs = state.cropSize;
      const region = createRegion({
        x: pt.x - cs.w / 2,
        y: pt.y - cs.h / 2,
        w: cs.w,
        h: cs.h,
      });
      // Allow immediate dragging of the new stamp
      state.movingRegion = { id: region.id, startPt: pt, startRect: { x: region.x, y: region.y } };
      state.dragging = true;
      renderSidebar();
      draw();
      return;
    }

    // No crop size set yet — start defining it by dragging
    state.activeRegionId = null;
    state.dragging = true;
    state.dragStart = { x: pt.x, y: pt.y, cx: pt.x, cy: pt.y };
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

    if (state.dragging && state.movingRegion) {
      const r = state.regions.find((rg) => rg.id === state.movingRegion.id);
      if (!r) return;
      r.x = state.movingRegion.startRect.x + (pt.x - state.movingRegion.startPt.x);
      r.y = state.movingRegion.startRect.y + (pt.y - state.movingRegion.startPt.y);
      draw();
      renderSidebar();
      return;
    }

    if (state.dragging && state.resizingRegion) {
      const r = state.regions.find((rg) => rg.id === state.resizingRegion.id);
      if (!r) return;
      const dx = pt.x - state.resizingRegion.startPt.x;
      const dy = pt.y - state.resizingRegion.startPt.y;
      const sr = state.resizingRegion.startRect;

      if (state.resizingRegion.handle === 'nw') {
        r.x = sr.x + dx;
        r.y = sr.y + dy;
        r.w = sr.w - dx;
        r.h = sr.h - dy;
      } else if (state.resizingRegion.handle === 'ne') {
        r.y = sr.y + dy;
        r.w = sr.w + dx;
        r.h = sr.h - dy;
      } else if (state.resizingRegion.handle === 'sw') {
        r.x = sr.x + dx;
        r.w = sr.w - dx;
        r.h = sr.h + dy;
      } else if (state.resizingRegion.handle === 'se') {
        r.w = sr.w + dx;
        r.h = sr.h + dy;
      }

      // Minimum size check
      if (r.w < 5) {
        if (state.resizingRegion.handle.includes('w')) {
          r.x = sr.x + sr.w - 5;
        }
        r.w = 5;
      }
      if (r.h < 5) {
        if (state.resizingRegion.handle.includes('n')) {
          r.y = sr.y + sr.h - 5;
        }
        r.h = 5;
      }

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

    // Stamp preview
    if (state.cropSize && state.tool === 'select') {
      state.stampPreview = pt;
      const activeReg = state.regions.find(r => r.id === state.activeRegionId);
      if (activeReg) {
        const handles = getResizeHandles(activeReg);
        const hs = 8 / state.scale;
        for (const [key, h] of Object.entries(handles)) {
          if (Math.abs(pt.x - h.x) < hs && Math.abs(pt.y - h.y) < hs) {
            canvas.style.cursor = (key === 'nw' || key === 'se') ? 'nwse-resize' : 'nesw-resize';
            draw();
            return;
          }
        }
      }

      const hovered = findRegionAt(pt);
      canvas.style.cursor = hovered ? 'move' : 'crosshair';
      draw();
      return;
    }

    // Cursor hints
    if (state.tool === 'select') {
      canvas.style.cursor = 'crosshair';
    }
  });

  canvas.addEventListener('mouseleave', () => {
    state.stampPreview = null;
    draw();
  });

  window.addEventListener('mouseup', () => {
    if (state.panStart) {
      state.panStart = null;
      state.panOffsetStart = null;
      container.classList.remove('panning-active');
      return;
    }

    if (state.dragging && state.dragStart && !state.movingRegion) {
      const r = getDragRect();
      if (r.w > MIN_REGION_SIZE && r.h > MIN_REGION_SIZE) {
        // Set crop size from this first drag
        state.cropSize = { w: Math.round(r.w), h: Math.round(r.h) };
        // Create first region from this drag
        createRegion({
          x: r.x,
          y: r.y,
          w: state.cropSize.w,
          h: state.cropSize.h,
        });
        renderSidebar();
      }
    }

    state.dragging = false;
    state.dragStart = null;
    state.movingRegion = null;
    state.resizingRegion = null;
    state.resizeHandle = null;
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
      exportGrid();
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
    // Escape to reset crop size
    if (e.key === 'Escape') {
      state.cropSize = null;
      state.regions = [];
      state.nextId = 1;
      state.activeRegionId = null;
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

  document.getElementById('save-btn').addEventListener('click', exportGrid);

  // ---- Resize ----

  window.addEventListener('resize', () => resizeCanvas());
}

// Re-export for use externally
import { resizeCanvas } from './canvas.js';
