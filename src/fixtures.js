// 창문·문(창호)과 천장/벽 조명 3D 모델
// 창호 로컬 좌표: x = 벽을 따라(방 안에서 벽을 볼 때 오른쪽이 +), y = 바닥에서 높이, z = 방 안쪽(+)
import * as THREE from 'three';
import { viewTexture } from './materials.js';
const PI = Math.PI;

export const WIN_ST = [['slide', '미서기창 (2짝)'], ['slide4', '미서기창 (4짝)'], ['casement', '여닫이창'], ['tilt', '시스템창 (턴앤틸트)'], ['fixed', '고정창 (픽스)'], ['grid', '격자창'], ['full', '통창']];
export const DOOR_ST = [['swing', '여닫이문'], ['double', '양개 여닫이문'], ['slide', '미닫이문'], ['jung3', '3연동 중문'], ['jung1', '원슬라이딩 중문'], ['swingG', '여닫이 유리 중문'], ['folding', '폴딩도어'], ['entrance', '현관문'], ['open', '개구부 (문 없음)']];
export const FCOLS = [['#f3f2ee', '화이트'], ['#2b2b2d', '블랙'], ['#a0714f', '우드'], ['#d9c3a0', '내추럴'], ['#b8bcc2', '실버'], ['#6b5a45', '브론즈'], ['#6d6f75', '그레이']];
export const CURT = [['none', '없음'], ['curtain', '암막 커튼'], ['sheer', '쉬폰 커튼'], ['blind', '우드 블라인드'], ['roll', '롤스크린']];
export const SWING = new Set(['swing', 'double', 'swingG', 'entrance']);
export const TEMPS = [[2700, '2700K 전구색'], [3000, '3000K 웜화이트'], [3500, '3500K'], [4000, '4000K 주백색'], [5000, '5000K 주광백색'], [6500, '6500K 주광색']];

export const LKIND = {
  down: { n: '매입 다운라이트', w: 10, kf: 0.5, temp: 4000 },
  spot: { n: '매입 스포트', w: 8, kf: 0.4, temp: 3000 },
  panel: { n: 'LED 평판등 (사각)', w: 60, d: 60, kf: 1.1, temp: 5000 },
  round: { n: '원형 방등', w: 50, kf: 1, temp: 5000 },
  pendant: { n: '펜던트 (돔)', w: 35, drop: 80, kf: 0.8, temp: 3000, color: '#2b2b2d' },
  pendantG: { n: '펜던트 (유리구)', w: 20, drop: 70, kf: 0.6, temp: 2700, color: '#b59a5b' },
  pendantL: { n: '라인 펜던트 (식탁등)', w: 120, drop: 80, kf: 0.9, temp: 3000, rot: 1, color: '#2b2b2d' },
  chand: { n: '샹들리에', w: 70, drop: 60, kf: 1, temp: 2700, color: '#b59a5b' },
  rail: { n: '레일 조명', w: 150, kf: 0.8, temp: 3500, rot: 1, color: '#2b2b2d' },
  fan: { n: '실링팬 조명', w: 120, drop: 30, kf: 0.9, temp: 3000, color: '#a0714f' },
  wall: { n: '벽등 (브라켓)', w: 15, mt: 'w', y: 170, kf: 0.5, temp: 2700, color: '#2b2b2d' },
  strip: { n: '간접조명 LED 라인', w: 200, mt: 'w', y: -12, kf: 0.6, temp: 3000 },
};

export function kelvin(k) {
  const t = (k || 3000) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  const c = v => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(c(r), c(g), c(b));
}

const col = c => (typeof c === 'number' ? c : new THREE.Color(c).getHex());
function M(c, o = {}) {
  const m = new THREE.MeshLambertMaterial({ color: col(c) });
  if (o.op != null) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; m.side = THREE.DoubleSide; }
  if (o.ds) m.side = THREE.DoubleSide;
  return m;
}
function BX(p, sx, sy, sz, x, y0, z, c, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, sx), Math.max(0.2, sy), Math.max(0.2, sz)), M(c, o));
  m.position.set(x, y0 + sy / 2, z);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  p.add(m); return m;
}
// 유리 투명도·색 (창호마다 설정: o.gop 0~100% 투명, o.gtint)
export const GTINT = [['clear', '투명 (클리어)', 0x9db4c8], ['low', '저철분 (아주 맑음)', 0xc9dde6], ['bronze', '브론즈', 0x8a6a4a], ['gray', '그레이', 0x5b6068], ['black', '블랙 (짙은 틴트)', 0x22262b], ['frost', '반투명 (불투명 유리)', 0xe8eef0], ['mist', '모루·간유리', 0xd9e2e6]];
let GCUR = null;
function GLS(p, w, h, x, y0, z, op = 0.28, c = 0x9db4c8) {
  if (GCUR) { if (GCUR.op != null) op = GCUR.op; if (GCUR.c != null) c = GCUR.c; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.5, w), Math.max(0.5, h)), M(c, { op }));
  m.position.set(x, y0 + h / 2, z); p.add(m); return m;
}
const CH = 0xc5c9cf;

function buildWin(o, R, g) {
  const w = o.w, h = o.h, y0 = o.y, fc = o.fc || '#f3f2ee', ft = 5, st = o.st || 'slide';
  BX(g, w + 2 * ft, ft, 10, 0, y0 - ft, -3, fc); BX(g, w + 2 * ft, ft, 10, 0, y0 + h, -3, fc);
  BX(g, ft, h, 10, -w / 2 - ft / 2, y0, -3, fc); BX(g, ft, h, 10, w / 2 + ft / 2, y0, -3, fc);
  if (st !== 'full' && y0 > 8) BX(g, w + 16, 2, 10, 0, y0 - 2, 5, 0xf6f4ef);
  const wo = Math.max(0, Math.min(1, o.wo || 0));
  const sash = (x, sw, z, hd, par = g) => {
    const t = 4;
    BX(par, sw, t, 3, x, y0, z, fc); BX(par, sw, t, 3, x, y0 + h - t, z, fc);
    BX(par, t, h - 2 * t, 3, x - sw / 2 + t / 2, y0 + t, z, fc); BX(par, t, h - 2 * t, 3, x + sw / 2 - t / 2, y0 + t, z, fc);
    GLS(par, sw - 2 * t, h - 2 * t, x, y0 + t, z);
    if (hd) BX(par, 1.5, 10, 2, x + hd * (sw / 2 - 2), y0 + h / 2 - 5, z + 2.5, CH);
  };
  const leafW = (px, lw, dir, ang) => { const p = new THREE.Group(); p.position.set(px, 0, 0); p.rotation.y = -dir * ang; g.add(p); sash(dir * lw / 2, lw, 0, -dir, p); };
  if (st === 'slide') { const sw = w / 2 + 3; sash(-w / 2 + sw / 2, sw, -4, 1); sash(w / 2 - sw / 2 - wo * (w - sw), sw, 0, -1); }
  else if (st === 'slide4') { const sw = w / 4 + 3, step = (w - sw) / 3; for (let i = 0; i < 4; i++) { let x = -w / 2 + sw / 2 + i * step; if (i === 1) x -= wo * step; if (i === 2) x += wo * step; sash(x, sw, i % 2 ? 0 : -4, i < 2 ? 1 : -1); } }
  else if (st === 'casement') { leafW(-w / 2, w / 2, 1, wo * PI / 2); leafW(w / 2, w / 2, -1, wo * PI / 2); }
  else if (st === 'tilt') leafW(-w / 2, w, 1, wo * PI / 2);
  const vw = o.view && o.view !== 'inherit' ? o.view : (R.view || 'city');
  if (vw !== 'none') {
    const tex = viewTexture(vw, R.vtimeNow || 'day').clone(); tex.needsUpdate = true;
    const pw = w + 8, ph = h + 8, cx0 = ((o.id || 1) * 0.137) % 0.45;
    tex.repeat.set(Math.min(1, pw / 700), Math.min(1, ph / 350)); tex.offset.set(cx0, Math.max(0, Math.min(1 - ph / 350, 0.62 - (y0 + h / 2) / 700)));
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex }));
    bm.position.set(0, y0 + h / 2, -9); bm.userData.scenery = 1; g.add(bm);
  }
  const cur = o.cur || 'none', cc = o.cc || '#e9e1d3', top = Math.min(R.H - 3, y0 + h + 18);
  if (cur === 'curtain' || cur === 'sheer') {
    const ext = 25, L = w + 2 * ext, sheer = cur === 'sheer', ph = top - 1;
    BX(g, L + 10, 2.5, 2.5, 0, top, 12, 0xb8bcc2);
    const panel = (x0, pw) => { const n = Math.max(3, Math.round(pw / 9)), fw = pw / n; for (let i = 0; i < n; i++) BX(g, fw * 1.05, ph, 3, x0 + fw * (i + 0.5), 1, 12 + (i % 2 ? 1.5 : -1.5), cc, sheer ? { op: 0.45 } : {}); };
    if (sheer) panel(-L / 2, L); else { const pw = (L / 2) * 0.42; panel(-L / 2, pw); panel(L / 2 - pw, pw); }
  } else if (cur === 'blind') {
    const n = Math.max(3, Math.round(h * 0.5 / 5));
    BX(g, w + 6, 4, 6, 0, y0 + h, 6, cc);
    for (let i = 0; i < n; i++) BX(g, w + 4, 0.8, 5, 0, y0 + h - 3 - i * 5, 6, cc, { rx: 0.35 });
  } else if (cur === 'roll') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, w + 6, 16), M(cc)); m.rotation.z = PI / 2; m.position.set(0, y0 + h + 3, 6); g.add(m);
    BX(g, w + 2, h * 0.35, 0.5, 0, y0 + h - h * 0.35, 6, cc);
  }
}

function buildDoor(o, R, g) {
  const w = o.w, h = o.h, st = o.st || 'swing', fc = o.fc || (st.startsWith('jung') ? '#2b2b2d' : '#f3f2ee'), dc = o.dc || (st === 'entrance' ? '#3a3d42' : '#f3f2ee');
  const angD = o.ang ?? 0, ang = angD * PI / 180, hl = o.hinge !== 'R', inw = o.sw !== 'out', f = angD / 90;
  if (st !== 'open') { BX(g, w + 12, 6, 16, 0, h, 0, fc); BX(g, 6, h, 16, -w / 2 - 3, 0, 0, fc); BX(g, 6, h, 16, w / 2 + 3, 0, 0, fc); }
  else BX(g, w, 0.6, 14, 0, 0, 0, 0xbfb7a8);
  const lineM = new THREE.LineBasicMaterial({ color: 0x8a8f96, transparent: true, opacity: 0.7 });
  const leaf = (px, lw, dir, opt = {}) => {
    const p = new THREE.Group(), s = inw ? 1 : -1, t = opt.t || 4; p.position.set(px, 0, s * 3); p.rotation.y = -dir * s * ang; g.add(p);
    if (opt.glassy) {
      const ff = opt.fc || fc;
      BX(p, 4, h - 1, t, dir * 2, 0, 0, ff); BX(p, 4, h - 1, t, dir * (lw - 2), 0, 0, ff); BX(p, lw, 5, t, dir * lw / 2, h - 6, 0, ff); BX(p, lw, 8, t, dir * lw / 2, 0, 0, ff);
      GLS(p, lw - 8, h - 14, dir * lw / 2, 8, 0, 0.3);
    } else {
      BX(p, lw - 1, h - 1, t, dir * lw / 2, 0, 0, opt.c || dc);
      if (o.glass) GLS(p, lw * 0.45, h * 0.5, dir * lw / 2, h * 0.35, t / 2 + 0.15, 0.5);
    }
    const hx = dir * (lw - 7);
    if (opt.bar) { BX(p, 2.5, h * 0.45, 3, hx, h * 0.28, t / 2 + 3, CH); }
    else { BX(p, 10, 2, 2, hx - dir * 3, h * 0.47, t / 2 + 2.5, CH); BX(p, 10, 2, 2, hx - dir * 3, h * 0.47, -t / 2 - 2.5, CH); }
    const pts = [];
    for (let i = 0; i <= 24; i++) { const th = i / 24 * PI / 2; pts.push(new THREE.Vector3(px + dir * Math.cos(th) * lw, 0.4, s * (3 + Math.sin(th) * lw))); }
    pts.push(new THREE.Vector3(px, 0.4, s * 3));
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineM));
  };
  if (st === 'swing' || st === 'entrance') {
    const ent = st === 'entrance';
    leaf(hl ? -w / 2 : w / 2, w, hl ? 1 : -1, { t: ent ? 6 : 4, bar: ent });
    if (ent) BX(g, w + 12, 1.5, 18, 0, 0, 0, 0x8a8f96);
  } else if (st === 'double') { leaf(-w / 2, w / 2, 1); leaf(w / 2, w / 2, -1); }
  else if (st === 'swingG') {
    const lw = Math.min(w, 100); leaf(hl ? -w / 2 : w / 2, lw, hl ? 1 : -1, { glassy: 1 });
    if (w - lw > 8) { const fw = w - lw, fx = hl ? w / 2 - fw / 2 : -w / 2 + fw / 2; BX(g, 4, h, 4, fx + (hl ? fw / 2 - 2 : -fw / 2 + 2), 0, 0, fc); BX(g, fw, 5, 4, fx, h - 5, 0, fc); BX(g, fw, 8, 4, fx, 0, 0, fc); GLS(g, fw - 4, h - 13, fx, 8, 0, 0.3); }
  } else if (st === 'slide') {
    const dir = hl ? 1 : -1, z = inw ? 6 : -6, off = -dir * f * w * 0.85;
    BX(g, w * 2 + 8, 3, 5, -dir * w / 2, h, z, fc);
    const p = new THREE.Group(); p.position.set(off, 0, z); g.add(p);
    BX(p, w + 4, h - 2, 4, 0, 0, 0, dc);
    if (o.glass) GLS(p, w * 0.45, h * 0.55, 0, h * 0.3, 2.2, 0.5);
    BX(p, 2, 30, 3, dir * (w / 2 - 5), h * 0.4, 2.5, CH);
  } else if (st === 'jung3') {
    const ov = 4, pw = (w + 2 * ov) / 3, t = 2.5, zs = [4, 9, 14], oc = o.open ?? (angD / 90) * 2, m = hl ? 1 : -1;
    BX(g, w, 5, 16, 0, h - 5, 9, fc); BX(g, w, 1.5, 16, 0, 0, 9, fc);
    const X = i => -w / 2 + pw / 2 + i * (pw - ov); // 쌓이는 쪽(경첩 쪽)부터 0,1,2
    const pos = [X(0), X(1) + (X(0) - X(1)) * Math.max(0, Math.min(1, oc - 1)), X(2) + (X(1) - X(2)) * Math.min(1, Math.max(0, oc)) + (X(0) - X(1)) * Math.max(0, Math.min(1, oc - 1))];
    for (let i = 0; i < 3; i++) {
      const p = new THREE.Group(); p.position.set(m * pos[i], 0, zs[i]); g.add(p);
      BX(p, 5, h - 8, t, -pw / 2 + 2.5, 1.5, 0, fc); BX(p, 5, h - 8, t, pw / 2 - 2.5, 1.5, 0, fc); BX(p, pw, 5, t, 0, h - 10, 0, fc); BX(p, pw, 6, t, 0, 1.5, 0, fc);
      BX(p, pw - 8, 30, t, 0, 7.5, 0, 0x3a3d42); GLS(p, pw - 9, Math.max(1, h - 52), 0, 40, 0);
    }
  } else if (st === 'jung1') {
    const lw = w * 0.6, fw = w - lw + 4, fx = hl ? -w / 2 + fw / 2 : w / 2 - fw / 2, cx0 = hl ? w / 2 - lw / 2 : -w / 2 + lw / 2, cx1 = hl ? -w / 2 + lw / 2 : w / 2 - lw / 2;
    BX(g, w, 5, 14, 0, h - 5, 8, fc);
    const panel = (x, pw, z, hd) => { const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p); BX(p, 3, h - 6, 3, -pw / 2 + 1.5, 0, 0, fc); BX(p, 3, h - 6, 3, pw / 2 - 1.5, 0, 0, fc); BX(p, pw, 3, 3, 0, h - 9, 0, fc); BX(p, pw, 4, 3, 0, 0, 0, fc); GLS(p, pw - 6, h - 13, 0, 4, 0, 0.25); if (hd) BX(p, 2, 60, 4, hd * (pw / 2 - 6), h * 0.3, 3, CH); };
    panel(fx, fw, 4, 0); panel(cx0 + (cx1 - cx0) * f, lw, 11, hl ? 1 : -1);
  } else if (st === 'folding') {
    const n = Math.max(2, Math.round(w / 45)), pw = w / n, dir = hl ? 1 : -1;
    let x = hl ? -w / 2 : w / 2, z = 3;
    BX(g, w, 4, 6, 0, h - 4, 3, fc);
    for (let i = 0; i < n; i++) { const a = (i % 2 ? -1 : 1) * f * 1.25 * (inw ? 1 : -1), dx = dir * pw * Math.cos(a), dz = pw * Math.sin(a); BX(g, pw - 1, h - 6, 3.5, x + dx / 2, 0, z + dz / 2, dc, { ry: Math.atan2(-dz, dx) }); x += dx; z += dz; }
  }
}

export function buildOpening(o, R) {
  const g = new THREE.Group(), tint = GTINT.find(t => t[0] === o.gtint);
  GCUR = o.gop != null || tint ? { op: o.gop != null ? Math.max(0.03, Math.min(1, 1 - o.gop / 100)) : (tint && (tint[0] === 'frost' || tint[0] === 'mist') ? 0.82 : null), c: tint ? tint[2] : null } : null;
  if (o.kind === 'win') buildWin(o, R, g); else buildDoor(o, R, g);
  GCUR = null;
  return g;
}

export function buildLight(l) {
  const g = new THREE.Group(), em = [], k = LKIND[l.kind] || LKIND.down, w = l.w || k.w, fc = l.color || k.color || '#f2f2f0';
  let dr = l.drop ?? k.drop ?? 0;
  const E = () => { const m = new THREE.MeshLambertMaterial({ color: 0xffffff }); em.push(m); return m; };
  const add = (geo, mat, x, y, z, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (r) m.rotation.set(r[0] || 0, r[1] || 0, r[2] || 0); g.add(m); return m; };
  const cyl = (rt, rb, h, seg = 24) => new THREE.CylinderGeometry(rt, rb, Math.max(0.2, h), seg);
  const cord = (x, z, len) => { if (len > 0.5) add(cyl(0.3, 0.3, len, 6), M(0x333333), x, -len / 2, z); };
  let lp = [0, -10, 0];
  switch (l.kind) {
    case 'spot': add(cyl(w / 2 + 1.5, w / 2 + 1.5, 1), M(0x1d1d1f), 0, -0.5, 0); add(cyl(w / 2 - 1, w / 2 - 1, 0.4), E(), 0, -1.2, 0); lp = [0, -6, 0]; break;
    case 'panel': { const d = l.d || k.d || w; add(new THREE.BoxGeometry(w, 3, d), M(fc), 0, -1.5, 0); add(new THREE.BoxGeometry(w - 2, 0.4, d - 2), E(), 0, -3.1, 0); lp = [0, -12, 0]; break; }
    case 'round': add(cyl(w / 2, w / 2, 8, 40), M(fc), 0, -4, 0); add(cyl(w / 2 - 2, w / 2 - 2, 0.4, 40), E(), 0, -8.2, 0); lp = [0, -14, 0]; break;
    case 'pendant': { const r = w / 2; dr = Math.max(dr, r + 5); cord(0, 0, dr - r); add(new THREE.SphereGeometry(r, 28, 12, 0, PI * 2, 0, PI / 2), M(fc, { ds: 1 }), 0, -dr, 0); add(new THREE.SphereGeometry(r * 0.22, 12, 8), E(), 0, -dr + r * 0.25, 0); lp = [0, -dr - 4, 0]; break; }
    case 'pendantG': { const r = w / 2; dr = Math.max(dr, r + 5); cord(0, 0, dr - r); add(cyl(2.5, 3.5, 4, 12), M(fc), 0, -dr + r + 1, 0); add(new THREE.SphereGeometry(r, 24, 16), M(0xdfeaf0, { op: 0.35 }), 0, -dr, 0); add(new THREE.SphereGeometry(r * 0.25, 12, 8), E(), 0, -dr, 0); lp = [0, -dr, 0]; break; }
    case 'pendantL': cord(-w * 0.4, 0, dr); cord(w * 0.4, 0, dr); add(new THREE.BoxGeometry(w, 4, 8), M(fc), 0, -dr - 2, 0); add(new THREE.BoxGeometry(w - 2, 0.4, 6), E(), 0, -dr - 4.2, 0); lp = [0, -dr - 8, 0]; break;
    case 'chand': {
      const r = w / 2, n = 8;
      add(cyl(0.6, 0.6, dr * 0.6, 8), M(fc), 0, -dr * 0.3, 0); add(new THREE.SphereGeometry(5, 16, 12), M(fc), 0, -dr * 0.6, 0);
      add(cyl(0.8, 0.8, dr * 0.4, 8), M(fc), 0, -dr * 0.8, 0);
      add(new THREE.TorusGeometry(r * 0.8, 1, 8, 40), M(fc), 0, -dr, 0, [PI / 2, 0, 0]);
      for (let i = 0; i < n; i++) { const a = i * 2 * PI / n, x = Math.cos(a) * r * 0.8, z = Math.sin(a) * r * 0.8; add(new THREE.BoxGeometry(r * 0.8, 1, 1), M(fc), x / 2, -dr, z / 2, [0, -a, 0]); add(cyl(1.6, 1.2, 4, 10), M(fc), x, -dr + 2, z); add(new THREE.SphereGeometry(1.8, 10, 8), E(), x, -dr + 6, z); }
      lp = [0, -dr + 4, 0]; break;
    }
    case 'rail': {
      add(new THREE.BoxGeometry(w, 3, 4), M(fc), 0, -1.5, 0);
      const n = Math.max(2, Math.round(w / 50));
      for (let i = 0; i < n; i++) { const x = -w / 2 + w / n * (i + 0.5); add(cyl(0.8, 0.8, 6, 6), M(fc), x, -6, 0); add(cyl(3.2, 3.2, 11, 16), M(fc), x, -12, 2, [0.5, 0, 0]); add(cyl(2.6, 2.6, 0.4, 16), E(), x, -16.7, 4.6, [0.5, 0, 0]); }
      lp = [0, -20, 0]; break;
    }
    case 'fan': {
      const L = w / 2;
      add(cyl(0.8, 0.8, dr, 6), M(0x333333), 0, -dr / 2, 0); add(cyl(9, 9, 10, 24), M(0x333333), 0, -dr - 5, 0);
      for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; add(new THREE.BoxGeometry(L - 10, 0.8, 12), M(fc), Math.cos(a) * (L / 2 + 5), -dr - 4, Math.sin(a) * (L / 2 + 5), [0, -a, 0]); }
      add(new THREE.SphereGeometry(8, 20, 10, 0, PI * 2, PI / 2, PI / 2), E(), 0, -dr - 10, 0);
      lp = [0, -dr - 20, 0]; break;
    }
    case 'wall': add(new THREE.BoxGeometry(10, 14, 2), M(fc), 0, 0, 1); add(cyl(0.8, 0.8, 12, 8), M(fc), 0, 0, 8, [PI / 2, 0, 0]); add(cyl(4, 7, 12, 20), M(fc, { ds: 1 }), 0, 6, 14); add(new THREE.SphereGeometry(2.5, 10, 8), E(), 0, 3, 14); lp = [0, 8, 16]; break;
    case 'strip': add(new THREE.BoxGeometry(w, 2, 10), M(fc), 0, 3, 5); add(new THREE.BoxGeometry(w, 1.2, 1.2), E(), 0, 1, 2); lp = [0, 8, 12]; break;
    default: add(cyl(w / 2 + 1.5, w / 2 + 1.5, 1), M(0xffffff), 0, -0.5, 0); add(cyl(w / 2 - 0.5, w / 2 - 0.5, 0.4), E(), 0, -1.2, 0); lp = [0, -6, 0];
  }
  g.userData.em = em; g.userData.lp = lp;
  return g;
}

export function disposeTree(o) {
  o.traverse(c => {
    if (c.geometry) c.geometry.dispose();
    if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose());
  });
}
