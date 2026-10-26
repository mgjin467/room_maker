import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAT } from './catalog.js';
import { buildParts, LEAF, NOPT, DEFA, TYPES, PV, LAMPS } from './builders.js';
import { buildOpening, buildLight, WIN_ST, DOOR_ST, LKIND, kelvin, FCOLS, CURT, SWING, TEMPS, disposeTree } from './fixtures.js';
import { drawPlan } from './plan.js';

const $ = id => document.getElementById(id);
const PI = Math.PI, rd = Math.round, r1 = v => Math.round(v * 10) / 10, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WALLS = ['N', 'E', 'S', 'W'];
const WALLN = { N: '뒷벽', E: '오른쪽 벽', S: '앞벽 (입구쪽)', W: '왼쪽 벽' };
const WRY = { N: 0, E: -PI / 2, S: PI, W: PI / 2 };
const WROT = { N: 0, W: 90, S: 180, E: 270 };
const NRM = { N: [0, 1], E: [-1, 0], S: [0, -1], W: [1, 0] };
const MAXL = 12;
const WHITE = new THREE.Color(0xffffff), BLACK = new THREE.Color(0);

// ---------- 저장소 ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('브라우저 저장 공간에 저장하지 못했습니다'); } },
};
const K_PROJ = 'room3d.v2.projects', K_CUR = 'room3d.v2.cur', K_SZ = 'room3d.v2.sizes', K_CUS = 'room3d.v2.custom', K_REC = 'room3d.v2.recent', K_PREF = 'room3d.v2.prefs';
let SZ = LS.get(K_SZ, {}), CUSTOM = LS.get(K_CUS, []), RECENT = LS.get(K_REC, []), PROJ = LS.get(K_PROJ, {});
const PREF = Object.assign({ snap: 1, handles: 1, labels: 0, night: 0, vdoor: 1, vwin: 1, ceil: 1, lock: 1, remember: 1, stack: 1, tab: 'add' }, LS.get(K_PREF, {}));
PREF.dims = Object.assign({ room: 1, ops: 0, item: 1, gap: 1 }, PREF.dims || {});
const savePref = () => LS.set(K_PREF, PREF);

// ---------- 상태 ----------
const DEF_R = { W: 230, D: 278, H: 227, fl: 'wood', flc: '#cdb892', wc: '#f0ede6', wcs: {}, bb: '#ffffff' };
let R = { ...DEF_R }, OPS = [], LIGHTS = [], items = [], MEAS = [], nid = 1, sel = null, projName = '내 방';
function exampleState() {
  return {
    R: { ...DEF_R, wcs: {} },
    ops: [
      { id: 1, kind: 'win', wall: 'E', c: 167.5, w: 149, h: 112, y: 113, st: 'slide', fc: '#f3f2ee', cur: 'none', cc: '#e9e1d3' },
      { id: 2, kind: 'door', wall: 'S', c: 115, w: 230, h: 215, y: 0, st: 'jung3', fc: '#2b2b2d', dc: '#f3f2ee', hinge: 'L', sw: 'in', ang: 0 },
    ],
    lights: [{ id: 3, kind: 'round', x: 115, z: 139, w: 50, temp: 5000, lum: 1, color: '#f2f2f0', on: true }],
    items: [
      { id: 4, pk: '침실|싱글 침대', name: '싱글 침대', type: 'bed', w: 100, d: 200, h: 45, bw: 100, bd: 200, bh: 45, color: '#8fa8d8', c2: '#e9e4da', x: 50, z: 100, y: 0, rot: 0 },
      { id: 5, pk: '서재·사무|컴퓨터 책상 120', name: '책상', type: 'panel', w: 120, d: 60, h: 74, bw: 120, bd: 60, bh: 74, color: '#c49a6c', x: 200, z: 170, y: 0, rot: 90 },
    ],
    meas: [],
  };
}
function emptyState() { const s = exampleState(); s.items = []; s.lights = []; s.ops = s.ops.slice(0, 1); s.ops[0].id = 1; return s; }
function migrateV1(d) {
  const o = d.R || {}, W = o.W || 230, D = o.D || 278, open = Math.min(o.open ?? 230, W), ox = clamp(o.ox || 0, 0, W - open);
  return {
    R: { ...DEF_R, W, D, H: o.H || 227, wcs: {} },
    ops: [
      { id: 9001, kind: 'win', wall: 'E', c: (o.wz ?? 93) + (o.ww ?? 149) / 2, w: o.ww ?? 149, h: o.wh ?? 120, y: o.wb ?? 113, st: 'slide', fc: '#f3f2ee', cur: 'none' },
      ...(open >= 20 ? [{ id: 9002, kind: 'door', wall: 'S', c: ox + open / 2, w: open, h: Math.min(o.dh ?? 215, o.H || 227), y: 0, st: 'jung3', fc: '#2b2b2d', hinge: 'L', sw: 'in', ang: 0 }] : []),
    ],
    lights: [], meas: [],
    items: (d.items || []).map(i => ({ ...i, bw: i.w, bd: i.d, bh: i.h, y: 0 })),
  };
}

// ---------- three ----------
const wrap = $('v'), cv = $('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(45, 1, 5, 9000), camO = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 9000);
let cam = camP;
const ctl = new OrbitControls(camP, cv); ctl.enableDamping = true; ctl.maxPolarAngle = PI / 2 - 0.02;
const amb = new THREE.AmbientLight(0xffffff, 0.56), hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 0.1), dl = new THREE.DirectionalLight(0xffffff, 0.42);
dl.position.set(200, 500, 400); scene.add(amb, hemi, dl);
function rsz() {
  const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camP.aspect = w / h; camP.updateProjectionMatrix();
  const hh = (camO.top - camO.bottom) / 2; camO.left = -hh * w / h; camO.right = hh * w / h; camO.updateProjectionMatrix();
}
new ResizeObserver(rsz).observe(wrap);
const roomG = new THREE.Group(), opG = new THREE.Group(), ltG = new THREE.Group(), fG = new THREE.Group(), dimG = new THREE.Group(), hdG = new THREE.Group();
scene.add(roomG, opG, ltG, fG, dimG, hdG);
const selBox = new THREE.BoxHelper(undefined, 0x2f6fed); selBox.visible = false; selBox.material.depthTest = false; selBox.renderOrder = 20; scene.add(selBox);

// ---------- 좌표 헬퍼 ----------
const fpw = it => (it.fold && LEAF[it.type] ? it.w * LEAF[it.type] : it.w);
function fp(it) { const w = fpw(it), a = (it.rot || 0) * PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return [w * c + it.d * s, w * s + it.d * c]; }
const wlen = k => (k === 'N' || k === 'S' ? R.W : R.D);
const sOf = o => (o.wall === 'S' ? R.W - o.c : o.wall === 'W' ? R.D - o.c : o.c);
const wpt = (k, s) => (k === 'N' ? [s, 0] : k === 'E' ? [R.W, s] : k === 'S' ? [R.W - s, R.D] : [0, R.D - s]);
const wxz = (k, c) => (k === 'N' ? [c, 0] : k === 'E' ? [R.W, c] : k === 'S' ? [c, R.D] : [0, c]);
const rotWall = r => { const v = ((Math.round(((r % 360) + 360) % 360 / 90) * 90) % 360); return { 0: 'N', 90: 'W', 180: 'S', 270: 'E' }[v]; };
const snapV = (v, s) => (PREF.snap ? Math.round(v / s) * s : r1(v));
function nearestWall(x, z) { const d = { N: z, S: R.D - z, W: x, E: R.W - x }; return WALLS.reduce((a, b) => (d[b] < d[a] ? b : a)); }
function lightIsWall(l) { return (LKIND[l.kind] || {}).mt === 'w'; }

// ---------- 바닥 텍스처 ----------
const TX = {};
const FLOORS = [['wood', '원목 마루'], ['herring', '헤링본 마루'], ['tile', '타일 600각'], ['bigtile', '포세린 타일 1200×600'], ['marble', '대리석'], ['concrete', '콘크리트·에폭시'], ['carpet', '카펫'], ['plain', '장판 (단색)']];
function floorTex(t, c) {
  const k = t + c; if (TX[k]) return TX[k];
  const N = 512, cv2 = document.createElement('canvas'); cv2.width = cv2.height = N;
  const g = cv2.getContext('2d'), base = new THREE.Color(c), sh = f => '#' + base.clone().multiplyScalar(f).getHexString();
  let a = 7; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  let u = 100;
  g.fillStyle = c; g.fillRect(0, 0, N, N);
  if (t === 'wood') {
    u = 120; const rows = 6, rh = N / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * N * 0.6;
      while (x < N) {
        const L = N * (0.45 + r() * 0.4); g.fillStyle = sh(0.94 + r() * 0.1); g.fillRect(x, i * rh, L, rh);
        g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1;
        for (let j = 0; j < 6; j++) { const yy = i * rh + r() * rh; g.beginPath(); g.moveTo(x, yy); g.bezierCurveTo(x + L * 0.3, yy + (r() - 0.5) * 6, x + L * 0.6, yy + (r() - 0.5) * 6, x + L, yy + (r() - 0.5) * 4); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, i * rh, 1.5, rh); x += L;
      }
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, i * rh, N, 1.5);
    }
  } else if (t === 'herring') {
    u = 80; const cw = N / 4, ph = cw / 2;
    for (let k = 0; k < 4; k++) for (let j = -1; j < 9; j++) {
      const x0 = k * cw, y0 = j * ph * 2 + (k % 2) * ph, dir = k % 2 ? -1 : 1;
      [0, N].forEach(oy => { g.fillStyle = sh(0.93 + r() * 0.12); g.beginPath(); g.moveTo(x0, y0 + oy - N); g.lineTo(x0 + cw, y0 + oy - N + dir * ph); g.lineTo(x0 + cw, y0 + oy - N + dir * ph + ph * 2); g.lineTo(x0, y0 + oy - N + ph * 2); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke(); });
    }
  } else if (t === 'tile' || t === 'bigtile') {
    u = t === 'tile' ? 60 : 120;
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},.03)`; g.fillRect(r() * N, r() * N, 3, 3); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, N, 3); g.fillRect(0, 0, 3, N);
    if (t === 'bigtile') g.fillRect(0, N / 2, N, 3);
  } else if (t === 'marble') {
    u = 120;
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(90,90,100,${0.06 + r() * 0.14})`; g.lineWidth = 0.5 + r() * 2.5; g.beginPath(); let x = r() * N, y = 0; g.moveTo(x, y); while (y < N) { x += (r() - 0.5) * 60; y += 20 + r() * 40; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, 0, N, 2); g.fillRect(0, 0, 2, N); g.fillRect(0, N / 2, N, 2); g.fillRect(N / 2, 0, 2, N);
  } else if (t === 'concrete') {
    u = 200; for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},.04)`; g.beginPath(); g.arc(r() * N, r() * N, 10 + r() * 50, 0, PI * 2); g.fill(); }
  } else if (t === 'carpet') {
    u = 50; for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},.08)`; g.fillRect(r() * N, r() * N, 2, 2); }
  } else { for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(0,0,0,.02)'; g.fillRect(r() * N, r() * N, 4, 4); } }
  const tex = new THREE.CanvasTexture(cv2); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return (TX[k] = { tex, u });
}
const SHT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.7, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();

// ---------- 방 ----------
function wallRects(len, H, holes) {
  const xs = [0, len]; holes.forEach(h => xs.push(clamp(h[0], 0, len), clamp(h[1], 0, len)));
  const u = [...new Set(xs)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < u.length - 1; i++) {
    const a = u[i], b = u[i + 1]; if (b - a < 0.01) continue;
    const m = (a + b) / 2, cov = holes.filter(h => h[0] < m && h[1] > m).map(h => [clamp(h[2], 0, H), clamp(h[3], 0, H)]).sort((p, q) => p[0] - q[0]);
    let y = 0; cov.forEach(([y0, y1]) => { if (y0 > y) out.push([a, b, y, y0]); y = Math.max(y, y1); });
    if (y < H) out.push([a, b, y, H]);
  }
  return out.filter(q => q[3] - q[2] > 0.01);
}
function freeIntervals(len, holes) {
  const hs = holes.map(h => [clamp(h[0], 0, len), clamp(h[1], 0, len)]).sort((a, b) => a[0] - b[0]), out = []; let a = 0;
  hs.forEach(([h0, h1]) => { if (h0 > a) out.push([a, h0]); a = Math.max(a, h1); });
  if (a < len) out.push([a, len]); return out;
}
function clampOp(o) {
  const len = wlen(o.wall);
  o.w = clamp(o.w, 20, len);
  if (o.kind === 'door') { o.y = 0; o.h = clamp(o.h, 20, R.H - 1); }
  else { o.y = clamp(o.y, 0, R.H - 21); o.h = clamp(o.h, 20, R.H - 1 - o.y); }
  o.c = clamp(o.c, o.w / 2, len - o.w / 2);
}
function buildRoom() {
  disposeTree(roomG); roomG.clear(); disposeTree(opG); opG.clear();
  const { W, D, H } = R;
  const ft = floorTex(R.fl, R.flc); ft.tex.repeat.set(W / ft.u, D / ft.u); ft.tex.needsUpdate = true;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: ft.tex }));
  fl.rotation.x = -PI / 2; fl.position.set(W / 2, -0.2, D / 2); roomG.add(fl);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 24, 10, D + 24), new THREE.MeshLambertMaterial({ color: 0xb9b2a6 })); slab.position.set(W / 2, -5.4, D / 2); roomG.add(slab);
  const pts = []; for (let x = 0; x <= W; x += 50) pts.push(x, 0, 0, x, 0, D); for (let z = 0; z <= D; z += 50) pts.push(0, 0, z, W, 0, z);
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const gl = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0, transparent: true, opacity: 0.07 })); gl.position.y = 0.1; roomG.add(gl);
  WALLS.forEach(k => {
    const len = wlen(k), holes = OPS.filter(o => o.wall === k).map(o => { const s = sOf(o); return [s - o.w / 2, s + o.w / 2, o.y, o.y + o.h]; });
    const mtl = new THREE.MeshLambertMaterial({ color: R.wcs[k] || R.wc }), [nx, nz] = NRM[k];
    wallRects(len, H, holes).forEach(([a, b, y0, y1]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), mtl), [px, pz] = wpt(k, (a + b) / 2);
      m.position.set(px, (y0 + y1) / 2, pz); m.rotation.y = WRY[k]; roomG.add(m);
    });
    const bbm = new THREE.MeshLambertMaterial({ color: R.bb });
    freeIntervals(len, holes.filter(h => h[2] < 2)).forEach(([a, b]) => {
      if (b - a < 1) return; const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, 8, 1.2), bbm), [px, pz] = wpt(k, (a + b) / 2);
      m.position.set(px + nx * 0.6, 4, pz + nz * 0.6); m.rotation.y = WRY[k]; roomG.add(m);
    });
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 24, 2, 12), new THREE.MeshLambertMaterial({ color: 0xcfc9be })), [cx, cz] = wpt(k, len / 2);
    cap.position.set(cx - nx * 6, H + 1, cz - nz * 6); cap.rotation.y = WRY[k]; roomG.add(cap);
  });
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ color: 0xf7f6f2 }));
  ce.rotation.x = PI / 2; ce.position.set(W / 2, H, D / 2); ce.visible = !!PREF.ceil; ce.userData.ceil = 1; roomG.add(ce);
  OPS.forEach(o => {
    const g = buildOpening(o, R), [x, z] = wxz(o.wall, o.c);
    g.position.set(x, 0, z); g.rotation.y = WRY[o.wall];
    g.traverse(c => { c.userData.op = o; }); g.userData.op = o; o.g = g; opG.add(g);
  });
  buildHandles(); applyVis();
  if (sel && sel.k === 'op') updSelBox();
}
function buildHandles() {
  disposeTree(hdG); hdG.clear(); if (!PREF.handles) return;
  const { W, D } = R, mat = new THREE.MeshBasicMaterial({ color: 0xe8590c }), am = new THREE.MeshBasicMaterial({ color: 0xffffff });
  WALLS.forEach(k => {
    const [px, pz] = wpt(k, wlen(k) / 2), [nx, nz] = NRM[k], g = new THREE.Group();
    g.position.set(px - nx * 30, 1, pz - nz * 30);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 28), mat); g.add(disc);
    const ar = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 3), am); ar.position.y = 1.2; ar.rotation.y = (k === 'N' || k === 'S') ? PI / 2 : 0; g.add(ar);
    const ar2 = new THREE.Mesh(new THREE.ConeGeometry(4, 6, 12), am); ar2.rotation.set(0, 0, 0); ar2.position.y = 1.4;
    g.traverse(c => { c.userData.h = k; }); hdG.add(g);
  });
}
function setVis(g, on) {
  g.traverse(o => { const m = o.material; if (m && !o.isLine) { if (m.userData.o == null) m.userData.o = m.opacity; m.transparent = true; m.opacity = on ? m.userData.o : Math.min(0.08, m.userData.o); m.depthWrite = on && m.userData.o >= 1; } });
}
function applyVis() { OPS.forEach(o => o.g && setVis(o.g, o.kind === 'win' ? PREF.vwin : PREF.vdoor)); }

// ---------- 조명 ----------
function plCount() { let n = 0; scene.traverse(o => { if (o.isPointLight) n++; }); return n; }
function mkLight(l) {
  if (l.g) { ltG.remove(l.g); disposeTree(l.g); }
  const g = buildLight(l), k = LKIND[l.kind] || LKIND.down;
  if (l.on !== false && plCount() < MAXL) {
    const pl = new THREE.PointLight(kelvin(l.temp), 1, 800, 2); pl.userData.base = (l.lum ?? 1) * (k.kf || 0.8);
    pl.position.set(...g.userData.lp); g.add(pl);
  }
  g.traverse(c => { c.userData.lt = l; }); l.g = g; ltG.add(g); placeLight(l); applyLightMode();
}
function placeLight(l) {
  if (!l.g) return;
  if (lightIsWall(l)) { l.wall = l.wall || 'N'; const len = wlen(l.wall); l.c = clamp(l.c ?? len / 2, 5, len - 5); l.y = clamp(l.y ?? 170, 5, R.H - 3); const [x, z] = wxz(l.wall, l.c); l.g.position.set(x, l.y, z); l.g.rotation.y = WRY[l.wall]; }
  else { l.x = clamp(l.x, 0, R.W); l.z = clamp(l.z, 0, R.D); l.g.position.set(l.x, R.H, l.z); l.g.rotation.y = (l.rot || 0) * PI / 180; }
}
function applyLightMode() {
  const n = !!PREF.night;
  amb.intensity = n ? 0.14 : 0.56; hemi.intensity = n ? 0.04 : 0.1; dl.intensity = n ? 0.03 : 0.42;
  scene.background = n ? new THREE.Color(0x14161b) : null;
  scene.traverse(o => { if (o.isPointLight) o.intensity = o.userData.base * (n ? 1 : 0.12); });
  items.forEach(it => { if (!it.g) return; const on = it.on !== false; it.g.userData.ems.forEach(m => m.emissive.copy(on ? kelvin(it.temp || 2900).multiplyScalar(n ? 0.9 : 0.3) : BLACK)); });
  LIGHTS.forEach(l => l.g && l.g.userData.em.forEach(m => m.emissive.copy(l.on !== false ? kelvin(l.temp).multiplyScalar(n ? 1 : 0.45) : BLACK)));
  const b = $('night'); if (b) { b.classList.toggle('on', n); b.textContent = n ? '☀ 주간' : '🌙 야간'; }
}

// ---------- 가구 ----------
function col(it, c) {
  const m = new THREE.Color(it.color || '#999999');
  if (c == null) return m.getHex();
  if (typeof c === 'number') return c;
  switch (c) {
    case 'd': return m.multiplyScalar(0.62).getHex();
    case 'dd': return m.multiplyScalar(0.4).getHex();
    case 'f': return m.multiplyScalar(0.9).getHex();
    case 'l': return m.lerp(WHITE, 0.5).getHex();
    case 'a': case 'ad': case 'al': {
      const a = new THREE.Color(it.c2 || DEFA[it.type] || '#' + m.clone().lerp(WHITE, 0.5).getHexString());
      return c === 'a' ? a.getHex() : c === 'ad' ? a.multiplyScalar(0.72).getHex() : a.lerp(WHITE, 0.25).getHex();
    }
  }
  return new THREE.Color(c).getHex();
}
function labelSprite(t) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 40px sans-serif';
  const tw = Math.min(900, g.measureText(t).width + 30); c.width = tw; c.height = 64;
  g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(0, 6, tw, 52); g.fillStyle = '#1d1d1f'; g.fillText(t, tw / 2, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(tw / 64 * 13, 13, 1); s.renderOrder = 15; return s;
}
function mk(it) {
  if (it.g) { fG.remove(it.g); disposeTree(it.g); }
  const g = new THREE.Group(), m = new THREE.Group(), ms = [], ems = [], cm = {}, fw = fpw(it);
  const { P, LP } = buildParts(it, fw, { H: R.H });
  P.forEach(p => {
    const c = col(it, p.c), key = c + '|' + (p.op || 1) + '|' + (p.em ? 1 : 0);
    let mt = cm[key];
    if (!mt) {
      mt = cm[key] = new THREE.MeshLambertMaterial({ color: c });
      if (p.op) { mt.transparent = true; mt.opacity = p.op; mt.depthWrite = false; mt.side = THREE.DoubleSide; }
      (p.em ? ems : ms).push(mt);
    }
    let geo;
    if (p.g === 'c') geo = new THREE.CylinderGeometry(Math.max(0.01, p.rt), Math.max(0.01, p.rb), Math.max(0.05, p.h), p.seg || 20, 1, false, p.ts || 0, p.tl || PI * 2);
    else if (p.g === 's') geo = new THREE.SphereGeometry(Math.max(0.05, p.r), p.ws || 16, p.hs || 12, 0, PI * 2, 0, p.tl || PI);
    else if (p.g === 't') geo = new THREE.TorusGeometry(p.r, p.t, 8, p.ts || 28, p.arc || PI * 2);
    else geo = new THREE.BoxGeometry(Math.max(0.05, p.w), Math.max(0.05, p.h), Math.max(0.05, p.d));
    const q = new THREE.Mesh(geo, mt);
    if (p.g === 'b' || p.g === 'c') q.position.set(p.x, p.y + p.h / 2, p.z); else q.position.set(p.x, p.y, p.z);
    q.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0); q.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
    q.userData.it = it; m.add(q);
  });
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(fw, it.h, it.d)), new THREE.LineBasicMaterial({ color: 0x2f6fed, depthTest: false, transparent: true }));
  e.position.y = it.h / 2; e.renderOrder = 12; e.visible = false; g.add(m, e);
  if (!it.nc && it.h > 3 && (it.y || 0) < 1 && it.mt !== 'w') {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(fw + 14, it.d + 14), new THREE.MeshBasicMaterial({ map: SHT, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -PI / 2; sh.position.y = 0.15 - (it.y || 0); g.add(sh);
  }
  if (PREF.labels) { const s = labelSprite(it.name); s.position.y = it.h + 14; g.add(s); }
  if (LP.length && it.on !== false && plCount() < MAXL) {
    const pl = new THREE.PointLight(kelvin(it.temp || 2900), 1, 600, 2); pl.userData.base = (it.lum ?? 0.8) * 0.8;
    pl.position.set(...LP[0]); g.add(pl);
  }
  g.userData = { m, e, ms, ems }; it.g = g; fG.add(g); place(it);
  if (sel && sel.o === it) { e.visible = true; addResizeHandles(it); }
  applyLightModeItem(it);
}
function applyLightModeItem(it) {
  const n = !!PREF.night, on = it.on !== false;
  it.g.traverse(o => { if (o.isPointLight) o.intensity = o.userData.base * (n ? 1 : 0.12); });
  it.g.userData.ems.forEach(m => m.emissive.copy(on ? kelvin(it.temp || 2900).multiplyScalar(n ? 0.9 : 0.3) : BLACK));
}
function place(it) { it.g.position.set(it.x, it.y || 0, it.z); it.g.rotation.y = (it.rot || 0) * PI / 180; }
function wallPlace(it, k, c) {
  it.rot = WROT[k]; const [fw, fd] = fp(it);
  if (k === 'N') { it.x = c; it.z = fd / 2; } else if (k === 'S') { it.x = c; it.z = R.D - fd / 2; }
  else if (k === 'W') { it.z = c; it.x = fw / 2; } else { it.z = c; it.x = R.W - fw / 2; }
}
function fit(it, sn) {
  let [fw, fd] = fp(it);
  if (it.mt === 'w') { const k = rotWall(it.rot); wallPlace(it, k, k === 'N' || k === 'S' ? it.x : it.z); [fw, fd] = fp(it); }
  if (sn && PREF.snap) {
    const s = 5;
    if (it.mt !== 'w') {
      it.x = Math.round((it.x - fw / 2) / s) * s + fw / 2; it.z = Math.round((it.z - fd / 2) / s) * s + fd / 2;
      if (it.x - fw / 2 < 8) it.x = fw / 2; else if (R.W - it.x - fw / 2 < 8) it.x = R.W - fw / 2;
      if (it.z - fd / 2 < 8) it.z = fd / 2; else if (R.D - it.z - fd / 2 < 8) it.z = R.D - fd / 2;
    } else { const k = rotWall(it.rot); if (k === 'N' || k === 'S') it.x = Math.round(it.x / s) * s; else it.z = Math.round(it.z / s) * s; }
    edgeSnap(it, fw, fd);
  }
  it.x = fw >= R.W ? R.W / 2 : clamp(it.x, fw / 2, R.W - fw / 2);
  it.z = fd >= R.D ? R.D / 2 : clamp(it.z, fd / 2, R.D - fd / 2);
  it.y = clamp(it.y || 0, 0, Math.max(0, R.H - it.h));
  place(it);
}
function edgeSnap(it, fw, fd) {
  const T = 6; let bx = null, bz = null;
  items.forEach(o => {
    if (o === it || o.nc || it.nc) return;
    const [ow, od] = fp(o), ax = [it.x - fw / 2, it.x + fw / 2], az = [it.z - fd / 2, it.z + fd / 2], ox = [o.x - ow / 2, o.x + ow / 2], oz = [o.z - od / 2, o.z + od / 2];
    const nearZ = az[1] > oz[0] - 40 && az[0] < oz[1] + 40, nearX = ax[1] > ox[0] - 40 && ax[0] < ox[1] + 40;
    if (nearZ) for (const a of ax) for (const b of ox) { const d = b - a; if (Math.abs(d) < T && (bx == null || Math.abs(d) < Math.abs(bx))) bx = d; }
    if (nearX) for (const a of az) for (const b of oz) { const d = b - a; if (Math.abs(d) < T && (bz == null || Math.abs(d) < Math.abs(bz))) bz = d; }
  });
  if (bx != null && it.mt !== 'w') it.x += bx; if (bz != null && it.mt !== 'w') it.z += bz;
}
function obb(it) { const a = (it.rot || 0) * PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: it.x, z: it.z, ux: [c, -s], uz: [s, c], hw: fpw(it) / 2, hd: it.d / 2 }; }
function separated(A, B) {
  const dx = B.x - A.x, dz = B.z - A.z;
  for (const v of [A.ux, A.uz, B.ux, B.uz]) {
    const dist = Math.abs(dx * v[0] + dz * v[1]);
    const ra = A.hw * Math.abs(A.ux[0] * v[0] + A.ux[1] * v[1]) + A.hd * Math.abs(A.uz[0] * v[0] + A.uz[1] * v[1]);
    const rb = B.hw * Math.abs(B.ux[0] * v[0] + B.ux[1] * v[1]) + B.hd * Math.abs(B.uz[0] * v[0] + B.uz[1] * v[1]);
    if (dist >= ra + rb - 0.5) return true;
  }
  return false;
}
function hit2(a, b) { if (a.nc || b.nc) return false; const ay = a.y || 0, by = b.y || 0; if (ay >= by + b.h - 0.5 || by >= ay + a.h - 0.5) return false; return !separated(obb(a), obb(b)); }
const overlapsAny = it => items.some(o => o !== it && hit2(it, o));
const aabb = it => { const [fw, fd] = fp(it); return [it.x - fw / 2, it.x + fw / 2, it.z - fd / 2, it.z + fd / 2]; };
function opZones(o) {
  const k = o.wall, a = o.c - o.w / 2, b = o.c + o.w / 2, { W, D } = R;
  const rect = (dp, a0 = a, b0 = b) => k === 'N' ? [a0, b0, 0, dp] : k === 'S' ? [a0, b0, D - dp, D] : k === 'E' ? [W - dp, W, a0, b0] : [0, dp, a0, b0];
  if (o.kind === 'win') return [{ r: rect(22), f: 'wb', y0: o.y + 3, y1: o.y + o.h }];
  const st = o.st || 'swing', z = [{ r: rect(45), f: 'db', y0: 0, y1: o.h }];
  if (SWING.has(st) && o.sw !== 'out') {
    const s0 = sOf(o) - o.w / 2, s1 = sOf(o) + o.w / 2, hinge = (s, lw) => { const [hx, hz] = wpt(k, s); return { hx, hz, rad: lw }; };
    const leaves = st === 'double' ? [[s0, o.w / 2], [s1, o.w / 2]] : [[o.hinge !== 'R' ? s0 : s1, st === 'swingG' ? Math.min(o.w, 100) : o.w]];
    leaves.forEach(([s, lw]) => z.push({ r: rect(lw), f: 'db', y0: 0, y1: o.h, arc: hinge(s, lw) }));
  }
  return z;
}
function check() {
  items.forEach(a => { a.ov = a.wb = a.db = false; });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (hit2(items[i], items[j])) items[i].ov = items[j].ov = true;
  OPS.forEach(o => {
    const zs = opZones(o);
    items.forEach(it => {
      if (it.nc || it.mt === 'c') return; const b = aabb(it), y0 = it.y || 0, y1 = y0 + it.h;
      zs.forEach(zn => {
        const r = zn.r, ix0 = Math.max(b[0], r[0]), ix1 = Math.min(b[1], r[1]), iz0 = Math.max(b[2], r[2]), iz1 = Math.min(b[3], r[3]);
        if (ix1 - ix0 < 0.5 || iz1 - iz0 < 0.5 || y1 <= zn.y0 || y0 >= zn.y1) return;
        if (zn.arc) { const { hx, hz, rad } = zn.arc, px = clamp(hx, ix0, ix1), pz = clamp(hz, iz0, iz1); if (Math.hypot(px - hx, pz - hz) >= rad) return; }
        it[zn.f] = true;
      });
    });
  });
  items.forEach(a => a.g && a.g.userData.ms.forEach(m => m.emissive.setHex(a.ov ? 0x7a1414 : 0)));
}
function surfaceFor(it) {
  if (!it.sk || !PREF.stack) return null;
  let best = null, top = -1;
  items.forEach(o => {
    if (o === it || o.nc || o.sk || o.mt === 'c') return;
    const b = aabb(o); if (it.x < b[0] || it.x > b[1] || it.z < b[2] || it.z > b[3]) return;
    const t = (o.y || 0) + o.h; if (t > top && t < R.H - it.h) { top = t; best = o; }
  });
  return best ? top : 0;
}

// ---------- 치수선 ----------
const lc = {}, lm = {}, sm = {}, sg = new THREE.SphereGeometry(1.6, 8, 6);
function tex(t, color) {
  const k = t + color; if (!lc[k]) {
    const c = document.createElement('canvas'); c.width = 192; c.height = 64; const g = c.getContext('2d');
    g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 7; g.strokeStyle = '#fff'; g.strokeText(t, 96, 32); g.fillStyle = color; g.fillText(t, 96, 32);
    lc[k] = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true });
  }
  return lc[k];
}
function dim(a, b, c, txt) {
  const p0 = new THREE.Vector3(...a), p1 = new THREE.Vector3(...b), len = p0.distanceTo(p1); if (len < 1) return;
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p0, p1]), lm[c] || (lm[c] = new THREE.LineBasicMaterial({ color: c, depthTest: false }))); l.renderOrder = 9; dimG.add(l);
  const sp = new THREE.Sprite(tex(txt || rd(len) + 'cm', '#' + c.toString(16).padStart(6, '0'))); sp.scale.set(54, 18, 1); sp.position.copy(p0).add(p1).multiplyScalar(0.5); sp.renderOrder = 10; dimG.add(sp);
  [p0, p1].forEach(p => { const s = new THREE.Mesh(sg, sm[c] || (sm[c] = new THREE.MeshBasicMaterial({ color: c, depthTest: false }))); s.position.copy(p); s.renderOrder = 9; dimG.add(s); });
}
let mzTemp = null;
function dims() {
  while (dimG.children.length) { const c = dimG.children.pop(); if (c.isLine) c.geometry.dispose(); }
  const { W, D, H } = R, BL = 0x1d6fd6, GR = 0x2b9348, OR = 0xe8590c, RDc = 0xd33a2c, PU = 0x8e44ad;
  if (PREF.dims.room) { dim([0, 3, 8], [W, 3, 8], BL); dim([8, 3, 0], [8, 3, D], BL); dim([8, 0, 8], [8, H, 8], BL); }
  OPS.forEach(o => {
    if (!PREF.dims.ops && !(sel && sel.o === o)) return;
    const k = o.wall, [nx, nz] = NRM[k], s = sOf(o), P = (sv, y, n) => { const [x, z] = wpt(k, sv); return [x + nx * n, y, z + nz * n]; };
    const yt = o.y + o.h + 7, e0 = o.c - o.w / 2;
    dim(P(s - o.w / 2, yt, 4), P(s + o.w / 2, yt, 4), OR);
    const base = k === 'N' || k === 'S' ? (x => [x, 4, k === 'N' ? 4 : D - 4]) : (z => [k === 'W' ? 4 : W - 4, 4, z]);
    if (e0 > 1) dim(base(0), base(e0), GR);
    if (o.kind === 'win') { dim(P(s - o.w / 2 - 8, 0, 4), P(s - o.w / 2 - 8, o.y, 4), GR); dim(P(s + o.w / 2 + 8, o.y, 4), P(s + o.w / 2 + 8, o.y + o.h, 4), OR); }
    else dim(P(s + o.w / 2 + 8, 0, 4), P(s + o.w / 2 + 8, o.h, 4), OR);
  });
  if (sel && sel.k === 'item') {
    const it = sel.o, x = it.x, z = it.z, h = it.h, y0 = it.y || 0, w = fpw(it), d = it.d, a = (it.rot || 0) * PI / 180, c = Math.cos(a), s = Math.sin(a);
    const L = (lx, y, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
    if (PREF.dims.item) { dim(L(-w / 2, y0 + h + 2, d / 2), L(w / 2, y0 + h + 2, d / 2), OR); dim(L(w / 2, y0 + h + 2, -d / 2), L(w / 2, y0 + h + 2, d / 2), OR); dim(L(-w / 2, y0, d / 2), L(-w / 2, y0 + h, d / 2), OR); if (y0 > 1) dim(L(-w / 2 - 4, 0, d / 2), L(-w / 2 - 4, y0, d / 2), GR); }
    if (PREF.dims.gap) {
      const b = aabb(it), yy = y0 + 6, ob = items.filter(o => o !== it && !o.nc && !(o.y >= y0 + h || (o.y || 0) + o.h <= y0)).map(o => ({ o, b: aabb(o) }));
      const dir = (axis, sign) => {
        let best = axis === 'x' ? (sign > 0 ? W - b[1] : b[0]) : (sign > 0 ? D - b[3] : b[2]), isItem = false;
        ob.forEach(({ b: q }) => {
          if (axis === 'x') { if (q[3] <= b[2] || q[2] >= b[3]) return; const g = sign > 0 ? q[0] - b[1] : b[0] - q[1]; if (g >= -0.5 && g < best) { best = Math.max(0, g); isItem = true; } }
          else { if (q[1] <= b[0] || q[0] >= b[1]) return; const g = sign > 0 ? q[2] - b[3] : b[2] - q[3]; if (g >= -0.5 && g < best) { best = Math.max(0, g); isItem = true; } }
        });
        const cl = isItem && best > 2 && best < 60 ? RDc : GR;
        if (axis === 'x') { const x0 = sign > 0 ? b[1] : b[0]; dim([x0, yy, z], [x0 + sign * best, yy, z], cl); }
        else { const z0 = sign > 0 ? b[3] : b[2]; dim([x, yy, z0], [x, yy, z0 + sign * best], cl); }
      };
      dir('x', -1); dir('x', 1); dir('z', -1); dir('z', 1);
    }
  }
  MEAS.forEach(([x0, z0, x1, z1]) => dim([x0, 2, z0], [x1, 2, z1], PU));
  if (mzTemp && mzTemp.p1) dim([mzTemp.p0[0], 2, mzTemp.p0[1]], [mzTemp.p1[0], 2, mzTemp.p1[1]], PU);
}

// ---------- 선택 ----------
function addResizeHandles(it) {
  const g = it.g; if (!g || it.lock) return;
  const w = fpw(it), mat = new THREE.MeshBasicMaterial({ color: 0x2f6fed, depthTest: false }), mat2 = new THREE.MeshBasicMaterial({ color: 0xe8590c, depthTest: false });
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(4.5, 14, 10), mat); c1.position.set(w / 2, 0.5, it.d / 2); c1.userData.rh = it; c1.userData.ax = 'wd'; c1.renderOrder = 14;
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 14), mat2); c2.position.set(0, it.h + 6, it.d / 2); c2.userData.rh = it; c2.userData.ax = 'h'; c2.renderOrder = 14;
  g.add(c1, c2); g.userData.hd = [c1, c2];
}
function updSelBox() {
  if (sel && (sel.k === 'op' || sel.k === 'light') && sel.o.g) { selBox.setFromObject(sel.o.g); selBox.visible = true; } else selBox.visible = false;
}
function setSel(s, tab) {
  if (sel && sel.k === 'item' && sel.o.g) { sel.o.g.userData.e.visible = false; (sel.o.g.userData.hd || []).forEach(h => { sel.o.g.remove(h); h.geometry.dispose(); }); sel.o.g.userData.hd = null; }
  sel = s;
  if (sel && sel.k === 'item' && sel.o.g) { sel.o.g.userData.e.visible = true; addResizeHandles(sel.o); }
  updSelBox(); renderSel(); quick(); dims(); markList();
  if (tab) showTab(tab);
}
function refreshItem(it, sn) { mk(it); fit(it, sn); check(); dims(); syncSel(); quick(); infoSel(); }
function upd() { check(); dims(); markList(); quick(); infoSel(); syncSel(); updSelBox(); updArea(); commitSoon(); }

// ---------- 히스토리 / 프로젝트 ----------
const clean = o => { const { g, ov, wb, db, ...r } = o; return r; };
function snap() { return { R: JSON.parse(JSON.stringify(R)), ops: OPS.map(clean), lights: LIGHTS.map(clean), items: items.map(clean), meas: MEAS.map(m => [...m]) }; }
let hist = [], hi = -1, ct = null;
function commit() { ct = null; const s = JSON.stringify(snap()); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 150) hist.shift(); hi = hist.length - 1; saveProj(s); updUndo(); }
function commitSoon(ms = 350) { clearTimeout(ct); ct = setTimeout(commit, ms); }
function flush() { if (ct) { clearTimeout(ct); commit(); } }
function undo() { flush(); if (hi <= 0) return toast('더 이상 되돌릴 수 없습니다'); hi--; load(JSON.parse(hist[hi]), true); saveProj(hist[hi]); updUndo(); }
function redo() { flush(); if (hi >= hist.length - 1) return; hi++; load(JSON.parse(hist[hi]), true); saveProj(hist[hi]); updUndo(); }
function updUndo() { $('undo').disabled = hi <= 0; $('redo').disabled = hi >= hist.length - 1; }
function saveProj(s) { PROJ[projName] = { t: Date.now(), s: JSON.parse(s) }; LS.set(K_PROJ, PROJ); LS.set(K_CUR, projName); }
function normItem(i) { return { y: 0, rot: 0, type: 'box', color: '#b0a090', ...i, bw: i.bw || i.w, bd: i.bd || i.d, bh: i.bh || i.h }; }
function clearScene() { items.forEach(i => { if (i.g) { fG.remove(i.g); disposeTree(i.g); } }); LIGHTS.forEach(l => { if (l.g) { ltG.remove(l.g); disposeTree(l.g); } }); }
function load(st, keepSel) {
  const sk = sel ? [sel.k, sel.o.id] : null;
  clearScene(); sel = null;
  R = { ...DEF_R, ...(st.R || {}) }; R.wcs = { ...((st.R && st.R.wcs) || {}) };
  OPS = (st.ops || []).map(o => ({ ...o })); LIGHTS = (st.lights || []).map(l => ({ ...l })); items = (st.items || []).map(normItem); MEAS = (st.meas || []).map(m => [...m]);
  nid = Math.max(0, ...OPS.map(o => o.id || 0), ...LIGHTS.map(o => o.id || 0), ...items.map(o => o.id || 0)) + 1;
  [...OPS, ...LIGHTS, ...items].forEach(o => { if (!o.id) o.id = nid++; });
  OPS.forEach(clampOp); buildRoom(); LIGHTS.forEach(mkLight); items.forEach(i => { mk(i); fit(i, false); });
  applyLightMode();
  let s = null;
  if (keepSel && sk) { const pool = sk[0] === 'item' ? items : sk[0] === 'op' ? OPS : LIGHTS, o = pool.find(x => x.id === sk[1]); if (o) s = { k: sk[0], o }; }
  setSel(s); check(); dims(); renderRoom(); renderLights(); markList(); updArea(); renderFile();
}
function openProject(name, fresh) {
  flush(); projName = name;
  const p = PROJ[name]; const st = fresh || (p && p.s) || exampleState();
  load(st); hist = []; hi = -1; commit(); updUndo(); fitView();
}

// ---------- 추가 ----------
function newItem(o) { return { id: nid++, x: R.W / 2, z: R.D / 2, y: 0, rot: 0, ...o }; }
function findPreset(pk) {
  const [c, n] = pk.split('|');
  if (c === 'my') { const p = CUSTOM.find(p => p[0] === n); return p ? { p, pk, my: 1 } : null; }
  const cat = CAT.find(x => x[0] === c); const p = cat && cat[1].find(p => p[0] === n); return p ? { p, pk } : null;
}
function addPreset(pk, p) {
  const [n, w, d, h, c, type, ex = {}] = p, u = SZ[pk];
  const it = newItem({ pk, name: n, w: u ? u.w : w, d: u ? u.d : d, h: u ? u.h : h, bw: w, bd: d, bh: h, color: c, type: type || 'box', ...JSON.parse(JSON.stringify(ex)) });
  if (LAMPS.has(it.type) || it.lt) { it.lt = 1; it.on = true; it.temp = it.temp || 2900; }
  RECENT = [pk, ...RECENT.filter(k => k !== pk)].slice(0, 10); LS.set(K_REC, RECENT);
  placeNew(it); if (u) toast(`저장된 내 크기 ${u.w}×${u.d}×${u.h}cm 로 추가했습니다`);
  renderCatalog();
}
function camWallOrder() { const v = new THREE.Vector3(); cam.getWorldDirection(v); return [...WALLS].sort((a, b) => (NRM[a][0] * v.x + NRM[a][1] * v.z) - (NRM[b][0] * v.x + NRM[b][1] * v.z)); }
function opBlocksWall(it, k) {
  const c = k === 'N' || k === 'S' ? it.x : it.z, [fw, fd] = fp(it), half = (k === 'N' || k === 'S' ? fw : fd) / 2, y0 = it.y || 0, y1 = y0 + it.h;
  return OPS.some(o => o.wall === k && o.c + o.w / 2 > c - half && o.c - o.w / 2 < c + half && o.y < y1 && o.y + o.h > y0);
}
function freeSpot(it) {
  const [fw, fd] = fp(it);
  for (let z = 0; z + fd <= R.D + 0.1; z += 10) for (let x = 0; x + fw <= R.W + 0.1; x += 10) { it.x = x + fw / 2; it.z = z + fd / 2; if (!overlapsAny(it)) return place(it); }
  it.x = R.W / 2; it.z = R.D / 2; fit(it, false);
}
function placeNew(it) {
  items.push(it);
  if (it.mt === 'c') it.y = Math.max(0, R.H - it.h - (it.hang ?? 25));
  mk(it);
  if (it.mt === 'w') {
    let ok = false;
    for (const k of camWallOrder()) {
      const len = wlen(k), [fw0] = fp({ ...it, rot: 0 });
      for (let c = fw0 / 2 + 5; c <= len - fw0 / 2 - 5 && !ok; c += 10) { wallPlace(it, k, c); if (!overlapsAny(it) && !opBlocksWall(it, k)) ok = true; }
      if (ok) break;
    }
    if (!ok) wallPlace(it, camWallOrder()[0], wlen(camWallOrder()[0]) / 2);
    fit(it, false);
  } else if (it.sk) {
    const base = sel && sel.k === 'item' && sel.o !== it && !sel.o.sk && !sel.o.nc && sel.o.h < 140 ? sel.o : items.find(o => o !== it && !o.sk && !o.nc && o.mt !== 'w' && o.mt !== 'c' && o.h >= 30 && o.h <= 130 && fpw(o) * o.d > fpw(it) * it.d * 1.5);
    if (base && PREF.stack) {
      const b = aabb(base); let done = false; it.y = (base.y || 0) + base.h;
      const [fw, fd] = fp(it);
      for (let z = b[2] + fd / 2; z <= b[3] - fd / 2 && !done; z += 5) for (let x = b[0] + fw / 2; x <= b[1] - fw / 2 && !done; x += 5) { it.x = x; it.z = z; if (!overlapsAny(it)) done = true; }
      if (!done) { it.x = base.x; it.z = base.z; }
      fit(it, false);
    } else freeSpot(it);
  } else freeSpot(it);
  setSel({ k: 'item', o: it }); upd();
}
function addOp(kind, st, wall) {
  const len = wlen(wall), H = R.H;
  const o = { id: nid++, kind, wall, st, c: len / 2, fc: kind === 'door' && st.startsWith('jung') ? '#2b2b2d' : '#f3f2ee', hinge: 'L', sw: 'in', ang: 0, cur: 'none', cc: '#e9e1d3' };
  if (kind === 'win') { o.w = Math.min(st === 'full' ? 240 : st === 'tilt' ? 80 : 150, len - 20); o.h = st === 'full' ? H - 25 : 120; o.y = st === 'full' ? 5 : 90; }
  else { o.w = Math.min({ double: 140, jung3: 150, jung1: 140, folding: 180, entrance: 100, slide: 90, open: 100 }[st] || 90, len - 10); o.h = Math.min(210, H - 10); o.y = 0; if (st === 'entrance') o.dc = '#3a3d42'; }
  const others = OPS.filter(x => x.wall === wall);
  for (let c = o.w / 2 + 10; c <= len - o.w / 2 - 10; c += 5) { if (!others.some(x => Math.abs(x.c - c) < (x.w + o.w) / 2 + 5)) { o.c = c; break; } }
  clampOp(o); OPS.push(o); buildRoom(); setSel({ k: 'op', o }, 'sel'); renderRoom(); upd();
}
function addLight(kind) {
  const k = LKIND[kind], l = { id: nid++, kind, w: k.w, d: k.d, drop: k.drop, temp: k.temp || 3000, lum: 1, color: k.color || '#f2f2f0', on: true, rot: 0, x: R.W / 2, z: R.D / 2 };
  if (k.mt === 'w') { l.wall = camWallOrder()[0]; l.c = wlen(l.wall) / 2; l.y = k.y < 0 ? R.H + k.y : k.y; }
  else if (sel && sel.k === 'item') { l.x = sel.o.x; l.z = sel.o.z; if (k.rot) l.rot = (sel.o.rot || 0) % 180; }
  LIGHTS.push(l); mkLight(l); setSel({ k: 'light', o: l }, 'sel'); renderLights(); upd();
  if (plCount() >= MAXL) toast(`실시간 광원은 최대 ${MAXL}개까지 계산됩니다. 나머지는 모양만 표시됩니다.`);
}

// ---------- 명령 ----------
function delSel() {
  if (!sel) return; const o = sel.o;
  if (sel.k === 'item') { fG.remove(o.g); disposeTree(o.g); items = items.filter(i => i !== o); }
  else if (sel.k === 'op') { OPS = OPS.filter(i => i !== o); buildRoom(); renderRoom(); }
  else { ltG.remove(o.g); disposeTree(o.g); LIGHTS = LIGHTS.filter(i => i !== o); renderLights(); }
  setSel(null); upd();
}
function dupSel() {
  if (!sel) return; const o = sel.o;
  if (sel.k === 'item') { const it = newItem({ ...clean(o), id: undefined }); it.id = nid++; it.x += 20; it.z += 20; items.push(it); mk(it); fit(it, false); if (overlapsAny(it)) freeSpot(it); setSel({ k: 'item', o: it }); }
  else if (sel.k === 'op') { const n = { ...clean(o), id: nid++ }; n.c = o.c + o.w + 10; clampOp(n); OPS.push(n); buildRoom(); renderRoom(); setSel({ k: 'op', o: n }); }
  else { const n = { ...clean(o), id: nid++ }; if (lightIsWall(n)) n.c = (n.c || 0) + 40; else { n.x += 40; } LIGHTS.push(n); mkLight(n); renderLights(); setSel({ k: 'light', o: n }); }
  upd();
}
function rotSel(deg = 90) {
  if (!sel) return;
  if (sel.k === 'item') { const it = sel.o; if (it.lock) return toast('잠긴 가구입니다'); it.rot = ((((it.rot || 0) + deg) % 360) + 360) % 360; if (it.mt === 'w') { const k = rotWall(it.rot); wallPlace(it, k, k === 'N' || k === 'S' ? it.x : it.z); } fit(it, false); upd(); }
  else if (sel.k === 'light' && !lightIsWall(sel.o)) { sel.o.rot = (((sel.o.rot || 0) + deg) % 360 + 360) % 360; placeLight(sel.o); upd(); }
}
function setSize(it, k, v) {
  v = Math.max(1, v);
  if (PREF.lock) { const f = v / it[k]; if (!isFinite(f) || f <= 0) return; ['w', 'd', 'h'].forEach(q => { it[q] = r1(Math.max(1, it[q] * f)); }); }
  it[k] = r1(v);
}
function scaleIt(it, f) { ['w', 'd', 'h'].forEach(q => { it[q] = r1(Math.max(1, it[q] * f)); }); }
const pctAll = it => Math.cbrt((it.w / it.bw) * (it.d / it.bd) * (it.h / it.bh)) * 100;
function remember(it) {
  if (!PREF.remember || !it.pk) return;
  SZ[it.pk] = { w: it.w, d: it.d, h: it.h }; LS.set(K_SZ, SZ); renderCatalog();
}
function sizeChanged(it) { refreshItem(it, false); commitSoon(); clearTimeout(it._rt); it._rt = setTimeout(() => remember(it), 600); }
function focusSel() {
  if (!sel) return; const o = sel.o, box = new THREE.Box3().setFromObject(o.g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
  if (cam === camO) { ctl.target.copy(c); camO.position.set(c.x, 2000, c.z + 0.01); camO.zoom = clamp(400 / Math.max(60, sz), 0.5, 8); camO.updateProjectionMatrix(); ctl.update(); return; }
  const dir = camP.position.clone().sub(ctl.target).normalize(); ctl.target.copy(c); camP.position.copy(c).add(dir.multiplyScalar(Math.max(140, sz * 2.2))); ctl.update();
}
let clip = null;
function copySel() { if (sel) { clip = { k: sel.k, o: clean(sel.o) }; toast('복사했습니다 (Ctrl+V 붙여넣기)'); } }
function pasteClip() {
  if (!clip) return;
  if (clip.k === 'item') { const it = normItem({ ...JSON.parse(JSON.stringify(clip.o)), id: nid++ }); it.x += 15; it.z += 15; items.push(it); mk(it); fit(it, false); setSel({ k: 'item', o: it }); }
  else if (clip.k === 'op') { const n = { ...clip.o, id: nid++ }; n.c += n.w + 10; clampOp(n); OPS.push(n); buildRoom(); renderRoom(); setSel({ k: 'op', o: n }); }
  else { const n = { ...clip.o, id: nid++ }; n.x = (n.x || 0) + 30; LIGHTS.push(n); mkLight(n); renderLights(); setSel({ k: 'light', o: n }); }
  upd();
}
function setRoom(k, v) {
  R[k] = v; OPS.forEach(clampOp); buildRoom(); LIGHTS.forEach(placeLight); items.forEach(i => { if (i.mt === 'c') i.y = Math.max(0, R.H - i.h - (i.hang ?? 25)); fit(i, false); }); upd();
}
function shiftRoom(dx, dz) {
  items.forEach(i => { i.x -= dx; i.z -= dz; }); LIGHTS.forEach(l => { if (!lightIsWall(l)) { l.x -= dx; l.z -= dz; } else if (l.wall === 'N' || l.wall === 'S') l.c -= dx; else l.c -= dz; });
  OPS.forEach(o => { if (o.wall === 'N' || o.wall === 'S') o.c -= dx; else o.c -= dz; });
  MEAS.forEach(m => { m[0] -= dx; m[2] -= dx; m[1] -= dz; m[3] -= dz; });
  const off = new THREE.Vector3(-dx, 0, -dz); camP.position.add(off); camO.position.add(off); ctl.target.add(off);
}

// ---------- 카메라 ----------
function useCam(c) { if (cam === c) return; cam = c; ctl.object = c; ctl.enableRotate = c === camP; rsz(); }
function view(k) {
  const cx = R.W / 2, cz = R.D / 2;
  if (k === 'plan') {
    useCam(camO); const asp = camP.aspect || 1, hh = Math.max(R.D * 0.62, R.W * 0.62 / asp) + 30;
    camO.top = hh; camO.bottom = -hh; camO.left = -hh * asp; camO.right = hh * asp; camO.zoom = 1; camO.updateProjectionMatrix();
    camO.position.set(cx, 3000, cz + 0.01); ctl.target.set(cx, 0, cz); ctl.update(); return;
  }
  useCam(camP);
  if (k === 'door') { camP.position.set(cx, 160, R.D + 280); ctl.target.set(cx, 85, cz - 40); }
  else if (k === 'iso') { camP.position.set(cx + 340, 340, R.D + 330); ctl.target.set(cx, 50, cz); }
  else { const h = Math.max(R.D * 1.15, R.W * 1.15 / camP.aspect) / 0.828 + 10; camP.position.set(cx, h, cz + 0.5); ctl.target.set(cx, 0, cz); }
  ctl.update();
}
function fitView() { view(cam === camO ? 'plan' : 'door'); }
document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => view(b.dataset.v));

// ---------- 포인터 ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function ptr(e) { const r = cv.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, cam); }
function planeHit(n, cst) { const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(n, cst), p) ? p : null; }
const hitY = y => planeHit(new THREE.Vector3(0, 1, 0), -y);
function wallPlaneHit(k) { const { W, D } = R; return k === 'N' ? planeHit(new THREE.Vector3(0, 0, 1), 0) : k === 'S' ? planeHit(new THREE.Vector3(0, 0, 1), -D) : k === 'E' ? planeHit(new THREE.Vector3(1, 0, 0), -W) : planeHit(new THREE.Vector3(1, 0, 0), 0); }
function pick() {
  const hs = [...hdG.children]; if (sel && sel.k === 'item' && sel.o.g.userData.hd) hs.push(...sel.o.g.userData.hd);
  const h0 = ray.intersectObjects(hs, true)[0]; if (h0) return h0;
  return ray.intersectObjects([...items.map(i => i.g.userData.m), opG, ltG], true).find(h => h.object.visible !== false) || null;
}
function classify(h) {
  let o = h.object;
  while (o) { const u = o.userData; if (u.rh) return { k: 'rh', it: u.rh, ax: u.ax }; if (u.h) return { k: 'room', w: u.h }; if (u.it) return { k: 'item', o: u.it }; if (u.op) return { k: 'op', o: u.op }; if (u.lt) return { k: 'light', o: u.lt }; o = o.parent; }
  return null;
}
let drag = null, down = null, mode = null, raf = 0;
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  ptr(e); down = { x: e.clientX, y: e.clientY, t: Date.now() };
  if (mode === 'measure') return;
  const h = pick(); if (!h) return; const f = classify(h); if (!f) return;
  const startDrag = d => { drag = d; ctl.enabled = false; try { cv.setPointerCapture(e.pointerId); } catch (_) { } };
  if (f.k === 'rh') { const it = f.it, p = f.ax === 'h' ? null : hitY(it.y || 0); startDrag({ k: 'rh', it, ax: f.ax, w0: it.w, d0: it.d, h0: it.h, x0: it.x, z0: it.z, p0: p }); return; }
  if (f.k === 'room') { startDrag({ k: 'room', w: f.w }); return; }
  if (f.k === 'item') {
    const it = f.o; if (!(sel && sel.o === it)) setSel({ k: 'item', o: it });
    if (it.lock) return;
    const p = hitY(h.point.y); if (p) startDrag({ k: 'item', it, py: h.point.y, ox: it.x - p.x, oz: it.z - p.z });
    return;
  }
  if (f.k === 'op') { const o = f.o; if (!(sel && sel.o === o)) setSel({ k: 'op', o }, 'sel'); const p = wallPlaneHit(o.wall); if (p) startDrag({ k: 'op', o, off: o.c - (o.wall === 'N' || o.wall === 'S' ? p.x : p.z), y0: o.y, py0: p.y }); return; }
  if (f.k === 'light') { const l = f.o; if (!(sel && sel.o === l)) setSel({ k: 'light', o: l }, 'sel'); const py = lightIsWall(l) ? l.y : R.H - 10, p = hitY(py) || hitY(0); if (p) startDrag({ k: 'light', l, py, ox: (l.x || 0) - p.x, oz: (l.z || 0) - p.z }); }
}, true);
cv.addEventListener('pointermove', e => {
  ptr(e);
  if (mode === 'measure' && mzTemp && mzTemp.p0) { const p = hitY(0); if (p) { mzTemp.p1 = [snapV(p.x, 1), snapV(p.z, 1)]; dims(); } return; }
  if (!drag) { if (e.pointerType === 'mouse' && !raf) raf = requestAnimationFrame(() => { raf = 0; const h = pick(), f = h && classify(h); cv.style.cursor = mode === 'measure' ? 'crosshair' : f ? (f.k === 'room' ? (f.w === 'N' || f.w === 'S' ? 'ns-resize' : 'ew-resize') : f.k === 'rh' ? 'nwse-resize' : 'grab') : 'default'; }); return; }
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 3) down.moved = true;
  const d = drag;
  if (d.k === 'item') {
    const it = d.it, p = hitY(d.py); if (!p) return;
    if (it.mt === 'w') { const k = nearestWall(p.x, p.z); wallPlace(it, k, k === 'N' || k === 'S' ? p.x : p.z); fit(it, true); }
    else { it.x = p.x + d.ox; it.z = p.z + d.oz; if (it.sk && PREF.stack) { const t = surfaceFor(it); if (t != null) it.y = t; } fit(it, true); }
    check(); infoSel(); dims(); quick();
  } else if (d.k === 'op') {
    const o = d.o, p = wallPlaneHit(o.wall); if (!p) return;
    let c = (o.wall === 'N' || o.wall === 'S' ? p.x : p.z) + d.off; const len = wlen(o.wall), beyond = 35;
    // 모서리를 넘기면 옆 벽으로: [새 벽, 새 벽에서 모서리 쪽 끝(min/max)]
    const NEXT = { N: [['W', 'min'], ['E', 'min']], S: [['W', 'max'], ['E', 'max']], E: [['N', 'max'], ['S', 'max']], W: [['N', 'min'], ['S', 'min']] };
    if (c < -beyond || c > len + beyond) {
      const [k, end] = NEXT[o.wall][c < 0 ? 0 : 1], nl = wlen(k), hw = Math.min(o.w, nl) / 2;
      o.wall = k; o.c = end === 'min' ? hw + 5 : nl - hw - 5; d.off = 0;
    } else o.c = snapV(c, 5);
    if (e.shiftKey && o.kind === 'win') o.y = snapV(d.y0 + (p.y - d.py0), 5);
    clampOp(o); schedRoom(); infoSel();
  } else if (d.k === 'light') {
    const l = d.l, p = hitY(d.py); if (!p) return;
    if (lightIsWall(l)) { const k = nearestWall(p.x, p.z); l.wall = k; l.c = snapV(k === 'N' || k === 'S' ? p.x : p.z, 5); }
    else { l.x = snapV(p.x + d.ox, 5); l.z = snapV(p.z + d.oz, 5); }
    placeLight(l); updSelBox(); syncSel();
  } else if (d.k === 'room') {
    const p = hitY(0); if (!p) return;
    if (d.w === 'E') R.W = clamp(snapV(p.x, 5), 60, 3000);
    else if (d.w === 'S') R.D = clamp(snapV(p.z, 5), 60, 3000);
    else if (d.w === 'W') { const dx = snapV(p.x, 5); if (dx && R.W - dx >= 60) { shiftRoom(dx, 0); R.W -= dx; } }
    else { const dz = snapV(p.z, 5); if (dz && R.D - dz >= 60) { shiftRoom(0, dz); R.D -= dz; } }
    OPS.forEach(clampOp); schedRoom(true);
  } else if (d.k === 'rh') {
    const it = d.it;
    if (d.ax === 'h') {
      const n = new THREE.Vector3(); cam.getWorldDirection(n); n.y = 0; if (n.lengthSq() < 1e-4) n.set(0, 0, 1); n.normalize();
      const p = planeHit(n, -n.dot(new THREE.Vector3(it.x, 0, it.z))); if (!p) return;
      const nh = Math.max(1, rd(p.y - (it.y || 0) - 6)); if (PREF.lock) { const f = nh / d.h0; it.w = r1(Math.max(1, d.w0 * f)); it.d = r1(Math.max(1, d.d0 * f)); } it.h = nh;
    } else {
      const p = hitY(it.y || 0); if (!p) return;
      const a = (it.rot || 0) * PI / 180, c = Math.cos(a), s = Math.sin(a), k = fpw(it) / it.w;
      const lw0 = d.w0 * k, ax = d.x0 - (lw0 / 2) * c - (d.d0 / 2) * s, az = d.z0 + (lw0 / 2) * s - (d.d0 / 2) * c;
      const dx = p.x - ax, dz = p.z - az, lx = dx * c - dz * s, lz = dx * s + dz * c;
      let nw = Math.max(5, lx) / k, nd = Math.max(5, lz);
      if (PREF.lock) { const f = Math.max(nw / d.w0, nd / d.d0); nw = d.w0 * f; nd = d.d0 * f; it.h = r1(Math.max(1, d.h0 * f)); }
      it.w = rd(nw); it.d = rd(nd);
      const ew = it.w * k; it.x = ax + (ew / 2) * c + (it.d / 2) * s; it.z = az - (ew / 2) * s + (it.d / 2) * c;
    }
    mk(it); fit(it, false); check(); dims(); syncSel(); quick(); infoSel();
  }
});
let rrq = 0;
function schedRoom(full) { if (rrq) return; rrq = requestAnimationFrame(() => { rrq = 0; buildRoom(); if (full) { LIGHTS.forEach(placeLight); items.forEach(i => fit(i, false)); } check(); dims(); syncSel(); updArea(); }); }
function endDrag(e) {
  const wasClick = down && !down.moved && Date.now() - down.t < 600 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6;
  if (mode === 'measure' && wasClick) {
    ptr(e); const p = hitY(0);
    if (p) { const q = [snapV(p.x, 1), snapV(p.z, 1)]; if (!mzTemp || !mzTemp.p0) mzTemp = { p0: q }; else { MEAS.push([...mzTemp.p0, ...q]); mzTemp = null; upd(); toast(`측정: ${rd(Math.hypot(q[0] - MEAS.at(-1)[0], q[1] - MEAS.at(-1)[1]))}cm`); } dims(); }
  } else if (drag) {
    const d = drag; drag = null; ctl.enabled = true;
    if (d.k === 'rh') { remember(d.it); }
    if (d.k === 'room') { renderRoom(); }
    if (d.k === 'op') renderRoom();
    upd(); renderSel();
  } else if (wasClick && down) { ptr(e); if (!pick()) setSel(null); }
  down = null;
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', e => { drag = null; ctl.enabled = true; down = null; });
cv.addEventListener('dblclick', () => focusSel());

addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.key === 'Escape')) return;
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); return redo(); }
  if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); return dupSel(); }
  if (ctrl && (k === 'c' || k === 'C')) return copySel();
  if (ctrl && (k === 'v' || k === 'V')) return pasteClip();
  if (k === 'Escape') { if (mode) setMode(null); else setSel(null); document.activeElement.blur && document.activeElement.blur(); return; }
  if (!sel) return;
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return delSel(); }
  if (k === 'r' || k === 'R') return rotSel(e.shiftKey ? 15 : 90);
  if (k === 'f' || k === 'F') return focusSel();
  const st = e.altKey ? 1 : e.shiftKey ? 20 : 5;
  let dx = 0, dz = 0;
  if (k === 'ArrowLeft') dx = -st; else if (k === 'ArrowRight') dx = st; else if (k === 'ArrowUp') dz = -st; else if (k === 'ArrowDown') dz = st;
  if (sel.k === 'item') {
    const it = sel.o;
    if (k === '[' || k === ']') { if (it.lock) return; scaleIt(it, k === ']' ? 1.05 : 1 / 1.05); sizeChanged(it); return; }
    if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); it.y = Math.max(0, (it.y || 0) + (k === 'PageUp' ? st : -st)); fit(it, false); upd(); return; }
    if ((dx || dz) && !it.lock) { e.preventDefault(); it.x += dx; it.z += dz; if (it.mt === 'w') { const w = rotWall(it.rot); if (w === 'N' || w === 'S') it.z = it.z; } fit(it, false); upd(); }
  } else if (sel.k === 'op' && (dx || dz)) { e.preventDefault(); const o = sel.o, v = o.wall === 'N' || o.wall === 'S' ? dx : dz; if (v) { o.c += v; clampOp(o); buildRoom(); upd(); } else if (o.kind === 'win') { o.y -= dz; clampOp(o); buildRoom(); upd(); } }
  else if (sel.k === 'light' && (dx || dz)) { e.preventDefault(); const l = sel.o; if (lightIsWall(l)) l.c += (l.wall === 'N' || l.wall === 'S') ? dx : dz; else { l.x += dx; l.z += dz; } placeLight(l); upd(); }
});

// ---------- UI 헬퍼 ----------
function h(t, p = {}, ...k) {
  const e = document.createElement(t);
  for (const a in p) { const v = p[a]; if (v == null) continue; if (a === 'class') e.className = v; else if (a.startsWith('on')) e[a] = v; else if (a === 'style') e.style.cssText = v; else if (a === 'html') e.innerHTML = v; else if (typeof v === 'boolean') { if (v) e.setAttribute(a, ''); } else e.setAttribute(a, v); }
  k.flat().forEach(c => c != null && c !== false && e.append(c));
  return e;
}
let BIND = [];
function bnum(get, set, o = {}) {
  const i = h('input', { type: 'number', step: o.step ?? 1, min: o.min, max: o.max });
  const sync = () => { const v = get(); i.value = v == null || !isFinite(v) ? '' : r1(v); }; sync(); BIND.push([i, sync]);
  i.oninput = () => { const v = parseFloat(i.value); if (!isFinite(v)) return; if (o.min != null && v < o.min) return; if (o.max != null && v > o.max) return; set(v); };
  i.onchange = () => { sync(); commitSoon(0); };
  return i;
}
function bsel(opts, get, set) { const s = h('select', {}, opts.map(([v, t]) => h('option', { value: v }, t))); const sync = () => { s.value = String(get()); }; sync(); BIND.push([s, sync]); s.onchange = () => set(s.value); return s; }
function bchk(lbl, get, set, title) { const i = h('input', { type: 'checkbox' }); const sync = () => { i.checked = !!get(); }; sync(); BIND.push([i, sync]); i.onchange = () => set(i.checked); return h('label', { class: 'ck', title }, i, lbl); }
function bcol(get, set) { const i = h('input', { type: 'color' }); const sync = () => { i.value = get() || '#888888'; }; sync(); BIND.push([i, sync]); i.oninput = () => set(i.value); i.onchange = () => commitSoon(0); return i; }
function brange(get, set, min, max, step, fmt) {
  const i = h('input', { type: 'range', min, max, step }), out = h('output');
  const sync = () => { i.value = get(); out.textContent = fmt ? fmt(+i.value) : i.value; }; sync(); BIND.push([i, sync]);
  i.oninput = () => { set(+i.value); out.textContent = fmt ? fmt(+i.value) : i.value; }; i.onchange = () => commitSoon(0);
  return h('div', { class: 'rg' }, i, out);
}
function swatches(list, get, set) { return h('div', { class: 'sw' }, list.map(([c, n]) => h('button', { class: 'swb', title: n, style: `background:${c}`, onclick: () => { set(c); syncSel(); commitSoon(0); } })), bcol(get, set)); }
const app = (el, ...k) => el.append(...k.flat().filter(c => c != null && c !== false));
const F = (lbl, inp, cls) => h('label', { class: 'f' + (cls ? ' ' + cls : '') }, h('span', {}, lbl), inp);
const G = (n, ...k) => h('div', { class: 'g', style: `grid-template-columns:repeat(${n},minmax(0,1fr))` }, ...k);
const BTN = (t, fn, cls = 'o', title) => h('button', { class: cls, onclick: fn, title }, t);
function syncSel() { BIND = BIND.filter(([i]) => i.isConnected); BIND.forEach(([i, s]) => { if (i !== document.activeElement) s(); }); }
let tt = null;
function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, 2600); }
function download(name, data, type) { const a = document.createElement('a'); a.href = typeof data === 'string' && data.startsWith('data:') ? data : URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { a.remove(); }, 100); }
const fname = s => (projName + '_' + s).replace(/[\\/:*?"<>|\s]+/g, '_');

// ---------- 탭 ----------
function showTab(t) {
  PREF.tab = t; savePref();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('#p > section').forEach(s => { s.hidden = s.id !== 't-' + t; });
  if (t === 'list') renderList(); if (t === 'file') renderFile(); if (t === 'room') renderRoom(); if (t === 'light') renderLights();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => showTab(b.dataset.t));

// 카탈로그
const openCats = LS.get('room3d.v2.opencats', { '거실': 1, '침실': 1 });
function renderCatalog() {
  const q = $('q').value.trim().toLowerCase(), box = $('pre'); box.innerHTML = '';
  const cats = [];
  if (CUSTOM.length) cats.push(['내 가구', CUSTOM.map(p => ({ p, pk: 'my|' + p[0], my: 1 }))]);
  if (!q && RECENT.length) { const r = RECENT.map(findPreset).filter(Boolean); if (r.length) cats.push(['최근 사용', r]); }
  CAT.forEach(([c, ls]) => cats.push([c, ls.map(p => ({ p, pk: c + '|' + p[0] }))]));
  let any = false;
  cats.forEach(([c, ls]) => {
    const f = q ? ls.filter(x => x.p[0].toLowerCase().includes(q) || c.includes(q) || (TYPES[x.p[5]] || '').includes(q)) : ls;
    if (!f.length) return; any = true;
    const det = h('details', { open: !!(q || openCats[c] || c === '최근 사용' || c === '내 가구') }, h('summary', {}, c, h('small', {}, ` ${f.length}`)));
    det.ontoggle = () => { openCats[c] = det.open ? 1 : 0; LS.set('room3d.v2.opencats', openCats); };
    const d = h('div', { class: 'ch' });
    f.forEach(x => {
      const u = SZ[x.pk], p = x.p;
      const b = h('button', { class: 'c' + (u ? ' u' : ''), title: `기본 ${p[1]}×${p[2]}×${p[3]}cm` + (u ? `\n내 크기 ${u.w}×${u.d}×${u.h}cm (다음 추가 시 적용)` : '') }, p[0]);
      b.onclick = () => addPreset(x.pk, p);
      if (x.my) { const xx = h('span', { class: 'x', title: '내 가구에서 삭제' }, '×'); xx.onclick = ev => { ev.stopPropagation(); if (!confirm(`'${p[0]}'을(를) 내 가구에서 삭제할까요?`)) return; CUSTOM = CUSTOM.filter(c => c !== p); LS.set(K_CUS, CUSTOM); renderCatalog(); }; app(b, xx); }
      d.append(b);
    });
    det.append(d); box.append(det);
  });
  if (!any) box.append(h('p', { class: 'mu' }, '검색 결과가 없습니다.'));
}
$('q').oninput = renderCatalog;
$('addc').onclick = () => { const it = newItem({ name: '새 가구', w: 60, d: 60, h: 60, bw: 60, bd: 60, bh: 60, color: '#b0a090', type: 'box' }); placeNew(it); showTab('sel'); };

// 선택 패널
function infoSel() {
  const el = $('inf'); if (!el) return; if (!sel) { el.textContent = ''; return; }
  if (sel.k === 'item') {
    const it = sel.o, [fw, fd] = fp(it), w = [];
    if (it.ov) w.push('⚠ 다른 가구와 겹침'); if (it.wb) w.push('⚠ 창문을 가림'); if (it.db) w.push('⚠ 문 열림·통행 간섭');
    el.innerHTML = `벽까지 — 왼쪽 <b>${rd(it.x - fw / 2)}</b> · 오른쪽 <b>${rd(R.W - it.x - fw / 2)}</b> · 뒷벽 <b>${rd(it.z - fd / 2)}</b> · 앞벽 <b>${rd(R.D - it.z - fd / 2)}</b> cm` + (w.length ? `<div class="warn">${w.join(' · ')}</div>` : '');
  } else if (sel.k === 'op') { const o = sel.o, len = wlen(o.wall); el.innerHTML = `${WALLN[o.wall]} 길이 ${rd(len)}cm · 왼쪽 끝까지 <b>${rd(sOf(o) - o.w / 2)}</b> · 오른쪽 끝까지 <b>${rd(len - sOf(o) - o.w / 2)}</b> cm <small>(방 안에서 벽을 바라볼 때)</small>`; }
  else el.textContent = '';
}
function renderSel() {
  const b = $('t-sel'); b.innerHTML = '';
  if (!sel) { app(b, h('p', { class: 'mu' }, '3D 화면이나 목록에서 가구·창호·조명을 선택하세요.'), h('p', { class: 'mu' }, '더블클릭: 선택 대상으로 카메라 이동')); syncSel(); return; }
  if (sel.k === 'item') itemPanel(b, sel.o); else if (sel.k === 'op') opPanel(b, sel.o); else lightPanel(b, sel.o);
  app(b, h('div', { id: 'inf', class: 'inf' })); infoSel(); syncSel();
}
function itemPanel(b, it) {
  const RF = () => refreshItem(it, false), C2 = () => { mk(it); commitSoon(); };
  const u = it.pk && SZ[it.pk];
  app(b, 
    G(5, F('이름', h('input', { type: 'text', value: it.name, oninput: e => { it.name = e.target.value; if (PREF.labels) mk(it); markList(); quick(); commitSoon(); } }), 'c3'), F('색상', bcol(() => it.color, v => { it.color = v; C2(); markList(); })), F('보조색', bcol(() => it.c2 || DEFA[it.type] || '#e9e4da', v => { it.c2 = v; C2(); }))),
    G(2, F('모델 (모양)', bsel(Object.entries(TYPES), () => it.type, v => { it.type = v; RF(); commitSoon(); renderSel(); })),
      F('설치 위치', bsel([['f', '바닥'], ['w', '벽 부착'], ['c', '천장 매달기']], () => it.mt || 'f', v => { it.mt = v === 'f' ? undefined : v; if (v === 'c') it.y = Math.max(0, R.H - it.h - 25); if (v === 'w') { const k = nearestWall(it.x, it.z); wallPlace(it, k, k === 'N' || k === 'S' ? it.x : it.z); if (!it.y) it.y = 100; } if (v === 'f') it.y = 0; RF(); commitSoon(); }))),
    it.type === 'plant' ? F('식물 종류', bsel(PV, () => it.pv || 'leafy', v => { it.pv = v; C2(); })) : null,
    h('h4', {}, '크기 (cm)'),
    G(3, F('가로', bnum(() => it.w, v => { setSize(it, 'w', v); sizeChanged(it); }, { min: 1 })), F('세로 (깊이)', bnum(() => it.d, v => { setSize(it, 'd', v); sizeChanged(it); }, { min: 1 })), F('높이', bnum(() => it.h, v => { setSize(it, 'h', v); sizeChanged(it); }, { min: 1 }))),
    G(3, F('가로 %', bnum(() => it.w / it.bw * 100, v => { setSize(it, 'w', it.bw * v / 100); sizeChanged(it); }, { min: 1, step: 5 })), F('세로 %', bnum(() => it.d / it.bd * 100, v => { setSize(it, 'd', it.bd * v / 100); sizeChanged(it); }, { min: 1, step: 5 })), F('높이 %', bnum(() => it.h / it.bh * 100, v => { setSize(it, 'h', it.bh * v / 100); sizeChanged(it); }, { min: 1, step: 5 }))),
    F('전체 크기 % (기본 크기 대비 · 비율 유지)', (() => { let st = null; const r = brange(() => rd(pctAll(it)), v => { if (!st) st = { w: it.w, d: it.d, h: it.h, p: pctAll(it) }; const f = v / st.p; it.w = r1(Math.max(1, st.w * f)); it.d = r1(Math.max(1, st.d * f)); it.h = r1(Math.max(1, st.h * f)); sizeChanged(it); }, 10, 300, 1, v => v + '%'); r.querySelector('input').addEventListener('change', () => { st = null; }); return r; })()),
    h('div', { class: 'r' }, [50, 75, 90, 100, 110, 125, 150, 200].map(p => BTN(p + '%', () => { it.w = r1(it.bw * p / 100); it.d = r1(it.bd * p / 100); it.h = r1(it.bh * p / 100); sizeChanged(it); }, 'c')), BTN('−5%', () => { scaleIt(it, 1 / 1.05); sizeChanged(it); }, 'c'), BTN('+5%', () => { scaleIt(it, 1.05); sizeChanged(it); }, 'c')),
    h('div', { class: 'cg' }, bchk('가로·세로·높이 비율 유지', () => PREF.lock, v => { PREF.lock = v ? 1 : 0; savePref(); }), bchk('변경한 크기를 다음 추가 시에도 사용', () => PREF.remember, v => { PREF.remember = v ? 1 : 0; savePref(); if (v) remember(it); })),
    h('div', { class: 'mu sm' }, `기본 크기 ${it.bw}×${it.bd}×${it.bh}` + (u ? ` · 저장된 내 크기 ${u.w}×${u.d}×${u.h}` : it.pk ? ' · 저장된 내 크기 없음' : ' · 직접 입력 가구')),
    h('div', { class: 'r' },
      BTN('기본 크기로', () => { it.w = it.bw; it.d = it.bd; it.h = it.bh; if (it.pk && SZ[it.pk]) { delete SZ[it.pk]; LS.set(K_SZ, SZ); renderCatalog(); } refreshItem(it, false); commitSoon(); renderSel(); toast('기본 크기로 되돌리고 저장된 내 크기를 지웠습니다'); }, 'o'),
      u ? BTN('내 크기로', () => { it.w = u.w; it.d = u.d; it.h = u.h; refreshItem(it, false); commitSoon(); }, 'o') : null,
      it.pk ? BTN('이 크기를 내 기본으로 저장', () => { SZ[it.pk] = { w: it.w, d: it.d, h: it.h }; LS.set(K_SZ, SZ); renderCatalog(); renderSel(); toast('다음에 추가할 때 이 크기로 들어갑니다'); }, 'o') : null,
      it.pk ? BTN('같은 종류 모두 이 크기로', () => { let n = 0; items.forEach(o => { if (o !== it && o.pk === it.pk) { o.w = it.w; o.d = it.d; o.h = it.h; mk(o); fit(o, false); n++; } }); upd(); toast(`${n}개 가구에 적용했습니다`); }, 'o') : null),
    h('h4', {}, '위치·회전'),
    G(4, F('왼쪽 벽에서', bnum(() => it.x - fp(it)[0] / 2, v => { it.x = v + fp(it)[0] / 2; fit(it, false); upd(); })), F('뒷벽에서', bnum(() => it.z - fp(it)[1] / 2, v => { it.z = v + fp(it)[1] / 2; fit(it, false); upd(); })),
      F('바닥에서 높이', bnum(() => it.y || 0, v => { it.y = v; fit(it, false); upd(); }, { min: 0 })), F('회전 (°)', bnum(() => it.rot || 0, v => { it.rot = ((v % 360) + 360) % 360; if (it.mt === 'w') { const k = rotWall(it.rot); wallPlace(it, k, k === 'N' || k === 'S' ? it.x : it.z); } fit(it, false); upd(); }, { step: 15 }))),
    h('div', { class: 'r' }, BTN('⟲ 15°', () => rotSel(-15), 'c'), BTN('⟳ 15°', () => rotSel(15), 'c'), BTN('⟳ 90°', () => rotSel(90), 'b'), BTN('가로 중앙', () => { it.x = R.W / 2; fit(it, false); upd(); }, 'c'), BTN('세로 중앙', () => { it.z = R.D / 2; fit(it, false); upd(); }, 'c')),
    h('h4', {}, '옵션'),
    h('div', { class: 'cg' },
      LEAF[it.type] ? bchk('날개 접기', () => it.fold, v => { it.fold = v; RF(); commitSoon(); }) : null,
      bchk('다른 가구 위에 올리기', () => it.sk, v => { it.sk = v ? 1 : 0; commitSoon(); }, '책상·테이블 위로 드래그하면 그 위에 올라갑니다'),
      bchk('겹침 검사 제외 (러그 등)', () => it.nc, v => { it.nc = v ? 1 : 0; RF(); upd(); }),
      bchk('잠금 (이동·크기 고정)', () => it.lock, v => { it.lock = v ? 1 : 0; setSel(sel); commitSoon(); })),
    NOPT[it.type] ? G(3, F(NOPT[it.type], bnum(() => it.n || (it.type === 'cab' ? 2 : 5), v => { if (v >= 1 && v <= 12) { it.n = Math.round(v); C2(); } }, { min: 1, max: 12 }))) : null,
    (LAMPS.has(it.type) || it.lt) ? G(3, F('조명', bsel([['1', '켜짐'], ['0', '꺼짐']], () => it.on === false ? '0' : '1', v => { it.on = v === '1'; C2(); })), F('색온도', bsel(TEMPS, () => it.temp || 2900, v => { it.temp = +v; C2(); })), F('밝기', brange(() => it.lum ?? 0.8, v => { it.lum = v; C2(); }, 0.1, 2, 0.1))) : null,
    h('h4', {}, '견적·메모'),
    G(3, F('가격 (원)', bnum(() => it.price || 0, v => { it.price = v; markList(); commitSoon(); }, { min: 0, step: 1000 })), F('메모', h('input', { type: 'text', value: it.memo || '', placeholder: '구매처, 모델명 등', oninput: e => { it.memo = e.target.value; commitSoon(); } }), 'c2')),
    h('div', { class: 'r' }, BTN('복제 (Ctrl+D)', dupSel), BTN('삭제 (Del)', delSel), BTN('내 가구로 등록', () => {
      const n = prompt('카탈로그 \'내 가구\'에 등록할 이름', it.name); if (!n) return;
      const ex = {}; ['c2', 'mt', 'y', 'n', 'pv', 'sk', 'lt', 'nc', 'lg', 'cols', 'leg', 'sink', 'hb', 'temp'].forEach(k => { if (it[k] != null) ex[k] = it[k]; });
      CUSTOM = CUSTOM.filter(p => p[0] !== n); CUSTOM.push([n, it.w, it.d, it.h, it.color, it.type, ex]); LS.set(K_CUS, CUSTOM); renderCatalog(); toast(`'${n}'을(를) 내 가구에 등록했습니다`);
    }), BTN('카메라 맞춤', focusSel)),
  );
}
function opPanel(b, o) {
  const RB = () => { clampOp(o); buildRoom(); check(); dims(); syncSel(); infoSel(); markList(); commitSoon(); };
  const isWin = o.kind === 'win', st = o.st, swing = SWING.has(st), axisLbl = o.wall === 'N' || o.wall === 'S' ? '왼쪽 벽에서' : '뒷벽에서';
  app(b, 
    h('h3', {}, isWin ? '창문' : '문·출입구'),
    G(2, F('종류', bsel(isWin ? WIN_ST : DOOR_ST, () => o.st, v => { o.st = v; if (isWin && v === 'full') { o.y = 5; o.h = R.H - 25; } RB(); renderSel(); renderRoom(); })), F('설치 벽', bsel(WALLS.map(k => [k, WALLN[k]]), () => o.wall, v => { o.wall = v; RB(); renderSel(); renderRoom(); }))),
    G(4, F(axisLbl, bnum(() => o.c - o.w / 2, v => { o.c = v + o.w / 2; RB(); }, { min: 0 })), F('폭', bnum(() => o.w, v => { const e0 = o.c - o.w / 2; o.w = v; o.c = e0 + v / 2; RB(); }, { min: 20 })), F('높이', bnum(() => o.h, v => { o.h = v; RB(); }, { min: 20 })), isWin ? F('바닥에서', bnum(() => o.y, v => { o.y = v; RB(); }, { min: 0 })) : F('', h('span'))),
    h('div', { class: 'r' }, BTN('벽 중앙에 맞추기', () => { o.c = (o.wall === 'N' || o.wall === 'S' ? R.W : R.D) / 2; RB(); }, 'c')),
    h('h4', {}, '색상'),
    F('프레임 색', swatches(FCOLS, () => o.fc || '#f3f2ee', v => { o.fc = v; RB(); })),
    !isWin && st !== 'open' ? F('문짝 색', swatches([['#f3f2ee', '화이트'], ['#e6dccb', '아이보리'], ['#a0714f', '우드'], ['#6b4e3d', '월넛'], ['#6d6f75', '그레이'], ['#3a3d42', '차콜'], ['#2f4f6f', '네이비']], () => o.dc || '#f3f2ee', v => { o.dc = v; RB(); })) : null,
    !isWin && st !== 'open' ? h('div', { class: 'cg' }, ['swing', 'double', 'slide', 'entrance'].includes(st) ? bchk('유리 삽입', () => o.glass, v => { o.glass = v ? 1 : 0; RB(); }) : null) : null,
    !isWin && st !== 'open' && st !== 'double' ? G(2, F(swing ? '경첩 위치' : '열리는 방향', bsel([['L', '왼쪽'], ['R', '오른쪽']], () => o.hinge || 'L', v => { o.hinge = v; RB(); })), swing || st === 'folding' ? F('열림 방향', bsel([['in', '방 안쪽으로'], ['out', '바깥쪽으로']], () => o.sw || 'in', v => { o.sw = v; RB(); })) : F('', h('span'))) : null,
    !isWin && st !== 'open' ? F(swing ? '열림 각도' : '열림 정도', brange(() => o.ang || 0, v => { o.ang = v; RB(); }, 0, 90, 5, v => swing ? v + '°' : rd(v / 90 * 100) + '%')) : null,
    isWin ? G(2, F('커튼·블라인드', bsel(CURT, () => o.cur || 'none', v => { o.cur = v; RB(); renderSel(); })), o.cur && o.cur !== 'none' ? F('커튼 색', bcol(() => o.cc || '#e9e1d3', v => { o.cc = v; RB(); })) : F('', h('span'))) : null,
    h('div', { class: 'r' }, BTN('복제', dupSel), BTN('삭제', delSel), BTN('카메라 맞춤', focusSel)),
    h('p', { class: 'mu sm' }, '3D 화면에서 창호를 드래그하면 벽을 따라 이동하고, 모서리를 넘기면 옆 벽으로 옮겨집니다. 창문은 Shift+드래그로 높이 조절.'),
  );
}
function lightPanel(b, l) {
  const RB = () => { mkLight(l); updSelBox(); syncSel(); commitSoon(); renderLights(); }, k = LKIND[l.kind] || LKIND.down, isW = lightIsWall(l);
  app(b, 
    h('h3', {}, '조명'),
    G(2, F('종류', bsel(Object.entries(LKIND).map(([a, v]) => [a, v.n]), () => l.kind, v => { const was = lightIsWall(l); l.kind = v; const nk = LKIND[v]; l.w = nk.w; l.d = nk.d; l.drop = nk.drop; if (!was && nk.mt === 'w') { l.wall = nearestWall(l.x, l.z); l.c = l.wall === 'N' || l.wall === 'S' ? l.x : l.z; l.y = nk.y < 0 ? R.H + nk.y : nk.y; } if (was && nk.mt !== 'w') { const [x, z] = wxz(l.wall, l.c); l.x = x; l.z = z; } RB(); renderSel(); })), F('켜기/끄기', bsel([['1', '켜짐'], ['0', '꺼짐']], () => l.on === false ? '0' : '1', v => { l.on = v === '1'; RB(); }))),
    G(2, F('색온도', bsel(TEMPS, () => l.temp || 3000, v => { l.temp = +v; RB(); })), F('밝기', brange(() => l.lum ?? 1, v => { l.lum = v; RB(); }, 0.1, 2.5, 0.1))),
    F('기구 색', swatches([['#f2f2f0', '화이트'], ['#2b2b2d', '블랙'], ['#b59a5b', '골드'], ['#b8bcc2', '실버'], ['#a0714f', '우드']], () => l.color || '#f2f2f0', v => { l.color = v; RB(); })),
    isW ? G(3, F('설치 벽', bsel(WALLS.map(a => [a, WALLN[a]]), () => l.wall, v => { l.wall = v; RB(); })), F(l.wall === 'N' || l.wall === 'S' ? '왼쪽 벽에서' : '뒷벽에서', bnum(() => l.c, v => { l.c = v; placeLight(l); updSelBox(); commitSoon(); })), F('바닥에서 높이', bnum(() => l.y, v => { l.y = v; placeLight(l); updSelBox(); commitSoon(); })))
      : G(3, F('왼쪽 벽에서', bnum(() => l.x, v => { l.x = v; placeLight(l); updSelBox(); commitSoon(); })), F('뒷벽에서', bnum(() => l.z, v => { l.z = v; placeLight(l); updSelBox(); commitSoon(); })), k.rot ? F('회전 (°)', bnum(() => l.rot || 0, v => { l.rot = v; placeLight(l); updSelBox(); commitSoon(); }, { step: 15 })) : F('', h('span'))),
    G(3, F(l.kind === 'panel' ? '가로' : '크기·길이', bnum(() => l.w || k.w, v => { l.w = v; RB(); }, { min: 4 })), l.kind === 'panel' ? F('세로', bnum(() => l.d || k.d, v => { l.d = v; RB(); }, { min: 4 })) : null, k.drop != null ? F('천장에서 내림', bnum(() => l.drop ?? k.drop, v => { l.drop = v; RB(); }, { min: 5 })) : null),
    h('div', { class: 'r' }, BTN('복제', dupSel), BTN('삭제', delSel), BTN('카메라 맞춤', focusSel)),
    h('p', { class: 'mu sm' }, '3D 화면에서 조명을 드래그해 위치를 옮길 수 있습니다. 야간 모드에서 조명 효과가 잘 보입니다.'),
  );
}

// 빠른 도구 막대
function quick() {
  const q = $('qb'); if (!sel) { q.hidden = true; return; } q.hidden = false;
  const o = sel.o, it = sel.k === 'item';
  $('qbn').textContent = it ? `${o.name} · ${r1(fpw(o))}×${r1(o.d)}×${r1(o.h)}` : sel.k === 'op' ? `${(o.kind === 'win' ? WIN_ST : DOOR_ST).find(s => s[0] === o.st)?.[1] || ''} · ${rd(o.w)}×${rd(o.h)}` : (LKIND[o.kind] || {}).n;
  q.querySelectorAll('.qi').forEach(e => e.hidden = !it);
  const rotOK = it || (sel.k === 'light' && !lightIsWall(o));
  q.querySelector('[data-q=rot]').hidden = !rotOK;
  if (it && document.activeElement !== $('qbp')) $('qbp').value = rd(pctAll(o));
  q.querySelector('[data-q=lock]').textContent = it && o.lock ? '🔒' : '🔓';
}
$('qb').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b || !sel) return; const a = b.dataset.q, o = sel.o;
  if (a === 'rot') rotSel(90); else if (a === 'dup') dupSel(); else if (a === 'del') delSel(); else if (a === 'edit') showTab('sel'); else if (a === 'focus') focusSel();
  else if (sel.k === 'item') {
    if (a === 'lock') { o.lock = o.lock ? 0 : 1; setSel(sel); commitSoon(); return; }
    if (o.lock) return toast('잠긴 가구입니다');
    if (a === 'm') { scaleIt(o, 1 / 1.05); sizeChanged(o); } if (a === 'p') { scaleIt(o, 1.05); sizeChanged(o); }
  }
});
$('qbp').onchange = e => { const v = parseFloat(e.target.value); if (sel && sel.k === 'item' && v > 0 && !sel.o.lock) { scaleIt(sel.o, v / pctAll(sel.o)); sizeChanged(sel.o); } };

// 방·창호 탭
function updArea() { const el = $('area'); if (el) { const a = R.W * R.D / 10000; el.textContent = `면적 ${a.toFixed(2)}㎡ (${(a / 3.3058).toFixed(2)}평) · 둘레 ${rd((R.W + R.D) * 2)}cm`; } }
function renderRoom() {
  const b = $('t-room'); if (b.hidden && b.childElementCount) { b.dataset.dirty = 1; return; } b.innerHTML = '';
  const ws = h('select', {}, WALLS.map(k => h('option', { value: k }, WALLN[k]))), wst = h('select', {}, WIN_ST.map(([v, t]) => h('option', { value: v }, t)));
  const ds = h('select', {}, WALLS.map(k => h('option', { value: k }, WALLN[k]))), dst = h('select', {}, DOOR_ST.map(([v, t]) => h('option', { value: v }, t)));
  ws.value = 'N'; ds.value = 'S';
  app(b, 
    h('h3', {}, '방 치수 (cm)'),
    G(3, F('가로 (좌↔우)', bnum(() => R.W, v => setRoom('W', v), { min: 60 })), F('깊이 (뒤↔앞)', bnum(() => R.D, v => setRoom('D', v), { min: 60 })), F('천장 높이', bnum(() => R.H, v => setRoom('H', v), { min: 150 }))),
    h('div', { class: 'mu sm', id: 'area' }),
    h('div', { class: 'cg' }, bchk('벽 크기 조절 핸들 (3D 화면 주황 원)', () => PREF.handles, v => { PREF.handles = v ? 1 : 0; savePref(); buildHandles(); syncTb(); })),
    h('h3', {}, '마감재'),
    F('바닥재', G(2, bsel(FLOORS, () => R.fl, v => { R.fl = v; buildRoom(); commitSoon(); }), bcol(() => R.flc, v => { R.flc = v; buildRoom(); }))),
    h('div', { class: 'sw' }, [['#cdb892', '오크'], ['#e2cfa8', '메이플'], ['#a77b55', '티크'], ['#6b4a35', '월넛'], ['#d8d4cc', '그레이 타일'], ['#f1eee8', '화이트 타일'], ['#9a9894', '콘크리트']].map(([c, n]) => h('button', { class: 'swb', title: n, style: `background:${c}`, onclick: () => { R.flc = c; buildRoom(); syncSel(); commitSoon(); } }))),
    F('벽 색 (전체)', swatches([['#f0ede6', '화이트'], ['#f5f1e8', '아이보리'], ['#e9e4dc', '웜그레이'], ['#dfe3e6', '쿨그레이'], ['#d9cbb8', '베이지'], ['#c9d3c4', '세이지'], ['#cfd9e3', '스카이'], ['#3f4652', '네이비']], () => R.wc, v => { R.wc = v; buildRoom(); })),
    h('details', {}, h('summary', {}, '포인트 벽 (벽별 색상)'),
      G(4, WALLS.map(k => F(WALLN[k].replace(' (입구쪽)', ''), h('div', { class: 'pw' }, bcol(() => R.wcs[k] || R.wc, v => { R.wcs[k] = v; buildRoom(); }), BTN('×', () => { delete R.wcs[k]; buildRoom(); syncSel(); commitSoon(); }, 'x', '전체 벽 색으로'))))),
      F('걸레받이 색', bcol(() => R.bb, v => { R.bb = v; buildRoom(); }))),
    h('h3', {}, '창문·문 추가'),
    G(3, F('창문 종류', wst), F('벽', ws), F(' ', BTN('+ 창문', () => addOp('win', wst.value, ws.value), 'b'))),
    G(3, F('문 종류', dst), F('벽', ds), F(' ', BTN('+ 문', () => addOp('door', dst.value, ds.value), 'b'))),
    h('h3', {}, `창호 목록 (${OPS.length})`),
    h('div', {}, OPS.length ? OPS.map(o => {
      const nm = (o.kind === 'win' ? WIN_ST : DOOR_ST).find(s => s[0] === o.st)?.[1] || o.st, same = OPS.filter(x => x !== o && x.wall === o.wall && Math.abs(x.c - o.c) < (x.w + o.w) / 2 - 0.5);
      const row = h('div', { class: 'it' + (sel && sel.o === o ? ' s' : ''), onclick: () => setSel({ k: 'op', o }, 'sel') }, h('i', { style: `background:${o.kind === 'win' ? '#9ec9ff' : '#e8590c'}` }), h('span', {}, `${o.kind === 'win' ? '🪟' : '🚪'} ${nm}`), same.length ? h('em', {}, '겹침') : null, h('small', {}, `${WALLN[o.wall]} · ${rd(o.w)}×${rd(o.h)}`));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); OPS = OPS.filter(q => q !== o); if (sel && sel.o === o) setSel(null); buildRoom(); renderRoom(); upd(); }; row.append(x); return row;
    }) : h('p', { class: 'mu' }, '창호가 없습니다.')),
    h('div', { class: 'cg' }, bchk('문 표시 (끄면 투명)', () => PREF.vdoor, v => { PREF.vdoor = v ? 1 : 0; savePref(); applyVis(); syncTb(); }), bchk('창문 표시', () => PREF.vwin, v => { PREF.vwin = v ? 1 : 0; savePref(); applyVis(); syncTb(); })),
    h('h3', {}, '치수선 표시'),
    h('div', { class: 'cg' }, [['room', '방 크기'], ['ops', '모든 창호 위치'], ['item', '선택 가구 크기'], ['gap', '주변 간격 (벽·가구까지)']].map(([k, n]) => bchk(n, () => PREF.dims[k], v => { PREF.dims[k] = v ? 1 : 0; savePref(); dims(); }))),
    h('p', { class: 'mu sm' }, '주변 간격이 빨간색이면 통로 폭이 60cm 미만입니다.'),
    MEAS.length ? h('div', { class: 'r' }, BTN(`줄자 측정선 ${MEAS.length}개 지우기`, () => { MEAS = []; dims(); upd(); renderRoom(); })) : null,
  );
  updArea(); syncSel(); delete b.dataset.dirty;
}
function renderLights() {
  const b = $('t-light'); if (b.hidden && b.childElementCount) { b.dataset.dirty = 1; return; } b.innerHTML = '';
  app(b, 
    h('h3', {}, '조명 분위기'),
    h('div', { class: 'r' }, BTN('☀ 주간', () => setNight(0), PREF.night ? 'o' : 'b'), BTN('🌙 야간 (조명 효과 보기)', () => setNight(1), PREF.night ? 'b' : 'o')),
    h('h3', {}, '천장·벽 조명 추가 (클릭)'),
    h('div', { class: 'ch' }, Object.entries(LKIND).map(([k, v]) => BTN(v.n, () => addLight(k), 'c'))),
    h('p', { class: 'mu sm' }, '가구를 선택한 상태에서 펜던트를 추가하면 그 가구 바로 위에 달립니다. 스탠드는 \'가구 추가 → 스탠드·조명\'에 있습니다.'),
    h('h3', {}, `설치된 조명 (${LIGHTS.length})`),
    h('div', {}, LIGHTS.length ? LIGHTS.map(l => {
      const row = h('div', { class: 'it' + (sel && sel.o === l ? ' s' : ''), onclick: () => setSel({ k: 'light', o: l }, 'sel') }, h('i', { style: `background:#${kelvin(l.temp).getHexString()};border:1px solid #ccc` }), h('span', {}, `💡 ${(LKIND[l.kind] || {}).n}`), l.on === false ? h('em', {}, '꺼짐') : null, h('small', {}, `${l.temp}K`));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); ltG.remove(l.g); disposeTree(l.g); LIGHTS = LIGHTS.filter(q => q !== l); if (sel && sel.o === l) setSel(null); renderLights(); upd(); }; row.append(x); return row;
    }) : h('p', { class: 'mu' }, '설치된 조명이 없습니다.')),
    h('p', { class: 'mu sm' }, `실시간 광원은 최대 ${MAXL}개(스탠드 포함)까지 계산됩니다.`),
  );
  delete b.dataset.dirty;
}
function setNight(v) { PREF.night = v ? 1 : 0; savePref(); applyLightMode(); renderLights(); }

// 목록 탭
let listDirty = true;
function markList() { listDirty = true; if (!$('t-list').hidden) renderList(); }
const won = n => (n || 0).toLocaleString('ko-KR') + '원';
function renderList() {
  if (!listDirty && $('t-list').childElementCount) return; listDirty = false;
  const b = $('t-list'); b.innerHTML = '';
  const area = R.W * R.D, occ = items.filter(i => !i.nc && (i.y || 0) < 1 && i.mt !== 'w').reduce((s, i) => s + fpw(i) * i.d, 0), price = items.reduce((s, i) => s + (+i.price || 0), 0);
  const warn = items.filter(i => i.ov || i.wb || i.db).length;
  app(b, 
    h('div', { class: 'stats' },
      h('div', {}, h('b', {}, `${(area / 10000).toFixed(2)}㎡`), h('small', {}, `${(area / 10000 / 3.3058).toFixed(1)}평`)),
      h('div', {}, h('b', {}, `${items.length}개`), h('small', {}, '가구·소품')),
      h('div', {}, h('b', {}, `${rd(occ / area * 100)}%`), h('small', {}, '바닥 점유율')),
      h('div', {}, h('b', {}, won(price)), h('small', {}, '예상 금액'))),
    warn ? h('p', { class: 'warn' }, `⚠ 확인 필요한 가구 ${warn}개 (겹침 · 창문 가림 · 문 간섭)`) : null,
    h('div', {}, items.length ? items.map(it => {
      const d = h('div', { class: 'it' + (sel && sel.o === it ? ' s' : ''), onclick: () => setSel({ k: 'item', o: it }), ondblclick: () => { setSel({ k: 'item', o: it }); focusSel(); } }, h('i', { style: `background:${it.color}` }), h('span', {}, it.name));
      if (it.lock) d.append(h('em', { class: 'g' }, '🔒')); if (it.ov) d.append(h('em', {}, '겹침')); if (it.wb) d.append(h('em', {}, '창문 가림')); if (it.db) d.append(h('em', {}, '문 간섭'));
      d.append(h('small', {}, `${r1(fpw(it))}×${r1(it.d)}×${r1(it.h)}` + (it.price ? ` · ${won(it.price)}` : '')));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); setSel({ k: 'item', o: it }); delSel(); }; d.append(x);
      return d;
    }) : h('p', { class: 'mu' }, '가구가 없습니다. \'가구 추가\' 탭에서 추가하세요.')),
    h('div', { class: 'r' }, BTN('CSV(엑셀) 내보내기', exportCSV, 'b'), BTN('평면도 + 목록 인쇄', printPlan)),
  );
}
function exportCSV() {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['번호', '이름', '분류', '모델', '가로', '세로', '높이', '바닥에서', '회전', '왼쪽벽에서', '뒷벽에서', '가격', '메모']];
  items.forEach((it, i) => { const [fw, fd] = fp(it); rows.push([i + 1, it.name, (it.pk || '직접입력|').split('|')[0], TYPES[it.type] || it.type, r1(fpw(it)), r1(it.d), r1(it.h), r1(it.y || 0), it.rot || 0, rd(it.x - fw / 2), rd(it.z - fd / 2), it.price || 0, it.memo || '']); });
  rows.push([]); rows.push(['', '합계', '', '', '', '', '', '', '', '', '', items.reduce((s, i) => s + (+i.price || 0), 0), '']);
  rows.push(['', `방 ${R.W}×${R.D}×${R.H}cm`]);
  download(fname('가구목록.csv'), '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function planState() { return { ...snap(), items: items.map(i => ({ ...clean(i), fw: fpw(i) })) }; }
function shot3D() { renderer.render(scene, cam); return cv.toDataURL('image/png'); }
function printPlan() {
  const img = drawPlan(planState(), { title: projName }).toDataURL('image/png'), s3 = shot3D(), pr = $('pr');
  const price = items.reduce((s, i) => s + (+i.price || 0), 0);
  pr.innerHTML = '';
  pr.append(h('h1', {}, projName), h('img', { src: img, class: 'plan' }), h('img', { src: s3, class: 'v3' }),
    h('table', {}, h('thead', {}, h('tr', {}, ['#', '이름', '크기 (가로×세로×높이)', '위치 (왼쪽·뒷벽에서)', '가격', '메모'].map(t => h('th', {}, t)))),
      h('tbody', {}, items.map((it, i) => { const [fw, fd] = fp(it); return h('tr', {}, [i + 1, it.name, `${r1(fpw(it))}×${r1(it.d)}×${r1(it.h)}`, `${rd(it.x - fw / 2)} · ${rd(it.z - fd / 2)}`, it.price ? won(it.price) : '', it.memo || ''].map(t => h('td', {}, String(t)))); })),
      h('tfoot', {}, h('tr', {}, h('td', { colspan: 4 }, '합계'), h('td', {}, won(price)), h('td', {})))));
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); }, 300);
}

// 파일 탭
function renderFile() {
  const b = $('t-file'); if (b.hidden && b.childElementCount) return; b.innerHTML = '';
  const names = Object.keys(PROJ).sort((a, c) => (PROJ[c].t || 0) - (PROJ[a].t || 0));
  const fi = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fi.onchange = () => { const f = fi.files[0]; if (!f) return; f.text().then(t => importJSON(t, f.name)).catch(() => toast('파일을 읽지 못했습니다')); fi.value = ''; };
  app(b, 
    h('h3', {}, '프로젝트 (자동 저장)'),
    F('현재 프로젝트', bsel(names.map(n => [n, n]), () => projName, v => { if (v !== projName) { openProject(v); } })),
    h('div', { class: 'r' },
      BTN('+ 새 프로젝트', () => { const n = uniq(prompt('새 프로젝트 이름', '새 방') || ''); if (!n) return; const empty = confirm('빈 방으로 시작할까요?\n(취소를 누르면 예시 가구가 들어간 방으로 시작)'); openProject(n, empty ? emptyState() : exampleState()); renderFile(); }, 'b'),
      BTN('다른 이름으로 저장', () => { const n = uniq(prompt('저장할 이름', projName + ' 복사본') || ''); if (!n) return; flush(); const s = snap(); openProject(n, s); renderFile(); toast(`'${n}'(으)로 저장했습니다`); }),
      BTN('이름 변경', () => { const n = (prompt('새 이름', projName) || '').trim(); if (!n || n === projName) return; if (PROJ[n]) return toast('같은 이름이 있습니다'); PROJ[n] = PROJ[projName]; delete PROJ[projName]; projName = n; LS.set(K_PROJ, PROJ); LS.set(K_CUR, n); renderFile(); }),
      BTN('삭제', () => { if (Object.keys(PROJ).length <= 1) return toast('마지막 프로젝트는 삭제할 수 없습니다'); if (!confirm(`'${projName}' 프로젝트를 삭제할까요?`)) return; delete PROJ[projName]; LS.set(K_PROJ, PROJ); openProject(Object.keys(PROJ)[0]); renderFile(); })),
    h('h3', {}, '파일로 저장·불러오기'),
    h('div', { class: 'r' }, BTN('JSON 파일로 내보내기', exportJSON, 'b'), BTN('JSON 파일 가져오기', () => fi.click()), fi),
    h('p', { class: 'mu sm' }, '내보낸 파일에는 배치, 창호, 조명과 저장된 내 크기·내 가구가 함께 들어 있어 다른 PC에서도 그대로 이어서 작업할 수 있습니다.'),
    h('h3', {}, '이미지·인쇄'),
    h('div', { class: 'r' }, BTN('3D 화면 PNG', () => download(fname('3D.png'), shot3D())), BTN('평면도 PNG', () => download(fname('평면도.png'), drawPlan(planState(), { title: projName }).toDataURL('image/png'))), BTN('평면도 + 목록 인쇄/PDF', printPlan, 'b')),
    h('h3', {}, `저장된 내 크기 (${Object.keys(SZ).length})`),
    h('div', { class: 'cg' }, bchk('가구 크기를 바꾸면 다음 추가 시에도 그 크기 사용', () => PREF.remember, v => { PREF.remember = v ? 1 : 0; savePref(); })),
    h('div', {}, Object.keys(SZ).length ? Object.entries(SZ).map(([pk, v]) => { const row = h('div', { class: 'it' }, h('span', {}, pk.split('|')[1]), h('small', {}, `${v.w}×${v.d}×${v.h}`)); const x = h('button', { class: 'x', title: '기본 크기로 되돌리기' }, '×'); x.onclick = () => { delete SZ[pk]; LS.set(K_SZ, SZ); renderCatalog(); renderFile(); }; row.append(x); return row; }) : h('p', { class: 'mu sm' }, '아직 없습니다. 가구 크기를 바꾸면 여기에 기록됩니다.')),
    Object.keys(SZ).length ? h('div', { class: 'r' }, BTN('모두 기본 크기로', () => { if (!confirm('저장된 내 크기를 모두 지울까요?')) return; SZ = {}; LS.set(K_SZ, SZ); renderCatalog(); renderFile(); })) : null,
    h('h3', {}, '초기화'),
    h('div', { class: 'r' }, BTN('가구 모두 지우기', () => { if (!confirm('이 프로젝트의 가구를 모두 지울까요? (Ctrl+Z로 되돌릴 수 있음)')) return; items.forEach(i => { fG.remove(i.g); disposeTree(i.g); }); items = []; setSel(null); upd(); }), BTN('예시 상태로 되돌리기', () => { if (!confirm('처음 예시 상태로 되돌릴까요? (Ctrl+Z로 되돌릴 수 있음)')) return; load(exampleState()); upd(); fitView(); })),
  );
  syncSel();
}
function uniq(n) { n = n.trim(); if (!n) return ''; let k = n, i = 2; while (PROJ[k]) k = `${n} (${i++})`; return k; }
function exportJSON() { flush(); download(fname('배치.json'), JSON.stringify({ app: 'room3d', v: 2, name: projName, state: snap(), sizes: SZ, custom: CUSTOM }, null, 1), 'application/json'); }
function importJSON(t, fn) {
  let d; try { d = JSON.parse(t); } catch (e) { return toast('JSON 형식이 아닙니다'); }
  let st = d.state; if (!st && d.R && Array.isArray(d.items)) st = d.R.wz != null ? migrateV1(d) : d;
  if (!st) return toast('배치 파일이 아닙니다');
  if (d.sizes) { SZ = { ...SZ, ...d.sizes }; LS.set(K_SZ, SZ); }
  if (Array.isArray(d.custom)) { d.custom.forEach(p => { if (!CUSTOM.some(c => c[0] === p[0])) CUSTOM.push(p); }); LS.set(K_CUS, CUSTOM); }
  const n = uniq(d.name || fn.replace(/\.json$/i, '') || '가져온 방'); openProject(n, st); renderCatalog(); renderFile(); toast(`'${n}'을(를) 불러왔습니다`);
}

// ---------- 툴바 ----------
const TBK = [['snap', '스냅·벽/가구 붙이기'], ['handles', '벽 크기 핸들'], ['labels', '가구 이름표'], ['ceil', '천장 표시'], ['vdoor', '문 표시'], ['vwin', '창문 표시'], ['stack', '소품 위에 올리기']];
$('ddm').append(...TBK.map(([k, n]) => { const i = h('input', { type: 'checkbox', 'data-k': k }); i.onchange = () => { PREF[k] = i.checked ? 1 : 0; savePref(); onPref(k); }; return h('label', {}, i, ' ' + n); }));
function syncTb() { document.querySelectorAll('#ddm input').forEach(i => { i.checked = !!PREF[i.dataset.k]; }); }
function onPref(k) {
  if (k === 'handles') buildHandles(); else if (k === 'labels') items.forEach(mk); else if (k === 'ceil') roomG.children.forEach(c => { if (c.userData.ceil) c.visible = !!PREF.ceil; });
  else if (k === 'vdoor' || k === 'vwin') applyVis();
  syncSel();
}
function setMode(m) { mode = m; mzTemp = null; $('mz').classList.toggle('on', m === 'measure'); cv.style.cursor = m === 'measure' ? 'crosshair' : 'default'; $('hint').textContent = m === 'measure' ? '줄자: 바닥의 두 점을 차례로 클릭하세요 · Esc 종료 · 측정선은 \'방·창호\' 탭에서 지울 수 있습니다' : HINT; dims(); }
$('mz').onclick = () => setMode(mode === 'measure' ? null : 'measure');
$('night').onclick = () => setNight(PREF.night ? 0 : 1);
$('shot').onclick = () => download(fname('3D.png'), shot3D());
$('undo').onclick = undo; $('redo').onclick = redo;
const HINT = '드래그: 이동 · 빈 곳 드래그: 회전 · 우클릭 드래그: 이동 · 휠: 확대 · 파란 점/주황 화살표: 크기 · R 회전 · Del 삭제 · Ctrl+Z 되돌리기 · 더블클릭: 확대';
$('hint').textContent = HINT;
document.addEventListener('click', e => { const dd = $('dd'); if (dd.open && !dd.contains(e.target)) dd.open = false; });

// ---------- 시작 ----------
window.addEventListener('beforeunload', flush);
(function init() {
  if (!Object.keys(PROJ).length) {
    const v1 = LS.get('roomLayoutV1', null);
    PROJ['내 방'] = { t: Date.now(), s: v1 && v1.R ? migrateV1(v1) : exampleState() };
  }
  let cur = LS.get(K_CUR, null); if (!cur || !PROJ[cur]) cur = Object.keys(PROJ)[0];
  syncTb(); renderCatalog(); rsz();
  showTab(PREF.tab === 'sel' ? 'add' : PREF.tab || 'add');
  openProject(cur);
  view('door');
})();
(function loop() { requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); })();

// 테스트·디버깅용
window.__room3d = { scene, get cam() { return cam; }, THREE, scr(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam), r = cv.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, get sel() { return sel; }, get SZ() { return SZ; }, get items() { return items; }, get ops() { return OPS; }, get lights() { return LIGHTS; }, get R() { return R; }, CAT, addPreset, addOp, addLight, setSel, view, undo, redo, setRoom, drawPlan: () => drawPlan(planState(), { title: projName }) };
