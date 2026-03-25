import { CLUSTER_DIST } from './config.js';

/**
 * Collects all edge pixel colors and clusters nearby colors together.
 * Returns the average color of the largest cluster, or null if no cluster
 * covers enough of the edge to be considered a background.
 */
export function detectBgColor(imageData) {
  const { data, width, height } = imageData;

  const edgePixels = [];
  function sample(x, y) {
    const i = (y * width + x) * 4;
    edgePixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  for (let x = 0; x < width; x++) { sample(x, 0); sample(x, height - 1); }
  for (let y = 1; y < height - 1; y++) { sample(0, y); sample(width - 1, y); }

  const clusters = [];
  const distSq = CLUSTER_DIST * CLUSTER_DIST * 3;

  for (const [pr, pg, pb] of edgePixels) {
    let best = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      const ar = c.sumR / c.count;
      const ag = c.sumG / c.count;
      const ab = c.sumB / c.count;
      const d = (pr - ar) ** 2 + (pg - ag) ** 2 + (pb - ab) ** 2;
      if (d < bestDist) { bestDist = d; best = c; }
    }
    if (best && bestDist <= distSq) {
      best.sumR += pr; best.sumG += pg; best.sumB += pb; best.count++;
    } else {
      clusters.push({ sumR: pr, sumG: pg, sumB: pb, count: 1 });
    }
  }

  let biggest = clusters[0];
  for (const c of clusters) { if (c.count > biggest.count) biggest = c; }

  if (biggest.count < edgePixels.length * 0.25) return null;

  return {
    r: Math.round(biggest.sumR / biggest.count),
    g: Math.round(biggest.sumG / biggest.count),
    b: Math.round(biggest.sumB / biggest.count),
  };
}

/**
 * Flood-fill from the edges: only removes background pixels that are
 * connected to the border, so interior pixels of the same color are kept.
 */
export function removeBgColor(imageData, bg, tolerance) {
  const { data, width, height } = imageData;
  const tolSq = tolerance * tolerance * 3;
  const visited = new Uint8Array(width * height);

  function matches(idx) {
    const i = idx * 4;
    const dr = data[i] - bg.r;
    const dg = data[i + 1] - bg.g;
    const db = data[i + 2] - bg.b;
    return dr * dr + dg * dg + db * db <= tolSq;
  }

  const queue = [];
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = (height - 1) * width + x;
    if (matches(top)) { queue.push(top); visited[top] = 1; }
    if (matches(bot)) { queue.push(bot); visited[bot] = 1; }
  }
  for (let y = 1; y < height - 1; y++) {
    const left = y * width;
    const right = y * width + width - 1;
    if (matches(left)) { queue.push(left); visited[left] = 1; }
    if (matches(right)) { queue.push(right); visited[right] = 1; }
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    data[idx * 4 + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;
    const neighbors = [];
    if (x > 0) neighbors.push(idx - 1);
    if (x < width - 1) neighbors.push(idx + 1);
    if (y > 0) neighbors.push(idx - width);
    if (y < height - 1) neighbors.push(idx + width);
    for (const n of neighbors) {
      if (!visited[n] && matches(n)) {
        visited[n] = 1;
        queue.push(n);
      }
    }
  }
}
