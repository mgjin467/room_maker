// 2D 평면도(도면) 그리기 — PNG 저장·인쇄용
const ELL = new Set(['rtable', 'rugR', 'plant', 'pouf', 'beanbag', 'humid', 'mlamp', 'tlamp', 'flamp', 'uplight', 'tripod', 'barstool', 'basket', 'vase', 'lamp', 'circ', 'fan', 'shelfR', 'mirrorR', 'clock']);
const SWING = new Set(['swing', 'double', 'swingG', 'entrance']);

function rgba(hex, a) {
  const n = parseInt((hex || '#888888').slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawPlan(st, o = {}) {
  const { R, ops, items, lights } = st, W = R.W, D = R.D, T = 12;
  const s = Math.min(4, 1700 / W, 1250 / D), m = Math.round(T * s + 130), cw = Math.round(W * s + 2 * m), ch = Math.round(D * s + 2 * m + 110);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const g = c.getContext('2d');
  const X = x => m + x * s, Y = z => m + z * s;
  const sOf = op => op.wall === 'S' ? W - op.c : op.wall === 'W' ? D - op.c : op.c;
  const NRM = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] };
  const P = (k, sv, n = 0) => { const b = k === 'N' ? [sv, 0] : k === 'E' ? [W, sv] : k === 'S' ? [W - sv, D] : [0, D - sv]; return [X(b[0] + NRM[k][0] * n), Y(b[1] + NRM[k][1] * n)]; };
  const line = (a, b) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };

  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cw, ch);
  g.fillStyle = '#f6f2ea'; g.fillRect(X(0), Y(0), W * s, D * s);
  g.strokeStyle = 'rgba(0,0,0,.06)'; g.lineWidth = 1;
  for (let x = 50; x < W; x += 50) line([X(x), Y(0)], [X(x), Y(D)]);
  for (let z = 50; z < D; z += 50) line([X(0), Y(z)], [X(W), Y(z)]);

  // 가구
  const fs = Math.max(11, Math.min(15, s * 3.6));
  const its = [...items].sort((a, b) => (b.nc ? 1 : 0) - (a.nc ? 1 : 0) || (a.y || 0) - (b.y || 0));
  const labels = [];
  its.forEach(it => {
    const th = (it.rot || 0) * Math.PI / 180, w = it.fw ?? it.w, d = it.d, up = (it.y || 0) > 20 || it.mt === 'w' || it.mt === 'c';
    g.save(); g.translate(X(it.x), Y(it.z)); g.rotate(-th);
    g.fillStyle = rgba(it.color, it.nc ? 0.25 : up ? 0.18 : 0.5);
    g.strokeStyle = up ? 'rgba(40,40,40,.6)' : 'rgba(30,30,30,.85)'; g.lineWidth = 1.4;
    g.setLineDash(up ? [6, 4] : []);
    g.beginPath();
    if (ELL.has(it.type)) g.ellipse(0, 0, w * s / 2, d * s / 2, 0, 0, Math.PI * 2);
    else g.rect(-w * s / 2, -d * s / 2, w * s, d * s);
    g.fill(); g.stroke();
    if (!ELL.has(it.type) && !it.nc && it.mt !== 'w') { g.lineWidth = 2.4; g.setLineDash([]); line([-w * s / 2, -d * s / 2], [w * s / 2, -d * s / 2]); }
    g.restore();
    labels.push(it);
  });
  // 조명
  (lights || []).forEach(l => {
    const p = l.wall ? P(l.wall, l.wall === 'S' ? W - l.c : l.wall === 'W' ? D - l.c : l.c, 3) : [X(l.x), Y(l.z)];
    g.strokeStyle = '#d08a1c'; g.fillStyle = 'rgba(255,200,80,.5)'; g.lineWidth = 1.5; g.setLineDash([]);
    g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.fill(); g.stroke();
    line([p[0] - 5, p[1] - 5], [p[0] + 5, p[1] + 5]); line([p[0] - 5, p[1] + 5], [p[0] + 5, p[1] - 5]);
  });

  // 벽
  g.setLineDash([]);
  const walls = ['N', 'E', 'S', 'W'];
  walls.forEach(k => {
    const len = k === 'N' || k === 'S' ? W : D, ext = k === 'N' || k === 'S' ? T : 0;
    const holes = ops.filter(op => op.wall === k).map(op => [sOf(op) - op.w / 2, sOf(op) + op.w / 2]).sort((a, b) => a[0] - b[0]);
    let a = -ext; const segs = [];
    holes.forEach(([h0, h1]) => { if (h0 > a) segs.push([a, h0]); a = Math.max(a, h1); });
    if (a < len + ext) segs.push([a, len + ext]);
    g.fillStyle = '#2f3033';
    segs.forEach(([s0, s1]) => {
      const p0 = P(k, s0, 0), p1 = P(k, s1, -T);
      g.fillRect(Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]));
    });
  });
  // 창호 기호
  ops.forEach(op => {
    const k = op.wall, sc = sOf(op), a = sc - op.w / 2, b = sc + op.w / 2;
    g.strokeStyle = '#2f3033'; g.lineWidth = 1.5; g.setLineDash([]);
    if (op.kind === 'win') {
      line(P(k, a, 0), P(k, b, 0)); line(P(k, a, -T), P(k, b, -T)); line(P(k, a, 0), P(k, a, -T)); line(P(k, b, 0), P(k, b, -T));
      g.strokeStyle = '#3d7fc4'; g.lineWidth = 2.5; line(P(k, a, -T / 2), P(k, b, -T / 2));
      if (op.st === 'slide' || op.st === 'slide4') { g.lineWidth = 1.5; line(P(k, a, -T * 0.3), P(k, sc + 3, -T * 0.3)); line(P(k, sc - 3, -T * 0.7), P(k, b, -T * 0.7)); }
      return;
    }
    const st = op.st || 'swing', inw = op.sw !== 'out', sg = inw ? 1 : -1, hl = op.hinge !== 'R';
    g.strokeStyle = '#555'; g.lineWidth = 1.5;
    const swingLeaf = (hs, os, lw) => {
      const H = P(k, hs, 0), Cc = P(k, os, 0), O = P(k, hs, sg * lw);
      const vc = [Cc[0] - H[0], Cc[1] - H[1]], vo = [O[0] - H[0], O[1] - H[1]];
      g.lineWidth = 2.2; line(H, O); g.lineWidth = 1; g.setLineDash([5, 4]);
      g.beginPath(); for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI / 2, px = H[0] + Math.cos(t) * vc[0] + Math.sin(t) * vo[0], py = H[1] + Math.cos(t) * vc[1] + Math.sin(t) * vo[1]; i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke(); g.setLineDash([]);
    };
    if (SWING.has(st)) {
      if (st === 'double') { swingLeaf(a, sc, op.w / 2); swingLeaf(b, sc, op.w / 2); }
      else { const lw = st === 'swingG' ? Math.min(op.w, 100) : op.w; swingLeaf(hl ? a : b, hl ? a + lw : b - lw, lw); }
    } else if (st === 'slide' || st === 'jung1') {
      const n0 = 4, n1 = 8; g.strokeStyle = '#555'; g.lineWidth = 1.5;
      const p = [P(k, a, sg * n0), P(k, b, sg * n0), P(k, b, sg * n1), P(k, a, sg * n1)];
      g.beginPath(); p.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke();
    } else if (st === 'jung3') {
      const pw = op.w / 3;
      for (let i = 0; i < 3; i++) { const n0 = 3 + i * 4; const p = [P(k, a + i * pw, n0), P(k, a + (i + 1) * pw, n0), P(k, a + (i + 1) * pw, n0 + 3), P(k, a + i * pw, n0 + 3)]; g.beginPath(); p.forEach((q, j) => j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.closePath(); g.stroke(); }
    } else if (st === 'folding') {
      const n = Math.max(2, Math.round(op.w / 45)), pw = op.w / n; g.beginPath();
      for (let i = 0; i <= n; i++) { const q = P(k, a + i * pw, i % 2 ? sg * 10 : sg * 2); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.stroke();
    } else { g.setLineDash([4, 4]); line(P(k, a, -T / 2), P(k, b, -T / 2)); g.setLineDash([]); }
  });

  // 라벨
  g.textAlign = 'center'; g.textBaseline = 'middle';
  labels.forEach(it => {
    const w = it.fw ?? it.w, minS = Math.min(w, it.d) * s, t1 = it.name, t2 = `${Math.round(w)}×${Math.round(it.d)}`;
    if (minS < 18) return;
    let f = fs; g.font = `600 ${f}px system-ui, sans-serif`;
    while (g.measureText(t1).width > Math.max(w, it.d) * s * 1.1 && f > 9) { f--; g.font = `600 ${f}px system-ui, sans-serif`; }
    const x = X(it.x), y = it.nc ? Y(it.z) + it.d * s / 2 - f * 1.6 : Y(it.z);
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.fillStyle = '#1d1d1f';
    const two = minS > f * 2.6;
    g.strokeText(t1, x, two ? y - f * 0.6 : y); g.fillText(t1, x, two ? y - f * 0.6 : y);
    if (two) { g.font = `${f - 1}px system-ui, sans-serif`; g.fillStyle = '#555'; g.strokeText(t2, x, y + f * 0.65); g.fillText(t2, x, y + f * 0.65); }
  });

  // 치수선
  const dimAt = (k, a, b, off, txt) => {
    const n = -T - off / s, p0 = P(k, a, n), p1 = P(k, b, n);
    g.strokeStyle = '#1d6fd6'; g.fillStyle = '#1d6fd6'; g.lineWidth = 1;
    line(P(k, a, -T - 2 / s), P(k, a, n - 6 / s)); line(P(k, b, -T - 2 / s), P(k, b, n - 6 / s));
    line(p0, p1);
    [p0, p1].forEach(p => line([p[0] - 4, p[1] + 4], [p[0] + 4, p[1] - 4]));
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, vert = Math.abs(p1[1] - p0[1]) > Math.abs(p1[0] - p0[0]);
    g.save(); g.translate(mx, my); if (vert) g.rotate(-Math.PI / 2);
    g.font = '600 12px system-ui, sans-serif'; const tw = g.measureText(txt).width + 6;
    g.fillStyle = '#fff'; g.fillRect(-tw / 2, -8, tw, 16); g.fillStyle = '#1d6fd6'; g.fillText(txt, 0, 0); g.restore();
  };
  walls.forEach(k => {
    const len = k === 'N' || k === 'S' ? W : D, os = ops.filter(op => op.wall === k).map(op => [sOf(op) - op.w / 2, sOf(op) + op.w / 2]).sort((a, b) => a[0] - b[0]);
    if (os.length) { const br = [0]; os.forEach(([a, b]) => br.push(Math.max(0, a), Math.min(len, b))); br.push(len); for (let i = 0; i < br.length - 1; i++) if (br[i + 1] - br[i] > 0.5) dimAt(k, br[i], br[i + 1], 26, `${Math.round(br[i + 1] - br[i])}`); }
    if (k === 'N' || k === 'W') dimAt(k, 0, len, os.length ? 62 : 30, `${Math.round(len)}`);
  });

  // 표제
  const y0 = ch - 92;
  g.strokeStyle = '#ccc'; g.lineWidth = 1; line([30, y0], [cw - 30, y0]);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#1d1d1f';
  g.font = '700 22px system-ui, sans-serif'; g.fillText(o.title || '평면도', 30, y0 + 32);
  const area = W * D / 10000;
  g.font = '14px system-ui, sans-serif'; g.fillStyle = '#555';
  g.fillText(`방 ${W} × ${D} cm · 천장 ${R.H} cm · 면적 ${area.toFixed(2)}㎡ (${(area / 3.3058).toFixed(2)}평) · 가구 ${items.length}개 · 단위 cm`, 30, y0 + 58);
  g.fillText(new Date().toLocaleString('ko-KR'), 30, y0 + 80);
  const bl = 100 * s, bx = cw - 40 - bl;
  g.fillStyle = '#1d1d1f'; g.fillRect(bx, y0 + 40, bl / 2, 6); g.strokeRect(bx, y0 + 40, bl, 6);
  g.textAlign = 'center'; g.fillText('0', bx, y0 + 64); g.fillText('1m', bx + bl, y0 + 64);
  return c;
}
