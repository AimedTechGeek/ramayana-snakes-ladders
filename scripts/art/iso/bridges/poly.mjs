// Small convex-polygon helpers for the bridge parts, in the (u, v) plane of a part (u along, v up).

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Drops repeated points and the closing duplicate. */
export function clean(poly, eps = 1e-5) {
  const out = [];
  for (const p of poly) if (!out.length || dist(p, out[out.length - 1]) > eps) out.push(p);
  while (out.length > 1 && dist(out[0], out[out.length - 1]) <= eps) out.pop();
  // Drop points that lie on the line of their neighbours.
  return out.filter((p, i) => {
    const a = out[(i + out.length - 1) % out.length];
    const b = out[(i + 1) % out.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-7;
  });
}

export function area(poly) {
  let sum = 0;
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    sum += p[0] * q[1] - q[0] * p[1];
  });
  return sum / 2;
}

export function centroid(poly) {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

/** Sutherland-Hodgman: `subject` clipped by the convex polygon `clip` (either winding). */
export function clipConvex(subject, clip) {
  const sign = area(clip) >= 0 ? 1 : -1;
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= -1e-9;
    const cut = (p, q) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const t = (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / (ex * dy - ey * dx);
      return [p[0] + dx * t, p[1] + dy * t];
    };
    const next = [];
    out.forEach((p, j) => {
      const q = out[(j + 1) % out.length];
      if (inside(p)) {
        next.push(p);
        if (!inside(q)) next.push(cut(p, q));
      } else if (inside(q)) next.push(cut(p, q));
    });
    out = next;
  }
  return out;
}

/** Interval [u0, u1] of a convex polygon along the horizontal line at height v, or null. */
export function chordAtV(poly, v) {
  const hits = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if ((p[1] - v) * (q[1] - v) <= 0 && p[1] !== q[1])
      hits.push(p[0] + ((q[0] - p[0]) * (v - p[1])) / (q[1] - p[1]));
  });
  return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null;
}

/** Interval [v0, v1] of a convex polygon along the vertical line at u, or null. */
export function chordAtU(poly, u) {
  const hits = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    if ((p[0] - u) * (q[0] - u) <= 0 && p[0] !== q[0])
      hits.push(p[1] + ((q[1] - p[1]) * (u - p[0])) / (q[0] - p[0]));
  });
  return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : null;
}

/** True when the point lies inside the convex polygon (inset by `margin`). */
export function inside(poly, p, margin = 0) {
  const sign = area(poly) >= 0 ? 1 : -1;
  return poly.every((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const cross = sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    return cross >= margin * dist(a, b);
  });
}
