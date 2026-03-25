import { state } from './state.js';
import { deleteRegion } from './regions.js';
import { draw } from './canvas.js';

let regionList, regionCount, sidebarEmpty;

export function initSidebar() {
  regionList = document.getElementById('region-list');
  regionCount = document.getElementById('region-count');
  sidebarEmpty = document.getElementById('sidebar-empty');
}

export function renderSidebar() {
  regionCount.textContent = state.regions.length;
  sidebarEmpty.style.display = state.regions.length ? 'none' : 'flex';

  regionList.innerHTML = '';
  state.regions.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'region-card' + (r.id === state.activeRegionId ? ' active' : '');
    card.dataset.id = r.id;

    // Preview canvas
    const previewDiv = document.createElement('div');
    previewDiv.className = 'region-preview';
    const pc = document.createElement('canvas');
    const pw = Math.max(1, Math.round(Math.abs(r.w)));
    const ph = Math.max(1, Math.round(Math.abs(r.h)));
    const maxW = 280;
    const maxH = 60;
    const pScale = Math.min(maxW / pw, maxH / ph, 1);
    pc.width = Math.round(pw * pScale);
    pc.height = Math.round(ph * pScale);
    const pCtx = pc.getContext('2d');
    if (state.img) {
      pCtx.drawImage(state.img, r.x, r.y, r.w, r.h, 0, 0, pc.width, pc.height);
    }
    previewDiv.appendChild(pc);

    // Header
    const header = document.createElement('div');
    header.className = 'region-card-header';

    const colorDot = document.createElement('div');
    colorDot.className = 'region-color';
    colorDot.style.background = r.color;

    const nameInput = document.createElement('input');
    nameInput.className = 'region-name-input';
    nameInput.type = 'text';
    nameInput.value = r.name;
    nameInput.placeholder = `Region ${r.id}`;
    nameInput.addEventListener('input', (e) => { r.name = e.target.value; draw(); });
    nameInput.addEventListener('focus', () => {
      state.activeRegionId = r.id;
      draw();
      highlightCard(r.id);
    });

    const dims = document.createElement('span');
    dims.className = 'region-dims';
    dims.textContent = `${Math.round(Math.abs(r.w))}\u00d7${Math.round(Math.abs(r.h))}`;

    const del = document.createElement('button');
    del.className = 'region-delete';
    del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    del.addEventListener('click', () => {
      deleteRegion(r.id);
      renderSidebar();
      draw();
    });

    header.append(colorDot, nameInput, dims, del);
    card.append(previewDiv, header);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.region-delete') || e.target.closest('.region-name-input')) return;
      state.activeRegionId = r.id;
      renderSidebar();
      draw();
    });

    regionList.appendChild(card);
  });
}

function highlightCard(id) {
  document.querySelectorAll('.region-card').forEach((c) => {
    c.classList.toggle('active', parseInt(c.dataset.id) === id);
  });
}
