// 방 평면(다각형) 기하 — 좌표: x = 왼쪽→오른쪽, z = 뒤→앞 (cm)
// 꼭짓점은 (0,0)→(W,0)→(W,D)→(0,D) 순서(시계 방향, 화면 기준). 내부 법선 n = (-u.z, u.x)
export const RECT = (W, D) => [[0, 0], [W, 0], [W, D], [0, D]];

export function signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; a += x0 * z1 - x1 * z0; } return a / 2; }
export function orient(pts) { return signedArea(pts) < 0 ? [...pts].reverse() : pts; }

export function edgesOf(pts, bul = {}) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1e-6;
    const u = [dx / len, dz / len], nn = [-u[1], u[0]];
    out.push({ i, a, b, len, u, n: nn, ry: Math.atan2(-u[1], u[0]), rot: Math.atan2(nn[0], nn[1]) * 180 / Math.PI, h: +(bul[i] || 0) });
  }
  return out;
}
// 곡선 벽(활꼴 높이 h, +는 바깥쪽으로 볼록) 위의 점들
export function arcPts(e, seg = 18) {
  if (!e.h || Math.abs(e.h) < 0.5) return [e.a, e.b];
  const L = e.len, s = Math.sign(e.h), hh = Math.abs(e.h), dir = [-e.n[0] * s, -e.n[1] * s];
  const r = (L * L / 4 + hh * hh) / (2 * hh), al = 2 * Math.atan(2 * hh / L);
  const mid = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2], C = [mid[0] + dir[0] * (hh - r), mid[1] + dir[1] * (hh - r)];
  const out = [];
  for (let k = 0; k <= seg; k++) { const f = -al + 2 * al * k / seg; out.push([C[0] + r * (dir[0] * Math.cos(f) + e.u[0] * Math.sin(f)), C[1] + r * (dir[1] * Math.cos(f) + e.u[1] * Math.sin(f))]); }
  out[0] = e.a; out[seg] = e.b; return out;
}
export function outline(edges) { const o = []; edges.forEach(e => { const p = arcPts(e); p.slice(0, -1).forEach(q => o.push(q)); }); return o; }
export function bbox(pts) { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; pts.forEach(([x, z]) => { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }); return { x0, z0, x1, z1, W: x1 - x0, D: z1 - z0 }; }
export function inside(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
export function segDist(e, x, z) { const px = x - e.a[0], pz = z - e.a[1], s = Math.max(0, Math.min(e.len, px * e.u[0] + pz * e.u[1])); return { d: Math.hypot(px - e.u[0] * s, pz - e.u[1] * s), s, t: px * e.n[0] + pz * e.n[1] }; }
export const P = (e, s, off = 0) => [e.a[0] + e.u[0] * s + e.n[0] * off, e.a[1] + e.u[1] * s + e.n[1] * off];
export function isRect(pts, bul) { return pts.length === 4 && !Object.values(bul || {}).some(v => Math.abs(v) > 0.5) && pts.every(([x, z], i) => { const [x1, z1] = pts[(i + 1) % 4]; return Math.abs(x - x1) < 0.01 || Math.abs(z - z1) < 0.01; }); }

// 방 모양 프리셋
export const SHAPES = [
  ['rect', '직사각형'], ['L', 'L자형'], ['Lr', 'ㄱ자형 (반대)'], ['T', 'T자형'], ['U', 'ㄷ자형'], ['cham', '모서리 깎은 방'],
  ['round1', '한쪽 벽 둥글게'], ['roundAll', '모서리 둥근 방'], ['trap', '사다리꼴'], ['hex', '육각형'], ['oct', '팔각형'], ['bay', '돌출창 (베이)'],
];
export function shapePreset(k, W, D) {
  const q = Math.round;
  switch (k) {
    case 'L': return { pts: [[0, 0], [q(W * 0.55), 0], [q(W * 0.55), q(D * 0.45)], [W, q(D * 0.45)], [W, D], [0, D]], bul: {} };
    case 'Lr': return { pts: [[0, 0], [W, 0], [W, D], [q(W * 0.45), D], [q(W * 0.45), q(D * 0.55)], [0, q(D * 0.55)]], bul: {} };
    case 'T': return { pts: [[0, 0], [W, 0], [W, q(D * 0.45)], [q(W * 0.7), q(D * 0.45)], [q(W * 0.7), D], [q(W * 0.3), D], [q(W * 0.3), q(D * 0.45)], [0, q(D * 0.45)]], bul: {} };
    case 'U': return { pts: [[0, 0], [q(W * 0.3), 0], [q(W * 0.3), q(D * 0.4)], [q(W * 0.7), q(D * 0.4)], [q(W * 0.7), 0], [W, 0], [W, D], [0, D]], bul: {} };
    case 'cham': { const c = q(Math.min(W, D) * 0.18); return { pts: [[c, 0], [W - c, 0], [W, c], [W, D - c], [W - c, D], [c, D], [0, D - c], [0, c]], bul: {} }; }
    case 'round1': return { pts: RECT(W, D), bul: { 0: q(D * 0.18) } };
    case 'roundAll': { const c = q(Math.min(W, D) * 0.16), h = q(c * 0.2929 * 1.0); return { pts: [[c, 0], [W - c, 0], [W, c], [W, D - c], [W - c, D], [c, D], [0, D - c], [0, c]], bul: { 1: h, 3: h, 5: h, 7: h } }; }
    case 'trap': return { pts: [[q(W * 0.15), 0], [q(W * 0.85), 0], [W, D], [0, D]], bul: {} };
    case 'hex': { const r = Math.min(W, D) / 2, pts = []; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3 + Math.PI / 6; pts.push([q(W / 2 + Math.cos(a) * W / 2), q(D / 2 + Math.sin(a) * D / 2)]); } void r; return { pts, bul: {} }; }
    case 'oct': { const pts = []; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 - Math.PI / 8 + i * Math.PI / 4; pts.push([q(W / 2 + Math.cos(a) * W / 2 / Math.cos(Math.PI / 8)), q(D / 2 + Math.sin(a) * D / 2 / Math.cos(Math.PI / 8))]); } return { pts, bul: {} }; }
    case 'bay': { const b = q(W * 0.22); return { pts: [[0, 0], [q(W / 2 - b), 0], [q(W / 2 - b * 0.6), -40], [q(W / 2 + b * 0.6), -40], [q(W / 2 + b), 0], [W, 0], [W, D], [0, D]], bul: {} }; }
    default: return { pts: RECT(W, D), bul: {} };
  }
}
