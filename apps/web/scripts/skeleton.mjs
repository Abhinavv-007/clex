/**
 * Pen strokes from letter outlines.
 *
 * A script font only ships the outline of each letter, but a hand writes a
 * line. This recovers that line: the word is rasterised, thinned down to its
 * one pixel centre line, the centre line is read as a graph (ends, crossings
 * and the runs between them), and the graph is walked the way a pen would go
 * through it: from the leftmost end, straight on through every crossing,
 * lifting only when a run dead-ends. What comes back is a list of smooth
 * strokes, in writing order, in font units.
 *
 * On a monoline script the centre line at a fixed pen width redraws the
 * letter; on a high-contrast italic it is the path a pen would take through
 * it, which is what the handwriting's draw-on mask follows.
 */

/** Curve flattening steps per segment. */
const CURVE_STEPS = 10;

/**
 * @param {{ type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }[]} commands
 * @returns {number[][][]} closed polygons
 */
function flatten(commands) {
  const polys = [];
  let cur = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  for (const c of commands) {
    if (c.type === 'M') {
      if (cur.length > 2) polys.push(cur);
      cur = [[c.x, c.y]];
      cx = sx = c.x; cy = sy = c.y;
    } else if (c.type === 'L') {
      cur.push([c.x, c.y]);
      cx = c.x; cy = c.y;
    } else if (c.type === 'Q') {
      for (let i = 1; i <= CURVE_STEPS; i += 1) {
        const t = i / CURVE_STEPS;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        cur.push([a * cx + b * c.x1 + d * c.x, a * cy + b * c.y1 + d * c.y]);
      }
      cx = c.x; cy = c.y;
    } else if (c.type === 'C') {
      for (let i = 1; i <= CURVE_STEPS; i += 1) {
        const t = i / CURVE_STEPS;
        const a = (1 - t) ** 3;
        const b = 3 * (1 - t) ** 2 * t;
        const e = 3 * (1 - t) * t * t;
        const d = t ** 3;
        cur.push([a * cx + b * c.x1 + e * c.x2 + d * c.x, a * cy + b * c.y1 + e * c.y2 + d * c.y]);
      }
      cx = c.x; cy = c.y;
    } else if (c.type === 'Z') {
      if (cur.length > 2) polys.push(cur);
      cur = [];
      cx = sx; cy = sy;
    }
  }
  if (cur.length > 2) polys.push(cur);
  return polys;
}

/**
 * Non-zero winding scanline fill.
 * @param {number[][][]} polys in pixel space
 * @param {number} W @param {number} H
 */
function rasterise(polys, W, H) {
  const img = new Uint8Array(W * H);
  /** @type {number[][][]} per row: [x, winding] */
  const rows = Array.from({ length: H }, () => []);
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i += 1) {
      const [x0, y0] = poly[i];
      const [x1, y1] = poly[(i + 1) % poly.length];
      if (y0 === y1) continue;
      const dir = y1 > y0 ? 1 : -1;
      const ya = Math.min(y0, y1);
      const yb = Math.max(y0, y1);
      const r0 = Math.max(0, Math.ceil(ya - 0.5));
      const r1 = Math.min(H - 1, Math.ceil(yb - 0.5) - 1);
      for (let r = r0; r <= r1; r += 1) {
        const yc = r + 0.5;
        const x = x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0);
        rows[r].push([x, dir]);
      }
    }
  }
  for (let r = 0; r < H; r += 1) {
    const xs = rows[r].sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i += 1) {
      wind += xs[i][1];
      if (wind === 0) continue;
      const a = Math.max(0, Math.ceil(xs[i][0] - 0.5));
      const b = Math.min(W - 1, Math.ceil(xs[i + 1][0] - 0.5) - 1);
      for (let x = a; x <= b; x += 1) img[r * W + x] = 1;
    }
  }
  return img;
}

/** Chamfer distance to the background, in pixels. */
function distance(img, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < d.length; i += 1) d[i] = img[i] ? INF : 0;
  const A = 1;
  const B = Math.SQRT2;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + A);
      if (y > 0) {
        v = Math.min(v, d[i - W] + A);
        if (x > 0) v = Math.min(v, d[i - W - 1] + B);
        if (x < W - 1) v = Math.min(v, d[i - W + 1] + B);
      }
      d[i] = v;
    }
  }
  for (let y = H - 1; y >= 0; y -= 1) {
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + A);
      if (y < H - 1) {
        v = Math.min(v, d[i + W] + A);
        if (x < W - 1) v = Math.min(v, d[i + W + 1] + B);
        if (x > 0) v = Math.min(v, d[i + W - 1] + B);
      }
      d[i] = v;
    }
  }
  return d;
}

/** Zhang–Suen thinning, in place. */
function thin(img, W, H) {
  const del = [];
  let changed = true;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[y * W + x]);
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass += 1) {
      del.length = 0;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          if (!img[y * W + x]) continue;
          const p2 = at(x, y - 1); const p3 = at(x + 1, y - 1); const p4 = at(x + 1, y);
          const p5 = at(x + 1, y + 1); const p6 = at(x, y + 1); const p7 = at(x - 1, y + 1);
          const p8 = at(x - 1, y); const p9 = at(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k += 1) if (!seq[k] && seq[k + 1]) a += 1;
          if (a !== 1) continue;
          if (pass === 0) {
            if (p2 * p4 * p6 || p4 * p6 * p8) continue;
          } else if (p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(y * W + x);
        }
      }
      if (del.length) changed = true;
      for (const i of del) img[i] = 0;
    }
  }
  // Staircase corners: a pixel whose removal keeps its neighbours connected
  // and that sits in an L of two 4-neighbours is redundant.
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!img[y * W + x]) continue;
      const n = at(x, y - 1); const e = at(x + 1, y); const s = at(x, y + 1); const w = at(x - 1, y);
      const count = n + e + s + w + at(x + 1, y - 1) + at(x + 1, y + 1) + at(x - 1, y + 1) + at(x - 1, y - 1);
      if (count !== 2) continue;
      if ((n && e && !at(x - 1, y + 1)) || (e && s && !at(x - 1, y - 1)) || (s && w && !at(x + 1, y - 1)) || (w && n && !at(x + 1, y + 1))) {
        img[y * W + x] = 0;
      }
    }
  }
}

const N8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
const RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/**
 * Reads the thinned image as a graph of nodes (ends and crossings) and the
 * pixel runs between them.
 */
function graph(img, W, H) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[y * W + x]);
  const kind = new Int8Array(W * H); // 0 plain, 1 end, 3 crossing, 4 isolated
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!img[y * W + x]) continue;
      let n = 0;
      let trans = 0;
      for (let k = 0; k < 8; k += 1) {
        const a = at(x + RING[k][0], y + RING[k][1]);
        const b = at(x + RING[(k + 1) % 8][0], y + RING[(k + 1) % 8][1]);
        n += a;
        if (!a && b) trans += 1;
      }
      kind[y * W + x] = n === 0 ? 4 : trans === 1 && n <= 2 ? 1 : trans >= 3 ? 3 : n === 1 ? 1 : 0;
    }
  }

  // Crossing pixels next to each other are one node.
  const nodeOf = new Int32Array(W * H).fill(-1);
  /** @type {{ x: number, y: number, px: number[], end: boolean }[]} */
  const nodes = [];
  for (let i = 0; i < W * H; i += 1) {
    if (!kind[i] || nodeOf[i] >= 0) continue;
    const id = nodes.length;
    const px = [];
    const stack = [i];
    nodeOf[i] = id;
    const crossing = kind[i] === 3;
    while (stack.length) {
      const j = /** @type {number} */ (stack.pop());
      px.push(j);
      if (!crossing) continue;
      const jx = j % W;
      const jy = (j / W) | 0;
      for (const [dx, dy] of N8) {
        const nx = jx + dx;
        const ny = jy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (kind[k] === 3 && nodeOf[k] < 0) {
          nodeOf[k] = id;
          stack.push(k);
        }
      }
    }
    let sx = 0;
    let sy = 0;
    for (const j of px) { sx += j % W; sy += (j / W) | 0; }
    nodes.push({ x: sx / px.length, y: sy / px.length, px, end: kind[i] === 1 || kind[i] === 4 });
  }

  const seen = new Uint8Array(W * H);
  /** @type {{ a: number, b: number, pts: number[][] }[]} */
  const edges = [];
  const walk = (fromNode, sx, sy) => {
    const pts = [[nodes[fromNode].x, nodes[fromNode].y]];
    let x = sx;
    let y = sy;
    let px = -1;
    let py = -1;
    for (let guard = 0; guard < W * H; guard += 1) {
      const i = y * W + x;
      if (nodeOf[i] >= 0 && nodeOf[i] !== fromNode) {
        const n = nodes[nodeOf[i]];
        pts.push([n.x, n.y]);
        return { b: nodeOf[i], pts };
      }
      if (nodeOf[i] === fromNode) {
        // Came back into the node we started from: a closed loop.
        if (pts.length > 3) {
          pts.push([nodes[fromNode].x, nodes[fromNode].y]);
          return { b: fromNode, pts };
        }
      } else {
        seen[i] = 1;
        pts.push([x, y]);
      }
      let next = null;
      for (const [dx, dy] of N8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx === px && ny === py) continue;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!img[k]) continue;
        if (nodeOf[k] >= 0 && (nodeOf[k] !== fromNode || pts.length > 3)) { next = [nx, ny]; break; }
        if (nodeOf[k] < 0 && !seen[k]) { next = next ?? [nx, ny]; if (Math.abs(dx) + Math.abs(dy) === 1) break; }
      }
      if (!next) return pts.length > 2 ? { b: -1, pts } : null;
      px = x; py = y;
      [x, y] = next;
    }
    return null;
  };

  nodes.forEach((node, id) => {
    for (const j of node.px) {
      const jx = j % W;
      const jy = (j / W) | 0;
      for (const [dx, dy] of N8) {
        const nx = jx + dx;
        const ny = jy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!img[k] || seen[k]) continue;
        if (nodeOf[k] >= 0) {
          // Two nodes touching directly.
          if (nodeOf[k] > id) edges.push({ a: id, b: nodeOf[k], pts: [[node.x, node.y], [nodes[nodeOf[k]].x, nodes[nodeOf[k]].y]] });
          continue;
        }
        const run = walk(id, nx, ny);
        if (!run) continue;
        if (run.b < 0) {
          const last = run.pts[run.pts.length - 1];
          const nid = nodes.length;
          nodes.push({ x: last[0], y: last[1], px: [], end: true });
          run.b = nid;
        }
        edges.push({ a: id, b: run.b, pts: run.pts });
      }
    }
  });

  // Closed rings with no node on them at all.
  for (let i = 0; i < W * H; i += 1) {
    if (!img[i] || seen[i] || nodeOf[i] >= 0) continue;
    const id = nodes.length;
    nodes.push({ x: i % W, y: (i / W) | 0, px: [i], end: false });
    nodeOf[i] = id;
    const x = i % W;
    const y = (i / W) | 0;
    for (const [dx, dy] of N8) {
      const k = (y + dy) * W + (x + dx);
      if (img[k] && !seen[k] && nodeOf[k] < 0) {
        const run = walk(id, x + dx, y + dy);
        if (run && run.b >= 0) edges.push({ a: id, b: run.b, pts: run.pts });
        break;
      }
    }
  }

  return { nodes, edges };
}

const len = (pts) => {
  let s = 0;
  for (let i = 1; i < pts.length; i += 1) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
};

/** Removes the short whiskers thinning leaves at ends and corners. */
function prune(g, minLen) {
  for (let round = 0; round < 3; round += 1) {
    const deg = new Map();
    for (const e of g.edges) {
      deg.set(e.a, (deg.get(e.a) || 0) + 1);
      deg.set(e.b, (deg.get(e.b) || 0) + (e.a === e.b ? 1 : 0) + (e.a === e.b ? 0 : 1));
    }
    const before = g.edges.length;
    g.edges = g.edges.filter((e) => {
      if (e.a === e.b) return true;
      const da = deg.get(e.a) || 0;
      const db = deg.get(e.b) || 0;
      const spur = (da === 1 && db >= 3) || (db === 1 && da >= 3);
      return !(spur && len(e.pts) < minLen);
    });
    // Nodes left with exactly two runs are not crossings any more: join them.
    const inc = new Map();
    g.edges.forEach((e, i) => {
      if (!inc.has(e.a)) inc.set(e.a, []);
      inc.get(e.a).push(i);
      if (e.b !== e.a) {
        if (!inc.has(e.b)) inc.set(e.b, []);
        inc.get(e.b).push(i);
      }
    });
    const dead = new Set();
    for (const [node, list] of inc) {
      if (list.length !== 2) continue;
      const [i, j] = list;
      if (i === j || dead.has(i) || dead.has(j)) continue;
      const ei = g.edges[i];
      const ej = g.edges[j];
      if (ei.a === ei.b || ej.a === ej.b) continue;
      const pi = ei.b === node ? ei.pts : [...ei.pts].reverse();
      const pj = ej.a === node ? ej.pts : [...ej.pts].reverse();
      const a = ei.b === node ? ei.a : ei.b;
      const b = ej.a === node ? ej.b : ej.a;
      g.edges[i] = { a, b, pts: [...pi, ...pj.slice(1)] };
      dead.add(j);
      if (a === node || b === node) continue;
      // Re-point anything else that referenced the joined edge.
      for (const [n2, l2] of inc) {
        if (n2 === node) continue;
        const k = l2.indexOf(j);
        if (k >= 0) l2[k] = i;
      }
    }
    g.edges = g.edges.filter((_, i) => !dead.has(i));
    if (g.edges.length === before && !dead.size) break;
  }
  return g;
}

/** Direction leaving a run's start, measured a little way in. */
function heading(pts, reach) {
  const [x0, y0] = pts[0];
  let travelled = 0;
  for (let i = 1; i < pts.length; i += 1) {
    travelled += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (travelled >= reach || i === pts.length - 1) {
      const dx = pts[i][0] - x0;
      const dy = pts[i][1] - y0;
      const m = Math.hypot(dx, dy) || 1;
      return [dx / m, dy / m];
    }
  }
  return [1, 0];
}

/**
 * Walks the graph in writing order: from the leftmost free end, straight on
 * through crossings, lifting the pen only at a dead end.
 */
function order(g, reach) {
  const used = new Uint8Array(g.edges.length);
  const inc = new Map();
  g.edges.forEach((e, i) => {
    if (!inc.has(e.a)) inc.set(e.a, []);
    inc.get(e.a).push(i);
    if (e.b !== e.a) {
      if (!inc.has(e.b)) inc.set(e.b, []);
      inc.get(e.b).push(i);
    }
  });
  const free = (n) => (inc.get(n) || []).filter((i) => !used[i]);
  const oriented = (i, from) => {
    const e = g.edges[i];
    return e.a === from ? { pts: e.pts, to: e.b } : { pts: [...e.pts].reverse(), to: e.a };
  };

  const strokes = [];
  for (;;) {
    // Start at the leftmost node that still has runs, preferring loose ends.
    let start = -1;
    let best = Infinity;
    for (const [n, list] of inc) {
      const f = list.filter((i) => !used[i]).length;
      if (!f) continue;
      const odd = f % 2 === 1 || g.nodes[n].end;
      const score = g.nodes[n].x - (odd ? 0.5 * reach : 0);
      if (score < best) { best = score; start = n; }
    }
    if (start < 0) break;

    let node = start;
    let dir = [1, 0.15];
    const pts = [];
    for (;;) {
      const options = free(node);
      if (!options.length) break;
      let pick = options[0];
      let bestDot = -Infinity;
      for (const i of options) {
        const o = oriented(i, node);
        const h = heading(o.pts, reach);
        const dot = h[0] * dir[0] + h[1] * dir[1];
        if (dot > bestDot) { bestDot = dot; pick = i; }
      }
      used[pick] = 1;
      const o = oriented(pick, node);
      if (pts.length) pts.push(...o.pts.slice(1));
      else pts.push(...o.pts);
      const back = heading([...o.pts].reverse(), reach);
      dir = [-back[0], -back[1]];
      node = o.to;
    }
    strokes.push(pts);
  }
  return strokes;
}

/** Evenly spaced points along a polyline. */
function resample(pts, step) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const d = Math.hypot(bx - ax, by - ay);
    let t = step - carry;
    while (t <= d) {
      out.push([ax + ((bx - ax) * t) / d, ay + ((by - ay) * t) / d]);
      t += step;
    }
    carry = d - (t - step);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.25) out.push(last);
  else out[out.length - 1] = last;
  return out;
}

/** Gaussian smoothing that keeps the two ends where they are. */
function smooth(pts, radius) {
  if (pts.length < 5 || radius < 1) return pts;
  const w = [];
  for (let k = -radius; k <= radius; k += 1) w.push(Math.exp(-(k * k) / (2 * (radius / 2) ** 2)));
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    let sx = 0;
    let sy = 0;
    let sw = 0;
    const r = Math.min(radius, i, pts.length - 1 - i);
    for (let k = -r; k <= r; k += 1) {
      const q = pts[i + k];
      const wk = w[k + radius];
      sx += q[0] * wk; sy += q[1] * wk; sw += wk;
    }
    return [sx / sw, sy / sw];
  });
}

/** Smooth path data through the points (Catmull–Rom as cubic Béziers). */
function toPath(pts) {
  const r = (n) => Math.round(n);
  if (pts.length === 1) return `M${r(pts[0][0])} ${r(pts[0][1])}h0`;
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/**
 * @param {{ type: string }[]} commands outline of the word, font units, y down
 * @param {{ pxPerStroke?: number, coarse?: number }} [opts] coarse: spacing of the
 *   output points, in strokes (0.7 follows every turn; a mask can be coarser)
 * @returns {{ strokes: { d: string, length: number }[], width: number, maxWidth: number, box: { x1: number, y1: number, x2: number, y2: number } }}
 */
export function penStrokes(commands, opts = {}) {
  const polys = flatten(commands);
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  if (!Number.isFinite(x1)) return { strokes: [], width: 0, maxWidth: 0, box: { x1: 0, y1: 0, x2: 0, y2: 0 } };

  // First pass at a rough scale to measure the pen, then the real one.
  const measure = (scale) => {
    const pad = 4;
    const W = Math.ceil((x2 - x1) * scale) + pad * 2;
    const H = Math.ceil((y2 - y1) * scale) + pad * 2;
    const px = polys.map((p) => p.map(([x, y]) => [(x - x1) * scale + pad, (y - y1) * scale + pad]));
    return { W, H, pad, img: rasterise(px, W, H) };
  };
  const rough = measure(0.12);
  const dist0 = distance(rough.img, rough.W, rough.H);
  const skel0 = rough.img.slice();
  thin(skel0, rough.W, rough.H);
  const widths0 = [];
  for (let i = 0; i < skel0.length; i += 1) if (skel0[i]) widths0.push(dist0[i]);
  widths0.sort((a, b) => a - b);
  const strokeUnits = Math.max(1, ((widths0[Math.floor(widths0.length / 2)] || 1) * 2 - 1) / 0.12);

  const target = opts.pxPerStroke ?? 14;
  const scale = target / strokeUnits;
  const { W, H, pad, img } = measure(scale);
  const dist = distance(img, W, H);
  const skel = img.slice();
  thin(skel, W, H);
  const widths = [];
  for (let i = 0; i < skel.length; i += 1) if (skel[i]) widths.push(dist[i]);
  widths.sort((a, b) => a - b);
  const strokePx = Math.max(2, (widths[Math.floor(widths.length / 2)] || target / 2) * 2 - 1);

  const g = prune(graph(skel, W, H), strokePx * 1.25);
  const walked = order(g, strokePx * 1.4);

  const toUnits = ([x, y]) => [(x - pad) / scale + x1, (y - pad) / scale + y1];
  const strokes = [];
  for (const raw of walked) {
    if (!raw.length) continue;
    let pts = resample(raw, Math.max(1, strokePx * 0.35));
    pts = smooth(pts, 3);
    pts = resample(pts, Math.max(1.5, strokePx * (opts.coarse ?? 0.7)));
    const u = pts.map(toUnits);
    const length = len(u);
    strokes.push({ d: toPath(u.length > 1 && length < strokePx / scale * 0.6 ? [u[0]] : u), length: Math.max(1, length) });
  }
  // The thickest parts of a high-contrast face are far wider than its median
  // stroke; whatever draws over the letters needs to know how wide they get.
  const heavy = Math.max(strokePx, (widths[Math.floor(widths.length * 0.97)] || strokePx / 2) * 2);
  return { strokes, width: strokePx / scale, maxWidth: heavy / scale, box: { x1, y1, x2, y2 } };
}
