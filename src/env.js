// 야외 공간: 지면 텍스처 · 하늘 · 주변 풍경 (산·바다·숲·도시 등)
import * as THREE from 'three';

export const ENVS = [
  ['field', '들판·잔디밭'], ['mountain', '산 (능선)'], ['forest', '숲속'], ['gravel', '자갈 마당'], ['beach', '바다·해변'],
  ['lake', '호숫가'], ['valley', '계곡'], ['sand', '사막·모래언덕'], ['snow', '눈밭·설산'], ['garden', '정원 (잔디+판석)'],
  ['plaza', '도시 광장'], ['rooftop', '루프탑'], ['deckyard', '데크 마당'], ['farm', '시골 논밭'],
];
// 지면 기본색 · 지면 종류
export const ENV_DEF = {
  field: { gc: '#6f9a4a', g: 'grass' }, mountain: { gc: '#728f4f', g: 'grass' }, forest: { gc: '#5b7a3f', g: 'moss' }, gravel: { gc: '#a9a39a', g: 'gravel' },
  beach: { gc: '#e6d3a8', g: 'sand' }, lake: { gc: '#6f9a4a', g: 'grass' }, valley: { gc: '#7b8f55', g: 'grass' }, sand: { gc: '#dcc08a', g: 'dune' },
  snow: { gc: '#f2f5f8', g: 'snow' }, garden: { gc: '#7aa257', g: 'pavers' }, plaza: { gc: '#c9c4bb', g: 'stone' }, rooftop: { gc: '#9a9894', g: 'concrete' },
  deckyard: { gc: '#a0714f', g: 'deck' }, farm: { gc: '#9a8a52', g: 'farm' },
};
export const GROUNDS = [['grass', '잔디'], ['moss', '숲 바닥 (이끼·낙엽)'], ['gravel', '자갈'], ['sand', '모래'], ['dune', '사막 모래'], ['snow', '눈'], ['pavers', '판석 + 잔디'], ['stone', '석재 포장'], ['concrete', '콘크리트'], ['deck', '나무 데크'], ['farm', '흙·밭'], ['soil', '흙']];

const TX = {};
export function groundTex(kind, color) {
  const k = kind + color; if (TX[k]) return TX[k];
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), base = new THREE.Color(color), sh = f => '#' + base.clone().multiplyScalar(f).getHexString(), mix = (to, t) => '#' + base.clone().lerp(new THREE.Color(to), t).getHexString();
  let a = 11; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  g.fillStyle = color; g.fillRect(0, 0, N, N); let u = 200;
  const speck = (n, s0, s1, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const s = s0 + r() * (s1 - s0); g.beginPath(); g.ellipse(r() * N, r() * N, s, s * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill(); } };
  if (kind === 'grass' || kind === 'moss') {
    u = 160; speck(900, 6, 26, [sh(0.88), sh(1.08), sh(0.95), mix('#d8d08a', 0.15)]);
    g.lineWidth = 1.2; for (let i = 0; i < 5000; i++) { const x = r() * N, y = r() * N; g.strokeStyle = r() < 0.5 ? sh(0.75) : sh(1.2); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6); g.stroke(); }
    if (kind === 'moss') speck(260, 2, 7, ['#8a6a3a', '#a0522d', '#6b4f3a', '#c9a45a']);
  } else if (kind === 'gravel') {
    u = 80; for (let i = 0; i < 4200; i++) { const s = 2 + r() * 6; g.fillStyle = [sh(0.78), sh(0.92), sh(1.08), sh(1.18), sh(0.66)][(r() * 5) | 0]; g.beginPath(); g.ellipse(r() * N, r() * N, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'sand' || kind === 'dune') {
    u = kind === 'dune' ? 400 : 220; speck(3000, 0.6, 1.8, [sh(0.92), sh(1.06), sh(0.85)]);
    g.strokeStyle = sh(0.9); g.lineWidth = 2; for (let y = 0; y < N; y += 18) { g.beginPath(); for (let x = 0; x <= N; x += 8) g.lineTo(x, y + Math.sin(x / 40 + y) * 4); g.stroke(); }
  } else if (kind === 'snow') {
    u = 260; speck(1400, 2, 14, ['#ffffff', '#e6edf3', '#dfe8ef']); speck(300, 0.6, 1.4, ['#c9d6e2']);
  } else if (kind === 'pavers' || kind === 'stone') {
    u = kind === 'pavers' ? 220 : 160; const n = kind === 'pavers' ? 4 : 6, s = N / n;
    if (kind === 'pavers') { g.fillStyle = color; g.fillRect(0, 0, N, N); speck(500, 3, 10, [sh(0.85), sh(1.1)]); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const off = kind === 'stone' && j % 2 ? s / 2 : 0, gap = kind === 'pavers' ? 18 : 3; g.fillStyle = kind === 'pavers' ? ['#c9c2b6', '#bdb5a8', '#d3ccc0'][(i + j) % 3] : [sh(1.02), sh(0.94), sh(1.08)][(i * 7 + j) % 3]; g.fillRect(i * s + off + gap / 2, j * s + gap / 2, s - gap, s - gap); }
  } else if (kind === 'concrete') {
    u = 300; speck(2200, 0.6, 3, [sh(0.9), sh(1.08)]); g.strokeStyle = sh(0.8); g.lineWidth = 2; g.strokeRect(1, 1, N - 2, N - 2);
  } else if (kind === 'deck') {
    u = 120; const rows = 8, rh = N / rows; for (let i = 0; i < rows; i++) { g.fillStyle = [sh(1), sh(0.9), sh(1.08), sh(0.95)][i % 4]; g.fillRect(0, i * rh + 2, N, rh - 4); g.strokeStyle = sh(0.8); for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, i * rh + r() * rh); g.lineTo(N, i * rh + r() * rh); g.stroke(); } }
  } else if (kind === 'farm' || kind === 'soil') {
    u = 260; speck(1600, 1, 5, [sh(0.8), sh(1.1), sh(0.9)]);
    if (kind === 'farm') { for (let y = 0; y < N; y += 32) { g.fillStyle = '#6f8f3a'; g.fillRect(0, y + 6, N, 10); for (let x = 0; x < N; x += 6) { g.fillStyle = r() < 0.5 ? '#5f7f2a' : '#8aa64a'; g.fillRect(x, y + 3 + r() * 6, 2, 8); } } }
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return (TX[k] = { tex, u });
}
// 하늘: 세로 그라데이션
const SKY = {};
export function skyTex(time) {
  if (SKY[time]) return SKY[time];
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  const S = { day: [['#3d7cc9', 0], ['#8ab9e6', 0.55], ['#dcebf5', 1]], sunset: [['#2c3e70', 0], ['#c96f8a', 0.45], ['#f6b26b', 0.78], ['#ffe0a3', 1]], night: [['#05070d', 0], ['#0d1630', 0.6], ['#1d2a4a', 1]], dawn: [['#5d7fb8', 0], ['#e9b8c9', 0.6], ['#fde8d0', 1]], cloudy: [['#8a96a3', 0], ['#bcc5cd', 0.6], ['#e3e6e8', 1]] }[time] || [['#3d7cc9', 0], ['#dcebf5', 1]];
  S.forEach(([col, t]) => gr.addColorStop(t, col)); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); return (SKY[time] = t);
}
export const FOGC = { day: 0xcfe0ee, sunset: 0xf1c7a0, night: 0x0f1629, dawn: 0xf1d8d8, cloudy: 0xd3d8dc };

// 주변 풍경 (사이트 바깥) — 가벼운 로우폴리
export function buildEnv(R, BB, time) {
  const G = new THREE.Group(), env = R.env || 'field', cx = BB.x0 + BB.W / 2, cz = BB.z0 + BB.D / 2, rad = Math.max(BB.W, BB.D) / 2;
  let a = 97; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const L = c => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const night = time === 'night', tint = c => night ? new THREE.Color(c).multiplyScalar(0.35).getHex() : c;
  const ringXZ = (r0, r1) => { const ang = r() * Math.PI * 2, d = rad + r0 + r() * (r1 - r0); return [cx + Math.cos(ang) * d, cz + Math.sin(ang) * d]; };
  const mount = (x, z, h, w, col, snowCap) => { const m = new THREE.Mesh(new THREE.ConeGeometry(w, h, 7, 1), L(tint(col))); m.position.set(x, h / 2 - 20, z); m.rotation.y = r() * 3; G.add(m); if (snowCap) { const s = new THREE.Mesh(new THREE.ConeGeometry(w * 0.32, h * 0.32, 7, 1), L(tint(0xf4f6f8))); s.position.set(x, h - h * 0.16 - 20, z); s.rotation.y = m.rotation.y; G.add(s); } };
  const tree = (x, z, s, pine) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(6 * s, 9 * s, 120 * s, 6), L(tint(0x6b4f3a))); t.position.set(x, 60 * s, z); G.add(t); const c = pine ? new THREE.Mesh(new THREE.ConeGeometry(90 * s, 320 * s, 7), L(tint(r() < 0.5 ? 0x2f5d3a : 0x3d6b45))) : new THREE.Mesh(new THREE.IcosahedronGeometry(110 * s, 0), L(tint([0x4f7f3a, 0x5b8a40, 0x3f6f37][(r() * 3) | 0]))); c.position.set(x, pine ? 260 * s : 210 * s, z); G.add(c); };
  const hill = (x, z, w, h, col) => { const m = new THREE.Mesh(new THREE.SphereGeometry(w, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(tint(col))); m.scale.y = h / w; m.position.set(x, -10, z); G.add(m); };
  const water = (x, z, w, d, col = 0x3b7ea8) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), new THREE.MeshLambertMaterial({ color: tint(col), transparent: true, opacity: 0.92 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 1, z); m.userData.water = 1; G.add(m); return m; };
  const bldg = (x, z, w, d, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), L(tint([0xb8bcc2, 0x9aa0a6, 0xd5d1c8, 0x8a8f96][(r() * 4) | 0]))); m.position.set(x, h / 2, z); G.add(m); if (night) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.85), new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: 0.35 })); const toC = Math.atan2(cx - x, cz - z); wm.position.set(x + Math.sin(toC) * (Math.max(w, d) / 2 + 1), h * 0.5, z + Math.cos(toC) * (Math.max(w, d) / 2 + 1)); wm.rotation.y = toC; G.add(wm); } };
  const far = 5200;
  if (['mountain', 'valley', 'snow', 'lake', 'field', 'farm', 'forest'].includes(env)) {
    const n = env === 'mountain' || env === 'valley' || env === 'snow' ? 26 : 12, big = env === 'mountain' || env === 'snow' ? 1.6 : env === 'valley' ? 1.3 : 0.7;
    for (let i = 0; i < n; i++) { const ang = (i / n) * Math.PI * 2 + r() * 0.2, mw = (900 + r() * 900) * big, d = rad * 1.45 + mw + 900 + r() * 1800; if (env === 'valley' && Math.abs(Math.sin(ang)) < 0.35) continue; mount(cx + Math.cos(ang) * d, cz + Math.sin(ang) * d, (1100 + r() * 1700) * big, mw, [0x6f8f5f, 0x5b7a52, 0x7e8f6a, 0x8a8f85][(r() * 4) | 0], env === 'snow' || (env === 'mountain' && r() < 0.5)); }
  }
  if (env === 'field' || env === 'farm' || env === 'garden') for (let i = 0; i < 10; i++) { const w = 700 + r() * 600, [x, z] = ringXZ(w * 1.05 + rad * 0.45 + 400, w + rad * 0.45 + 2400); hill(x, z, w, 120 + r() * 180, env === 'farm' ? 0x9a8a52 : 0x6f9a4a); }
  if (env === 'forest' || env === 'mountain' || env === 'snow' || env === 'lake' || env === 'valley' || env === 'field') {
    const n = env === 'forest' ? 140 : env === 'field' ? 18 : 60, r0 = env === 'forest' ? 150 : 400;
    for (let i = 0; i < n; i++) { const [x, z] = ringXZ(r0, env === 'forest' ? 1800 : 2200); tree(x, z, 0.7 + r() * 0.8, env === 'snow' || env === 'mountain' || (env === 'forest' && r() < 0.5)); }
  }
  if (env === 'beach') { const sz = BB.z0 - 350; water(cx, sz - far * 1.5, far * 4, far * 3, 0x2f7fb0); for (let k = 0; k < 3; k++) { const foam = new THREE.Mesh(new THREE.PlaneGeometry(far * 4, 26 - k * 6), new THREE.MeshBasicMaterial({ color: tint(0xf4f8fb), transparent: true, opacity: 0.75 - k * 0.2 })); foam.rotation.x = -Math.PI / 2; foam.position.set(cx, 1.6, sz - 6 - k * 70); G.add(foam); } for (let i = 0; i < 10; i++) { const x = cx + (r() - 0.5) * 3600, z = BB.z1 + 400 + r() * 1400; tree(x, z, 0.9, false); } }
  if (env === 'lake') water(cx, BB.z0 - 400 - 1100, 3600, 2200, 0x3b7ea8);
  if (env === 'valley') { water(cx, cz, 260, far * 2, 0x4a8fb0).position.x = BB.x1 + 300; for (let i = 0; i < 30; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(30 + r() * 60, 0), L(tint(0x8a8580))); s.position.set(BB.x1 + 160 + r() * 280, 10, cz + (r() - 0.5) * 4000); G.add(s); } }
  if (env === 'sand') for (let i = 0; i < 16; i++) { const w = 600 + r() * 900, [x, z] = ringXZ(w + rad * 0.45 + 300, w + rad * 0.45 + 3000); hill(x, z, w, 150 + r() * 260, 0xd8b97f); }
  if (env === 'plaza' || env === 'rooftop') { for (let i = 0; i < 40; i++) { const [x, z] = ringXZ(rad * 0.5 + (env === 'rooftop' ? 1500 : 1000), rad * 0.5 + 4500); bldg(x, z, 300 + r() * 500, 300 + r() * 500, (env === 'rooftop' ? 600 : 1200) + r() * 3000); } }
  if (env === 'rooftop') { // 난간
    const m = L(tint(0xb9b5ad)), y = 55; [[BB.x0, BB.z0, BB.x1, BB.z0], [BB.x1, BB.z0, BB.x1, BB.z1], [BB.x1, BB.z1, BB.x0, BB.z1], [BB.x0, BB.z1, BB.x0, BB.z0]].forEach(([x0, z0, x1, z1]) => { const len = Math.hypot(x1 - x0, z1 - z0), w = new THREE.Mesh(new THREE.BoxGeometry(len, 110, 15), m); w.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); w.rotation.y = -Math.atan2(z1 - z0, x1 - x0); G.add(w); });
  }
  // 구름 (낮)
  if (!night && time !== 'night') for (let i = 0; i < 14; i++) { const cl = new THREE.Mesh(new THREE.SphereGeometry(200 + r() * 260, 8, 6), new THREE.MeshBasicMaterial({ color: time === 'sunset' ? 0xf7cfae : 0xffffff, transparent: true, opacity: 0.85, fog: false })); cl.scale.set(2.2, 0.45, 1); const [x, z] = ringXZ(2500, 7000); cl.position.set(x, 2400 + r() * 1400, z); G.add(cl); }
  if (night) for (let i = 0; i < 160; i++) { const st = new THREE.Mesh(new THREE.SphereGeometry(6 + r() * 6, 4, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); const ang = r() * Math.PI * 2, el = 0.15 + r() * 1.2, d = 12000; st.position.set(cx + Math.cos(ang) * Math.cos(el) * d, Math.sin(el) * d, cz + Math.sin(ang) * Math.cos(el) * d); G.add(st); }
  return G;
}
