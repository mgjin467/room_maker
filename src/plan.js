// 2D 평면도(도면) — 다각형/곡선 벽 지원
import { edgesOf, outline, bbox, P as EP, arcPts } from './geom.js';
const ELL = new Set(['rtable', 'rugR', 'plant', 'pouf', 'beanbag', 'humid', 'mlamp', 'tlamp', 'flamp', 'uplight', 'tripod', 'barstool', 'basket', 'vase', 'lamp', 'circ', 'fan', 'shelfR', 'mirrorR', 'clock', 'person']);
const SWING = new Set(['swing', 'double', 'swingG', 'entrance']);
function rgba(hex, a) { const n = parseInt((hex || '#888888').slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

export function drawPlan(st, o = {}) {
  const { R, ops, items, lights } = st, T = 12;
  const E = edgesOf(R.pts, R.bul), OL = outline(E), bb = bbox(OL), W = bb.W, D = bb.D;
  const s = Math.min(4, 1700 / W, 1250 / D), m = Math.round(T * s + 140), cw = Math.round(W * s + 2 * m), ch = Math.round(D * s + 2 * m + 110);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const X = x => m + (x - bb.x0) * s, Y = z => m + (z - bb.z0) * s, PX = p => [X(p[0]), Y(p[1])];
  const line = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  const path = pts => { g.beginPath(); pts.forEach((p, i) => { const q = PX(p); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); };
  const P = (e, sv, n = 0) => PX(EP(e, sv, n));

  g.fillStyle = '#fff'; g.fillRect(0, 0, cw, ch);
  // 벽: 외곽선을 두껍게 그린 뒤 안쪽을 바닥색으로 채워 바깥 띠만 남김
  path(OL); g.lineJoin = 'miter'; g.strokeStyle = '#2f3033'; g.lineWidth = T * s * 2; g.stroke();
  path(OL); g.fillStyle = '#f6f2ea'; g.fill();
  g.save(); path(OL); g.clip(); g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1;
  for (let x = Math.ceil(bb.x0 / 50) * 50; x < bb.x1; x += 50) line([X(x), Y(bb.z0)], [X(x), Y(bb.z1)]);
  for (let z = Math.ceil(bb.z0 / 50) * 50; z < bb.z1; z += 50) line([X(bb.x0), Y(z)], [X(bb.x1), Y(z)]);
  g.restore();

  // 가구
  const fs = Math.max(11, Math.min(15, s * 3.6));
  const its = [...items].sort((a, b) => (b.nc ? 1 : 0) - (a.nc ? 1 : 0) || (a.y || 0) - (b.y || 0));
  its.forEach(it => {
    const th = (it.rot || 0) * Math.PI / 180, w = it.fw ?? it.w, d = it.d, up = (it.y || 0) > 20 || it.mt === 'w' || it.mt === 'c';
    g.save(); g.translate(X(it.x), Y(it.z)); g.rotate(-th);
    g.fillStyle = rgba(it.color, it.nc && it.type !== 'person' ? 0.25 : up ? 0.18 : 0.5);
    g.strokeStyle = up ? 'rgba(40,40,40,.6)' : 'rgba(30,30,30,.85)'; g.lineWidth = 1.4; g.setLineDash(up ? [6, 4] : []);
    g.beginPath();
    if (ELL.has(it.type)) g.ellipse(0, 0, w * s / 2, d * s / 2, 0, 0, Math.PI * 2); else g.rect(-w * s / 2, -d * s / 2, w * s, d * s);
    g.fill(); g.stroke();
    if (!ELL.has(it.type) && !it.nc && it.mt !== 'w') { g.lineWidth = 2.4; g.setLineDash([]); line([-w * s / 2, -d * s / 2], [w * s / 2, -d * s / 2]); }
    g.restore();
  });
  (lights || []).forEach(l => {
    const e = l.wall != null && E[l.wall] ? E[l.wall] : null, p = e ? P(e, l.s, 3) : [X(l.x), Y(l.z)];
    g.strokeStyle = '#d08a1c'; g.fillStyle = 'rgba(255,200,80,.5)'; g.lineWidth = 1.5; g.setLineDash([]);
    g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.fill(); g.stroke();
    line([p[0] - 5, p[1] - 5], [p[0] + 5, p[1] + 5]); line([p[0] - 5, p[1] + 5], [p[0] + 5, p[1] - 5]);
  });

  // 창호
  ops.forEach(op => {
    const e = E[op.wall]; if (!e) return;
    const a = op.s - op.w / 2, b = op.s + op.w / 2, quad = (s0, s1, n0, n1) => { const q = [P(e, s0, n0), P(e, s1, n0), P(e, s1, n1), P(e, s0, n1)]; g.beginPath(); q.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
    quad(a, b, 0.5, -T - 0.5); g.fillStyle = '#fff'; g.fill();
    g.strokeStyle = '#2f3033'; g.lineWidth = 1.5; g.setLineDash([]);
    if (op.kind === 'win') {
      line(P(e, a, 0), P(e, b, 0)); line(P(e, a, -T), P(e, b, -T)); line(P(e, a, 0), P(e, a, -T)); line(P(e, b, 0), P(e, b, -T));
      g.strokeStyle = '#3d7fc4'; g.lineWidth = 2.5; line(P(e, a, -T / 2), P(e, b, -T / 2));
      return;
    }
    const st = op.st || 'swing', sg = op.sw !== 'out' ? 1 : -1, hl = op.hinge !== 'R';
    g.strokeStyle = '#555';
    const swingLeaf = (hs, os, lw) => {
      const H = P(e, hs, 0), Cc = P(e, os, 0), O = P(e, hs, sg * lw), vc = [Cc[0] - H[0], Cc[1] - H[1]], vo = [O[0] - H[0], O[1] - H[1]];
      g.lineWidth = 2.2; line(H, O); g.lineWidth = 1; g.setLineDash([5, 4]); g.beginPath();
      for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI / 2, px = H[0] + Math.cos(t) * vc[0] + Math.sin(t) * vo[0], py = H[1] + Math.cos(t) * vc[1] + Math.sin(t) * vo[1]; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.setLineDash([]);
    };
    g.lineWidth = 1.5;
    if (SWING.has(st)) { if (st === 'double') { swingLeaf(a, op.s, op.w / 2); swingLeaf(b, op.s, op.w / 2); } else { const lw = st === 'swingG' ? Math.min(op.w, 100) : op.w; swingLeaf(hl ? a : b, hl ? a + lw : b - lw, lw); } }
    else if (st === 'slide' || st === 'jung1') { quad(a, b, 4 * sg, 8 * sg); g.stroke(); }
    else if (st === 'jung3') { const pw = op.w / 3; for (let i = 0; i < 3; i++) { quad(a + i * pw, a + (i + 1) * pw, 3 + i * 4, 6 + i * 4); g.stroke(); } }
    else if (st === 'folding') { const n = Math.max(2, Math.round(op.w / 45)), pw = op.w / n; g.beginPath(); for (let i = 0; i <= n; i++) { const q = P(e, a + i * pw, i % 2 ? sg * 10 : sg * 2); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke(); }
    else { g.setLineDash([4, 4]); line(P(e, a, -T / 2), P(e, b, -T / 2)); g.setLineDash([]); }
  });

  // 라벨
  g.textAlign = 'center'; g.textBaseline = 'middle';
  its.forEach(it => {
    const w = it.fw ?? it.w, minS = Math.min(w, it.d) * s, t1 = (it.label ? it.label + ' ' : '') + it.name, t2 = `${Math.round(w)}×${Math.round(it.d)}`;
    if (minS < 18) return;
    let f = fs; g.font = `600 ${f}px system-ui, sans-serif`;
    while (g.measureText(t1).width > Math.max(w, it.d) * s * 1.1 && f > 9) { f--; g.font = `600 ${f}px system-ui, sans-serif`; }
    const x = X(it.x), y = it.nc && it.type !== 'person' ? Y(it.z) + it.d * s / 2 - f * 1.6 : Y(it.z), two = minS > f * 2.6;
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.fillStyle = '#1d1d1f';
    g.strokeText(t1, x, two ? y - f * 0.6 : y); g.fillText(t1, x, two ? y - f * 0.6 : y);
    if (two) { g.font = `${f - 1}px system-ui, sans-serif`; g.fillStyle = '#555'; g.strokeText(t2, x, y + f * 0.65); g.fillText(t2, x, y + f * 0.65); }
  });

  // 치수: 각 벽 길이(+창호 체인)
  const dimAt = (e, a, b, off, txt) => {
    const n = -T - off / s, p0 = P(e, a, n), p1 = P(e, b, n);
    g.strokeStyle = '#1d6fd6'; g.fillStyle = '#1d6fd6'; g.lineWidth = 1;
    line(P(e, a, -T - 2 / s), P(e, a, n - 6 / s)); line(P(e, b, -T - 2 / s), P(e, b, n - 6 / s)); line(p0, p1);
    [p0, p1].forEach(p => line([p[0] - 4, p[1] + 4], [p[0] + 4, p[1] - 4]));
    let ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
    g.save(); g.translate((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2); g.rotate(ang);
    g.font = '600 12px system-ui, sans-serif'; const tw = g.measureText(txt).width + 6;
    g.fillStyle = '#fff'; g.fillRect(-tw / 2, -8, tw, 16); g.fillStyle = '#1d6fd6'; g.textAlign = 'center'; g.fillText(txt, 0, 0); g.restore();
  };
  E.forEach(e => {
    if (Math.abs(e.h) > 0.5) { const ap = arcPts(e), mp = ap[ap.length >> 1], q = PX(mp); g.fillStyle = '#1d6fd6'; g.font = '600 12px system-ui'; g.fillText(`곡선 ${Math.round(e.len)}`, q[0], q[1] - 18); return; }
    const os = ops.filter(op => op.wall === e.i).map(op => [op.s - op.w / 2, op.s + op.w / 2]).sort((a, b) => a[0] - b[0]);
    if (os.length) { const br = [0]; os.forEach(([a, b]) => br.push(Math.max(0, a), Math.min(e.len, b))); br.push(e.len); for (let i = 0; i < br.length - 1; i++) if (br[i + 1] - br[i] > 0.5) dimAt(e, br[i], br[i + 1], 24, `${Math.round(br[i + 1] - br[i])}`); }
    dimAt(e, 0, e.len, os.length ? 58 : 28, `${Math.round(e.len)}`);
  });

  // 표제
  const y0 = ch - 92;
  g.strokeStyle = '#ccc'; g.lineWidth = 1; line([30, y0], [cw - 30, y0]);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d1d1f';
  g.font = '700 22px system-ui, sans-serif'; g.fillText(o.title || '평면도', 30, y0 + 32);
  const area = Math.abs(polyArea(OL)) / 10000;
  g.font = '14px system-ui, sans-serif'; g.fillStyle = '#555';
  g.fillText(`외곽 ${Math.round(W)} × ${Math.round(D)} cm · 천장 ${R.H} cm · 면적 ${area.toFixed(2)}㎡ (${(area / 3.3058).toFixed(2)}평) · 가구 ${items.length}개 · 단위 cm`, 30, y0 + 58);
  g.fillText(new Date().toLocaleString('ko-KR'), 30, y0 + 80);
  const bl = 100 * s, bx = cw - 40 - bl;
  g.fillStyle = '#1d1d1f'; g.fillRect(bx, y0 + 40, bl / 2, 6); g.strokeRect(bx, y0 + 40, bl, 6);
  g.textAlign = 'center'; g.fillText('0', bx, y0 + 64); g.fillText('1m', bx + bl, y0 + 64);
  return c;
}
export function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
