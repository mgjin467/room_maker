// 러그 무늬 — 실제 러그에서 많이 쓰는 종류를 캔버스로 그림 (c1=바탕, c2=포인트, c3=세 번째 색)
export const RUG_PAT = [
  ['solid', '단색 (테두리)'], ['border', '보더 라인'], ['persian', '페르시안 메달리온'], ['oriental', '오리엔탈 (반복 문양)'], ['vintage', '빈티지 워싱 페르시안'],
  ['kilim', '킬림 (지그재그 띠)'], ['beni', '베니 오레인 (모로칸 다이아)'], ['trellis', '트렐리스 (모로칸 격자)'], ['geo', '기하학 (삼각)'], ['diamond', '다이아·아가일'],
  ['stripe', '스트라이프'], ['pinstripe', '얇은 줄무늬'], ['chevron', '쉐브론 (지그재그)'], ['herring', '헤링본'], ['checker', '체크 (바둑판)'], ['plaid', '타탄 체크'], ['grid', '그리드 라인'],
  ['abstract', '추상 (붓터치)'], ['block', '컬러 블록'], ['frame', '이중 프레임 (사각 겹침)'], ['wave', '물결'], ['rings', '동심원'], ['mandala', '만다라'], ['floral', '플라워'],
  ['terrazzo', '테라조 (점·조각)'], ['leopard', '호피 (애니멀)'], ['cow', '카우하이드'], ['shag', '샤기 (긴 털)'], ['jute', '황마·사이잘 (짜임)'], ['loop', '루프 (도톰한 질감)'],
];
export const RUG_SHAPE = [['rect', '직사각형'], ['round', '원형'], ['oval', '타원'], ['hex', '육각형'], ['oct', '팔각형'], ['half', '반달 (현관)']];
const RUG_EN = { solid: 'solid color with a subtle border', border: 'bordered', persian: 'traditional Persian medallion', oriental: 'oriental all-over motif', vintage: 'faded vintage Persian (distressed, washed)', kilim: 'flat-woven kilim with zigzag bands', beni: 'Moroccan Beni Ourain (cream shag with thin dark diamond lattice)', trellis: 'Moroccan trellis / quatrefoil lattice', geo: 'geometric triangles', diamond: 'diamond / argyle', stripe: 'wide stripes', pinstripe: 'pinstripes', chevron: 'chevron zigzag', herring: 'herringbone weave', checker: 'checkerboard', plaid: 'tartan plaid', grid: 'grid lines', abstract: 'abstract brush-stroke art', block: 'color-block', frame: 'nested rectangle frames', wave: 'wavy lines', rings: 'concentric circles', mandala: 'mandala', floral: 'floral', terrazzo: 'terrazzo speckle', leopard: 'leopard print', cow: 'cowhide', shag: 'long-pile shaggy', jute: 'natural jute / sisal weave', loop: 'chunky loop-pile texture' };
export const rugDesc = it => `${RUG_EN[it.rp] || 'plain'} rug${it.rs && it.rs !== 'rect' ? ` (${it.rs} shape)` : ''}, colors ${[it.color, it.c2, it.c3].filter(Boolean).join(' / ')}`;

const sh = (hex, f) => { const n = parseInt((hex || '#888888').slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, c = v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; };
// W×H 캔버스에 무늬 그리기 (실제 러그 크기 cm: wcm×dcm → 무늬 크기를 실제 비율로)
export function drawRug(g, W, H, it, wcm = 200, dcm = 140) {
  const c1 = it.color || '#b9a88f', c2 = it.c2 || sh(c1, 0.6), c3 = it.c3 || sh(c1, 1.35), k = (it.rpsc || 1), px = W / wcm; // px per cm
  let a = (it.id || 7) * 977 + 13; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const U = cm => cm * px * k, f = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const line = (c, lw, pts, close) => { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); g.stroke(); };
  const poly = (c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); };
  const ell = (c, x, y, rx, ry, rot = 0) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, Math.PI * 2); g.fill(); };
  const noise = (n, s0, s1, cols, alpha = 1) => { g.globalAlpha = alpha; for (let i = 0; i < n; i++) ell(cols[(r() * cols.length) | 0], r() * W, r() * H, s0 + r() * (s1 - s0), s0 + r() * (s1 - s0), r() * 3); g.globalAlpha = 1; };
  const borders = (list) => { let o = 0; list.forEach(([wcm2, col]) => { const t = U(wcm2); g.strokeStyle = col; g.lineWidth = t; g.strokeRect(o + t / 2, o + t / 2, W - 2 * o - t, H - 2 * o - t); o += t; }); return o; };
  f(c1, 0, 0, W, H);
  const p = it.rp || 'solid';
  switch (p) {
    case 'solid': noise(W * H / 90, 0.5, 1.5, [sh(c1, 0.93), sh(c1, 1.06)], 0.5); borders([[3, c2]]); break;
    case 'border': borders([[2, c2], [5, c1], [1.5, c2], [6, c1], [1, c3]]); break;
    case 'persian': case 'vintage': {
      const o = borders([[2, sh(c2, 0.7)], [9, c2], [1.5, c3], [3, c1], [1, c3]]);
      for (let x = o; x < W - o; x += U(10)) { ell(c3, x, o - U(10), U(2), U(2)); ell(c3, x, H - o + U(10), U(2), U(2)); }
      for (let y = o; y < H - o; y += U(10)) { ell(c3, o - U(10), y, U(2), U(2)); ell(c3, W - o + U(10), y, U(2), U(2)); }
      const cx = W / 2, cy = H / 2, mw = (W - 2 * o) * 0.36, mh = (H - 2 * o) * 0.36;
      poly(c2, [[cx, cy - mh], [cx + mw, cy], [cx, cy + mh], [cx - mw, cy]]); poly(c3, [[cx, cy - mh * 0.7], [cx + mw * 0.7, cy], [cx, cy + mh * 0.7], [cx - mw * 0.7, cy]]);
      ell(c2, cx, cy, mw * 0.3, mh * 0.3); ell(c1, cx, cy, mw * 0.15, mh * 0.15);
      [[o, o], [W - o, o], [o, H - o], [W - o, H - o]].forEach(([x, y]) => { g.save(); g.translate(x, y); poly(c2, [[0, 0], [mw * 0.6 * Math.sign(cx - x), 0], [0, mh * 0.6 * Math.sign(cy - y)]]); g.restore(); });
      for (let i = 0; i < 90; i++) { const x = o + r() * (W - 2 * o), y = o + r() * (H - 2 * o); ell(r() < 0.5 ? c3 : sh(c2, 1.2), x, y, U(1.2 + r() * 1.5), U(0.8 + r()), r() * 3); }
      if (p === 'vintage') { g.globalAlpha = 0.45; noise(W * H / 160, U(2), U(9), [sh(c1, 1.25), sh(c1, 1.15), '#d9d2c4']); g.globalAlpha = 1; }
      break;
    }
    case 'oriental': { const o = borders([[8, c2], [1.5, c3]]); const s = U(18); for (let y = o + s / 2; y < H - o; y += s) for (let x = o + s / 2 + ((Math.round((y - o) / s)) % 2) * s / 2; x < W - o; x += s) { poly(c2, [[x, y - s * 0.4], [x + s * 0.3, y], [x, y + s * 0.4], [x - s * 0.3, y]]); ell(c3, x, y, s * 0.08, s * 0.08); } break; }
    case 'kilim': { const bh = U(18); for (let y = 0, i = 0; y < H; y += bh, i++) { const col = [c2, c1, c3, c1][i % 4]; f(col, 0, y, W, bh); if (i % 2 === 0) { const s = U(9); for (let x = 0; x < W; x += s * 2) poly(i % 4 === 0 ? c3 : c2, [[x, y + bh * 0.2], [x + s, y + bh * 0.8], [x + s * 2, y + bh * 0.2]]); } } borders([[2, sh(c2, 0.7)]]); break; }
    case 'beni': { noise(W * H / 30, U(0.6), U(1.6), [sh(c1, 0.95), sh(c1, 1.05)], 0.6); const s = U(26); g.lineCap = 'round'; for (let x = -H; x < W + H; x += s) { line(c2, U(1.2), [[x, 0], [x + H, H]]); line(c2, U(1.2), [[x, H], [x + H, 0]]); } break; }
    case 'trellis': { const s = U(22); g.lineWidth = U(2.5); g.strokeStyle = c2; for (let y = 0; y < H + s; y += s) for (let x = 0; x < W + s; x += s) { g.beginPath(); g.arc(x, y, s / 2, 0, Math.PI / 2); g.stroke(); g.beginPath(); g.arc(x + s, y + s, s / 2, Math.PI, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(x + s, y, s / 2, Math.PI / 2, Math.PI); g.stroke(); g.beginPath(); g.arc(x, y + s, s / 2, Math.PI * 1.5, Math.PI * 2); g.stroke(); } borders([[4, c2]]); break; }
    case 'geo': { const s = U(25); for (let y = 0, j = 0; y < H; y += s, j++) for (let x = 0, i = 0; x < W; x += s, i++) { const col = [c1, c2, c3][(i + j * 2) % 3]; poly(col, (i + j) % 2 ? [[x, y], [x + s, y], [x, y + s]] : [[x + s, y], [x + s, y + s], [x, y + s]]); } break; }
    case 'diamond': { const s = U(26); for (let y = -s, j = 0; y < H + s; y += s / 2, j++) for (let x = (j % 2) * s / 2 - s; x < W + s; x += s) poly(j % 4 < 2 ? c2 : c3, [[x, y - s / 2], [x + s / 2, y], [x, y + s / 2], [x - s / 2, y]]); for (let x = -H; x < W + H; x += s) { line(sh(c1, 1.2), U(0.6), [[x, 0], [x + H, H]]); line(sh(c1, 1.2), U(0.6), [[x, H], [x + H, 0]]); } break; }
    case 'stripe': { const s = U(18); for (let x = 0, i = 0; x < W; x += s, i++) f([c1, c2, c1, c3][i % 4], x, 0, s, H); break; }
    case 'pinstripe': { const s = U(6); for (let x = 0; x < W; x += s) f(c2, x, 0, U(0.8), H); borders([[3, c2]]); break; }
    case 'chevron': { const s = U(16); g.lineJoin = 'miter'; for (let y = -s, i = 0; y < H + s; y += s, i++) { const pts = []; for (let x = 0; x <= W + s; x += s) pts.push([x, y + ((x / s) % 2 ? s / 2 : 0)]); line(i % 2 ? c2 : c3, s * 0.42, pts); } break; }
    case 'herring': { const s = U(4), L = U(16); for (let y = -L, j = 0; y < H + L; y += s * 2, j++) for (let x = 0, i = 0; x < W + L; x += L, i++) { g.save(); g.translate(x, y + (i % 2) * s); g.rotate(i % 2 ? -0.6 : 0.6); f((i + j) % 3 ? sh(c1, 0.9) : c2, 0, 0, L, s * 0.8); g.restore(); } break; }
    case 'checker': { const s = U(25); for (let y = 0, j = 0; y < H; y += s, j++) for (let x = 0, i = 0; x < W; x += s, i++) if ((i + j) % 2) f(c2, x, y, s, s); break; }
    case 'plaid': { const s = U(30); g.globalAlpha = 0.55; for (let x = 0; x < W; x += s) { f(c2, x, 0, s * 0.35, H); f(c3, x + s * 0.55, 0, s * 0.08, H); } for (let y = 0; y < H; y += s) { f(c2, 0, y, W, s * 0.35); f(c3, 0, y + s * 0.55, W, s * 0.08); } g.globalAlpha = 1; break; }
    case 'grid': { const s = U(30); for (let x = s; x < W; x += s) f(c2, x, 0, U(1.2), H); for (let y = s; y < H; y += s) f(c2, 0, y, W, U(1.2)); break; }
    case 'abstract': { for (let i = 0; i < 26; i++) { g.globalAlpha = 0.75; g.strokeStyle = [c2, c3, sh(c1, 0.7), sh(c2, 1.3)][i % 4]; g.lineWidth = U(4 + r() * 12); g.lineCap = 'round'; g.beginPath(); let x = r() * W, y = r() * H; g.moveTo(x, y); for (let k2 = 0; k2 < 3; k2++) { x += (r() - 0.5) * W * 0.5; y += (r() - 0.5) * H * 0.5; g.quadraticCurveTo(x + (r() - 0.5) * W * 0.3, y + (r() - 0.5) * H * 0.3, x, y); } g.stroke(); } g.globalAlpha = 1; break; }
    case 'block': { f(c2, 0, 0, W * (0.35 + r() * 0.2), H); f(c3, W * 0.62, H * 0.45, W * 0.38, H * 0.55); f(sh(c1, 0.75), W * 0.22, H * 0.7, W * 0.3, H * 0.3); break; }
    case 'frame': { f(sh(c2, 0.75), 0, 0, W, H); f(c1, U(10), U(10), W - U(20), H - U(20)); f(c2, W * 0.3, H * 0.3, W * 0.4, H * 0.4); break; }
    case 'wave': { g.lineWidth = U(3); for (let y = 0, i = 0; y < H + U(12); y += U(12), i++) { g.strokeStyle = i % 2 ? c2 : c3; g.beginPath(); for (let x = 0; x <= W; x += 4) g.lineTo(x, y + Math.sin(x / U(14)) * U(4)); g.stroke(); } break; }
    case 'rings': { const cx = W / 2, cy = H / 2, R0 = Math.hypot(W, H) / 2; for (let rr = R0, i = 0; rr > 2; rr -= U(10), i++) ell([c1, c2, c3][i % 3], cx, cy, rr, rr * (H / W) * (W / H)); break; }
    case 'mandala': { const cx = W / 2, cy = H / 2, R0 = Math.min(W, H) * 0.48; for (let ring = 0; ring < 5; ring++) { const rr = R0 * (1 - ring * 0.18), n = 8 + ring * 4; for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; ell(ring % 2 ? c2 : c3, cx + Math.cos(t) * rr * 0.85, cy + Math.sin(t) * rr * 0.85, rr * 0.12, rr * 0.06, t); } } ell(c2, cx, cy, R0 * 0.18, R0 * 0.18); ell(c3, cx, cy, R0 * 0.08, R0 * 0.08); g.lineWidth = U(2); g.strokeStyle = c2; g.beginPath(); g.ellipse(cx, cy, R0, R0, 0, 0, Math.PI * 2); g.stroke(); break; }
    case 'floral': { for (let i = 0; i < Math.round(W * H / (U(30) * U(30))); i++) { const x = r() * W, y = r() * H, s = U(5 + r() * 5), col = r() < 0.5 ? c2 : c3; for (let k2 = 0; k2 < 5; k2++) { const t = k2 / 5 * Math.PI * 2; ell(col, x + Math.cos(t) * s * 0.7, y + Math.sin(t) * s * 0.7, s * 0.55, s * 0.35, t); } ell(sh(c1, 0.7), x, y, s * 0.3, s * 0.3); } borders([[3, c2]]); break; }
    case 'terrazzo': noise(W * H / (U(6) * U(6)), U(0.8), U(3), [c2, c3, sh(c1, 0.7), sh(c2, 1.3)]); break;
    case 'leopard': for (let i = 0; i < W * H / (U(9) * U(9)); i++) { const x = r() * W, y = r() * H, s = U(2 + r() * 2.5); ell(c2, x, y, s * 1.3, s, r() * 3); ell(sh(c1, 0.85), x, y, s * 0.6, s * 0.45, r() * 3); } break;
    case 'cow': for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H, s = Math.min(W, H) * (0.08 + r() * 0.12); g.fillStyle = c2; g.beginPath(); for (let k2 = 0; k2 < 10; k2++) { const t = k2 / 10 * Math.PI * 2, rr = s * (0.7 + r() * 0.5); k2 ? g.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr) : g.moveTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } g.closePath(); g.fill(); } break;
    case 'shag': noise(W * H / 6, U(0.3), U(1.4), [sh(c1, 0.82), sh(c1, 1.1), sh(c1, 0.95), c1]); break;
    case 'jute': { const s = U(1.6); for (let y = 0, j = 0; y < H; y += s, j++) for (let x = 0, i = 0; x < W; x += s * 2, i++) f((i + j) % 2 ? sh(c1, 0.82) : sh(c1, 1.08), x + (j % 2) * s, y, s * 1.8, s * 0.85); if (it.c2) borders([[5, c2]]); break; }
    case 'loop': { const s = U(1.4); for (let y = s / 2; y < H; y += s) for (let x = s / 2 + ((y / s) % 2) * s / 2; x < W; x += s) ell(r() < 0.5 ? sh(c1, 0.9) : sh(c1, 1.07), x, y, s * 0.45, s * 0.45); break; }
  }
}
const CACHE = new Map();
export function rugCanvas(it, wcm, dcm, max = 1024) {
  const W = Math.round(Math.min(max, max * wcm / Math.max(wcm, dcm))), H = Math.round(Math.min(max, max * dcm / Math.max(wcm, dcm)));
  const key = [it.rp, it.color, it.c2, it.c3, it.rpsc, it.id, W, H].join('|'); if (CACHE.has(key)) return CACHE.get(key);
  const c = document.createElement('canvas'); c.width = Math.max(8, W); c.height = Math.max(8, H);
  drawRug(c.getContext('2d'), c.width, c.height, it, wcm, dcm);
  if (CACHE.size > 60) CACHE.delete(CACHE.keys().next().value); CACHE.set(key, c); return c;
}
// 무늬 고르기용 작은 미리보기
export function rugThumb(it, k) { const c = document.createElement('canvas'); c.width = 72; c.height = 50; drawRug(c.getContext('2d'), 72, 50, { ...it, rp: k, rpsc: 0.55 }, 200, 140); return c.toDataURL('image/png'); }
