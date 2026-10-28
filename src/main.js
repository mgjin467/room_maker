import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAT } from './catalog.js';
import { buildParts, LEAF, NOPT, DEFA, TYPES, PV, LAMPS, COLSTY, colPat, OUTFITS, HAIRS, POSES, SLEEVES, TIES, BODIES, TREES } from './builders.js';
import { buildOpening, buildLight, WIN_ST, DOOR_ST, LKIND, kelvin, FCOLS, CURT, SWING, TEMPS, disposeTree, GTINT } from './fixtures.js';
import { drawPlan, polyArea } from './plan.js';
import { RECT, orient, edgesOf, arcPts, outline, bbox, inside, segDist, P as EP, SHAPES, shapePreset, isRect } from './geom.js';
import { MATS, MATN, makeMat, VIEWS, VTIME } from './materials.js';
import { saveFile, isMobile } from './save.js';
import { Cloud, takeCfgFromURL } from './cloud.js';
import { initAI } from './aiui.js';
import { faceTexture, sampleSkin } from './faces.js';
import { initHScroll, reveal } from './hscroll.js';
import { ENVS, ENV_DEF, GROUNDS, groundTex, skyTex, FOGC, buildEnv } from './env.js';
import { putRef, getRef, delRef, uploadMissing, REF_KINDS } from './refs.js';
import { fileToDataURL } from './ai.js';
import { viewImg } from './viewer.js';
import { RUG_PAT, RUG_SHAPE, rugCanvas, rugThumb, rugDesc } from './rugs.js';

const $ = id => document.getElementById(id);
const PI = Math.PI, rd = Math.round, r1 = v => Math.round(v * 10) / 10, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAXL = 12, WHITE = new THREE.Color(0xffffff), BLACK = new THREE.Color(0);

// ---------- 저장소 ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('브라우저 저장 공간에 저장하지 못했습니다'); } },
};
const K_PROJ = 'room3d.v2.projects', K_CUR = 'room3d.v2.cur', K_SZ = 'room3d.v2.sizes', K_CUS = 'room3d.v2.custom', K_REC = 'room3d.v2.recent', K_PREF = 'room3d.v2.prefs';
let SZ = LS.get(K_SZ, {}), CUSTOM = LS.get(K_CUS, []), RECENT = LS.get(K_REC, []), PROJ = LS.get(K_PROJ, {});
const PREF = Object.assign({ snap: 1, handles: 1, labels: 0, night: 0, vdoor: 1, vwin: 1, ceil: 1, lock: 1, remember: 1, stack: 1, tab: 'add', touchSafe: 1, shapeEdit: 0, site: 1, pickWin: 1, pickDoor: 1, pickLight: 1 }, LS.get(K_PREF, {}));
PREF.dims = Object.assign({ room: 1, ops: 0, item: 1, gap: 1 }, PREF.dims || {});
const savePref = () => { LS.set(K_PREF, PREF); cloudSettingsSoon(); };

// ---------- 상태 ----------
const DEF_R = { pts: RECT(230, 278), bul: {}, H: 227, fl: 'wood', flc: '#cdb892', fld: 0, wc: '#f0ede6', wcs: {}, bb: '#ffffff', view: 'city', vtime: 'auto' };
let R = JSON.parse(JSON.stringify(DEF_R)), E = [], OL = [], BB = { x0: 0, z0: 0, x1: 230, z1: 278, W: 230, D: 278 };
let OPS = [], LIGHTS = [], items = [], MEAS = [], nid = 1, sel = null, projName = '내 방';
function geo() { E = edgesOf(R.pts, R.bul); OL = outline(E); BB = bbox(OL); R.W = rd(BB.W); R.D = rd(BB.D); }
const straight = e => !e || Math.abs(e.h) < 0.5;
function exampleState() {
  return {
    R: { ...JSON.parse(JSON.stringify(DEF_R)) },
    ops: [
      { id: 1, no: 1, kind: 'win', wall: 1, s: 167.5, w: 149, h: 112, y: 113, st: 'slide', fc: '#f3f2ee', cur: 'none', cc: '#e9e1d3' },
      { id: 2, no: 1, kind: 'door', wall: 2, s: 115, w: 230, h: 215, y: 0, st: 'jung3', fc: '#2b2b2d', dc: '#f3f2ee', hinge: 'L', sw: 'in', ang: 0, open: 0 },
    ],
    lights: [{ id: 3, no: 1, kind: 'round', x: 115, z: 139, w: 50, temp: 5000, lum: 1, color: '#f2f2f0', on: true }],
    items: [
      { id: 4, pk: '침실|싱글 침대', name: '싱글 침대', type: 'bed', w: 100, d: 200, h: 45, bw: 100, bd: 200, bh: 45, color: '#8fa8d8', c2: '#e9e4da', x: 50, z: 100, y: 0, rot: 0 },
      { id: 5, pk: '서재·사무|컴퓨터 책상 120', name: '책상', type: 'panel', w: 120, d: 60, h: 74, bw: 120, bd: 60, bh: 74, color: '#c49a6c', x: 200, z: 170, y: 0, rot: 90 },
    ],
    meas: [],
  };
}
function emptyState() { const s = exampleState(); s.items = []; s.lights = []; s.ops = s.ops.slice(0, 1); return s; }
function migrateV1(d) {
  const o = d.R || {}, W = o.W || 230, D = o.D || 278, open = Math.min(o.open ?? 230, W), ox = clamp(o.ox || 0, 0, W - open);
  return {
    R: { W, D, H: o.H || 227 },
    ops: [
      { id: 9001, kind: 'win', wall: 'E', c: (o.wz ?? 93) + (o.ww ?? 149) / 2, w: o.ww ?? 149, h: o.wh ?? 120, y: o.wb ?? 113, st: 'slide', fc: '#f3f2ee', cur: 'none' },
      ...(open >= 20 ? [{ id: 9002, kind: 'door', wall: 'S', c: ox + open / 2, w: open, h: Math.min(o.dh ?? 215, o.H || 227), y: 0, st: 'jung3', fc: '#2b2b2d', hinge: 'L', sw: 'in', ang: 0 }] : []),
    ],
    lights: [], meas: [], items: (d.items || []).map(i => ({ ...i, bw: i.w, bd: i.d, bh: i.h, y: 0 })),
  };
}
// 이전(직사각형 N/E/S/W) 형식 → 다각형 형식
function normState(st) {
  st = JSON.parse(JSON.stringify(st || {}));
  const r = st.R || {};
  if (!r.pts) {
    const W = r.W || 230, D = r.D || 278, WI = { N: 0, E: 1, S: 2, W: 3 }, sOld = (k, c) => (k === 'S' ? W - c : k === 'W' ? D - c : c);
    r.pts = RECT(W, D); r.bul = {};
    const wcs = {}; Object.entries(r.wcs || {}).forEach(([k, v]) => { if (WI[k] != null) wcs[WI[k]] = v; }); r.wcs = wcs;
    (st.ops || []).forEach(o => { if (typeof o.wall === 'string') { o.s = sOld(o.wall, o.c); o.wall = WI[o.wall]; delete o.c; } if (o.st === 'jung3' && o.open == null) o.open = ((o.ang || 0) / 90) * 2; });
    (st.lights || []).forEach(l => { if (typeof l.wall === 'string') { l.s = sOld(l.wall, l.c); l.wall = WI[l.wall]; delete l.c; } });
    (st.items || []).forEach(i => { if (i.mt === 'w' && i.wall == null) { const rr = ((Math.round((((i.rot || 0) % 360) + 360) % 360 / 90) * 90) % 360); const k = { 0: 'N', 90: 'W', 180: 'S', 270: 'E' }[rr]; i.wall = WI[k]; i.ws = sOld(k, k === 'N' || k === 'S' ? i.x : i.z); } });
  }
  st.R = { ...JSON.parse(JSON.stringify(DEF_R)), ...r }; st.R.pts = orient(st.R.pts);
  return st;
}

// ---------- three ----------
const wrap = $('v'), cv = $('c');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camP = new THREE.PerspectiveCamera(45, 1, 5, 30000), camO = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 9000);
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
let RG = roomG, OG = opG; const houseG = new THREE.Group(); scene.add(houseG);
// ---------- 공간: 한 프로젝트 안의 여러 방·야외 ----------
// SPACES = [{ id, name, kind:'room'|'out', s: 저장된 상태(현재 공간은 s 없음) }]
let SPACES = [{ id: 's1', name: '방 1', kind: 'room' }], SPID = 's1';
const spKind = r => (r && r.kind === 'out' ? 'out' : 'room');
const ROOM_PRE = [['빈 방 (기본)', 230, 278, 227], ['침실 350×330', 350, 330, 230], ['거실 450×380', 450, 380, 230], ['주방·다이닝 320×300', 320, 300, 230], ['욕실 200×230', 200, 230, 225], ['아이방 300×280', 300, 280, 230], ['사무실 600×500', 600, 500, 270], ['카페·매장 800×600', 800, 600, 300], ['스튜디오 900×700', 900, 700, 350], ['웨딩홀·연회장 1500×1200', 1500, 1200, 500], ['현재 공간과 같은 크기', 0, 0, 0]];
const OUT_PRE = [['마당 1000×800', 1000, 800], ['캠핑 사이트 1200×1000', 1200, 1000], ['야외 웨딩 1800×1400', 1800, 1400], ['해변 2000×1500', 2000, 1500], ['넓은 들판 3000×2400', 3000, 2400]];
function outdoorState(env, W = 1200, D = 1000) {
  const d = ENV_DEF[env] || ENV_DEF.field;
  return { R: { ...JSON.parse(JSON.stringify(DEF_R)), kind: 'out', env, gk: d.g, gc: d.gc, pts: RECT(W, D), H: 400, vtime: 'auto' }, ops: [], lights: [], items: [], meas: [] };
}
function roomState(W, D, H) { const s = emptyState(); if (W && D) { s.R.pts = RECT(W, D); s.R.H = H || s.R.H; s.ops[0].s = Math.min(s.ops[0].s, W - 90); } return s; }
function curSpaceState() { const s = snap(); delete s.spaces; delete s.spid; return s; }
function switchSpace(id, quiet) {
  if (id === SPID || !SPACES.some(x => x.id === id)) return;
  flush(); const cur = SPACES.find(x => x.id === SPID); if (cur) { cur.s = curSpaceState(); cur.kind = spKind(R); }
  const tgt = SPACES.find(x => x.id === id), st = { ...(tgt.s || roomState()), spaces: SPACES.map(x => x.id === id ? { id: x.id, name: x.name, kind: x.kind } : x), spid: id };
  load(st); if (R.kind === 'out' && (R.corridors || []).length) { syncCorrOpenings(R.houses || [], R.corridors); buildRoom(); } commit(); fitView(); renderRoom(); renderSpacePill(); if (!quiet) toast(`${tgt.kind === 'out' ? '🌳' : '🏠'} '${tgt.name}'(으)로 이동`);
}
function addSpace(name, state) {
  const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
  SPACES.push({ id, name: uniqSpace(name), kind: spKind(state.R), s: state }); switchSpace(id, true); toast(`＋ '${SPACES.find(x => x.id === id).name}' 공간을 추가했습니다`); return id;
}
const uniqSpace = n => { n = (n || '').trim() || '공간'; let k = n, i = 2; while (SPACES.some(x => x.name === k)) k = `${n} ${i++}`; return k; };
function renameSpace(id) { const sp = SPACES.find(x => x.id === id); if (!sp) return; const v = (prompt('공간 이름', sp.name) || '').trim(); if (!v || v === sp.name) return; sp.name = uniqSpace(v); commit(); renderRoom(); renderSpacePill(); }
function dupSpace(id) { const sp = SPACES.find(x => x.id === id); if (!sp) return; const st = id === SPID ? curSpaceState() : JSON.parse(JSON.stringify(sp.s)); addSpace(sp.name + ' 복사본', st); }
function deleteSpace(id) {
  if (SPACES.length < 2) return toast('공간이 하나뿐이라 삭제할 수 없습니다');
  const sp = SPACES.find(x => x.id === id); if (!sp || !confirm(`'${sp.name}' 공간을 삭제할까요? (Ctrl+Z로 되돌릴 수 있음)`)) return;
  if (id === SPID) { const other = SPACES.find(x => x.id !== id); switchSpace(other.id, true); }
  SPACES = SPACES.filter(x => x.id !== id); commit(); renderRoom(); renderSpacePill(); toast(`'${sp.name}' 공간을 삭제했습니다`);
}
function addSpaceDlg(kind) {
  const body = h('div', {}), nm = h('input', { type: 'text', value: uniqSpace(kind === 'out' ? '야외' : '방') });
  let env = 'field', pre = 0; const roomsNow = SPACES.filter(x => x.kind !== 'out');
  const hsel = h('select', {}, h('option', { value: 'all' }, `전체 집 (방 ${roomsNow.length}개)`), ...roomsNow.map(sp => h('option', { value: sp.id }, sp.name + '만')), h('option', { value: '' }, '배치 안 함 (빈 야외)')); if (!roomsNow.length) hsel.value = '';
  const envBox = h('div', { class: 'ch' }), preBox = h('div', { class: 'ch' });
  const draw = () => {
    envBox.innerHTML = ''; preBox.innerHTML = '';
    if (kind === 'out') ENVS.forEach(([k, n]) => envBox.append(BTN(n, () => { env = k; draw(); }, 'c' + (env === k ? ' on' : ''))));
    (kind === 'out' ? OUT_PRE : ROOM_PRE).forEach((p, i) => preBox.append(BTN(p[0], () => { pre = i; draw(); }, 'c' + (pre === i ? ' on' : ''))));
  };
  draw();
  app(body, F('이름', nm), kind === 'out' ? h('h4', {}, '환경') : null, kind === 'out' ? envBox : null, h('h4', {}, '크기'), preBox,
    kind === 'out' && roomsNow.length ? F('🏠 야외에 집(방) 배치', hsel) : null,
    h('div', { class: 'r' }, BTN('만들기', () => {
      const p = (kind === 'out' ? OUT_PRE : ROOM_PRE)[pre];
      const st = kind === 'out' ? outdoorState(env, p[1], p[2]) : p[1] ? roomState(p[1], p[2], p[3]) : roomState(R.W, R.D, R.kind === 'out' ? 230 : R.H);
      m.close(); addSpace(nm.value, st);
      if (kind === 'out' && hsel.value) placeHouses(hsel.value === 'all' ? roomsNow.map(x => x.id) : [hsel.value]);
    }, 'b'), BTN('취소', () => m.close())),
    h('p', { class: 'mu sm' }, '사진·도면으로 만들려면 AI 탭 → 「방·도면 사진 인식」 또는 아래의 「📷 사진·도면으로 공간 만들기」를 쓰세요.'));
  const m = mdl(kind === 'out' ? '🌳 야외 공간 추가' : '🏠 방 추가', body);
}
function spaceBlock() {
  return h('div', { class: 'spbox' },
    h('div', { class: 'ch spc' }, SPACES.map(sp => BTN((sp.kind === 'out' ? '🌳 ' : '🏠 ') + sp.name, () => switchSpace(sp.id), 'c' + (sp.id === SPID ? ' on' : '')))),
    h('div', { class: 'r' }, BTN('🏘 모든 공간 함께 보기', goOverview, 'b'), BTN('＋ 방 추가', () => addSpaceDlg('room'), 'b'), BTN('＋ 야외 추가', () => addSpaceDlg('out'), 'b'), BTN('📷 사진·도면으로 공간 만들기', () => AI.openPhoto('room'), 'o')),
    R.kind !== 'out' && SPACES.some(x => x.kind === 'out') ? h('div', { class: 'cg' }, bchk('이 방 안에서도 옆 공간·통로·야외 배경 함께 보기', () => PREF.site, v => { PREF.site = v ? 1 : 0; savePref(); buildSiteView(); applyLightMode(); })) : null,
    h('div', { class: 'r' }, BTN('✎ 이름 변경', () => renameSpace(SPID), 'c'), BTN('⧉ 이 공간 복제', () => dupSpace(SPID), 'c'), SPACES.length > 1 ? BTN('🗑 이 공간 삭제', () => deleteSpace(SPID), 'c danger') : null));
}
function renderSpacePill() { const el = $('spcPill'); if (!el) return; const sp = SPACES.find(x => x.id === SPID) || {}; el.textContent = (spKind(R) === 'out' ? '🌳 ' : '🏠 ') + (sp.name || '공간') + (SPACES.length > 1 ? ` (${SPACES.length})` : '') + ' ▾'; const mb = $('ddspc'); if (mb) mb.textContent = '🏠 공간: ' + (sp.name || '') + ' (바꾸기·추가)'; }
// 야외 지면·풍경
// ---------- 야외 안의 집: 이 프로젝트의 방(들)을 건물로 배치 ----------
// R.houses = [{ id, sid(방 공간 id), x, z(배치 영역 안 중심), rot, roof:'flat'|'gable'|'none', lock }]
const ROOFS = [['flat', '평지붕'], ['gable', '박공지붕 (ㅅ자)'], ['none', '지붕 없음 (안이 보이게)']];
function roomBBox(st) { const r = normState(st).R, b = bbox(outline(edgesOf(r.pts, r.bul || {}))); return { W: b.W, D: b.D, H: r.H || 230 }; }
function buildHouseModel(st, roof) {
  const body = new THREE.Group(), sv = { R, E, OL, BB, OPS, items };
  let info;
  try {
    const s2 = normState(st); R = s2.R; R.wcs = { ...(R.wcs || {}) }; R.bul = { ...(R.bul || {}) }; geo();
    OPS = (s2.ops || []).map(o => ({ ...o })); items = (s2.items || []).map(normItem);
    RG = body; OG = body; buildRoomBody();
    items.forEach(it => { mk(it); fit(it, false); fG.remove(it.g); body.add(it.g); if (it.g.userData.e) it.g.userData.e.visible = false; });
    info = { BB: { ...BB }, H: R.H, OL: OL.map(p => [...p]), rect: isRect(R.pts, R.bul), wc: R.wc };
  } finally { R = sv.R; E = sv.E; OL = sv.OL; BB = sv.BB; OPS = sv.OPS; items = sv.items; RG = roomG; OG = opG; geo(); }
  body.traverse(o => { if (o.userData.ceil) o.visible = roof !== 'none'; if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.side = THREE.DoubleSide; }); });
  // 지붕
  const { BB: b, H } = info, rm = new THREE.MeshLambertMaterial({ color: 0x6b6f75, side: THREE.DoubleSide });
  if (roof === 'flat' || (roof === 'gable' && !info.rect)) { const sh = new THREE.Shape(info.OL.map(([x, z]) => new THREE.Vector2(x, -z))), m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 18, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: 0xb9b5ad })); m.rotation.x = -PI / 2; m.position.y = H + 2; body.add(m); }
  else if (roof === 'gable') { const ov = 30, rise = Math.min(b.D, b.W) * 0.3, half = b.D / 2 + ov, sl = Math.hypot(half, rise), ang = Math.atan2(rise, half); [1, -1].forEach(k => { const m = new THREE.Mesh(new THREE.BoxGeometry(b.W + ov * 2, 8, sl), rm); m.position.set(b.x0 + b.W / 2, H + rise / 2 + 4, b.z0 + b.D / 2 + k * half / 2); m.rotation.x = k * ang; body.add(m); }); [b.x0 - 1, b.x1 + 1].forEach(x => { const sh = new THREE.Shape([new THREE.Vector2(-b.D / 2, 0), new THREE.Vector2(b.D / 2, 0), new THREE.Vector2(0, rise)]), m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ color: new THREE.Color(info.wc || '#f0ede6').getHex(), side: THREE.DoubleSide })); m.rotation.y = PI / 2; m.position.set(x, H, b.z0 + b.D / 2); body.add(m); }); }
  // 건물 바닥 기단
  const base = new THREE.Mesh(new THREE.BoxGeometry(b.W + 24, 12, b.D + 24), new THREE.MeshLambertMaterial({ color: 0xa8a39a })); base.position.set(b.x0 + b.W / 2, -6, b.z0 + b.D / 2); body.add(base);
  body.position.set(-(b.x0 + b.W / 2), 0, -(b.z0 + b.D / 2)); // 집 중심이 원점
  return { body, W: b.W, D: b.D, H };
}
const TV = (o, k, v) => Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false }); // 저장에서 빠지는 임시 값
function buildHouses() {
  disposeTree(houseG); houseG.clear();
  if (R.kind !== 'out') return;
  (R.houses || []).forEach((hs, i) => { if (!hs.id) hs.id = 'h' + i + Date.now().toString(36);
    const sp = SPACES.find(x => x.id === hs.sid); if (!sp || !sp.s || spKind(sp.s.R) === 'out') { TV(hs, 'g', null); return; }
    const m = buildHouseModel(sp.s, hs.roof || 'flat'), g = new THREE.Group(); g.add(m.body); TV(hs, '_w', m.W); TV(hs, '_d', m.D); TV(hs, '_h', m.H); TV(hs, '_name', sp.name);
    g.position.set(hs.x, 0, hs.z); g.rotation.y = (hs.rot || 0) * PI / 180; g.traverse(o => { o.userData.house = hs; });
    TV(hs, 'g', g); houseG.add(g);
  });
  buildCorridors(R.houses || [], R.corridors, houseG);
}
function placeHouses(sids) {
  if (R.kind !== 'out') return toast('야외 공간에서만 집을 배치할 수 있습니다');
  const list = sids.map(id => SPACES.find(x => x.id === id)).filter(sp => sp && sp.s && spKind(sp.s.R) !== 'out'); if (!list.length) return toast('배치할 방이 없습니다 — 먼저 「＋ 방 추가」로 방을 만드세요');
  const dims = list.map(sp => roomBBox(sp.s)), gap = 0, Wt = dims.reduce((a, d) => a + d.W, 0) + gap * (dims.length - 1), Dt = Math.max(...dims.map(d => d.D));
  if (Wt + 600 > R.W || Dt + 900 > R.D) setRoomDim('W', Math.max(R.W, Wt + 600)), setRoomDim('D', Math.max(R.D, Dt + 900));
  let x = BB.x0 + (BB.W - Wt) / 2; const z = BB.z0 + 250 + Dt / 2;
  R.houses = [...(R.houses || [])];
  list.forEach((sp, i) => { R.houses.push({ id: 'h' + Date.now().toString(36) + i, sid: sp.id, x: r1(x + dims[i].W / 2), z: r1(z - (Dt - dims[i].D) / 2), rot: 0, roof: 'flat' }); x += dims[i].W + gap; });
  buildRoom(); upd(); renderRoom(); toast(`🏠 ${list.map(s => s.name).join(', ')} — 집을 야외에 배치했습니다 (끌어서 이동, 더블클릭하면 그 방으로 들어갑니다)`, 6000);
}
function removeHouse(hs) { R.houses = (R.houses || []).filter(x => x !== hs); if ((R.corridors || []).some(c => c.a === hs.id || c.b === hs.id)) { R.corridors = R.corridors.filter(c => c.a !== hs.id && c.b !== hs.id); syncCorrOpenings(R.houses, R.corridors); } if (sel && sel.o === hs) setSel(null); buildRoom(); upd(); renderRoom(); }
function housePanel(b, hs) {
  const RB = () => { buildRoom(); updSelBox(); commitSoon(); syncSel(); };
  app(b, h('div', { class: 'lab' }, `🏠 ${hs._name || '집'}`),
    h('p', { class: 'mu sm' }, `건물 크기 ${rd(hs._w || 0)} × ${rd(hs._d || 0)} cm · 높이 ${rd(hs._h || 0)} cm — 이 프로젝트의 방 공간을 그대로 보여 줍니다. 방 안을 고치면 여기에도 반영됩니다.`),
    G(3, F('왼쪽에서 (중심)', bnum(() => hs.x - BB.x0, v => { hs.x = BB.x0 + v; if (hs.g) hs.g.position.x = hs.x; updSelBox(); commitSoon(); })), F('뒤에서 (중심)', bnum(() => hs.z - BB.z0, v => { hs.z = BB.z0 + v; if (hs.g) hs.g.position.z = hs.z; updSelBox(); commitSoon(); })), F('각도 (시계°)', bnum(() => norm360(-(hs.rot || 0)), v => { hs.rot = norm360(-v); if (hs.g) hs.g.rotation.y = hs.rot * PI / 180; updSelBox(); commitSoon(); }, { step: 15 }))),
    h('div', { class: 'r' }, BTN('⟲ 90°', () => rotSel(90), 'c'), BTN('⟳ 90°', () => rotSel(-90), 'c'), BTN('⟳ 180°', () => rotSel(180), 'c'), BTN('가운데로', () => { hs.x = BB.x0 + BB.W / 2; hs.z = BB.z0 + BB.D / 2; RB(); }, 'c')),
    F('지붕', bsel(ROOFS, () => hs.roof || 'flat', v => { hs.roof = v; RB(); })),
    attachBlock(hs),
    h('div', { class: 'r' }, BTN('🚪 이 방으로 들어가기', () => switchSpace(hs.sid), 'b'), BTN('야외에서 빼기', () => removeHouse(hs), 'o danger')));
}
function housesBlock() {
  const rooms = SPACES.filter(sp => sp.id !== SPID && sp.kind !== 'out'), placed = new Set((R.houses || []).map(x => x.sid));
  return h('div', { class: 'spbox' },
    (R.houses || []).length ? h('div', { class: 'ch' }, R.houses.map(hs => BTN(`🏠 ${(SPACES.find(x => x.id === hs.sid) || {}).name || '(삭제된 방)'}`, () => { if (hs.g) setSel({ k: 'house', o: hs }, 'sel'); }, 'c' + (sel && sel.o === hs ? ' on' : '')))) : h('p', { class: 'mu sm' }, '아직 배치된 집이 없습니다.'),
    rooms.length ? h('div', { class: 'r' }, rooms.length > 1 ? BTN(`＋ 전체 집 배치 (방 ${rooms.length}개)`, () => placeHouses(rooms.filter(r => !placed.has(r.id)).map(r => r.id)), 'b') : null, ...rooms.map(sp => BTN(`＋ ${sp.name}${placed.has(sp.id) ? ' (하나 더)' : ''}`, () => placeHouses([sp.id]), rooms.length > 1 ? 'c' : 'b'))) : h('p', { class: 'mu sm' }, '이 프로젝트에 방 공간이 없습니다. 「＋ 방 추가」로 방을 만들면 여기에 집으로 배치할 수 있어요.'),
    h('p', { class: 'mu sm' }, '집을 끌어서 옮기고, 선택 탭에서 회전·지붕을 바꿀 수 있습니다. 집을 더블클릭하면 그 방 안으로 들어갑니다.'));
}
const envG = new THREE.Group(); scene.add(envG);
// ---------- 공간 연결: 전체 함께 보기 · 붙이기 · 연결 통로 · 배경 ----------
const rotPt = (x, z, deg) => { const a = deg * PI / 180, c = Math.cos(a), s = Math.sin(a); return [x * c + z * s, -x * s + z * c]; }; // three.js rotateY 와 같은 방향
function roomInfo(st) { const r = normState(st).R, E2 = edgesOf(r.pts, r.bul || {}), b = bbox(outline(E2)); return { E: E2, b, c: [b.x0 + b.W / 2, b.z0 + b.D / 2], H: r.H || 230 }; }
const spOf = id => SPACES.find(x => x.id === id);
function hFoot(hs, ri) { ri = ri || roomInfo(spOf(hs.sid).s); const hw = ri.b.W / 2, hd = ri.b.D / 2; return bbox([[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, z]) => { const [rx, rz] = rotPt(x, z, hs.rot || 0); return [hs.x + rx, hs.z + rz]; })); }
function siteToRoom(hs, ri, X, Z) { const [x, z] = rotPt(X - hs.x, Z - hs.z, -(hs.rot || 0)); return [x + ri.c[0], z + ri.c[1]]; }
const validHouse = hs => { const sp = spOf(hs.sid); return sp && sp.s && spKind(sp.s.R) !== 'out'; };
// 통로 모양 계산 (사이트 좌표, 축 정렬): 일자(가로/세로) 또는 ㄱ자. 붙어 있으면 통로 없이 벽에 문만
function corrGeom(c, houses) {
  const A = houses.find(x => x.id === c.a), B = houses.find(x => x.id === c.b); if (!A || !B || !validHouse(A) || !validHouse(B)) return null;
  const ia = roomInfo(spOf(A.sid).s), ib = roomInfo(spOf(B.sid).s), fa = hFoot(A, ia), fb = hFoot(B, ib), w = c.w || 110, segs = [], ends = [];
  const ov = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)], [oz0, oz1] = ov(fa.z0, fa.z1, fb.z0, fb.z1), [ox0, ox1] = ov(fa.x0, fa.x1, fb.x0, fb.x1);
  if (oz1 - oz0 >= w + 20 && (fa.x1 <= fb.x0 + 2 || fb.x1 <= fa.x0 + 2)) {
    const [L, Rr, hl, hr, il, ir] = fa.x1 <= fb.x0 + 2 ? [fa, fb, A, B, ia, ib] : [fb, fa, B, A, ib, ia], zc = clamp((oz0 + oz1) / 2 + (c.off || 0), oz0 + w / 2 + 5, oz1 - w / 2 - 5);
    segs.push({ ax: 'x', a0: L.x1, a1: Rr.x0, c: zc }); ends.push({ hs: hl, ri: il, X: L.x1 - 2, Z: zc }, { hs: hr, ri: ir, X: Rr.x0 + 2, Z: zc });
  } else if (ox1 - ox0 >= w + 20 && (fa.z1 <= fb.z0 + 2 || fb.z1 <= fa.z0 + 2)) {
    const [T, Bt, ht, hb, it2, ib2] = fa.z1 <= fb.z0 + 2 ? [fa, fb, A, B, ia, ib] : [fb, fa, B, A, ib, ia], xc = clamp((ox0 + ox1) / 2 + (c.off || 0), ox0 + w / 2 + 5, ox1 - w / 2 - 5);
    segs.push({ ax: 'z', a0: T.z1, a1: Bt.z0, c: xc }); ends.push({ hs: ht, ri: it2, X: xc, Z: T.z1 - 2 }, { hs: hb, ri: ib2, X: xc, Z: Bt.z0 + 2 });
  } else {
    const bc = [(fb.x0 + fb.x1) / 2, (fb.z0 + fb.z1) / 2], right = bc[0] > (fa.x0 + fa.x1) / 2, xA = right ? fa.x1 : fa.x0;
    const zA = clamp(bc[1] + (c.off || 0), fa.z0 + w / 2 + 10, fa.z1 - w / 2 - 10), down = bc[1] > zA, zB = down ? fb.z0 : fb.z1;
    segs.push({ ax: 'x', a0: Math.min(xA, bc[0] + (right ? w / 2 : -w / 2)), a1: Math.max(xA, bc[0] + (right ? w / 2 : -w / 2)), c: zA, open: { side: down ? 1 : -1, at: right ? 'end' : 'start' } });
    segs.push({ ax: 'z', a0: Math.min(zA + (down ? w / 2 : -w / 2), zB), a1: Math.max(zA + (down ? w / 2 : -w / 2), zB), c: bc[0] });
    ends.push({ hs: A, ri: ia, X: xA + (right ? -2 : 2), Z: zA }, { hs: B, ri: ib, X: bc[0], Z: zB + (down ? 2 : -2) });
  }
  return { segs, ends, w, h: Math.min(c.h || 215, ia.H - 5, ib.H - 5), Hc: Math.min(ia.H, ib.H) };
}
function buildCorridors(houses, corrs, into) {
  (corrs || []).forEach(c => {
    const gm = corrGeom(c, houses); if (!gm) return; const { w, Hc } = gm, g = new THREE.Group(), fm = new THREE.MeshLambertMaterial({ color: 0xc9a77c }), wm = new THREE.MeshLambertMaterial({ color: new THREE.Color(c.wc || '#efe9df').getHex(), side: THREE.DoubleSide }), rm = new THREE.MeshLambertMaterial({ color: 0xb9b5ad });
    const box = (sx, sy, sz, x, y, z, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.5, sx), sy, Math.max(0.5, sz)), m); q.position.set(x, y + sy / 2, z); g.add(q); };
    gm.segs.forEach(sg => {
      const L = sg.a1 - sg.a0; if (L < 3) return; const m = (sg.a0 + sg.a1) / 2;
      const along = (len, h, thick, at, off, mat, y = 0) => sg.ax === 'x' ? box(len, h, thick, at, y, sg.c + off, mat) : box(thick, h, len, sg.c + off, y, at, mat);
      along(L, 3, w + 16, m, 0, fm, -3); along(L, 12, w + 32, m, 0, rm, Hc);
      [-1, 1].forEach(sd => { if (sg.open && sg.open.side === sd) { const cut = w + 8, a0 = sg.open.at === 'end' ? sg.a0 : sg.a0 + cut, a1 = sg.open.at === 'end' ? sg.a1 - cut : sg.a1; if (a1 - a0 > 2) along(a1 - a0, Hc, 8, (a0 + a1) / 2, sd * (w / 2 + 4), wm); } else along(L, Hc, 8, m, sd * (w / 2 + 4), wm); });
      if (sg.open) { const endX = sg.open.at === 'end' ? sg.a1 : sg.a0; along(8, Hc, w + 16, endX + (sg.open.at === 'end' ? -4 : 4), 0, wm); }
    });
    g.traverse(o => { o.userData.corr = c; }); into.add(g);
  });
}
// 통로 끝마다 양쪽 방의 벽에 개구부/문을 냄 (방 데이터에 저장, 통로를 지우면 같이 지워짐)
function corrOps(c, houses) {
  const gm = corrGeom(c, houses); if (!gm) return [];
  return gm.ends.map(en => {
    const sp = spOf(en.hs.sid), [lx, lz] = siteToRoom(en.hs, en.ri, en.X, en.Z); let best = null;
    en.ri.E.forEach(e => { if (Math.abs(e.h) > 0.5) return; const q = segDist(e, lx, lz); if (!best || q.d < best.d) best = { e, ...q }; });
    if (!best || best.d > 60) return null;
    const ow = Math.min(gm.w, best.e.len - 20), s0 = clamp(best.s, ow / 2 + 5, best.e.len - ow / 2 - 5);
    return { sp, op: { kind: 'door', st: c.door || 'open', wall: best.e.i, s: r1(s0), w: r1(ow), h: gm.h, y: 0, fc: '#f3f2ee', dc: '#f3f2ee', hinge: 'L', sw: 'in', ang: 0, corr: c.id } };
  }).filter(Boolean);
}
function syncCorrOpenings(houses, corrs) {
  SPACES.forEach(sp => { if (sp.s && sp.s.ops) sp.s.ops = sp.s.ops.filter(o => !o.corr); });
  (corrs || []).forEach(c => corrOps(c, houses).forEach(({ sp, op }) => { const ops = sp.s.ops = [...(sp.s.ops || [])]; ops.push({ id: 90000 + ops.length + Math.floor(Math.random() * 9000), ...op }); }));
}
// 기존 창문·문과 겹치지 않는 위치로 통로를 자동으로 옮김
function autoOffset(c, houses) {
  const clash = () => corrOps(c, houses).some(({ sp, op }) => (sp.s.ops || []).some(o => !o.corr && o.wall === op.wall && Math.abs(o.s - op.s) < (o.w + op.w) / 2 + 10));
  for (let k = 0; k <= 60; k++) { const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10; c.off = off; if (!clash()) return true; }
  c.off = 0; return false;
}
// 집 끌 때 다른 집 벽에 딱 붙이기 (30cm 이내)
function snapHouse(hs) {
  const me = hFoot(hs), T = 30; let dx = null, dz = null;
  (R.houses || []).forEach(o => { if (o === hs || !validHouse(o)) return; const f = hFoot(o), zov = Math.min(me.z1, f.z1) - Math.max(me.z0, f.z0), xov = Math.min(me.x1, f.x1) - Math.max(me.x0, f.x0);
    if (zov > -T) [[f.x1 - me.x0], [f.x0 - me.x1]].forEach(([d]) => { if (Math.abs(d) < T && (dx == null || Math.abs(d) < Math.abs(dx))) dx = d; });
    if (xov > -T) [[f.z1 - me.z0], [f.z0 - me.z1]].forEach(([d]) => { if (Math.abs(d) < T && (dz == null || Math.abs(d) < Math.abs(dz))) dz = d; });
    if (dx != null && zov > 0) [[f.z0 - me.z0], [f.z1 - me.z1]].forEach(([d]) => { if (Math.abs(d) < T && dz == null) dz = d; });
    if (dz != null && xov > 0) [[f.x0 - me.x0], [f.x1 - me.x1]].forEach(([d]) => { if (Math.abs(d) < T && dx == null) dx = d; }); });
  if (dx != null) hs.x = r1(hs.x + dx); if (dz != null) hs.z = r1(hs.z + dz);
}
function attachHouse(hs, tgt, side, align, door) {
  const me = hFoot(hs), f = hFoot(tgt), w = me.x1 - me.x0, d = me.z1 - me.z0;
  if (side === 'R' || side === 'L') { hs.x = side === 'R' ? f.x1 + w / 2 : f.x0 - w / 2; hs.z = align === 'start' ? f.z0 + d / 2 : align === 'end' ? f.z1 - d / 2 : (f.z0 + f.z1) / 2; }
  else { hs.z = side === 'F' ? f.z1 + d / 2 : f.z0 - d / 2; hs.x = align === 'start' ? f.x0 + w / 2 : align === 'end' ? f.x1 - w / 2 : (f.x0 + f.x1) / 2; }
  hs.x = r1(hs.x); hs.z = r1(hs.z);
  if (door) { const nc = { id: 'c' + Date.now().toString(36), a: tgt.id, b: hs.id, w: door === 'jung3' ? 180 : 100, door }; R.corridors = [...(R.corridors || []).filter(c => !((c.a === hs.id && c.b === tgt.id) || (c.a === tgt.id && c.b === hs.id))), nc]; autoOffset(nc, R.houses); }
  syncCorrOpenings(R.houses, R.corridors); buildRoom(); upd(); renderSel(); renderRoom();
  toast(`🏠 '${hs._name}'을(를) '${tgt._name}' ${({ R: '오른쪽', L: '왼쪽', F: '앞쪽', B: '뒤쪽' })[side]}에 붙였습니다${door ? ' — 맞닿은 벽에 문을 냈습니다' : ''}`, 5000);
}
function addCorridor(a, b, w, door) {
  if (!a || !b || a === b) return toast('서로 다른 두 공간을 고르세요');
  R.corridors = [...(R.corridors || []), { id: 'c' + Date.now().toString(36), a, b, w: +w || 110, door: door || 'open' }];
  const gm0 = corrGeom(R.corridors.at(-1), R.houses || []); if (!gm0) { R.corridors.pop(); return toast('통로를 만들 수 없습니다'); }
  const moved = !autoOffset(R.corridors.at(-1), R.houses || []) ? ' (기존 창호와 겹칠 수 있어요 — ◀ ▶로 옮기세요)' : R.corridors.at(-1).off ? ' (기존 창문·문을 피해 위치를 옮겼습니다)' : ''; const gm = corrGeom(R.corridors.at(-1), R.houses || []);
  syncCorrOpenings(R.houses, R.corridors); buildRoom(); upd(); renderRoom();
  toast((gm.segs.some(s => s.a1 - s.a0 > 3) ? `🔗 연결 통로를 만들고 양쪽 방 벽에 ${door === 'open' ? '개구부' : '문'}를 냈습니다` : '🔗 두 공간이 맞닿아 있어 벽에 문만 냈습니다') + moved, 5000);
}
function removeCorridor(c) { R.corridors = (R.corridors || []).filter(x => x !== c); syncCorrOpenings(R.houses, R.corridors); buildRoom(); upd(); renderRoom(); toast('🗑 연결 통로를 지웠습니다 (벽의 문도 함께)'); }
const DOORS_C = [['open', '개구부 (문 없이 뚫림)'], ['swing', '여닫이문'], ['slide', '미닫이문'], ['jung3', '3연동 중문'], ['double', '양개문']];
function corridorBlock() {
  const hs = (R.houses || []).filter(validHouse); if (hs.length < 2) return h('p', { class: 'mu sm' }, '공간(집)이 2개 이상 배치되면 붙이거나 연결 통로를 만들 수 있습니다.');
  const opt = () => hs.map(x => h('option', { value: x.id }, x._name || '집'));
  const a = h('select', {}, opt()), b = h('select', {}, opt()), w = h('input', { type: 'number', value: 110, min: 70, max: 400 }), dr = h('select', {}, DOORS_C.map(([k, n]) => h('option', { value: k }, n))); b.value = hs[1].id;
  return h('div', { class: 'spbox' },
    G(2, F('공간 A', a), F('공간 B', b)), G(2, F('통로 폭 (cm)', w), F('방 벽에 낼 문', dr)),
    h('div', { class: 'r' }, BTN('🔗 연결 통로 만들기', () => addCorridor(a.value, b.value, w.value, dr.value), 'b')),
    (R.corridors || []).length ? h('div', {}, R.corridors.map(c => { const A = hs.find(x => x.id === c.a), B = hs.find(x => x.id === c.b); return h('div', { class: 'it' }, h('span', {}, `🔗 ${A ? A._name : '?'} ↔ ${B ? B._name : '?'} · 폭 ${c.w} · ${(DOORS_C.find(d => d[0] === c.door) || [])[1] || ''}`), h('button', { class: 'c', title: '통로 위치 옮기기', onclick: () => { c.off = (c.off || 0) - 20; syncCorrOpenings(R.houses, R.corridors); buildRoom(); upd(); } }, '◀'), h('button', { class: 'c', title: '통로 위치 옮기기', onclick: () => { c.off = (c.off || 0) + 20; syncCorrOpenings(R.houses, R.corridors); buildRoom(); upd(); } }, '▶'), h('button', { class: 'x', title: '통로 지우기', onclick: () => removeCorridor(c) }, '×')); })) : null,
    h('p', { class: 'mu sm' }, '떨어져 있으면 일자·ㄱ자 통로가 생기고, 맞닿아 있으면 벽에 문만 냅니다. 집을 옮기면 통로와 문 위치가 자동으로 따라갑니다.'));
}
function attachBlock(hs) {
  const others = (R.houses || []).filter(x => x !== hs && validHouse(x)); if (!others.length) return null;
  const t = h('select', {}, others.map(x => h('option', { value: x.id }, x._name || '집'))), sd = h('select', {}, [['R', '오른쪽에'], ['L', '왼쪽에'], ['F', '앞쪽에'], ['B', '뒤쪽에']].map(([k, n]) => h('option', { value: k }, n))), al = h('select', {}, [['center', '가운데 맞춤'], ['start', '뒤/왼쪽 끝 맞춤'], ['end', '앞/오른쪽 끝 맞춤']].map(([k, n]) => h('option', { value: k }, n))), dr = h('select', {}, h('option', { value: '' }, '문 없이 벽만 맞닿게'), DOORS_C.map(([k, n]) => h('option', { value: k }, '맞닿은 벽에 ' + n)));
  return h('div', { class: 'spbox' }, h('b', {}, '🧲 다른 공간에 붙이기'), G(2, F('대상', t), F('위치', sd)), G(2, F('정렬', al), F('연결', dr)), h('div', { class: 'r' }, BTN('붙이기', () => attachHouse(hs, others.find(x => x.id === t.value), sd.value, al.value, dr.value), 'b')), h('p', { class: 'mu sm' }, '끌어서 다른 집 가까이 가져가도 벽에 자동으로 딱 붙습니다.'));
}
// 전체 함께 보기: 배경 야외로 가서 아직 안 놓인 방을 모두 배치 (야외가 없으면 새로 만듦)
function goOverview() {
  let bg = SPACES.find(x => x.kind === 'out' && (x.id === SPID ? (R.houses || []).length : x.s && (x.s.R.houses || []).length)) || SPACES.find(x => x.kind === 'out');
  const rooms = () => SPACES.filter(x => x.kind !== 'out').map(x => x.id);
  if (!bg) { const rs = rooms(); if (!rs.length) return toast('공간이 없습니다'); addSpace('전체 배치 (배경)', outdoorState('field', 1600, 1300)); placeHouses(rs); return; }
  if (bg.id !== SPID) switchSpace(bg.id, true);
  const placed = new Set((R.houses || []).map(x => x.sid)), rest = rooms().filter(id => !placed.has(id));
  if (rest.length) placeHouses(rest); else toast('🏘 모든 공간을 함께 보고 있습니다 — 집을 끌어 옮기거나 붙이고, 더블클릭하면 그 방으로 들어갑니다', 5000);
}
// 방 안에서도 옆 공간·통로·야외 배경이 보이게 (옵션)
const siteG = new THREE.Group(); scene.add(siteG);
function buildSiteView() {
  disposeTree(siteG); siteG.clear(); siteG.userData.on = false;
  if (R.kind === 'out' || !PREF.site) { opG.traverse(o => { if (o.userData.scenery) o.visible = true; }); return; }
  const bg = SPACES.find(x => x.kind === 'out' && x.s && (x.s.R.houses || []).some(hh => hh.sid === SPID)) || SPACES.find(x => x.kind === 'out' && x.s);
  if (!bg) return;
  const bR = normState(bg.s).R, houses = (bR.houses || []), mine = houses.find(hh => hh.sid === SPID), bE = edgesOf(bR.pts, bR.bul || {}), bBB = bbox(outline(bE));
  const g1 = new THREE.Group(), g2 = new THREE.Group(); g1.add(g2); siteG.add(g1);
  if (mine) { const ri = roomInfo(curSpaceState()); g1.position.set(ri.c[0], 0, ri.c[1]); g1.rotation.y = -(mine.rot || 0) * PI / 180; g2.position.set(-mine.x, 0, -mine.z); }
  else { g2.position.set(BB.x0 + BB.W / 2 - (bBB.x0 + bBB.W / 2), 0, BB.z0 + BB.D / 2 - (bBB.z0 + bBB.D / 2)); }
  const D0 = ENV_DEF[bR.env] || ENV_DEF.field, gt = groundTex(bR.gk || D0.g, bR.gc || D0.gc), S = 24000, tex = gt.tex.clone(); tex.needsUpdate = true; tex.repeat.set(S / gt.u, S / gt.u);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ map: tex })); ground.rotation.x = -PI / 2; ground.position.set(bBB.x0 + bBB.W / 2, -11.5, bBB.z0 + bBB.D / 2); g2.add(ground);
  const tm = bR.vtime && bR.vtime !== 'auto' ? bR.vtime : PREF.night ? 'night' : 'day'; g2.add(buildEnv(bR, { ...bBB, W: bBB.W, D: bBB.D }, tm));
  houses.forEach(hs => { if (hs.sid === SPID || !validHouse(hs)) return; const m = buildHouseModel(spOf(hs.sid).s, hs.roof || 'flat'), g = new THREE.Group(); g.add(m.body); g.position.set(hs.x, 0, hs.z); g.rotation.y = (hs.rot || 0) * PI / 180; g.traverse(o => { o.userData.siteRoom = hs.sid; }); g2.add(g); });
  buildCorridors(houses, bR.corridors, g2);
  siteG.userData.on = true; siteG.userData.time = tm;
  opG.traverse(o => { if (o.userData.scenery) o.visible = false; }); // 창밖 그림 대신 실제 바깥이 보이게
  applyLightMode();
}

function buildOutdoor() {
  const D0 = ENV_DEF[R.env] || ENV_DEF.field, gk = R.gk || D0.g, gc = R.gc || D0.gc, t = vtimeNow(); R.vtimeNow = t;
  const gt = groundTex(gk, gc), S = 24000, tex = gt.tex.clone(); tex.needsUpdate = true; tex.repeat.set(S / gt.u, S / gt.u);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshLambertMaterial({ map: tex })); ground.rotation.x = -PI / 2; ground.position.set(BB.x0 + BB.W / 2, -0.2, BB.z0 + BB.D / 2); roomG.add(ground);
  // 사이트(배치 영역) 경계: 점선
  const pts = OL.map(([x, z]) => new THREE.Vector3(x, 0.6, z)); pts.push(pts[0].clone());
  const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 30, gapSize: 18, transparent: true, opacity: 0.85 })); ln.computeLineDistances(); roomG.add(ln);
  envG.add(buildEnv(R, BB, t));
  buildHouses();
}

const selBox = new THREE.BoxHelper(undefined, 0x2f6fed); selBox.visible = false; selBox.material.depthTest = false; selBox.renderOrder = 20; scene.add(selBox);

// ---------- 공통 헬퍼 ----------
const fpw = it => (it.fold && LEAF[it.type] ? it.w * LEAF[it.type] : it.w);
function fp(it) { const w = fpw(it), a = (it.rot || 0) * PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return [w * c + it.d * s, w * s + it.d * c]; }
const snapV = (v, s) => (PREF.snap ? Math.round(v / s) * s : r1(v));
const norm360 = r => ((r % 360) + 360) % 360;
function nearestEdge(x, z, onlyStraight = true) { let best = null, bd = 1e9; E.forEach(e => { if (onlyStraight && !straight(e)) return; const q = segDist(e, x, z); if (q.d < bd) { bd = q.d; best = { e, ...q }; } }); return best; }
const lightIsWall = l => (LKIND[l.kind] || {}).mt === 'w';
const center = () => [BB.x0 + BB.W / 2, BB.z0 + BB.D / 2];
const opLen = o => (E[o.wall] ? E[o.wall].len : 0);

// 라벨 (책장1, 조명2, 창문1 …)
const GRP = [[/^(bed|bunk|crib)$/, '침대'], [/^(sofa|sofaL|beanbag)$/, '소파'], [/^(shelf.|bookcase|mshelf)$/, '책장'], [/^(rack|wshelf|ladder)$/, '선반'], [/^(cab|drawer|vitrine|kitchen|island|hanger)$/, '수납장'], [/^(ctable|rtable|porbo|sq|wings|half|panel|ldesk|mdesk|vanity)$/, '테이블'], [/^(dchair|office|bench|barstool|pouf|massage)$/, '의자'], [/^plant$/, '식물'], [/^(lamp|flamp|arcLamp|tripod|mlamp|tlamp|uplight)$/, '스탠드'], [/^tv$/, 'TV'], [/^monitor$/, '모니터'], [/^person$/, '사람'], [/^(rug|rugR)$/, '러그'], [/^(frame|mirrorR|mirrorF|clock)$/, '벽장식'], [/^curtainI$/, '커튼'], [/^(fridge|washer|styler|acStand|acWall|purifier|humid|fan|circ|robot|appl|wine|pc|speaker|soundbar|piano|dpiano|treadmill)$/, '가전']];
const grp = t => (GRP.find(([re]) => re.test(t)) || [0, '소품'])[1];
function ensureNo(o, list, gname) { if (o.no && !list.some(x => x !== o && x.no === o.no && gname(x) === gname(o))) return; o.no = 1 + Math.max(0, ...list.filter(x => x !== o && gname(x) === gname(o)).map(x => x.no || 0)); }
const itemLabel = it => grp(it.type) + (it.no || '');
const opLabel = o => (o.kind === 'win' ? '창문' : '문') + (o.no || '');
const lightLabel = l => '조명' + (l.no || '');
function numberAll() { items.forEach(i => ensureNo(i, items, x => grp(x.type))); OPS.forEach(o => ensureNo(o, OPS, x => x.kind)); LIGHTS.forEach(l => ensureNo(l, LIGHTS, () => 'l')); }
const LOCKMSG = { item: '잠긴 가구입니다', op: '잠긴 창호입니다', light: '잠긴 조명입니다', room: '방 모양이 잠겨 있습니다' };
const isLocked = s => !!(s && (s.k === 'multi' ? s.list.every(o => o.lock) : s.k === 'edge' || s.k === 'vert' ? R.lock : s.o && s.o.lock));
function lockGuard(s) { if (isLocked(s)) { toast('🔒 ' + (LOCKMSG[s.k] || LOCKMSG.room) + ' — 잠금을 풀면 수정할 수 있습니다'); return true; } return false; }
const labelOf = s => !s ? '' : s.k === 'house' ? '🏠 ' + (s.o._name || '집') : s.k === 'item' ? itemLabel(s.o) : s.k === 'op' ? opLabel(s.o) : s.k === 'light' ? lightLabel(s.o) : s.k === 'edge' ? '벽' + (s.i + 1) : '꼭짓점' + (s.i + 1);

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
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, N, 3); g.fillRect(0, 0, 3, N); if (t === 'bigtile') g.fillRect(0, N / 2, N, 3);
  } else if (t === 'marble') {
    u = 120;
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(90,90,100,${0.06 + r() * 0.14})`; g.lineWidth = 0.5 + r() * 2.5; g.beginPath(); let x = r() * N, y = 0; g.moveTo(x, y); while (y < N) { x += (r() - 0.5) * 60; y += 20 + r() * 40; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, 0, N, 2); g.fillRect(0, 0, 2, N); g.fillRect(0, N / 2, N, 2); g.fillRect(N / 2, 0, 2, N);
  } else if (t === 'concrete') { u = 200; for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},.04)`; g.beginPath(); g.arc(r() * N, r() * N, 10 + r() * 50, 0, PI * 2); g.fill(); } }
  else if (t === 'carpet') { u = 50; for (let i = 0; i < 20000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},.08)`; g.fillRect(r() * N, r() * N, 2, 2); } }
  else { for (let i = 0; i < 3000; i++) { g.fillStyle = 'rgba(0,0,0,.02)'; g.fillRect(r() * N, r() * N, 4, 4); } }
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
  if (!E[o.wall] || !straight(E[o.wall])) { const c = E[o.wall] ? EP(E[o.wall], o.s || 0) : center(); const ne = nearestEdge(c[0], c[1]); if (ne) { o.wall = ne.e.i; o.s = ne.s; } else o.wall = 0; }
  const len = opLen(o);
  o.w = r1(clamp(o.w, 20, Math.max(20, len - 2)));
  if (o.kind === 'door') { o.y = 0; o.h = clamp(o.h, 20, R.H - 1); } else { o.y = clamp(o.y, 0, R.H - 21); o.h = clamp(o.h, 20, R.H - 1 - o.y); }
  o.s = clamp(o.s ?? len / 2, o.w / 2, Math.max(o.w / 2, len - o.w / 2));
}
function vtimeNow() { return R.vtime && R.vtime !== 'auto' ? R.vtime : PREF.night ? 'night' : 'day'; }
function addSeg(p, q, H, mtl, bbm, holes) {
  const dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz); if (len < 0.3) return;
  const u = [dx / len, dz / len], n = [-u[1], u[0]], ry = Math.atan2(-u[1], u[0]), at = s => [p[0] + u[0] * s, p[1] + u[1] * s];
  wallRects(len, H, holes).forEach(([a, b, y0, y1]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, y1 - y0), mtl), [x, z] = at((a + b) / 2); m.position.set(x, (y0 + y1) / 2, z); m.rotation.y = ry; RG.add(m); });
  freeIntervals(len, holes.filter(h => h[2] < 2)).forEach(([a, b]) => { if (b - a < 1) return; const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, 8, 1.2), bbm), [x, z] = at((a + b) / 2); m.position.set(x + n[0] * 0.6, 4, z + n[1] * 0.6); m.rotation.y = ry; RG.add(m); });
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 1, 2, 12), new THREE.MeshLambertMaterial({ color: 0xcfc9be })), [cx, cz] = at(len / 2);
  cap.position.set(cx - n[0] * 6, H + 1, cz - n[1] * 6); cap.rotation.y = ry; RG.add(cap);
}
function buildRoom() {
  geo(); disposeTree(roomG); roomG.clear(); disposeTree(opG); opG.clear(); disposeTree(envG); envG.clear(); if (R.kind !== 'out') { disposeTree(houseG); houseG.clear(); }
  const H = R.H;
  if (R.kind === 'out') { buildOutdoor(); buildHandles(); applyLightMode(); return; }
  buildRoomBody();
  buildHandles(); applyVis();
  if (sel && sel.k === 'op') updSelBox();
}
// 방 바닥·벽·창호 (RG/OG 그룹에 만듦 — 야외에 집으로 배치할 때도 재사용)
function buildRoomBody() {
  const H = R.H;
  // 바닥 / 슬래브 / 천장
  const sh = new THREE.Shape(OL.map(([x, z]) => new THREE.Vector2(x, -z))), shC = new THREE.Shape(OL.map(([x, z]) => new THREE.Vector2(x, z)));
  const ft = floorTex(R.fl, R.flc), tex = ft.tex; tex.repeat.set(1 / ft.u, 1 / ft.u); tex.center.set(0, 0); tex.rotation = (R.fld || 0) * PI / 180; tex.needsUpdate = true;
  const fl = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ map: tex })); fl.rotation.x = -PI / 2; fl.position.y = -0.2; RG.add(fl);
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 10, bevelEnabled: false, curveSegments: 4 }), new THREE.MeshLambertMaterial({ color: 0xb9b2a6 })); slab.rotation.x = -PI / 2; slab.position.y = -10.5; RG.add(slab);
  const ce = new THREE.Mesh(new THREE.ShapeGeometry(shC), new THREE.MeshLambertMaterial({ color: 0xf7f6f2 })); ce.rotation.x = PI / 2; ce.position.y = H; ce.visible = !!PREF.ceil; ce.userData.ceil = 1; RG.add(ce);
  // 바닥 격자(50cm)
  const pts = []; for (let x = Math.ceil(BB.x0 / 50) * 50; x <= BB.x1; x += 50) for (let z = BB.z0; z < BB.z1; z += 10) if (inside(OL, x, z + 5)) pts.push(x, 0, z, x, 0, Math.min(z + 10, BB.z1));
  for (let z = Math.ceil(BB.z0 / 50) * 50; z <= BB.z1; z += 50) for (let x = BB.x0; x < BB.x1; x += 10) if (inside(OL, x + 5, z)) pts.push(x, 0, z, Math.min(x + 10, BB.x1), 0, z);
  if (pts.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const gl = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0, transparent: true, opacity: 0.07 })); gl.position.y = 0.1; RG.add(gl); }
  // 벽
  const bbm = new THREE.MeshLambertMaterial({ color: R.bb });
  E.forEach(e => {
    const mtl = new THREE.MeshLambertMaterial({ color: R.wcs[e.i] || R.wc });
    if (!straight(e)) { const ap = arcPts(e, 20); for (let k = 0; k < ap.length - 1; k++) addSeg(ap[k], ap[k + 1], H, mtl, bbm, []); return; }
    const holes = OPS.filter(o => o.wall === e.i).map(o => [o.s - o.w / 2, o.s + o.w / 2, o.y, o.y + o.h]);
    addSeg(e.a, e.b, H, mtl, bbm, holes);
  });
  // 창호
  R.vtimeNow = vtimeNow();
  OPS.forEach(o => {
    clampOp(o); const e = E[o.wall], g = buildOpening(o, R), [x, z] = EP(e, o.s);
    g.position.set(x, 0, z); g.rotation.y = e.ry;
    g.traverse(c => { c.userData.op = o; }); g.userData.op = o; o.g = g; OG.add(g);
  });
}
function buildHandles() {
  disposeTree(hdG); hdG.clear(); if ((!PREF.handles && !PREF.shapeEdit) || R.lock) return;
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8590c }), am = new THREE.MeshBasicMaterial({ color: 0xffffff }), vm = new THREE.MeshBasicMaterial({ color: 0x2f6fed, depthTest: false }), pm = new THREE.MeshBasicMaterial({ color: 0x2b9348, depthTest: false });
  const big = isMobile() ? 1.5 : 1;
  E.forEach(e => {
    const mid = straight(e) ? EP(e, e.len / 2) : arcPts(e)[10], g = new THREE.Group();
    g.position.set(mid[0] - e.n[0] * 30, 1, mid[1] - e.n[1] * 30);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(11 * big, 11 * big, 2, 28), mat); g.add(disc);
    const ar = new THREE.Mesh(new THREE.BoxGeometry(14 * big, 2.4, 3), am); ar.position.y = 1.2; ar.rotation.y = e.ry + PI / 2; g.add(ar);
    g.traverse(c => { c.userData.h = { t: 'edge', i: e.i }; }); hdG.add(g);
    if (PREF.shapeEdit) { const p = new THREE.Mesh(new THREE.SphereGeometry(6 * big, 14, 10), pm), m2 = straight(e) ? EP(e, e.len / 2) : mid; p.position.set(m2[0], 4, m2[1]); p.renderOrder = 16; p.userData.h = { t: 'plus', i: e.i }; hdG.add(p); }
  });
  if (PREF.shapeEdit) R.pts.forEach((pt, j) => { const s = new THREE.Mesh(new THREE.SphereGeometry(8 * big, 16, 12), vm); s.position.set(pt[0], 6, pt[1]); s.renderOrder = 17; s.userData.h = { t: 'vert', i: j }; hdG.add(s); });
}
function setVis(g, on) {
  g.traverse(o => { const m = o.material; if (m && !o.isLine && !o.userData.scenery) { if (m.userData.o == null) m.userData.o = m.opacity; m.transparent = true; m.opacity = on ? m.userData.o : Math.min(0.08, m.userData.o); m.depthWrite = on && m.userData.o >= 1; } });
}
function applyVis() { OPS.forEach(o => o.g && setVis(o.g, o.kind === 'win' ? PREF.vwin : PREF.vdoor)); }

// ---------- 방 모양 편집 ----------
function wallRefs() {
  const refs = [];
  OPS.forEach(o => { const e = E[o.wall]; if (e) refs.push({ o, k: 's', w: o.wall, p: EP(e, o.s) }); });
  LIGHTS.forEach(l => { if (lightIsWall(l) && E[l.wall]) refs.push({ o: l, k: 's', w: l.wall, p: EP(E[l.wall], l.s) }); });
  items.forEach(i => { if (i.mt === 'w' && E[i.wall]) refs.push({ o: i, k: 'ws', w: i.wall, p: EP(E[i.wall], i.ws) }); });
  return refs;
}
function reproject(refs, map) {
  geo();
  refs.forEach(r => {
    const cands = (map ? map(r.w) : [r.w]).filter(i => E[i] && straight(E[i]));
    let best = null; (cands.length ? cands : E.filter(straight).map(e => e.i)).forEach(i => { const q = segDist(E[i], r.p[0], r.p[1]); if (!best || q.d < best.d) best = { i, ...q }; });
    if (!best) return; if (r.k === 'ws') { r.o.wall = best.i; r.o.ws = best.s; } else { r.o.wall = best.i; r.o.s = best.s; }
  });
}
function normalizeRoom() {
  geo(); const dx = BB.x0, dz = BB.z0; if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) return;
  R.pts = R.pts.map(([x, z]) => [r1(x - dx), r1(z - dz)]);
  items.forEach(i => { i.x -= dx; i.z -= dz; }); LIGHTS.forEach(l => { if (!lightIsWall(l)) { l.x -= dx; l.z -= dz; } });
  MEAS.forEach(m => { m[0] -= dx; m[2] -= dx; m[1] -= dz; m[3] -= dz; });
  const off = new THREE.Vector3(-dx, 0, -dz); camP.position.add(off); camO.position.add(off); ctl.target.add(off);
  geo();
}
function roomEdited(full = true) { buildRoom(); LIGHTS.forEach(placeLight); if (full) items.forEach(i => fit(i, false)); check(); dims(); upd(); }
function editShape(fn, map) { if (R.lock) return toast('🔒 방 모양이 잠겨 있습니다'); const refs = wallRefs(); fn(); R.pts = orient(R.pts); reproject(refs, map); normalizeRoom(); reproject(refs); roomEdited(); renderRoom(); }
function insertVertex(i) {
  editShape(() => { const e = E[i], m = straight(e) ? EP(e, e.len / 2) : arcPts(e)[10]; R.pts.splice(i + 1, 0, [r1(m[0]), r1(m[1])]); const b = {}; Object.entries(R.bul).forEach(([k, v]) => { k = +k; if (k < i) b[k] = v; else if (k > i) b[k + 1] = v; }); R.bul = b; },
    w => (w < i ? [w] : w === i ? [i, i + 1] : [w + 1]));
  setSel({ k: 'vert', i: i + 1 }, 'sel');
}
function deleteVertex(j) {
  if (R.pts.length <= 3) return toast('꼭짓점은 3개 이상이어야 합니다');
  const n = R.pts.length;
  editShape(() => { R.pts.splice(j, 1); const b = {}; Object.entries(R.bul).forEach(([k, v]) => { k = +k; if (k < j - 1) b[k] = v; else if (k > j) b[k - 1] = v; }); R.bul = b; },
    w => { const jj = j === 0 ? n - 1 : j - 1; if (w === jj || w === j) return [j === 0 ? n - 2 : j - 1]; return [w > j ? w - 1 : w]; });
  setSel(null);
}
function chamfer(j, d, round) {
  const n = R.pts.length, p = R.pts[j], a = R.pts[(j - 1 + n) % n], b = R.pts[(j + 1) % n];
  const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]); d = Math.min(d, la * 0.45, lb * 0.45);
  const p1 = [r1(p[0] + (a[0] - p[0]) / la * d), r1(p[1] + (a[1] - p[1]) / la * d)], p2 = [r1(p[0] + (b[0] - p[0]) / lb * d), r1(p[1] + (b[1] - p[1]) / lb * d)];
  const ang = Math.acos(clamp(((a[0] - p[0]) * (b[0] - p[0]) + (a[1] - p[1]) * (b[1] - p[1])) / la / lb, -1, 1)), chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const rr = d * Math.tan(ang / 2), sag = round ? rr - Math.sqrt(Math.max(0, rr * rr - chord * chord / 4)) : 0;
  editShape(() => { R.pts.splice(j, 1, p1, p2); const bnew = {}; Object.entries(R.bul).forEach(([k, v]) => { k = +k; if (k < j) bnew[k] = v; else bnew[k + 1] = v; }); if (round) bnew[j] = r1(sag); R.bul = bnew; },
    w => (w < j ? (w === (j - 1 + n) % n && j === 0 ? [w + 1] : [w]) : [w + 1]));
}
function applyShape(k) {
  const W = R.W, D = R.D, s = shapePreset(k, W, D);
  editShape(() => { R.pts = s.pts; R.bul = s.bul; R.wcs = {}; }, null);
  setSel(null); fitView();
}
function setRoomDim(k, v) {
  if (R.lock) { toast('🔒 방 크기가 잠겨 있습니다'); syncSel(); return; }
  if (k === 'H') { R.H = v; buildRoom(); LIGHTS.forEach(placeLight); items.forEach(i => { if (i.mt === 'c') i.y = Math.max(0, R.H - i.h - (i.hang ?? 25)); fit(i, false); }); return upd(); }
  const old = E.map(e => e.len), f = k === 'W' ? v / BB.W : v / BB.D; if (!isFinite(f) || f <= 0) return;
  R.pts = R.pts.map(([x, z]) => k === 'W' ? [r1(BB.x0 + (x - BB.x0) * f), z] : [x, r1(BB.z0 + (z - BB.z0) * f)]);
  geo(); [...OPS, ...LIGHTS.filter(lightIsWall)].forEach(o => { if (E[o.wall]) o.s = o.s * E[o.wall].len / (old[o.wall] || 1); });
  items.forEach(i => { if (i.mt === 'w' && E[i.wall]) i.ws = i.ws * E[i.wall].len / (old[i.wall] || 1); });
  roomEdited();
}

// ---------- 조명 ----------
function plCount() { let n = 0; scene.traverse(o => { if (o.isPointLight) n++; }); return n; }
function mkLight(l) {
  if (l.g) { ltG.remove(l.g); disposeTree(l.g); }
  const g = buildLight(l), k = LKIND[l.kind] || LKIND.down;
  if (l.on !== false && (l.lum ?? 1) > 0 && plCount() < MAXL) { const pl = new THREE.PointLight(kelvin(l.temp), 1, 800, 2); pl.userData.base = (l.lum ?? 1) * (k.kf || 0.8); pl.position.set(...g.userData.lp); g.add(pl); }
  g.traverse(c => { c.userData.lt = l; }); l.g = g; ltG.add(g); placeLight(l); applyLightMode();
}
function placeLight(l) {
  if (!l.g) return;
  if (lightIsWall(l)) {
    if (!E[l.wall] || !straight(E[l.wall])) { const ne = nearestEdge(l.x ?? 0, l.z ?? 0); l.wall = ne ? ne.e.i : 0; l.s = ne ? ne.s : 50; }
    const e = E[l.wall]; l.s = clamp(l.s ?? e.len / 2, 5, e.len - 5); l.y = clamp(l.y ?? 170, 5, R.H - 3);
    const [x, z] = EP(e, l.s); l.g.position.set(x, l.y, z); l.g.rotation.y = e.ry;
  } else { l.x = clamp(l.x ?? center()[0], BB.x0, BB.x1); l.z = clamp(l.z ?? center()[1], BB.z0, BB.z1); l.g.position.set(l.x, R.H, l.z); l.g.rotation.y = (l.rot || 0) * PI / 180; }
}
function applyLightMode() {
  const n = !!PREF.night;
  const out = R.kind === 'out', tm = out ? vtimeNow() : null;
  if (out) {
    const nt = tm === 'night', ss = tm === 'sunset' || tm === 'dawn';
    amb.intensity = nt ? 0.1 : 0.3; hemi.intensity = nt ? 0.06 : 0.32; hemi.color.set(nt ? 0x3a4a6a : ss ? 0xffd2b0 : 0xcfe3ff); hemi.groundColor.set(nt ? 0x101418 : 0x7a8a5a);
    dl.intensity = nt ? 0.06 : ss ? 0.45 : tm === 'cloudy' ? 0.25 : 0.52; dl.color.set(nt ? 0x8aa0d0 : ss ? 0xffb27a : 0xffffff); dl.position.set(BB.x0 - 600, ss ? 400 : 1800, BB.z0 + 900);
    scene.background = skyTex(tm); scene.fog = new THREE.Fog(FOGC[tm] || FOGC.day, 5000, 22000);
  } else {
    hemi.color.set(0xffffff); hemi.groundColor.set(0xd8cfc0); dl.color.set(0xffffff); dl.position.set(200, 500, 400); scene.fog = null;
    amb.intensity = n ? 0.14 : 0.56; hemi.intensity = n ? 0.04 : 0.1; dl.intensity = n ? 0.03 : 0.42;
    scene.background = n ? new THREE.Color(0x14161b) : null;
    if (siteG.userData.on) { const tm2 = n ? 'night' : (siteG.userData.time === 'night' ? 'day' : siteG.userData.time || 'day'); scene.background = skyTex(tm2); scene.fog = new THREE.Fog(FOGC[tm2] || FOGC.day, 5000, 22000); }
  }
  const dark = out ? tm === 'night' : n; scene.traverse(o => { if (o.isPointLight) o.intensity = o.userData.base * (dark ? 1 : out ? 0.25 : 0.12); });
  items.forEach(it => it.g && applyLightModeItem(it));
  LIGHTS.forEach(l => l.g && l.g.userData.em.forEach(m => m.emissive.copy(l.on !== false ? kelvin(l.temp).multiplyScalar((n ? 1 : 0.45) * ((l.lum ?? 1) <= 0 ? 0 : Math.min(1, (l.lum ?? 1) + 0.15))) : BLACK)));
  const b = $('night'); if (b) { b.classList.toggle('on', n); b.querySelector('.t') && (b.querySelector('.t').textContent = n ? '주간' : '야간'); }
}
function applyLightModeItem(it) {
  const n = !!PREF.night, on = it.on !== false;
  it.g.traverse(o => { if (o.isPointLight) o.intensity = o.userData.base * (n ? 1 : 0.12); });
  it.g.userData.ems.forEach(m => m.emissive.copy(on ? kelvin(it.temp || 2900).multiplyScalar((n ? 0.9 : 0.3) * ((it.lum ?? 0.8) <= 0 ? 0 : Math.min(1, (it.lum ?? 0.8) + 0.2))) : BLACK));
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
const MAIN_TOK = new Set([null, undefined, 'd', 'dd', 'f', 'l']), ACC_TOK = new Set(['a', 'ad', 'al']);
function labelSprite(t) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 40px sans-serif';
  const tw = Math.min(900, g.measureText(t).width + 30); c.width = tw; c.height = 64;
  g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,.88)'; g.fillRect(0, 6, tw, 52); g.fillStyle = '#1d1d1f'; g.fillText(t, tw / 2, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(tw / 64 * 13, 13, 1); s.renderOrder = 15; s.userData.label = 1; return s;
}
// 러그 무늬 텍스처 (내 사진이 있으면 사진 그대로)
const RUGTX = new Map();
function rugTex(it, fw) {
  const key = it.rugImg ? 'img|' + it.rugImg + '|' + rd(fw) + 'x' + rd(it.d) + '|' + (it.rugFit || 'cover') : null;
  if (key && RUGTX.has(key)) return RUGTX.get(key);
  if (it.rugImg) {
    const c = document.createElement('canvas'), W = 1024, H = Math.max(8, Math.round(1024 * it.d / Math.max(1, fw))); c.width = W; c.height = Math.min(2048, H);
    const g = c.getContext('2d'); g.fillStyle = it.color || '#999'; g.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c); RUGTX.set(key, tex); if (RUGTX.size > 30) RUGTX.delete(RUGTX.keys().next().value);
    getRef(it.rugImg).then(src => { if (!src) return; const im = new Image(); im.onload = () => { const s0 = it.rugFit === 'contain' ? Math.min(c.width / im.width, c.height / im.height) : Math.max(c.width / im.width, c.height / im.height), w2 = im.width * s0, h2 = im.height * s0; g.drawImage(im, (c.width - w2) / 2, (c.height - h2) / 2, w2, h2); tex.needsUpdate = true; }; im.src = src; });
    return tex;
  }
  return new THREE.CanvasTexture(rugCanvas(it, fw, it.d));
}
function mk(it) {
  if (it.g) { fG.remove(it.g); disposeTree(it.g); }
  const g = new THREE.Group(), m = new THREE.Group(), ms = [], ems = [], cm = {}, fw = fpw(it);
  const { P, LP } = buildParts(it, fw, { H: R.H });
  const rep = Math.max(1, Math.max(it.w, it.h) / 60);
  P.forEach(p => {
    const c = col(it, p.c), mat = MAIN_TOK.has(p.c) ? it.mat : ACC_TOK.has(p.c) ? it.mat2 : '', key = c + '|' + (p.op || 1) + '|' + (p.em ? 1 : 0) + '|' + (mat || '');
    let mt = cm[key];
    if (p.tex === 'rug') { mt = cm['rug'] || (cm['rug'] = new THREE.MeshLambertMaterial({ color: 0xffffff, map: rugTex(it, fw) })); if (!ms.includes(mt)) ms.push(mt); }
    if (p.tex === 'face' && it.face) { mt = cm['face'] || (cm['face'] = new THREE.MeshLambertMaterial({ color: 0xffffff, map: faceTexture(it.face, it.fzoom, it.fox, it.foy), transparent: true, depthWrite: false })); if (!ms.includes(mt)) ms.push(mt); }
    if (!mt) {
      mt = mat && !p.em ? makeMat(mat, c) : new THREE.MeshLambertMaterial({ color: c });
      if (mt.map) { mt.map = mt.map.clone(); mt.map.needsUpdate = true; mt.map.repeat.set(rep, rep); }
      if (p.op) { mt.transparent = true; mt.opacity = p.op; mt.depthWrite = false; mt.side = THREE.DoubleSide; }
      cm[key] = mt; (p.em ? ems : ms).push(mt);
    }
    let geo2;
    if (p.g === 'c') geo2 = new THREE.CylinderGeometry(Math.max(0.01, p.rt), Math.max(0.01, p.rb), Math.max(0.05, p.h), p.seg || 20, 1, false, p.ts || 0, p.tl || PI * 2);
    else if (p.g === 's') geo2 = new THREE.SphereGeometry(Math.max(0.05, p.r), p.ws || 16, p.hs || 12, p.phs || 0, p.phl || PI * 2, p.ths || 0, p.tl || PI);
    else if (p.g === 't') geo2 = new THREE.TorusGeometry(p.r, p.t, 8, p.ts || 28, p.arc || PI * 2);
    else geo2 = new THREE.BoxGeometry(Math.max(0.05, p.w), Math.max(0.05, p.h), Math.max(0.05, p.d));
    const q = new THREE.Mesh(geo2, mt); if (p.tex === 'face') q.userData.faceTex = 1;
    if (p.g === 'b' || p.g === 'c') q.position.set(p.x, p.y + p.h / 2, p.z); else q.position.set(p.x, p.y, p.z);
    q.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0); q.scale.set(p.sx || 1, p.sy || 1, p.sz || 1);
    q.userData.it = it; m.add(q);
  });
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(fw, it.h, it.d)), new THREE.LineBasicMaterial({ color: 0x2f6fed, depthTest: false, transparent: true }));
  e.position.y = it.h / 2; e.renderOrder = 12; e.visible = false; g.add(m, e);
  if (!(it.nc && it.type !== 'person') && it.h > 3 && (it.y || 0) < 1 && it.mt !== 'w') {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(fw + 14, it.d + 14), new THREE.MeshBasicMaterial({ map: SHT, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.rotation.x = -PI / 2; sh.position.y = 0.15; g.add(sh);
  }
  if (PREF.labels) { const s = labelSprite(`${itemLabel(it)} · ${it.name}`); s.position.y = it.h + 14; g.add(s); }
  if (LP.length && it.on !== false && (it.lum ?? 0.8) > 0 && plCount() < MAXL) { const pl = new THREE.PointLight(kelvin(it.temp || 2900), 1, 600, 2); pl.userData.base = (it.lum ?? 0.8) * 0.8; pl.position.set(...LP[0]); g.add(pl); }
  g.userData = { m, e, ms, ems }; it.g = g; fG.add(g); place(it);
  if (sel && sel.o === it) { e.visible = true; addResizeHandles(it); }
  applyLightModeItem(it);
}
function place(it) { it.g.position.set(it.x, it.y || 0, it.z); it.g.rotation.y = (it.rot || 0) * PI / 180; }
function wallPut(it, e, s) { const fw = fpw(it); it.wall = e.i; it.ws = clamp(s, Math.min(fw / 2, e.len / 2), Math.max(e.len / 2, e.len - fw / 2)); const [x, z] = EP(e, it.ws, it.d / 2 + 0.1); it.x = x; it.z = z; it.rot = norm360(rd(e.rot)); }
function fit(it, sn) {
  if (it.mt === 'w') {
    let e = E[it.wall]; if (!e || !straight(e)) { const ne = nearestEdge(it.x, it.z); if (!ne) return place(it); e = ne.e; it.ws = ne.s; }
    wallPut(it, e, sn && PREF.snap ? Math.round((it.ws ?? e.len / 2) / 5) * 5 : (it.ws ?? e.len / 2));
    it.y = clamp(it.y || 0, 0, Math.max(0, R.H - it.h)); return place(it);
  }
  let [fw, fd] = fp(it);
  if (sn && PREF.snap) {
    const s = 5; it.x = Math.round((it.x - fw / 2) / s) * s + fw / 2; it.z = Math.round((it.z - fd / 2) / s) * s + fd / 2;
    edgeSnap(it, fw, fd);
  }
  it.x = fw >= BB.W ? BB.x0 + BB.W / 2 : clamp(it.x, BB.x0 + fw / 2, BB.x1 - fw / 2);
  it.z = fd >= BB.D ? BB.z0 + BB.D / 2 : clamp(it.z, BB.z0 + fd / 2, BB.z1 - fd / 2);
  // 각 벽 안쪽으로 밀어 넣기 (+스냅 시 8cm 이내면 붙이기)
  const o = obb(it);
  for (let pass = 0; pass < 2; pass++) E.forEach(e => {
    if (!straight(e)) return;
    const ext = o.hw * Math.abs(o.ux[0] * e.n[0] + o.ux[1] * e.n[1]) + o.hd * Math.abs(o.uz[0] * e.n[0] + o.uz[1] * e.n[1]);
    const extU = o.hw * Math.abs(o.ux[0] * e.u[0] + o.ux[1] * e.u[1]) + o.hd * Math.abs(o.uz[0] * e.u[0] + o.uz[1] * e.u[1]);
    const px = it.x - e.a[0], pz = it.z - e.a[1], s = px * e.u[0] + pz * e.u[1], t = px * e.n[0] + pz * e.n[1];
    if (s < -extU * 0.5 || s > e.len + extU * 0.5 || t < -ext - 40) return;
    const gap = t - ext, mag = sn && PREF.snap ? 8 : 0;
    if (gap < 0 || gap < mag) { it.x += e.n[0] * -gap; it.z += e.n[1] * -gap; o.x = it.x; o.z = it.z; }
  });
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
  if (bx != null) it.x += bx; if (bz != null) it.z += bz;
}
function obb(it) { const a = (it.rot || 0) * PI / 180, c = Math.cos(a), s = Math.sin(a); return { x: it.x, z: it.z, ux: [c, -s], uz: [s, c], hw: fpw(it) / 2, hd: it.d / 2 }; }
const corners = o => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [o.x + o.ux[0] * o.hw * a + o.uz[0] * o.hd * b, o.z + o.ux[1] * o.hw * a + o.uz[1] * o.hd * b]);
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
  const e = E[o.wall]; if (!e) return [];
  const s0 = o.s - o.w / 2, s1 = o.s + o.w / 2;
  if (o.kind === 'win') return [{ e, r: [s0, s1, 0, 22], f: 'wb', y0: o.y + 3, y1: o.y + o.h }];
  const st = o.st || 'swing', z = [{ e, r: [s0, s1, 0, 45], f: 'db', y0: 0, y1: o.h }];
  if (SWING.has(st) && o.sw !== 'out') {
    const leaves = st === 'double' ? [[s0, o.w / 2, 1], [s1, o.w / 2, -1]] : [[o.hinge !== 'R' ? s0 : s1, st === 'swingG' ? Math.min(o.w, 100) : o.w, o.hinge !== 'R' ? 1 : -1]];
    leaves.forEach(([hs, lw, dir]) => z.push({ e, r: [Math.min(hs, hs + dir * lw), Math.max(hs, hs + dir * lw), 0, lw], f: 'db', y0: 0, y1: o.h, arc: { hs, rad: lw } }));
  }
  return z;
}
function check() {
  items.forEach(a => { a.ov = a.wb = a.db = a.out = false; });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (hit2(items[i], items[j])) items[i].ov = items[j].ov = true;
  items.forEach(it => { if (it.mt === 'w') return; const cs = corners(obb(it)); if (cs.some(([x, z]) => !inside(OL, x + Math.sign(it.x - x) * 1.5, z + Math.sign(it.z - z) * 1.5))) it.out = true; });
  OPS.forEach(o => {
    const zs = opZones(o);
    items.forEach(it => {
      if (it.nc || it.mt === 'c') return; const y0 = it.y || 0, y1 = y0 + it.h, cs = corners(obb(it));
      zs.forEach(zn => {
        if (y1 <= zn.y0 || y0 >= zn.y1) return;
        const loc = cs.map(([x, z]) => { const px = x - zn.e.a[0], pz = z - zn.e.a[1]; return [px * zn.e.u[0] + pz * zn.e.u[1], px * zn.e.n[0] + pz * zn.e.n[1]]; });
        const ls0 = Math.min(...loc.map(p => p[0])), ls1 = Math.max(...loc.map(p => p[0])), lt0 = Math.min(...loc.map(p => p[1])), lt1 = Math.max(...loc.map(p => p[1]));
        const ix0 = Math.max(ls0, zn.r[0]), ix1 = Math.min(ls1, zn.r[1]), it0 = Math.max(lt0, zn.r[2]), it1 = Math.min(lt1, zn.r[3]);
        if (ix1 - ix0 < 0.5 || it1 - it0 < 0.5) return;
        if (zn.arc) { const px = clamp(zn.arc.hs, ix0, ix1), pt = clamp(0, it0, it1); if (Math.hypot(px - zn.arc.hs, pt) >= zn.arc.rad) return; }
        it[zn.f] = true;
      });
    });
  });
  items.forEach(a => a.g && a.g.userData.ms.forEach(m => m.emissive && m.emissive.setHex(a.ov ? 0x7a1414 : 0)));
}
function surfaceFor(it) {
  if (!it.sk || !PREF.stack) return null;
  let top = -1;
  items.forEach(o => { if (o === it || o.nc || o.sk || o.mt === 'c') return; const b = aabb(o); if (it.x < b[0] || it.x > b[1] || it.z < b[2] || it.z > b[3]) return; const t = (o.y || 0) + o.h; if (t > top && t < R.H - it.h) top = t; });
  return top > 0 ? top : 0;
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
  const H = R.H, BL = 0x1d6fd6, GR = 0x2b9348, OR = 0xe8590c, RDc = 0xd33a2c, PU = 0x8e44ad;
  const ep = (e, s, off, y) => { const [x, z] = EP(e, s, off); return [x, y, z]; };
  if (PREF.dims.room) {
    E.forEach(e => { if (straight(e)) dim(ep(e, 0, 8, 3), ep(e, e.len, 8, 3), BL); else { const ap = arcPts(e), m = ap[ap.length >> 1]; dim([m[0], 3, m[1]], [m[0], 4, m[1]], BL, '곡선'); } });
    const v = R.pts[0], e0 = E[0]; dim([v[0] + e0.n[0] * 8 + e0.u[0] * 8, 0, v[1] + e0.n[1] * 8 + e0.u[1] * 8], [v[0] + e0.n[0] * 8 + e0.u[0] * 8, H, v[1] + e0.n[1] * 8 + e0.u[1] * 8], BL);
  }
  OPS.forEach(o => {
    if (!PREF.dims.ops && !(sel && sel.o === o)) return;
    const e = E[o.wall]; if (!e) return; const yt = o.y + o.h + 7;
    dim(ep(e, o.s - o.w / 2, 4, yt), ep(e, o.s + o.w / 2, 4, yt), OR);
    if (o.s - o.w / 2 > 1) dim(ep(e, 0, 4, 4), ep(e, o.s - o.w / 2, 4, 4), GR);
    if (e.len - o.s - o.w / 2 > 1) dim(ep(e, o.s + o.w / 2, 4, 4), ep(e, e.len, 4, 4), GR);
    if (o.kind === 'win') { dim(ep(e, o.s - o.w / 2 - 8, 4, 0), ep(e, o.s - o.w / 2 - 8, 4, o.y), GR); dim(ep(e, o.s + o.w / 2 + 8, 4, o.y), ep(e, o.s + o.w / 2 + 8, 4, o.y + o.h), OR); }
    else dim(ep(e, o.s + o.w / 2 + 8, 4, 0), ep(e, o.s + o.w / 2 + 8, 4, o.h), OR);
  });
  if (sel && sel.k === 'edge' && E[sel.i]) { const e = E[sel.i]; dim(ep(e, 0, 14, 5), ep(e, e.len, 14, 5), OR); }
  if (sel && sel.k === 'item') {
    const it = sel.o, x = it.x, z = it.z, h = it.h, y0 = it.y || 0, w = fpw(it), d = it.d, a = (it.rot || 0) * PI / 180, c = Math.cos(a), s = Math.sin(a);
    const L = (lx, y, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
    if (PREF.dims.item) { dim(L(-w / 2, y0 + h + 2, d / 2), L(w / 2, y0 + h + 2, d / 2), OR); dim(L(w / 2, y0 + h + 2, -d / 2), L(w / 2, y0 + h + 2, d / 2), OR); dim(L(-w / 2, y0, d / 2), L(-w / 2, y0 + h, d / 2), OR); if (y0 > 1) dim(L(-w / 2 - 4, 0, d / 2), L(-w / 2 - 4, y0, d / 2), GR); }
    if (PREF.dims.gap && it.mt !== 'w') {
      const b = aabb(it), yy = y0 + 6, ob = items.filter(o => o !== it && !o.nc && !(o.y >= y0 + h || (o.y || 0) + o.h <= y0)).map(o => ({ o, b: aabb(o) }));
      const wallDist = (dx, dz) => { // 벽까지 광선 거리
        let best = 1e9; const ox = dx ? (dx > 0 ? b[1] : b[0]) : x, oz = dz ? (dz > 0 ? b[3] : b[2]) : z;
        E.forEach(e => { const ap = arcPts(e, 8); for (let k = 0; k < ap.length - 1; k++) { const [x1, z1] = ap[k], [x2, z2] = ap[k + 1], ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((x1 - ox) * ez - (z1 - oz) * ex) / den, u = ((x1 - ox) * dz - (z1 - oz) * dx) / den; if (t > -0.5 && u >= 0 && u <= 1 && t < best) best = Math.max(0, t); } });
        return best < 1e8 ? best : 0;
      };
      const dir = (axis, sign) => {
        let best = axis === 'x' ? wallDist(sign, 0) : wallDist(0, sign), isItem = false;
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
  const w = fpw(it), k = isMobile() ? 1.6 : 1, mat = new THREE.MeshBasicMaterial({ color: 0x2f6fed, depthTest: false }), mat2 = new THREE.MeshBasicMaterial({ color: 0xe8590c, depthTest: false });
  const c1 = new THREE.Mesh(new THREE.SphereGeometry(4.5 * k, 14, 10), mat); c1.position.set(w / 2, 0.5, it.d / 2); c1.userData.rh = it; c1.userData.ax = 'wd'; c1.renderOrder = 14;
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(4.5 * k, 9 * k, 14), mat2); c2.position.set(0, it.h + 6, it.d / 2); c2.userData.rh = it; c2.userData.ax = 'h'; c2.renderOrder = 14;
  g.add(c1, c2); g.userData.hd = [c1, c2];
}
function updSelBox() {
  if (sel && (sel.k === 'op' || sel.k === 'light' || sel.k === 'house') && sel.o.g) { selBox.setFromObject(sel.o.g); selBox.visible = true; } else selBox.visible = false;
  if (isMulti()) { const b = mBox.box.makeEmpty(); sel.list.forEach(o => o.g && b.expandByObject(o.g)); b.expandByScalar(2); mBox.visible = true; } else mBox.visible = false;
}
function setSel(s, tab) {
  selItems().forEach(o => { if (!o.g) return; if (o.g.userData.e) o.g.userData.e.visible = false; (o.g.userData.hd || []).forEach(h => { o.g.remove(h); h.geometry.dispose(); }); o.g.userData.hd = null; });
  sel = s;
  if (sel && sel.k === 'item' && sel.o.g) { sel.o.g.userData.e.visible = true; addResizeHandles(sel.o); }
  if (isMulti()) sel.list.forEach(o => { if (o.g && o.g.userData.e) o.g.userData.e.visible = true; });
  if (!sel && MMODE) setMMode(false);
  updSelBox(); renderSel(); quick(); dims(); markList();
  if (tab) { showTab(tab); if (isMobile() && sheetState === 'peek') setSheet('half'); }
}
function refreshItem(it, sn) { mk(it); fit(it, sn); check(); dims(); syncSel(); quick(); infoSel(); }
function upd() { check(); dims(); markList(); quick(); infoSel(); syncSel(); updSelBox(); updArea(); commitSoon(); }

// ---------- 히스토리 / 프로젝트 / 클라우드 ----------
const clean = o => { const { g, ov, wb, db, out, _rt, ...r } = o; return r; };
function snap() { const { W, D, vtimeNow: _v, ...r } = R; void W; void D; return { R: JSON.parse(JSON.stringify(r)), ops: OPS.map(clean), lights: LIGHTS.map(clean), items: items.map(clean), meas: MEAS.map(m => [...m]), spaces: SPACES.map(sp => sp.id === SPID ? { id: sp.id, name: sp.name, kind: spKind(R) } : sp), spid: SPID }; }
let hist = [], hi = -1, ct = null;
function commit() { ct = null; const s = JSON.stringify(snap()); if (hist[hi] === s) return; hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 150) hist.shift(); hi = hist.length - 1; saveProj(s); updUndo(); }
function commitSoon(ms = 350) { clearTimeout(ct); ct = setTimeout(commit, ms); }
function flush() { if (ct) { clearTimeout(ct); commit(); } }
function undo() { flush(); if (hi <= 0) return toast('더 이상 되돌릴 수 없습니다'); hi--; load(JSON.parse(hist[hi]), true); saveProj(hist[hi]); updUndo(); }
function redo() { flush(); if (hi >= hist.length - 1) return; hi++; load(JSON.parse(hist[hi]), true); saveProj(hist[hi]); updUndo(); }
function updUndo() { $('undo').disabled = hi <= 0; $('redo').disabled = hi >= hist.length - 1; }
// ── 저장·동기화 ──
// PROJ[이름] = { t: 마지막 편집, s: 상태, ct: 이 사본의 기준이 된 클라우드 저장 시각, dirty: 클라우드에 아직 안 올린 편집 }
const DEV = (() => { let d = LS.get('room3d.v2.dev', ''); if (!d) { d = Math.random().toString(36).slice(2, 10); LS.set('room3d.v2.dev', d); } return d; })();
const K_OPENED = 'room3d.v2.openedAt';
let cloudQ = {}, cloudT = null, syncState = 'local', lastSaved = 0, unwatch = null;
const sameS = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hhmm = (t = Date.now()) => { const d = new Date(t); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };
function persist() { LS.set(K_PROJ, PROJ); LS.set(K_CUR, projName); }
// quiet: 프로젝트를 연 직후(편집 아님) — 클라우드에 올릴 '변경'으로 치지 않음
function saveProj(s, quiet) {
  const p = PROJ[projName], ns = JSON.parse(s);
  if (p && sameS(p.s, ns)) { persist(); return; }
  if (quiet) { if (p) p.s = ns; else PROJ[projName] = { t: 0, s: ns, dirty: 0 }; persist(); return; }
  PROJ[projName] = { ...(p || {}), t: Date.now(), s: ns, dirty: 1 }; persist();
  if (Cloud.user) { cloudQ[projName] = 1; cloudFlushSoon(); } else setSync('local');
}
function cloudFlushSoon() { setSync('saving'); clearTimeout(cloudT); cloudT = setTimeout(cloudFlush, 1200); }
async function cloudFlush() {
  if (!Cloud.user) return; clearTimeout(cloudT); const q = cloudQ; cloudQ = {};
  try {
    for (const n of Object.keys(q)) {
      const p = PROJ[n];
      if (!p) { await Cloud.deleteProject(n); continue; }
      if (!p.dirty) continue;
      const remote = await Cloud.getProject(n);
      if (remote && remote.t !== p.ct && remote.dev !== DEV && !sameS(JSON.parse(remote.data || 'null'), p.s)) {
        // 그 사이 다른 기기가 같은 프로젝트를 저장함 → 어느 쪽도 잃지 않게: 클라우드 것을 원본으로, 이 기기 편집은 복사본으로
        const copy = uniq(`${n} (이 기기 ${hhmm()})`), t = Date.now();
        await Cloud.saveProject(copy, p.s, t, DEV); PROJ[copy] = { t, s: p.s, ct: t, dirty: 0 };
        PROJ[n] = { t: remote.t, s: JSON.parse(remote.data), ct: remote.t, dirty: 0 };
        if (n === projName) openProject(n, null, true);
        toast(`다른 기기에서 '${n}'을(를) 먼저 저장해서, 이 기기에서 바꾼 내용은 '${copy}'(으)로 따로 저장했습니다`, 9000);
        continue;
      }
      const t = Date.now(); await Cloud.saveProject(n, p.s, t, DEV);
      if (n === projName) Cloud.setMeta('last', { name: n, at: t, dev: DEV, kind: isMobile() ? '휴대폰' : 'PC' }).catch(() => { });
      const cur = PROJ[n]; if (cur) { cur.ct = t; if (cur === p) { cur.t = t; cur.dirty = 0; } }
    }
    persist(); lastSaved = Date.now(); setSync('ok'); if (!$('t-file').hidden) renderFile();
  } catch (e) { cloudQ = { ...q, ...cloudQ }; setSync('err', e.message); }
}
// 💾 지금 저장 (자동 저장도 되지만 눌러서 바로 확정)
async function saveNow() {
  flush(); const p = PROJ[projName]; persist();
  if (!Cloud.user) return toast(Cloud.enabled ? '이 기기에 저장했습니다 — 로그인하면 클라우드에도 저장되어 PC·휴대폰 어디서나 열 수 있습니다' : '이 기기에 저장했습니다 (클라우드 연결 전)', 5000);
  if (p && (p.dirty || p.ct === undefined)) { p.dirty = 1; cloudQ[projName] = 1; }
  setSync('saving'); await cloudFlush();
  if (syncState === 'ok') Cloud.setMeta('last', { name: projName, at: Date.now(), dev: DEV, kind: isMobile() ? '휴대폰' : 'PC' }).catch(() => { });
  toast(syncState === 'ok' ? `☁ '${projName}' 클라우드에 저장했습니다 (${hhmm()})` : '클라우드 저장 실패 — 인터넷 연결을 확인하세요', 4000);
}
// 다른 기기에서 저장/삭제한 내용을 실시간 반영
function onRemote(changes) {
  let cur = false, other = null;
  for (const c of changes) {
    if (!c.name || c.dev === DEV) continue;
    const loc = PROJ[c.name];
    if (c.type === 'removed') { if (loc && !loc.dirty && loc.ct !== undefined) { delete PROJ[c.name]; if (c.name === projName) cur = 'gone'; } continue; }
    if (loc && loc.ct === c.t) continue;
    let rs; try { rs = JSON.parse(c.data); } catch (e) { continue; }
    if (loc && loc.dirty) continue; // 이 기기에도 안 올린 편집이 있으면 저장 시점에 복사본으로 처리
    PROJ[c.name] = { t: c.t, s: rs, ct: c.t, dirty: 0 }; if (c.name === projName) cur = true; else other = c.name;
  }
  persist();
  if (other && !cur) toast(`☁ 다른 기기에서 '${other}'을(를) 저장했습니다`, 8000, ['열기', () => openProject(other)]);
  if (cur === 'gone') { openProject(Object.keys(PROJ)[0] || '내 방'); toast('다른 기기에서 이 프로젝트를 삭제했습니다'); }
  else if (cur) { const keep = sel && sel.o && sel.o.id; openProject(projName, null, true); if (keep) { const it = items.find(i => i.id === keep); if (it) setSel({ k: 'item', o: it }); } toast('☁ 다른 기기에서 저장한 내용으로 업데이트했습니다', 3500); }
  if (!$('t-file').hidden) renderFile();
}
addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); saveNow(); } });
// 앱 전환·화면 끄기 직전에 바로 올리기 (모바일)
let lastPull = 0;
async function pullNow(force) { if (!Cloud.user || (!force && Date.now() - lastPull < 4000)) return; lastPull = Date.now(); flush(); if (Object.keys(cloudQ).length) await cloudFlush(); await onLogin(Cloud.user, !force); }
document.addEventListener('visibilitychange', () => { if (document.hidden) { flush(); if (Cloud.user && Object.keys(cloudQ).length) cloudFlush(); } else pullNow(); });
addEventListener('pageshow', e => { if (e.persisted) pullNow(); });
function setSync(s, m) { syncState = s; const el = $('sync'); if (!el) return; if (!el.onclick) el.onclick = () => saveNow(); el.className = 'sync ' + s; el.title = { local: '이 기기에만 저장됨 — 눌러서 저장 (로그인하면 클라우드)', saving: '클라우드에 저장 중…', ok: '클라우드에 저장됨', err: '클라우드 저장 실패: ' + (m || '') }[s]; el.querySelector('.t').textContent = { local: '저장', saving: '저장 중', ok: '저장됨', err: '오류' }[s]; }
let setT = null;
function cloudSettingsSoon() { if (!Cloud.user) return; clearTimeout(setT); setT = setTimeout(() => Cloud.setMeta('settings', { sizes: SZ, prefs: JSON.stringify({ ...PREF, tab: undefined }), recent: RECENT }).catch(e => setSync('err', e.message)), 1200); }
async function onLogin(u, quiet) {
  if (!quiet) { renderFile(); renderAccount(); }
  if (unwatch) { unwatch(); unwatch = null; }
  if (!u) { if (unwatchLib) { unwatchLib(); unwatchLib = null; } setSync('local'); return; }
  if (!quiet) setSync('saving');
  try {
    flush();
    const list = await Cloud.listProjects(), names = new Set(), backups = []; let changedCur = false;
    for (const r of list) {
      let rs; try { rs = JSON.parse(r.data); } catch (e) { continue; }
      names.add(r.name); const loc = PROJ[r.name];
      if (!loc) { PROJ[r.name] = { t: r.t, s: rs, ct: r.t, dirty: 0 }; continue; }
      if (sameS(loc.s, rs)) { loc.ct = r.t; loc.dirty = 0; continue; }
      if (loc.ct === r.t && !loc.dirty) continue; // 같은 클라우드 버전 (열 때 정리된 차이뿐)
      const legacy = loc.ct === undefined && loc.dirty === undefined;
      if (!loc.dirty && !legacy) { PROJ[r.name] = { t: r.t, s: rs, ct: r.t, dirty: 0 }; if (r.name === projName) changedCur = true; continue; }
      if (loc.dirty && loc.ct === r.t) { cloudQ[r.name] = 1; continue; } // 이 기기 편집만 있음 → 올리기
      // 양쪽 다 바뀜(또는 예전 버전 데이터) → 클라우드 것을 원본으로, 이 기기 것은 백업 복사본
      const copy = uniq(`${r.name} (이 기기 백업)`); PROJ[copy] = { t: loc.t || Date.now(), s: loc.s, dirty: 1 }; cloudQ[copy] = 1; backups.push(copy);
      PROJ[r.name] = { t: r.t, s: rs, ct: r.t, dirty: 0 }; if (r.name === projName) changedCur = true;
    }
    Object.keys(PROJ).forEach(n => {
      if (names.has(n)) return; const p = PROJ[n];
      if (p.ct !== undefined && !p.dirty) { delete PROJ[n]; if (n === projName) changedCur = true; } // 다른 기기에서 삭제됨
      else if (p.dirty || (p.ct === undefined && p.dirty === undefined)) { p.dirty = 1; cloudQ[n] = 1; }
    });
    persist();
    const st = await Cloud.getMeta('settings');
    let legacy = []; if (st) { SZ = { ...SZ, ...(st.sizes || {}) }; LS.set(K_SZ, SZ); try { legacy = JSON.parse(st.custom || '[]'); } catch (e) { } }
    await syncLib(legacy); watchLib();
    { const ids = []; const scan = st => { if (!st) return; (st.R && st.R.refs || []).forEach(r => ids.push(r.id)); (st.items || []).forEach(i => (i.refs || []).forEach(r => ids.push(r.id))); }; Object.values(PROJ).forEach(p => { scan(p.s); ((p.s && p.s.spaces) || []).forEach(sp => scan(sp.s)); }); uploadMissing(ids).then(n => { if (n) toast(`📎 참고 사진 ${n}장을 클라우드에 올렸습니다`); }); }
    await AI.onLogin();
    // 지금 화면이 손대지 않은 예시 방이거나 없어졌으면 → 클라우드에서 가장 최근에 저장한 프로젝트 열기
    const cp = PROJ[projName], pristine = !cp || (!cp.dirty && cp.ct === undefined);
    const latest = list.filter(r => PROJ[r.name]).sort((a, b) => (b.t || 0) - (a.t || 0))[0];
    // 다른 기기(PC 등)에서 마지막으로 작업·저장한 프로젝트가 이 기기에서 연 것보다 최근이면 그걸 연다
    let last = null; try { last = await Cloud.getMeta('last'); } catch (e) { }
    const follow = last && last.dev !== DEV && last.name !== projName && PROJ[last.name] && (last.at || 0) > Math.max(LS.get(K_OPENED, 0), (cp && cp.t) || 0) && !(cp && cp.dirty);
    if (follow) { openProject(last.name); toast(`☁ ${last.kind || '다른 기기'}에서 마지막으로 저장한 '${last.name}' (${hhmm(last.at)})을 열었습니다`, 5000); }
    else if (pristine && latest && latest.name !== projName) { openProject(latest.name); toast(`☁ 클라우드에서 '${latest.name}' (${hhmm(latest.t)} 저장)을 열었습니다`, 4000); }
    else if (!PROJ[projName]) openProject(Object.keys(PROJ)[0] || '내 방');
    else if (changedCur) { openProject(projName, null, true); toast(`☁ 다른 기기에서 저장한 '${projName}'을(를) 불러왔습니다`, 4000); }
    renderCatalog(); await cloudFlush(); setSync('ok'); renderFile();
    if (backups.length) toast(`이 기기에만 있던 다른 내용은 ${backups.map(b => `'${b}'`).join(', ')}(으)로 보관했습니다`, 9000);
    else if (!changedCur && !pristine && !follow && !quiet) toast('클라우드에 연결되었습니다');
    unwatch = Cloud.watchProjects(onRemote);
  } catch (e) { setSync('err', e.message); toast('클라우드 오류: ' + e.message); }
}
function normItem(i) { return { y: 0, rot: 0, type: 'box', color: '#b0a090', ...i, bw: i.bw || i.w, bd: i.bd || i.d, bh: i.bh || i.h }; }
function clearScene() { items.forEach(i => { if (i.g) { fG.remove(i.g); disposeTree(i.g); } }); LIGHTS.forEach(l => { if (l.g) { ltG.remove(l.g); disposeTree(l.g); } }); }
function load(st0, keepSel) {
  const st = normState(st0), sk = sel && sel.o ? [sel.k, sel.o.id] : null;
  clearScene(); sel = null;
  SPACES = Array.isArray(st.spaces) && st.spaces.length ? st.spaces.map(x => ({ ...x })) : [{ id: 's1', name: spKind(st.R) === 'out' ? '야외 1' : '방 1', kind: spKind(st.R) }];
  SPID = st.spid && SPACES.some(x => x.id === st.spid) ? st.spid : SPACES[0].id; SPACES.forEach(x => { if (x.id === SPID) delete x.s; });
  R = st.R; R.wcs = { ...(R.wcs || {}) }; R.bul = { ...(R.bul || {}) }; geo();
  OPS = (st.ops || []).map(o => ({ ...o })); LIGHTS = (st.lights || []).map(l => ({ ...l })); items = (st.items || []).map(normItem); MEAS = (st.meas || []).map(m => [...m]);
  nid = Math.max(0, ...OPS.map(o => o.id || 0), ...LIGHTS.map(o => o.id || 0), ...items.map(o => o.id || 0)) + 1;
  [...OPS, ...LIGHTS, ...items].forEach(o => { if (!o.id) o.id = nid++; });
  numberAll(); buildRoom(); LIGHTS.forEach(mkLight); items.forEach(i => { mk(i); fit(i, false); });
  applyLightMode();
  let s = null;
  if (keepSel && sk) { const pool = sk[0] === 'item' ? items : sk[0] === 'op' ? OPS : LIGHTS, o = pool.find(x => x.id === sk[1]); if (o) s = { k: sk[0], o }; }
  setSel(s); check(); dims(); renderRoom(); renderLights(); markList(); updArea(); renderFile(); renderSpacePill(); buildSiteView();
}
function openProject(name, fresh, keepView) {
  flush(); if (name !== projName) LS.set(K_OPENED, Date.now()); projName = name;
  const p = PROJ[name]; const st = fresh || (p && p.s) || exampleState();
  load(st); hist = [JSON.stringify(snap())]; hi = 0; saveProj(hist[0], !fresh); updUndo(); if (!keepView) fitView();
}

// ---------- 추가 ----------
function newItem(o) { const c = center(); const it = { id: nid++, x: c[0], z: c[1], y: 0, rot: 0, ...o }; return it; }
function findPreset(pk) {
  const [c, n] = pk.split('|');
  if (c === 'my') { const p = CUSTOM.find(p => p[0] === n); return p ? { p, pk, my: 1 } : null; }
  const cat = CAT.find(x => x[0] === c); const p = cat && cat[1].find(p => p[0] === n); return p ? { p, pk } : null;
}
function findPresetByName(name) {
  if (!name) return null; const q = String(name).replace(/\s/g, '').toLowerCase(), all = [...CUSTOM.map(p => ({ p, pk: 'my|' + p[0] })), ...CAT.flatMap(([c, ls]) => ls.map(p => ({ p, pk: c + '|' + p[0] })))];
  return all.find(x => x.p[0].replace(/\s/g, '').toLowerCase() === q) || all.find(x => x.p[0].replace(/\s/g, '').toLowerCase().includes(q)) || all.find(x => q.includes(x.p[0].replace(/\s/g, '').toLowerCase())) || null;
}
function presetItem(pk, p) {
  const [n, w, d, h, c, type, ex = {}] = p, u = SZ[pk];
  const it = newItem({ pk, name: n, w: u ? u.w : w, d: u ? u.d : d, h: u ? u.h : h, bw: w, bd: d, bh: h, color: c, type: type || 'box', ...JSON.parse(JSON.stringify(ex)) });
  if (LAMPS.has(it.type) || it.lt) { it.lt = 1; it.on = true; it.temp = it.temp || 2900; }
  return { it, u };
}
function addPreset(pk, p) {
  const { it, u } = presetItem(pk, p);
  RECENT = [pk, ...RECENT.filter(k => k !== pk)].slice(0, 10); LS.set(K_REC, RECENT);
  placeNew(it); if (u) toast(`저장된 내 크기 ${u.w}×${u.d}×${u.h}cm 로 추가했습니다`);
  renderCatalog(); haptic();
  return it;
}
function camWallOrder() { const v = new THREE.Vector3(); cam.getWorldDirection(v); return E.filter(straight).sort((a, b) => (a.n[0] * v.x + a.n[1] * v.z) - (b.n[0] * v.x + b.n[1] * v.z)); }
function opBlocksWall(it, e) { const fw = fpw(it), y0 = it.y || 0, y1 = y0 + it.h; return OPS.some(o => o.wall === e.i && o.s + o.w / 2 > it.ws - fw / 2 && o.s - o.w / 2 < it.ws + fw / 2 && o.y < y1 && o.y + o.h > y0); }
function freeSpot(it) {
  const [fw, fd] = fp(it);
  for (let z = BB.z0; z + fd <= BB.z1 + 0.1; z += 10) for (let x = BB.x0; x + fw <= BB.x1 + 0.1; x += 10) { it.x = x + fw / 2; it.z = z + fd / 2; if (!overlapsAny(it) && corners(obb(it)).every(([cx, cz]) => inside(OL, cx + Math.sign(it.x - cx), cz + Math.sign(it.z - cz)))) return place(it); }
  const c = center(); it.x = c[0]; it.z = c[1]; fit(it, false);
}
function placeNew(it, keepPos) {
  ensureNo(it, [...items, it], x => grp(x.type)); items.push(it);
  if (it.mt === 'c' && !keepPos) it.y = Math.max(0, R.H - it.h - (it.hang ?? 25));
  mk(it);
  if (keepPos) { fit(it, false); }
  else if (it.mt === 'w') {
    let ok = false;
    for (const e of camWallOrder()) { const fw = fpw(it); for (let s = fw / 2 + 5; s <= e.len - fw / 2 - 5 && !ok; s += 10) { wallPut(it, e, s); if (!overlapsAny(it) && !opBlocksWall(it, e)) ok = true; } if (ok) break; }
    if (!ok) { const e = camWallOrder()[0]; wallPut(it, e, e.len / 2); }
    fit(it, false);
  } else if (it.sk) {
    const base = sel && sel.k === 'item' && sel.o !== it && !sel.o.sk && !sel.o.nc && sel.o.h < 140 ? sel.o : items.find(o => o !== it && !o.sk && !o.nc && o.mt !== 'w' && o.mt !== 'c' && o.h >= 30 && o.h <= 130 && fpw(o) * o.d > fpw(it) * it.d * 1.5);
    if (base && PREF.stack) {
      const b = aabb(base); let done = false; it.y = (base.y || 0) + base.h; const [fw, fd] = fp(it);
      for (let z = b[2] + fd / 2; z <= b[3] - fd / 2 && !done; z += 5) for (let x = b[0] + fw / 2; x <= b[1] - fw / 2 && !done; x += 5) { it.x = x; it.z = z; if (!overlapsAny(it)) done = true; }
      if (!done) { it.x = base.x; it.z = base.z; }
      fit(it, false);
    } else freeSpot(it);
  } else freeSpot(it);
  setSel({ k: 'item', o: it }); upd();
}
function addOp(kind, st, wall, extra = {}) {
  const e = E[wall] && straight(E[wall]) ? E[wall] : E.find(straight); if (!e) return toast('창호를 달 수 있는 직선 벽이 없습니다');
  const len = e.len, H = R.H;
  const o = { id: nid++, kind, wall: e.i, st, s: len / 2, fc: kind === 'door' && st.startsWith('jung') ? '#2b2b2d' : '#f3f2ee', hinge: 'L', sw: 'in', ang: 0, open: 0, wo: 0, cur: 'none', cc: '#e9e1d3', view: 'inherit' };
  if (kind === 'win') { o.w = Math.min(st === 'full' ? 240 : st === 'tilt' ? 80 : 150, len - 20); o.h = st === 'full' ? H - 25 : 120; o.y = st === 'full' ? 5 : 90; }
  else { o.w = Math.min({ double: 140, jung3: 150, jung1: 140, folding: 180, entrance: 100, slide: 90, open: 100 }[st] || 90, len - 10); o.h = Math.min(210, H - 10); o.y = 0; if (st === 'entrance') o.dc = '#3a3d42'; }
  Object.assign(o, extra);
  if (extra.s == null) { const others = OPS.filter(x => x.wall === e.i); for (let s = o.w / 2 + 10; s <= len - o.w / 2 - 10; s += 5) { if (!others.some(x => Math.abs(x.s - s) < (x.w + o.w) / 2 + 5)) { o.s = s; break; } } }
  ensureNo(o, [...OPS, o], x => x.kind); clampOp(o); OPS.push(o); buildRoom(); setSel({ k: 'op', o }, 'sel'); renderRoom(); upd();
  return o;
}
function addLight(kind, extra = {}) {
  const k = LKIND[kind] || LKIND.down, c = center(), l = { id: nid++, kind: LKIND[kind] ? kind : 'down', w: k.w, d: k.d, drop: k.drop, temp: k.temp || 3000, lum: 1, color: k.color || '#f2f2f0', on: true, rot: 0, x: c[0], z: c[1] };
  if (k.mt === 'w') { const e = camWallOrder()[0]; l.wall = e.i; l.s = e.len / 2; l.y = k.y < 0 ? R.H + k.y : k.y; }
  else if (sel && sel.k === 'item' && !extra.x) { l.x = sel.o.x; l.z = sel.o.z; if (k.rot) l.rot = (sel.o.rot || 0) % 180; }
  Object.assign(l, extra);
  ensureNo(l, [...LIGHTS, l], () => 'l'); LIGHTS.push(l); mkLight(l); setSel({ k: 'light', o: l }, 'sel'); renderLights(); upd();
  if (plCount() >= MAXL) toast(`실시간 광원은 최대 ${MAXL}개까지 계산됩니다. 나머지는 모양만 표시됩니다.`);
  return l;
}

// ---------- 명령 ----------
function delObj(s) {
  const o = s.o;
  if (s.k === 'item') { fG.remove(o.g); disposeTree(o.g); items = items.filter(i => i !== o); }
  else if (s.k === 'op') { OPS = OPS.filter(i => i !== o); buildRoom(); renderRoom(); }
  else if (s.k === 'light') { ltG.remove(o.g); disposeTree(o.g); LIGHTS = LIGHTS.filter(i => i !== o); renderLights(); }
  else if (s.k === 'vert') return deleteVertex(s.i);
}
function delSel() { if (sel && sel.k === 'house') return removeHouse(sel.o); if (isMulti()) return delMulti(sel.list); if (!sel || lockGuard(sel)) return; delObj(sel); setSel(null); upd(); }
function dupSel() {
  if (isMulti()) return dupMulti(sel.list);
  if (sel && sel.k === 'house') return placeHouses([sel.o.sid]);
  if (!sel || !sel.o) return; const o = sel.o;
  if (sel.k === 'item') { const it = newItem({ ...clean(o), id: undefined, no: undefined, lock: 0 }); it.id = nid++; it.x += 20; it.z += 20; ensureNo(it, [...items, it], x => grp(x.type)); items.push(it); mk(it); fit(it, false); if (overlapsAny(it)) freeSpot(it); setSel({ k: 'item', o: it }); }
  else if (sel.k === 'op') { const n = { ...clean(o), id: nid++, no: undefined, lock: 0 }; n.s = o.s + o.w + 10; ensureNo(n, [...OPS, n], x => x.kind); clampOp(n); OPS.push(n); buildRoom(); renderRoom(); setSel({ k: 'op', o: n }); }
  else { const n = { ...clean(o), id: nid++, no: undefined, lock: 0 }; if (lightIsWall(n)) n.s = (n.s || 0) + 40; else { n.x += 40; } ensureNo(n, [...LIGHTS, n], () => 'l'); LIGHTS.push(n); mkLight(n); renderLights(); setSel({ k: 'light', o: n }); }
  upd();
}
function rotSel(deg = 90) {
  if (!sel) return; if (isMulti()) return rotMulti(sel.list, deg, PREF.rotEach);
  if (sel.k === 'house') { const hs = sel.o; if (hs.lock) return toast('잠긴 집입니다'); hs.rot = norm360((hs.rot || 0) + deg); if (hs.g) hs.g.rotation.y = hs.rot * PI / 180; if ((R.corridors || []).length) { syncCorrOpenings(R.houses, R.corridors); buildRoom(); } updSelBox(); syncSel(); return upd(); }
  if (sel.k === 'item') { const it = sel.o; if (it.lock) return toast('잠긴 가구입니다'); if (it.mt === 'w') return toast('벽 부착 가구는 벽 방향을 따릅니다'); it.rot = norm360((it.rot || 0) + deg); fit(it, false); upd(); }
  else if (sel.k === 'light' && !lightIsWall(sel.o)) { if (lockGuard(sel)) return; sel.o.rot = norm360((sel.o.rot || 0) + deg); placeLight(sel.o); upd(); }
}
// 화면 표시는 '시계방향 각도'(위에서 볼 때). 내부 rot 는 반시계(+) 기준.
const cwOf = o => norm360(-(o.rot || 0));
const rotCW = d => rotSel(-d);
function rotTo(cw) {
  if (!sel) return; const o = sel.o;
  if (isMulti()) { if (guardMulti(sel.list)) return; floorOf(sel.list).forEach(it => { it.rot = norm360(-cw); place(it); }); keepInside(sel.list); return upd(); }
  if (sel.k === 'item') { if (o.lock) return toast('잠긴 가구입니다'); if (o.mt === 'w') return; o.rot = norm360(-cw); fit(o, false); upd(); }
  else if (sel.k === 'light' && !lightIsWall(o)) { if (lockGuard(sel)) return; o.rot = norm360(-cw); placeLight(o); upd(); }
}
let ROT_DIR = LS.get('r3d_rotdir', 'cw'), ROT_STEP = LS.get('r3d_rotstep', 30);
// 회전 컨트롤: 빠른 버튼 + 원하는 각도 직접 입력(시계/반시계)
function rotWidget(o, compact) {
  const q = (d, t, c) => BTN(t, () => rotCW(d), c || 'c', (d > 0 ? '시계방향 ' : '반시계방향 ') + Math.abs(d) + '°');
  const inp = h('input', { type: 'number', min: 0, max: 360, step: 1, inputmode: 'decimal', value: ROT_STEP, class: 'rotin', 'aria-label': '회전 각도' });
  const dir = h('select', { class: 'rotdir', 'aria-label': '회전 방향' }, h('option', { value: 'cw' }, '⟳ 시계방향'), h('option', { value: 'ccw' }, '⟲ 반시계방향')); dir.value = ROT_DIR;
  const go = () => { const v = parseFloat(inp.value); if (!isFinite(v) || v === 0) return toast('각도를 입력하세요'); ROT_STEP = v; ROT_DIR = dir.value; LS.set('r3d_rotstep', v); LS.set('r3d_rotdir', ROT_DIR); rotCW(ROT_DIR === 'cw' ? v : -v); };
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
  const cur = h('span', { class: 'rotcur' }); const sync = () => { cur.textContent = '현재 ' + r1(cwOf(o)) + '°'; }; sync(); BIND.push([cur, sync]);
  return h('div', { class: 'rotw' + (compact ? ' cmp' : '') },
    h('div', { class: 'rotq' + (compact ? ' c3' : '') }, compact ? null : q(-15, '⟲ 15°'), q(-45, '⟲ 45°'), q(-90, '⟲ 90°'), q(-180, '⟲ 180°'), compact ? null : q(15, '⟳ 15°'), q(45, '⟳ 45°'), q(90, '⟳ 90°', 'b'), q(180, '⟳ 180°')),
    h('div', { class: 'rotc' }, inp, h('span', { class: 'u' }, '°'), dir, BTN('적용', go, 'b'), BTN('0°', () => rotTo(0), 'o', '정면(0°)으로'), cur));
}
// ---------- 다중 선택 · 그룹 · 일괄 편집 ----------
// sel = { k: 'multi', list: [가구…], o: 기준 가구 }  (가구·소품·사람)
let MMODE = false, MARQ = false;
const mBox = new THREE.Box3Helper(new THREE.Box3(), 0xe8590c); mBox.material.depthTest = false; mBox.renderOrder = 21; mBox.visible = false; scene.add(mBox);
const isMulti = () => !!(sel && sel.k === 'multi');
const selItems = () => !sel ? [] : sel.k === 'multi' ? sel.list : sel.k === 'item' ? [sel.o] : [];
const groupOf = it => it && it.gid ? items.filter(o => o.gid === it.gid) : it ? [it] : [];
const floorOf = list => list.filter(o => o.mt !== 'w');
function selectItems(list, primary, tab) {
  list = [...new Set(list)].filter(i => items.includes(i));
  if (!list.length) return setSel(null, tab);
  if (list.length === 1) return setSel({ k: 'item', o: list[0] }, tab);
  setSel({ k: 'multi', list, o: list.includes(primary) ? primary : list[list.length - 1] }, tab);
}
function toggleItem(it) {
  const cur = selItems(), mem = groupOf(it), all = mem.every(m => cur.includes(m));
  selectItems(all ? cur.filter(c => !mem.includes(c)) : [...cur, ...mem], it);
}
function startMarq() { MARQ = true; document.body.classList.add('marq'); toast('▭ 화면에서 사각형을 그리듯 끌면 그 안의 가구가 선택됩니다', 4000); }
function setMMode(v) { MMODE = !!v; document.body.classList.toggle('mmode', MMODE); quick(); if (MMODE) toast(isMobile() ? '☑ 다중 선택: 가구를 톡톡 눌러 추가/빼기 · 선택된 가구를 끌면 함께 이동' : '☑ 다중 선택: 클릭해서 추가/빼기 (Shift+클릭과 같음)', 4000); }
function unionBox(list) { let b = null; list.forEach(it => { const a = aabb(it); b = b ? [Math.min(b[0], a[0]), Math.max(b[1], a[1]), Math.min(b[2], a[2]), Math.max(b[3], a[3])] : a; }); return b || [0, 0, 0, 0]; }
const ucenter = list => { const u = unionBox(list); return [(u[0] + u[1]) / 2, (u[2] + u[3]) / 2]; };
// 그룹 전체를 같이 밀어서 방 밖으로 나가지 않게 (서로 간격은 유지)
function keepInside(list) {
  const fl = floorOf(list); if (!fl.length) return; const u = unionBox(fl); let dx = 0, dz = 0;
  if (u[1] - u[0] <= BB.W) { if (u[0] < BB.x0) dx = BB.x0 - u[0]; else if (u[1] > BB.x1) dx = BB.x1 - u[1]; }
  if (u[3] - u[2] <= BB.D) { if (u[2] < BB.z0) dz = BB.z0 - u[2]; else if (u[3] > BB.z1) dz = BB.z1 - u[3]; }
  fl.forEach(it => { it.x += dx; it.z += dz; it.y = clamp(it.y || 0, 0, Math.max(0, R.H - it.h)); place(it); });
  list.filter(o => o.mt === 'w').forEach(o => fit(o, false));
}
const lockedIn = list => list.filter(o => o.lock);
function guardMulti(list) { const lk = lockedIn(list); if (lk.length) { toast(`🔒 잠긴 가구 ${lk.length}개가 있어 할 수 없습니다 (${lk.slice(0, 3).map(itemLabel).join(', ')}${lk.length > 3 ? '…' : ''})`, 4000); return true; } return false; }
function moveMulti(list, dx, dz) {
  if (guardMulti(list)) return;
  list.forEach(o => { if (o.mt === 'w') { const e = E[o.wall]; if (e) o.ws = (o.ws || 0) + dx * e.u[0] + dz * e.u[1]; fit(o, false); } else { o.x += dx; o.z += dz; place(o); } });
  keepInside(list); upd();
}
function rotMulti(list, deg, each) {
  if (guardMulti(list)) return; const fl = floorOf(list); if (!fl.length) return toast('벽 부착 가구는 벽 방향을 따릅니다');
  const [cx, cz] = ucenter(fl), a = deg * PI / 180, c = Math.cos(a), s = Math.sin(a);
  fl.forEach(o => { if (!each) { const x = o.x - cx, z = o.z - cz; o.x = cx + x * c + z * s; o.z = cz - x * s + z * c; } o.rot = norm360((o.rot || 0) + deg); place(o); });
  keepInside(list); upd();
}
function scaleMulti(list, f, spread) {
  if (guardMulti(list) || !(f > 0)) return; const [cx, cz] = ucenter(floorOf(list));
  list.forEach(o => { scaleIt(o, f); mk(o); if (spread && o.mt !== 'w') { o.x = cx + (o.x - cx) * f; o.z = cz + (o.z - cz) * f; } fit(o, false); });
  keepInside(list); upd();
}
function sizeMulti(list, vals) {
  if (guardMulti(list)) return;
  list.forEach(o => { ['w', 'd', 'h'].forEach(k => { const v = +vals[k]; if (v > 0) { if (vals.ratio) { const f = v / o[k]; scaleIt(o, f); } else o[k] = r1(v); } }); mk(o); fit(o, false); });
  upd(); toast(`${list.length}개 크기를 바꿨습니다`);
}
function alignMulti(list, how) {
  if (guardMulti(list)) return; const fl = floorOf(list); if (fl.length < 2 && !/^room/.test(how)) return toast('바닥 가구가 2개 이상이어야 합니다');
  const u = unionBox(fl), ucx = (u[0] + u[1]) / 2, ucz = (u[2] + u[3]) / 2, [rcx, rcz] = center();
  if (how === 'roomC') { fl.forEach(o => { o.x += rcx - ucx; o.z += rcz - ucz; place(o); }); return (keepInside(list), upd()); }
  fl.forEach(o => {
    const a = aabb(o);
    if (how === 'l') o.x += u[0] - a[0]; else if (how === 'r') o.x += u[1] - a[1]; else if (how === 'cx') o.x += ucx - (a[0] + a[1]) / 2;
    else if (how === 'b') o.z += u[2] - a[2]; else if (how === 'f') o.z += u[3] - a[3]; else if (how === 'cz') o.z += ucz - (a[2] + a[3]) / 2;
    else if (how === 'floor') o.y = 0;
    place(o);
  });
  keepInside(list); upd();
}
// axis 'x' | 'z' · gap: null = 양 끝 고정하고 간격 균등, 숫자 = 그 간격(cm)으로 나란히
function distMulti(list, axis, gap) {
  if (guardMulti(list)) return; const fl = floorOf(list); if (fl.length < (gap == null ? 3 : 2)) return toast(gap == null ? '균등 분배는 3개 이상 선택하세요' : '2개 이상 선택하세요');
  const lo = axis === 'x' ? 0 : 2, hi = lo + 1, key = axis === 'x' ? 'x' : 'z';
  const arr = fl.map(o => ({ o, a: aabb(o) })).sort((p, q) => (p.a[lo] + p.a[hi]) - (q.a[lo] + q.a[hi]));
  const size = arr.reduce((s, p) => s + (p.a[hi] - p.a[lo]), 0), start = arr[0].a[lo], end = arr[arr.length - 1].a[hi];
  const g = gap == null ? (end - start - size) / (arr.length - 1) : +gap;
  let pos = start; arr.forEach(p => { const w = p.a[hi] - p.a[lo]; p.o[key] += pos - p.a[lo]; pos += w + g; place(p.o); });
  keepInside(list); upd(); toast(`간격 ${rd(g)}cm로 ${axis === 'x' ? '가로' : '세로'} 정렬했습니다`);
}
function mirrorMulti(list, axis) {
  if (guardMulti(list)) return; const fl = floorOf(list), [cx, cz] = ucenter(fl);
  fl.forEach(o => { if (axis === 'x') { o.x = 2 * cx - o.x; o.rot = norm360(-(o.rot || 0)); } else { o.z = 2 * cz - o.z; o.rot = norm360(180 - (o.rot || 0)); } place(o); });
  keepInside(list); upd();
}
let gidN = 0; const nextGid = () => { gidN = Math.max(gidN, ...items.map(i => i.gid || 0)) + 1; return gidN; };
function groupSel() {
  const list = selItems(); if (list.length < 2) return toast('2개 이상 선택한 뒤 그룹으로 묶으세요');
  const g = nextGid(); list.forEach(o => { o.gid = g; }); selectItems(list, sel.o); upd(); renderSel(); toast(`⧉ ${list.length}개를 그룹${g}(으)로 묶었습니다 — 하나를 누르면 그룹 전체가 선택됩니다`, 4000);
}
function ungroupSel() { const list = selItems(), n = new Set(list.map(o => o.gid).filter(Boolean)).size; if (!n) return toast('그룹이 아닙니다'); list.forEach(o => { delete o.gid; }); upd(); renderSel(); toast('그룹을 풀었습니다 (선택은 유지)'); }
const isOneGroup = list => list.length > 1 && list[0].gid && list.every(o => o.gid === list[0].gid) && groupOf(list[0]).length === list.length;
function cloneItems(list, dx, dz) {
  const map = new Map(), out = [];
  list.forEach(o => {
    const it = newItem({ ...clean(o), id: undefined, no: undefined, lock: 0 }); it.id = nid++;
    if (o.gid) { if (!map.has(o.gid)) map.set(o.gid, nextGid()); it.gid = map.get(o.gid); }
    if (o.mt === 'w') it.ws = (o.ws || 0) + dx; else { it.x = o.x + dx; it.z = o.z + dz; }
    ensureNo(it, [...items, it], x => grp(x.type)); items.push(it); mk(it); out.push(it);
  });
  out.forEach(it => (it.mt === 'w' ? fit(it, false) : place(it))); keepInside(out); return out;
}
function dupMulti(list, n = 1, axis = null, gap = 20) {
  const u = unionBox(floorOf(list).length ? floorOf(list) : list); let all = [];
  for (let i = 1; i <= n; i++) {
    const dx = axis === 'x' ? i * (u[1] - u[0] + gap) : axis === 'z' ? 0 : 30 * i, dz = axis === 'z' ? i * (u[3] - u[2] + gap) : axis === 'x' ? 0 : 30 * i;
    all = all.concat(cloneItems(list, dx, dz));
  }
  selectItems(all, all[all.length - 1]); upd(); toast(`${all.length}개를 복제했습니다`);
}
function delMulti(list) {
  const ok = list.filter(o => !o.lock); ok.forEach(o => delObj({ k: 'item', o }));
  setSel(null); upd(); toast(`🗑 ${ok.length}개 삭제` + (ok.length < list.length ? ` · 잠긴 ${list.length - ok.length}개는 남김` : '') + ' (Ctrl+Z 되돌리기)');
}
function lockMulti(list) { const v = list.some(o => !o.lock) ? 1 : 0; list.forEach(o => { o.lock = v; }); selectItems(list, sel && sel.o); markList(); commitSoon(0); toast(v ? `🔒 ${list.length}개 잠금` : `🔓 ${list.length}개 잠금 해제`); }
function batchSet(list, k, v) { list.forEach(o => { if (o.lock && k !== 'lock') return; o[k] = v; mk(o); fit(o, false); }); upd(); }
const sameType = it => items.filter(o => o.type === it.type);
// 화면 영역(사각형) 선택
const marqEl = (() => { const d = document.createElement('div'); d.id = 'marq'; d.hidden = true; document.getElementById('v').append(d); return d; })();
function marqRect(d, x, y) { const r = cv.getBoundingClientRect(), x0 = Math.min(d.x0, x), y0 = Math.min(d.y0, y), x1 = Math.max(d.x0, x), y1 = Math.max(d.y0, y); Object.assign(marqEl.style, { left: x0 - r.left + 'px', top: y0 - r.top + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' }); return [x0, y0, x1, y1]; }
function marqPick(rc) {
  const r = cv.getBoundingClientRect(), v = new THREE.Vector3();
  return items.filter(it => { v.set(it.x, (it.y || 0) + it.h / 2, it.z).project(cam); if (v.z > 1) return false; const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height; return sx >= rc[0] && sx <= rc[2] && sy >= rc[1] && sy <= rc[3]; });
}
// 다중 선택 패널
function multiPanel(b) {
  const list = sel.list, fl = floorOf(list), u = unionBox(fl.length ? fl : list), one = isOneGroup(list), lk = lockedIn(list).length;
  const chips = h('div', { class: 'ch mchips' }, list.map(o => h('button', { class: 'c' + (o === sel.o ? ' on' : ''), type: 'button', title: '빼기', onclick: () => selectItems(list.filter(x => x !== o), sel.o) }, `${itemLabel(o)} ${o.name} ✕`)));
  const step = h('select', { class: 'mstep', title: '한 번에 움직일 거리 (cm)' }, [1, 5, 10, 30, 50, 100].map(v => h('option', { value: v }, String(v)))); step.value = LS.get('r3d_mstep', 10); step.onchange = () => LS.set('r3d_mstep', +step.value);
  const mv = (sx, sz) => moveMulti(list, sx * +step.value, sz * +step.value);
  const dX = h('input', { type: 'number', inputmode: 'decimal', placeholder: '0' }), dZ = h('input', { type: 'number', inputmode: 'decimal', placeholder: '0' });
  const pct = h('input', { type: 'number', inputmode: 'decimal', value: 100, min: 1, step: 5 });
  const sw = h('input', { type: 'number', inputmode: 'decimal', placeholder: '그대로' }), sd = h('input', { type: 'number', inputmode: 'decimal', placeholder: '그대로' }), sh = h('input', { type: 'number', inputmode: 'decimal', placeholder: '그대로' });
  const gap = h('input', { type: 'number', inputmode: 'decimal', value: LS.get('r3d_mgap', 20), min: 0 }); gap.onchange = () => LS.set('r3d_mgap', +gap.value || 0);
  const an = h('input', { type: 'number', inputmode: 'numeric', value: 2, min: 1, max: 30 }), ag = h('input', { type: 'number', inputmode: 'decimal', value: 20, min: 0 }), ax = h('select', {}, h('option', { value: 'x' }, '가로(→)'), h('option', { value: 'z' }, '세로(↓)'));
  const col = h('input', { type: 'color', value: sel.o.color || '#888888' }); col.oninput = () => batchSet(list, 'color', col.value);
  const mat = h('select', {}, h('option', { value: '' }, '재질 일괄 변경…'), Object.keys(MATS).map(k => h('option', { value: k }, MATN[k] || k))); mat.onchange = () => { if (mat.value) batchSet(list, 'mat', mat.value); mat.value = ''; };
  app(b,
    h('div', { class: 'lab' }, one ? `⧉ 그룹${list[0].gid} · ${list.length}개` : `☑ ${list.length}개 선택`),
    h('p', { class: 'mu sm' }, `전체 범위 ${rd(u[1] - u[0])} × ${rd(u[3] - u[2])} cm · 기준: ${itemLabel(sel.o)} ${sel.o.name}` + (lk ? ` · 🔒 잠긴 가구 ${lk}개` : '')),
    chips,
    h('div', { class: 'r keep' },
      one ? BTN('⧉ 그룹 해제', ungroupSel, 'o') : BTN('⧉ 그룹으로 묶기 (Ctrl+G)', groupSel, 'b'),
      BTN(lk === list.length ? '🔓 모두 잠금 해제' : '🔒 모두 잠금', () => lockMulti(list)),
      BTN('선택 해제', () => setSel(null), 'c')),
    h('h4', {}, '이동 (모두 평행하게) · 가운데 숫자 = 한 칸 cm'),
    h('div', { class: 'mpad' },
      h('div', { class: 'pad' }, h('span'), BTN('↑', () => mv(0, -1), 'c', '뒤로'), h('span'), BTN('←', () => mv(-1, 0), 'c', '왼쪽'), step, BTN('→', () => mv(1, 0), 'c', '오른쪽'), h('span'), BTN('↓', () => mv(0, 1), 'c', '앞으로'), h('span')),
      h('div', { class: 'mvin' }, G(2, F('가로 이동 (→ +)', dX), F('세로 이동 (앞 +)', dZ)), h('div', { class: 'r' }, BTN('이동 적용', () => { const x = parseFloat(dX.value) || 0, z = parseFloat(dZ.value) || 0; if (!x && !z) return toast('이동할 거리를 입력하세요'); moveMulti(list, x, z); dX.value = dZ.value = ''; }, 'b'), BTN('방 가운데로', () => alignMulti(list, 'roomC'), 'o')))),
    h('p', { class: 'mu sm' }, isMobile() ? '3D 화면에서 선택된 가구 하나를 끌면 모두 함께 움직입니다.' : '3D 화면에서 선택된 가구 하나를 끌면 모두 함께 움직입니다 · 방향키 5cm (Shift 20cm, Alt 1cm)'),
    h('h4', {}, '회전'),
    h('div', { class: 'cg' }, bchk('각자 제자리에서 회전 (끄면 묶음 전체가 가운데를 중심으로 회전)', () => PREF.rotEach, v => { PREF.rotEach = v ? 1 : 0; savePref(); })),
    rotWidget(sel.o),
    h('h4', {}, '크기 (일괄)'),
    h('div', { class: 'r' }, ...[80, 90, 95, 105, 110, 120].map(p => BTN(p + '%', () => scaleMulti(list, p / 100, PREF.mSpread), 'c')),
      h('span', { class: 'mpct' }, pct, '%'), BTN('적용', () => { const v = parseFloat(pct.value); if (v > 0) scaleMulti(list, v / 100, PREF.mSpread); pct.value = 100; }, 'b')),
    h('div', { class: 'cg' }, bchk('간격도 같은 비율로 (묶음 전체를 키우기·줄이기)', () => PREF.mSpread, v => { PREF.mSpread = v ? 1 : 0; savePref(); })),
    G(3, F('가로 일괄 (cm)', sw), F('세로(깊이)', sd), F('높이', sh)),
    h('div', { class: 'r' }, BTN('모두 이 크기로', () => { if (!sw.value && !sd.value && !sh.value) return toast('바꿀 치수를 입력하세요'); sizeMulti(list, { w: sw.value, d: sd.value, h: sh.value, ratio: PREF.lock }); }, 'b'),
      BTN(`기준(${itemLabel(sel.o)}) 크기로 맞추기`, () => sizeMulti(list, { w: sel.o.w, d: sel.o.d, h: sel.o.h }), 'o')),
    h('p', { class: 'mu sm' }, PREF.lock ? '※ 「가로·세로·높이 비율 유지」가 켜져 있어 입력한 치수에 맞춰 각자 비율대로 커집니다.' : '※ 입력한 치수만 바뀌고 나머지는 그대로입니다.'),
    h('h4', {}, '정렬'),
    h('div', { class: 'mal' },
      BTN('⇤ 왼쪽', () => alignMulti(list, 'l'), 'c'), BTN('↔ 가로 가운데', () => alignMulti(list, 'cx'), 'c'), BTN('오른쪽 ⇥', () => alignMulti(list, 'r'), 'c'),
      BTN('⤒ 뒤쪽', () => alignMulti(list, 'b'), 'c'), BTN('↕ 세로 가운데', () => alignMulti(list, 'cz'), 'c'), BTN('앞쪽 ⤓', () => alignMulti(list, 'f'), 'c')),
    h('div', { class: 'r' }, BTN('바닥에 내리기 (높이 0)', () => alignMulti(list, 'floor'), 'c')),
    h('h4', {}, '간격 · 분배'),
    h('div', { class: 'r' }, BTN('가로 균등 분배', () => distMulti(list, 'x', null), 'c'), BTN('세로 균등 분배', () => distMulti(list, 'z', null), 'c')),
    h('div', { class: 'r mgap' }, h('span', { class: 'sm' }, '간격'), gap, h('span', { class: 'sm' }, 'cm로'), BTN('가로로 나란히', () => distMulti(list, 'x', +gap.value || 0), 'o'), BTN('세로로 나란히', () => distMulti(list, 'z', +gap.value || 0), 'o')),
    h('h4', {}, '반전'),
    h('div', { class: 'r' }, BTN('⇋ 좌우 반전', () => mirrorMulti(list, 'x'), 'c'), BTN('⇅ 앞뒤 반전', () => mirrorMulti(list, 'z'), 'c')),
    h('p', { class: 'mu sm' }, '배치(위치·방향)를 거울처럼 뒤집습니다. 가구 모양 자체는 그대로입니다.'),
    h('h4', {}, '복제'),
    h('div', { class: 'r' }, BTN('복제 (Ctrl+D)', () => dupMulti(list), 'b')),
    h('div', { class: 'r mgap' }, h('span', { class: 'sm' }, '배열 복제'), an, h('span', { class: 'sm' }, '세트 ·'), ax, h('span', { class: 'sm' }, '간격'), ag, h('span', { class: 'sm' }, 'cm'), BTN('만들기', () => dupMulti(list, clamp(+an.value || 1, 1, 30), ax.value, +ag.value || 0), 'o')),
    h('h4', {}, '내 가구로 저장'),
    h('div', { class: 'r' }, BTN(`💾 ${list.length}개 내 가구로 저장…`, () => saveLibDialog(list.map(o => ({ it: o, name: o.name }))), 'o')),
    h('h4', {}, '색·재질 일괄'),
    h('div', { class: 'r' }, h('label', { class: 'mcol' }, '주 색상 ', col), mat),
    h('h4', {}, '삭제'),
    h('div', { class: 'r' }, BTN(`${list.length}개 모두 삭제`, () => delMulti(list), 'o danger')),
  );
  if (lk === list.length) b.querySelectorAll('.mpad button,.mal button').forEach(x => { x.disabled = true; });
}
function setSize(it, k, v) {
  v = Math.max(1, v);
  if (PREF.lock) { const f = v / it[k]; if (!isFinite(f) || f <= 0) return; ['w', 'd', 'h'].forEach(q => { it[q] = r1(Math.max(1, it[q] * f)); }); }
  it[k] = r1(v);
}
function scaleIt(it, f) { ['w', 'd', 'h'].forEach(q => { it[q] = r1(Math.max(1, it[q] * f)); }); }
const pctAll = it => Math.cbrt((it.w / it.bw) * (it.d / it.bd) * (it.h / it.bh)) * 100;
function remember(it) { if (!PREF.remember || !it.pk) return; SZ[it.pk] = { w: it.w, d: it.d, h: it.h }; LS.set(K_SZ, SZ); renderCatalog(); cloudSettingsSoon(); }
function sizeChanged(it) { refreshItem(it, false); commitSoon(); clearTimeout(it._rt); it._rt = setTimeout(() => remember(it), 600); }
function focusSel() {
  if (isMulti()) { const b = new THREE.Box3(); sel.list.forEach(o => o.g && b.expandByObject(o.g)); const c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()).length(), dir = cam.position.clone().sub(ctl.target).normalize(); ctl.target.copy(c); cam.position.copy(c.clone().add(dir.multiplyScalar(Math.max(150, sz * 1.4)))); ctl.update(); return; }
  if (!sel || !sel.o || !sel.o.g) return; const o = sel.o, box = new THREE.Box3().setFromObject(o.g), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length();
  if (cam === camO) { ctl.target.copy(c); camO.position.set(c.x, 3000, c.z + 0.01); camO.zoom = clamp(400 / Math.max(60, sz), 0.5, 8); camO.updateProjectionMatrix(); ctl.update(); return; }
  const dir = camP.position.clone().sub(ctl.target).normalize(); ctl.target.copy(c); camP.position.copy(c).add(dir.multiplyScalar(Math.max(140, sz * 2.2))); ctl.update();
}
let clip = null;
function copySel() { if (isMulti()) { clip = { k: 'multi', list: sel.list.map(clean) }; return toast(`${sel.list.length}개 복사 (Ctrl+V 붙여넣기)`); } if (sel && sel.o) { clip = { k: sel.k, o: clean(sel.o) }; toast('복사했습니다 (Ctrl+V 붙여넣기)'); } }
function pasteClip() {
  if (!clip) return;
  if (clip.k === 'multi') { const tmp = clip.list.map(o => normItem(JSON.parse(JSON.stringify(o)))); const out = cloneItems(tmp, 15, 15); selectItems(out, out[out.length - 1]); return upd(); }
  if (clip.k === 'item') { const it = normItem({ ...JSON.parse(JSON.stringify(clip.o)), id: nid++, no: undefined }); it.x += 15; it.z += 15; ensureNo(it, [...items, it], x => grp(x.type)); items.push(it); mk(it); fit(it, false); setSel({ k: 'item', o: it }); }
  else if (clip.k === 'op') { const n = { ...clip.o, id: nid++, no: undefined }; n.s += n.w + 10; ensureNo(n, [...OPS, n], x => x.kind); clampOp(n); OPS.push(n); buildRoom(); renderRoom(); setSel({ k: 'op', o: n }); }
  else if (clip.k === 'light') { const n = { ...clip.o, id: nid++, no: undefined }; n.x = (n.x || 0) + 30; ensureNo(n, [...LIGHTS, n], () => 'l'); LIGHTS.push(n); mkLight(n); renderLights(); setSel({ k: 'light', o: n }); }
  upd();
}

// ---------- 카메라 ----------
function useCam(c) { if (cam === c) return; cam = c; ctl.object = c; ctl.enableRotate = c === camP; rsz(); }
function camPreset(k) {
  const [cx, cz] = center(), W = BB.W, D = BB.D;
  if (k === 'door') return { pos: [cx, 160, BB.z1 + 280], tgt: [cx, 85, cz - 40], fov: 45 };
  if (k === 'iso') return { pos: [cx + 340 + W * 0.2, 340, BB.z1 + 330], tgt: [cx, 50, cz], fov: 45 };
  if (k === 'isoL') return { pos: [cx - 340 - W * 0.2, 340, BB.z1 + 330], tgt: [cx, 50, cz], fov: 45 };
  if (k === 'top') return { pos: [cx, Math.max(D * 1.15, W * 1.15 / (camP.aspect || 1)) / 0.828 + 10, cz + 0.5], tgt: [cx, 0, cz], fov: 45 };
  const m = /^eye(\d+)$/.exec(k);
  if (m) { const v = R.pts[+m[1] % R.pts.length], dx = cx - v[0], dz = cz - v[1], L = Math.hypot(dx, dz) || 1, off = Math.min(45, L * 0.25); return { pos: [v[0] + dx / L * off, 150, v[1] + dz / L * off], tgt: [cx + dx / L * 30, 100, cz + dz / L * 30], fov: 68 }; }
  return null;
}
function view(k) {
  const [cx, cz] = center();
  if (k === 'plan') {
    useCam(camO); const asp = camP.aspect || 1, hh = Math.max(BB.D * 0.62, BB.W * 0.62 / asp) + 30;
    camO.top = hh; camO.bottom = -hh; camO.left = -hh * asp; camO.right = hh * asp; camO.zoom = 1; camO.updateProjectionMatrix();
    camO.position.set(cx, 3000, cz + 0.01); ctl.target.set(cx, 0, cz); ctl.update(); return;
  }
  useCam(camP); const p = camPreset(k) || camPreset('door');
  camP.fov = p.fov; camP.updateProjectionMatrix(); camP.position.set(...p.pos); ctl.target.set(...p.tgt); ctl.update();
}
function fitView() { view(cam === camO ? 'plan' : 'door'); }
document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view(b.dataset.v); closeMenus(); });
$('vsel') && ($('vsel').onchange = e => { view(e.target.value); e.target.blur(); });

// 화면 캡처 (AI 렌더 입력 / 고화질 저장)
function captureView(k, w, h, { clean: cl = true } = {}) {
  const oldPR = renderer.getPixelRatio(), oldSize = renderer.getSize(new THREE.Vector2());
  const hide = [dimG, hdG, selBox]; const vis = hide.map(o => o.visible);
  const extra = []; if (cl) { scene.traverse(o => { if ((o.userData.label || (o.isLineSegments && o.parent && o.parent.userData && o.parent.userData.e === o) || o.userData.rh) && o.visible) { extra.push(o); o.visible = false; } }); hide.forEach(o => { o.visible = false; }); }
  const c = viewCam(k, w, h);
  const bg0 = scene.background; if (!bg0) scene.background = new THREE.Color(0xe9e6df);
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.render(scene, c); scene.background = bg0;
  const url = cv.toDataURL('image/png');
  renderer.setPixelRatio(oldPR); renderer.setSize(oldSize.x, oldSize.y, false); rsz();
  hide.forEach((o, i) => { o.visible = vis[i]; }); extra.forEach(o => { o.visible = true; });
  return url;
}
function viewCam(k, w, h) {
  let c;
  if (k === 'cur' || k === 'plan') { c = (cam === camO ? camO : camP).clone(); if (c.isPerspectiveCamera) { c.aspect = w / h; c.updateProjectionMatrix(); } else { const hh = (camO.top - camO.bottom) / 2; c.left = -hh * w / h; c.right = hh * w / h; c.updateProjectionMatrix(); } }
  else if (k === 'sel' && sel && sel.o && sel.o.g) { const box = new THREE.Box3().setFromObject(sel.o.g), cc = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()).length(), dir = camP.position.clone().sub(ctl.target).normalize(); c = new THREE.PerspectiveCamera(45, w / h, 5, 30000); c.position.copy(cc).add(dir.multiplyScalar(Math.max(140, sz * 2))); c.lookAt(cc); }
  else { const p = camPreset(k) || camPreset('door'); c = new THREE.PerspectiveCamera(p.fov, w / h, 5, 30000); c.position.set(...p.pos); c.lookAt(new THREE.Vector3(...p.tgt)); }
  c.updateMatrixWorld(); return c;
}
// ---------- 실사 변환 왜곡 방지: 구조 가이드 이미지 + 화면 속 위치·크기 ----------
const GUIDE_PAL = [[0xe6194b, 'RED'], [0x3cb44b, 'GREEN'], [0xffe119, 'YELLOW'], [0x911eb4, 'PURPLE'], [0x46f0f0, 'CYAN'], [0xf032e6, 'MAGENTA'], [0xbcf60c, 'LIME'], [0x008080, 'TEAL'], [0x9a6324, 'BROWN'], [0x000075, 'NAVY'], [0x808000, 'OLIVE'], [0xfabebe, 'PINK'], [0x800000, 'MAROON'], [0xaaffc3, 'MINT'], [0x000000, 'BLACK'], [0xe6beff, 'LAVENDER']];
const guideColor = i => GUIDE_PAL[i % GUIDE_PAL.length];
function captureGuide(k, w, h) {
  const saved = [], made = [], M = (c, op = 1) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, depthWrite: op >= 1, side: THREE.DoubleSide, fog: false }); made.push(m); return m; };
  const set = (o, m) => { saved.push([o, o.material]); o.material = m; };
  const bg = scene.background, fog = scene.fog;
  try {
    scene.background = new THREE.Color(0xffffff); scene.fog = null;
    roomG.traverse(o => { if (!o.isMesh) return; const t = o.geometry.type, flat = Math.abs(Math.abs(o.rotation.x) - PI / 2) < 0.01; set(o, M(o.userData.ceil ? 0xf0f0f0 : (flat && o.rotation.x < 0) || t === 'ExtrudeGeometry' ? 0x8c8c8c : 0xcfcfcf)); });
    envG.traverse(o => { if (o.isMesh) set(o, M(o.userData.water ? 0x9db7cc : 0xbfc8b8)); });
    opG.children.forEach(g => { const o = g.userData.op; if (!o) return; const win = o.kind === 'win'; g.traverse(m => { if (!m.isMesh) return; const glass = m.material && m.material.transparent; set(m, M(glass ? (win ? 0x8fb4ff : 0xffc08a) : (win ? 0x0050ff : 0xff6a00), glass ? (win ? 0.5 : 0.14) : 1)); }); });
    items.forEach((it, i) => { if (!it.g) return; const m = M(guideColor(i)[0]); it.g.traverse(o => { if (o.isMesh) set(o, m); }); });
    ltG.traverse(o => { if (o.isMesh) set(o, M(0xffd400)); });
    houseG.traverse(o => { if (o.isMesh) { const hs = o.userData.house, op = o.userData.op || (o.parent && o.parent.userData.op); set(o, M(op ? (op.kind === 'win' ? 0x0050ff : 0xff6a00) : 0x7d7d7d)); } });
    return captureView(k, w, h);
  } finally { saved.forEach(([o, m]) => { o.material = m; }); made.forEach(m => m.dispose()); scene.background = bg; scene.fog = fog; }
}
// 카메라 기준으로 창호·가구가 화면 어디에, 어느 벽에, 얼마나 크게 있는지
function boxOn(c, obj) { const b = new THREE.Box3().setFromObject(obj); if (b.isEmpty()) return null; let x0 = 1, y0 = 1, x1 = -1, y1 = -1, any = false; for (let i = 0; i < 8; i++) { const v = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(c); if (v.z > 1 || v.z < -1) continue; any = true; x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } if (!any) return null; const cl = v => Math.max(-1, Math.min(1, v)); x0 = cl(x0); x1 = cl(x1); y0 = cl(y0); y1 = cl(y1); if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return null; const P = v => Math.round((v + 1) * 50); return { l: P(x0), r: P(x1), t: 100 - P(y1), b: 100 - P(y0), area: (x1 - x0) * (y1 - y0) }; }
function itemBox(k, w, h, it) { if (!it || !it.g) return null; return boxOn(viewCam(k, w, h), it.g); }
function layoutText(k, w, h) {
  const c = viewCam(k, w, h), fwd = new THREE.Vector3(); c.getWorldDirection(fwd); const f = [fwd.x, fwd.z], fl = Math.hypot(...f) || 1; f[0] /= fl; f[1] /= fl; const rt = [-f[1], f[0]];
  const box2 = obj => boxOn(c, obj);
  const side = e => { const n = e.n, d = n[0] * f[0] + n[1] * f[1], sd = (c.position.x - e.a[0]) * n[0] + (c.position.z - e.a[1]) * n[1]; if (d > 0.6) return sd < 0 ? 'FRONT wall that the camera stands just outside of / looks through (it is in the immediate FOREGROUND, nearest to the viewer)' : 'wall behind the camera'; if (d < -0.6) return 'BACK wall directly facing the camera (far side)'; return (n[0] * rt[0] + n[1] * rt[1]) > 0 ? 'LEFT wall' : 'RIGHT wall'; };
  const L = [];
  if (R.kind !== 'out') OPS.forEach(o => {
    if (!o.g) return; const e = E[o.wall]; if (!e) return; const bx = box2(o.g), nm = (o.kind === 'win' ? WIN_ST : DOOR_ST).find(x => x[0] === o.st)?.[1] || o.st;
    const tint = (GTINT.find(t => t[0] === (o.gtint || 'clear')) || [])[1], glass = o.kind === 'win' || ['jung3', 'jung1', 'swingG', 'folding'].includes(o.st) || o.glass ? `, glass ${o.gop ?? 72}% transparent (${tint})` : '';
    L.push(`- ${opLabel(o)} = ${o.kind === 'win' ? 'WINDOW' : 'DOOR'} "${nm}" ${rd(o.w)}cm wide × ${rd(o.h)}cm tall${o.kind === 'win' ? `, sill ${rd(o.y)}cm above floor, top at ${rd(o.y + o.h)}cm (ceiling ${R.H}cm)` : ''}; it takes ${Math.round(o.w / e.len * 100)}% of the ${rd(e.len)}cm-long ${side(e)}${glass}${o.st === 'jung3' ? `, open state ${o.open ? Math.round(o.open) + ' of 2 panels slid' : 'closed'}` : ''}. ${bx ? `In image #1 it occupies x ${bx.l}–${bx.r}%, y ${bx.t}–${bx.b}% of the frame — keep EXACTLY this position and size.` : 'It is NOT visible from this camera — do not draw it.'}`);
  });
  if (R.kind === 'out') (R.houses || []).forEach(hs => { if (!hs.g) return; const bx = box2(hs.g); L.push(`- HOUSE "${hs._name}" ${rd(hs._w)}×${rd(hs._d)}cm, ${rd(hs._h)}cm walls, ${hs.roof || 'flat'} roof = dark gray in the guide${bx ? `; x ${bx.l}–${bx.r}%, y ${bx.t}–${bx.b}% — keep exactly` : ' (not visible)'}.`); });
  const vis = items.map((it, i) => ({ it, i, bx: it.g ? box2(it.g) : null })).filter(x => x.bx).sort((a, b) => b.bx.area - a.bx.area).slice(0, 14);
  vis.forEach(({ it, i, bx }) => L.push(`- ${itemLabel(it)} "${it.name}" (${TYPES[it.type] || it.type}, ${rd(fpw(it))}×${rd(it.d)}×${rd(it.h)}cm) = ${guideColor(i)[1]} in the guide; x ${bx.l}–${bx.r}%, y ${bx.t}–${bx.b}%.`));
  return L.join('\n');
}
function shot3D() { const r = renderer.getSize(new THREE.Vector2()); return captureView('cur', Math.round(r.x * Math.min(2, devicePixelRatio)), Math.round(r.y * Math.min(2, devicePixelRatio)), { clean: false }); }

// ---------- 포인터 ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function ptr(e) { const r = cv.getBoundingClientRect(); mouse.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(mouse, cam); }
function planeHit(n, cst) { const p = new THREE.Vector3(); return ray.ray.intersectPlane(new THREE.Plane(n, cst), p) ? p : null; }
const hitY = y => planeHit(new THREE.Vector3(0, 1, 0), -y);
function wallPlaneHit(e) { const n = new THREE.Vector3(e.n[0], 0, e.n[1]); return planeHit(n, -(e.n[0] * e.a[0] + e.n[1] * e.a[1])); }
function pick() {
  const hs = [...hdG.children]; if (sel && sel.k === 'item' && sel.o.g.userData.hd) hs.push(...sel.o.g.userData.hd);
  const h0 = ray.intersectObjects(hs, true)[0]; if (h0) return h0;
  const okPick = hh => { let o = hh.object; while (o) { const u = o.userData; if (u.op) return u.op.kind === 'win' ? !!PREF.pickWin : !!PREF.pickDoor; if (u.lt) return !!PREF.pickLight; if (u.it || u.house) return true; o = o.parent; } return true; };
  return ray.intersectObjects([...items.map(i => i.g.userData.m), opG, ltG, ...(R.kind === 'out' ? [houseG] : [])], true).find(h => h.object.visible !== false && !h.object.userData.scenery && okPick(h)) || null;
}
function classify(h) {
  let o = h.object;
  while (o) { const u = o.userData; if (u.house) return { k: 'house', o: u.house }; if (u.rh) return { k: 'rh', it: u.rh, ax: u.ax }; if (u.h) return { k: 'room', h: u.h }; if (u.it) return { k: 'item', o: u.it }; if (u.op) return { k: 'op', o: u.op }; if (u.lt) return { k: 'light', o: u.lt }; if (u.house) return { k: 'house', o: u.house }; o = o.parent; }
  return null;
}
let drag = null, down = null, mode = null, raf = 0, lpT = null;
const haptic = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  ptr(e); down = { x: e.clientX, y: e.clientY, t: Date.now(), touch: e.pointerType === 'touch' };
  if (mode === 'measure') return;
  const startDrag = d => { drag = d; ctl.enabled = false; try { cv.setPointerCapture(e.pointerId); } catch (_) { } };
  const h = pick();
  if (!h || (MARQ && !(classify(h) || {}).k)) { if ((e.shiftKey && e.pointerType === 'mouse') || MARQ) { startDrag({ k: 'marq', x0: e.clientX, y0: e.clientY, add: e.shiftKey || MMODE || isMulti() }); marqEl.hidden = false; marqRect(drag, e.clientX, e.clientY); } return; }
  const f = classify(h); if (!f) return;
  if (f.k === 'rh') { const it = f.it; startDrag({ k: 'rh', it, ax: f.ax, w0: it.w, d0: it.d, h0: it.h, x0: it.x, z0: it.z }); return; }
  if (f.k === 'room') {
    const hd = f.h, p = hitY(0);
    if (R.lock) { toast('🔒 방 모양이 잠겨 있습니다'); return; }
    if (hd.t === 'plus') { down.handled = true; insertVertex(hd.i); return; }
    if (hd.t === 'vert') { setSel({ k: 'vert', i: hd.i }, 'sel'); startDrag({ k: 'vert', i: hd.i, refs: wallRefs() }); return; }
    const e2 = E[hd.i]; if (!e2 || !p) return;
    startDrag({ k: 'edge', i: hd.i, p0: [p.x, p.z], a0: [...R.pts[hd.i]], b0: [...R.pts[(hd.i + 1) % R.pts.length]], n: e2.n, refs: wallRefs() }); return;
  }
  if (f.k === 'item') {
    const it = f.o, cur = selItems(), inSel = cur.includes(it), add = e.shiftKey || e.ctrlKey || e.metaKey || MMODE;
    const startMulti = (list, flag) => { const p = hitY(h.point.y); if (!p) return; if (lockedIn(list).length) { drag = null; down.mflag = flag; down.mit = it; return; } startDrag({ k: 'multi', list, it, flag, py: h.point.y, p0: [p.x, p.z], st: list.map(o => ({ o, x: o.x, z: o.z, ws: o.ws })) }); };
    if (add) { if (!inSel) { down.handled = true; toggleItem(it); haptic(); return; } startMulti(selItems(), 'toggle'); return; }
    if (inSel && cur.length > 1) { startMulti(cur, 'single'); return; }
    if (it.gid && !e.altKey && groupOf(it).length > 1) { const g = groupOf(it); selectItems(g, it); if (down.touch && PREF.touchSafe) return; startMulti(g, null); return; }
    const was = sel && sel.o === it;
    if (!was) setSel({ k: 'item', o: it });
    if (down.touch) { clearTimeout(lpT); lpT = setTimeout(() => { if (down && !down.moved) { haptic(25); setSel({ k: 'item', o: it }, 'sel'); } }, 480); }
    if (it.lock || (down.touch && PREF.touchSafe && !was)) return;
    const p = hitY(h.point.y); if (p) startDrag({ k: 'item', it, py: h.point.y, ox: it.x - p.x, oz: it.z - p.z });
    return;
  }
  if (f.k === 'house') { const hs = f.o, was = sel && sel.o === hs; if (!was) setSel({ k: 'house', o: hs }, isMobile() ? null : 'sel'); if (hs.lock || (down.touch && PREF.touchSafe && !was)) return; const py = Math.max(0, h.point.y), p = hitY(py); if (p) startDrag({ k: 'house', hs, py, ox: hs.x - p.x, oz: hs.z - p.z }); return; }
  if (f.k === 'op') { const o = f.o, was = sel && sel.o === o; if (!was) setSel({ k: 'op', o }, isMobile() ? null : 'sel'); if (o.lock || (down.touch && PREF.touchSafe && !was)) return; const e2 = E[o.wall], p = wallPlaneHit(e2); if (p) { const q = segDist(e2, p.x, p.z); startDrag({ k: 'op', o, off: o.s - q.s, y0: o.y, py0: p.y }); } return; }
  if (f.k === 'light') { const l = f.o, was = sel && sel.o === l; if (!was) setSel({ k: 'light', o: l }, isMobile() ? null : 'sel'); if (l.lock || (down.touch && PREF.touchSafe && !was)) return; const py = lightIsWall(l) ? l.y : R.H - 10, p = hitY(py) || hitY(0); if (p) startDrag({ k: 'light', l, py, ox: (l.x || 0) - p.x, oz: (l.z || 0) - p.z }); }
}, true);
cv.addEventListener('pointermove', e => {
  ptr(e);
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.moved = true; clearTimeout(lpT); }
  if (mode === 'measure' && mzTemp && mzTemp.p0) { const p = hitY(0); if (p) { mzTemp.p1 = [snapV(p.x, 1), snapV(p.z, 1)]; dims(); } return; }
  if (!drag) { if (e.pointerType === 'mouse' && !raf) raf = requestAnimationFrame(() => { raf = 0; const h = pick(), f = h && classify(h); cv.style.cursor = mode === 'measure' ? 'crosshair' : f ? (f.k === 'room' ? (f.h.t === 'edge' ? 'move' : 'pointer') : f.k === 'rh' ? 'nwse-resize' : 'grab') : 'default'; }); return; }
  const d = drag;
  if (d.k === 'marq') { marqRect(d, e.clientX, e.clientY); return; }
  if (d.k === 'house') { const p = hitY(d.py); if (!p) return; const hs = d.hs; hs.x = snapV(p.x + d.ox, 5); hs.z = snapV(p.z + d.oz, 5); snapHouse(hs); if (hs.g) hs.g.position.set(hs.x, 0, hs.z); d.moved = true; updSelBox(); syncSel(); return; }
  if (d.k === 'multi') {
    const p = hitY(d.py); if (!p) return; let dx = p.x - d.p0[0], dz = p.z - d.p0[1];
    if (PREF.snap && !e.altKey) { dx = Math.round(dx / 5) * 5; dz = Math.round(dz / 5) * 5; }
    const fl = d.st.filter(q => q.o.mt !== 'w');
    if (fl.length) { let u = null; fl.forEach(q => { const [fw, fd] = fp(q.o), a = [q.x - fw / 2, q.x + fw / 2, q.z - fd / 2, q.z + fd / 2]; u = u ? [Math.min(u[0], a[0]), Math.max(u[1], a[1]), Math.min(u[2], a[2]), Math.max(u[3], a[3])] : a; });
      if (u[1] - u[0] <= BB.W) dx = clamp(dx, BB.x0 - u[0], BB.x1 - u[1]); if (u[3] - u[2] <= BB.D) dz = clamp(dz, BB.z0 - u[2], BB.z1 - u[3]); }
    d.st.forEach(q => { const o = q.o; if (o.mt === 'w') { const ew = E[o.wall]; if (ew) o.ws = (q.ws || 0) + dx * ew.u[0] + dz * ew.u[1]; fit(o, false); } else { o.x = q.x + dx; o.z = q.z + dz; place(o); } });
    d.moved = true; check(); dims(); quick(); infoSel(); updSelBox(); return;
  }
  if (d.k === 'item') {
    const it = d.it, p = hitY(d.py); if (!p) return;
    if (it.mt === 'w') { const ne = nearestEdge(p.x, p.z); if (ne) { it.wall = ne.e.i; it.ws = ne.s; } fit(it, true); }
    else { it.x = p.x + d.ox; it.z = p.z + d.oz; if (it.sk && PREF.stack) { const t = surfaceFor(it); if (t != null) it.y = t; } fit(it, true); }
    check(); infoSel(); dims(); quick();
  } else if (d.k === 'op') {
    const o = d.o, e2 = E[o.wall], p = wallPlaneHit(e2); if (!p) return;
    const q = segDist(e2, p.x, p.z), raw = (p.x - e2.a[0]) * e2.u[0] + (p.z - e2.a[1]) * e2.u[1], s = raw + d.off, n = E.length, beyond = 35;
    if (s < -beyond || s > e2.len + beyond) {
      const step = s < 0 ? -1 : 1; let k = (o.wall + step + n) % n, tries = 0; while (!straight(E[k]) && tries++ < n) k = (k + step + n) % n;
      if (k !== o.wall) { const ne = E[k], hw = Math.min(o.w, ne.len) / 2; o.wall = k; o.s = step < 0 ? ne.len - hw - 5 : hw + 5; d.off = 0; }
    } else o.s = snapV(s, 5);
    void q;
    if (e.shiftKey && o.kind === 'win') o.y = snapV(d.y0 + (p.y - d.py0), 5);
    clampOp(o); schedRoom(); infoSel();
  } else if (d.k === 'light') {
    const l = d.l, p = hitY(d.py); if (!p) return;
    if (lightIsWall(l)) { const ne = nearestEdge(p.x, p.z); if (ne) { l.wall = ne.e.i; l.s = snapV(ne.s, 5); } }
    else { l.x = snapV(p.x + d.ox, 5); l.z = snapV(p.z + d.oz, 5); }
    placeLight(l); updSelBox(); syncSel();
  } else if (d.k === 'edge') {
    const p = hitY(0); if (!p) return;
    const dd = snapV((p.x - d.p0[0]) * d.n[0] + (p.z - d.p0[1]) * d.n[1], 5), n = R.pts.length;
    R.pts[d.i] = [r1(d.a0[0] + d.n[0] * dd), r1(d.a0[1] + d.n[1] * dd)]; R.pts[(d.i + 1) % n] = [r1(d.b0[0] + d.n[0] * dd), r1(d.b0[1] + d.n[1] * dd)];
    reproject(d.refs); schedRoom(true);
  } else if (d.k === 'vert') {
    const p = hitY(0); if (!p) return; const n = R.pts.length, a = R.pts[(d.i - 1 + n) % n], b = R.pts[(d.i + 1) % n];
    let x = snapV(p.x, 5), z = snapV(p.z, 5);
    [a, b].forEach(q => { if (Math.abs(x - q[0]) < 8) x = q[0]; if (Math.abs(z - q[1]) < 8) z = q[1]; });
    R.pts[d.i] = [r1(x), r1(z)]; reproject(d.refs); schedRoom(true);
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
  clearTimeout(lpT);
  const wasClick = down && !down.moved && Date.now() - down.t < 600 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8;
  if (mode === 'measure' && wasClick) {
    ptr(e); const p = hitY(0);
    if (p) { const q = [snapV(p.x, 1), snapV(p.z, 1)]; if (!mzTemp || !mzTemp.p0) mzTemp = { p0: q }; else { MEAS.push([...mzTemp.p0, ...q]); mzTemp = null; upd(); const m = MEAS.at(-1); toast(`측정: ${rd(Math.hypot(m[2] - m[0], m[3] - m[1]))}cm`); } dims(); }
  } else if (drag && drag.k === 'marq') {
    const d = drag; drag = null; ctl.enabled = true; marqEl.hidden = true; MARQ = false; document.body.classList.remove('marq');
    const rc = [Math.min(d.x0, e.clientX), Math.min(d.y0, e.clientY), Math.max(d.x0, e.clientX), Math.max(d.y0, e.clientY)];
    if (rc[2] - rc[0] > 6 || rc[3] - rc[1] > 6) { let found = marqPick(rc); found = [...new Set(found.flatMap(groupOf))]; const base = d.add ? selItems() : []; if (found.length || base.length) selectItems([...base, ...found], found[found.length - 1], isMobile() ? null : 'sel'); toast(found.length ? `▭ ${found.length}개를 선택했습니다` : '영역 안에 가구가 없습니다'); }
  } else if (drag && drag.k === 'multi') {
    const d = drag; drag = null; ctl.enabled = true;
    if (wasClick && !d.moved) { if (d.flag === 'toggle') toggleItem(d.it); else if (d.flag === 'single') setSel({ k: 'item', o: d.it }); }
    else { keepInside(d.list); upd(); renderSel(); }
  } else if (drag) {
    const d = drag; drag = null; ctl.enabled = true;
    if (d.k === 'rh') remember(d.it);
    if (d.k === 'house' && d.moved && (R.corridors || []).length) { syncCorrOpenings(R.houses, R.corridors); buildRoom(); }
    if (d.k === 'edge' || d.k === 'vert') { cancelAnimationFrame(rrq); rrq = 0; R.pts = orient(R.pts); normalizeRoom(); reproject(d.refs); roomEdited(); renderRoom(); if (d.k === 'edge' && wasClick) setSel({ k: 'edge', i: d.i }, 'sel'); }
    if (d.k === 'op') renderRoom();
    upd(); renderSel();
  } else if (wasClick && down && down.mflag) { if (down.mflag === 'toggle') toggleItem(down.mit); else if (down.mflag === 'single') setSel({ k: 'item', o: down.mit }); }
  else if (wasClick && down && !down.handled) { ptr(e); if (!pick() && !MMODE) setSel(null); }
  down = null;
}
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', () => { drag = null; ctl.enabled = true; down = null; clearTimeout(lpT); marqEl.hidden = true; });
cv.addEventListener('dblclick', e => { if (sel && sel.k === 'house') return switchSpace(sel.o.sid); if (siteG.userData.on) { ptr(e); const hit = ray.intersectObject(siteG, true)[0]; const own = pick(); if (hit && hit.object.userData.siteRoom && (!own || own.distance > hit.distance)) return switchSpace(hit.object.userData.siteRoom); } focusSel(); });
cv.addEventListener('contextmenu', e => { if (isMobile()) e.preventDefault(); });

addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.key === 'Escape')) return;
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && (k === 'z' || k === 'Z')) { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
  if (ctrl && (k === 'y' || k === 'Y')) { e.preventDefault(); return redo(); }
  if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); return dupSel(); }
  if (ctrl && (k === 'c' || k === 'C')) return copySel();
  if (ctrl && (k === 'v' || k === 'V')) return pasteClip();
  if (ctrl && (k === 'a' || k === 'A')) { e.preventDefault(); if (items.length) selectItems(items, items[items.length - 1], 'sel'); return toast(`전체 ${items.length}개 선택`); }
  if (ctrl && (k === 'g' || k === 'G')) { e.preventDefault(); if (e.shiftKey) return ungroupSel(); return isMulti() && isOneGroup(sel.list) ? ungroupSel() : groupSel(); }
  if (k === 'Escape') { if (mode) setMode(null); else { setMMode(false); setSel(null); } closeMenus(); document.activeElement.blur && document.activeElement.blur(); return; }
  if (!sel) return;
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return delSel(); }
  if (k === 'r' || k === 'R') return rotCW(e.shiftKey ? -90 : 90);
  if (k === 'q' || k === 'Q') return rotCW(e.shiftKey ? -15 : -45);
  if (k === 'e' || k === 'E') return rotCW(e.shiftKey ? 15 : 45);
  if (k === 'f' || k === 'F') return focusSel();
  const st = e.altKey ? 1 : e.shiftKey ? 20 : 5;
  let dx = 0, dz = 0;
  if (k === 'ArrowLeft') dx = -st; else if (k === 'ArrowRight') dx = st; else if (k === 'ArrowUp') dz = -st; else if (k === 'ArrowDown') dz = st;
  if (sel.k === 'house' && (dx || dz)) { e.preventDefault(); const hs = sel.o; hs.x += dx; hs.z += dz; if (hs.g) hs.g.position.set(hs.x, 0, hs.z); updSelBox(); return upd(); }
  if (isMulti()) {
    if (k === '[' || k === ']') return scaleMulti(sel.list, k === ']' ? 1.05 : 1 / 1.05, PREF.mSpread);
    if (dx || dz) { e.preventDefault(); return moveMulti(sel.list, dx, dz); }
    return;
  }
  if (sel.k === 'item') {
    const it = sel.o;
    if (k === '[' || k === ']') { if (it.lock) return; scaleIt(it, k === ']' ? 1.05 : 1 / 1.05); sizeChanged(it); return; }
    if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); it.y = Math.max(0, (it.y || 0) + (k === 'PageUp' ? st : -st)); fit(it, false); upd(); return; }
    if ((dx || dz) && !lockGuard(sel)) { e.preventDefault(); if (it.mt === 'w') it.ws = (it.ws || 0) + (dx || -dz); else { it.x += dx; it.z += dz; } fit(it, false); upd(); }
  } else if (sel.k === 'op' && (dx || dz)) { e.preventDefault(); if (lockGuard(sel)) return; const o = sel.o; if (dx) o.s += dx; else if (o.kind === 'win') o.y -= dz; clampOp(o); buildRoom(); upd(); }
  else if (sel.k === 'light' && (dx || dz)) { e.preventDefault(); if (lockGuard(sel)) return; const l = sel.o; if (lightIsWall(l)) l.s += dx || -dz; else { l.x += dx; l.z += dz; } placeLight(l); upd(); }
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
  const i = h('input', { type: 'number', step: o.step ?? 1, min: o.min, max: o.max, inputmode: 'decimal' });
  const sync = () => { const v = get(); i.value = v == null || !isFinite(v) ? '' : r1(v); }; sync(); BIND.push([i, sync]);
  const apply = v => { if (!isFinite(v)) return; if (o.min != null && v < o.min) return; if (o.max != null && v > o.max) return; set(v); };
  // 모바일: 지우고 고치는 중간값(예: 1830 → 18 → 1850)이 바로 적용돼 다른 가구가 밀리지 않게, 입력을 마치면(완료·Enter·다른 곳 누르기) 적용
  i.oninput = () => { if (!document.body.classList.contains('mob')) apply(parseFloat(i.value)); };
  i.onchange = () => { apply(parseFloat(i.value)); sync(); commitSoon(0); };
  i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
  const st = o.step ?? 1, mb = h('button', { class: 'stp', type: 'button', tabindex: -1, onclick: () => { apply(r1((parseFloat(i.value) || 0) - st)); sync(); commitSoon(); } }, '−'), pb = h('button', { class: 'stp', type: 'button', tabindex: -1, onclick: () => { apply(r1((parseFloat(i.value) || 0) + st)); sync(); commitSoon(); } }, '+');
  return h('div', { class: 'num' }, mb, i, pb);
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
const BTN = (t, fn, cls = 'o', title) => h('button', { class: cls, onclick: fn, title, type: 'button' }, t);
function syncSel() { BIND = BIND.filter(([i]) => i.isConnected); BIND.forEach(([i, s]) => { if (i !== document.activeElement) s(); }); }
let tt = null;
// 알림 배너: 모든 작업 결과를 화면 위쪽에 쌓아서 보여 줌 (✅ 성공 · ⚠ 오류 · ℹ 안내) — 탭하면 닫힘
const NOTE = (() => { const d = document.createElement('div'); d.id = 'notes'; d.setAttribute('aria-live', 'polite'); document.body.append(d); return d; })();
let NOTE_PERM = false;
function sysNotify(title, body) { try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: 'room3d', icon: '/favicon.ico' }); } catch (e) { } }
function askNotifyPerm() { try { if (!NOTE_PERM && 'Notification' in window && Notification.permission === 'default') { NOTE_PERM = true; Notification.requestPermission().catch(() => { }); } } catch (e) { } }
function toast(t, ms = 2800, act, opt = {}) {
  const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => { el.hidden = true; }, ms);
  const s0 = String(t), type = opt.type || (/^ℹ/.test(s0) ? 'info' : null) || (/^(⚠|❌)|실패|오류|없습니다|할 수 없|거절/.test(s0) ? 'err' : /^(✅|🎨|☁|💾|＋|⧉|🗑|📎|🖼|🔒|🔓)|했습니다|됐습니다|완료/.test(s0) ? 'ok' : 'info');
  const n = h('div', { class: 'note ' + type, role: type === 'err' ? 'alert' : 'status' }, h('span', { class: 'ni' }, type === 'ok' ? '✓' : type === 'err' ? '!' : 'i'), h('span', { class: 'nt' }, s0));
  if (act) n.append(h('button', { class: 'na', type: 'button', onclick: e => { e.stopPropagation(); close(); act[1](); } }, act[0]));
  n.append(h('button', { class: 'nx', type: 'button', 'aria-label': '닫기', onclick: e => { e.stopPropagation(); close(); } }, '×'));
  const close = () => { n.classList.add('out'); setTimeout(() => n.remove(), 220); };
  n.onclick = close; NOTE.prepend(n); while (NOTE.children.length > 4) NOTE.lastChild.remove();
  const life = opt.sticky ? 0 : Math.max(ms, act ? 9000 : type === 'err' ? 6500 : type === 'ok' ? 4000 : 3000); if (life) setTimeout(close, life);
  if (opt.sys || (type !== 'info' && document.hidden)) sysNotify(opt.title || '방 가구 배치 3D', s0);
  if (type !== 'info') { try { navigator.vibrate && navigator.vibrate(type === 'err' ? [30, 60, 30] : 18); } catch (e) { } }
  return n;
}
const notify = (msg, o = {}) => toast(msg, o.ms || 4000, o.act, o);
const fname = s => (projName + '_' + s).replace(/[\\/:*?"<>|\s]+/g, '_');

// ---------- 모바일 시트 ----------
let sheetState = 'half';
const mq = matchMedia('(max-width: 820px)');
function layout() { document.body.classList.toggle('mob', mq.matches); if (mq.matches) setSheet(sheetState); else document.documentElement.style.removeProperty('--sh'); rsz(); buildHandles(); }
mq.addEventListener ? mq.addEventListener('change', layout) : mq.addListener(layout);
function sheetPx(s) { const vh = window.innerHeight; return s === 'peek' ? 104 : s === 'full' ? Math.round(vh * 0.9) : Math.round(vh * 0.5); }
function setSheet(s, px) { sheetState = s; const v = px ?? sheetPx(s); document.documentElement.style.setProperty('--sh', v + 'px'); document.body.dataset.sheet = s; setTimeout(rsz, 260); }
(() => {
  // 시트 끌기: 손잡이 + 탭 줄 전체(세로로 끌면 시트, 가로로 밀면 탭 스크롤, 탭하면 탭 전환)
  const g = $('grab'), tabs = $('tabs'), P = $('p'); let st = null;
  const H = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sh')) || sheetPx(sheetState);
  const begin = (y, x, src) => { st = { y, x, h: H(), t: Date.now(), src, on: src === 'grab', last: y, lt: Date.now(), vy: 0 }; if (st.on) document.body.classList.add('sheet-drag'); };
  const move = (y, x) => {
    if (!st) return false; const dy = y - st.y, dx = x - st.x;
    if (!st.on) { if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) { st.on = true; st.y = y; st.h = H(); document.body.classList.add('sheet-drag'); } else return false; }
    const now = Date.now(); st.vy = (y - st.last) / Math.max(1, now - st.lt); st.last = y; st.lt = now;
    document.documentElement.style.setProperty('--sh', clamp(st.h - (y - st.y), 90, window.innerHeight * 0.94) + 'px'); return true;
  };
  const end = y => {
    if (!st) return; const was = st; st = null; document.body.classList.remove('sheet-drag');
    if (!was.on) { if (was.src === 'grab' && Date.now() - was.t < 300) setSheet(sheetState === 'peek' ? 'half' : sheetState === 'half' ? 'full' : 'peek'); return; }
    const dy = y - was.y; if (was.src === 'grab' && Math.abs(dy) < 6 && Date.now() - was.t < 300) { setSheet(sheetState === 'peek' ? 'half' : sheetState === 'half' ? 'full' : 'peek'); return; }
    const v = was.h - dy, opts = ['peek', 'half', 'full'];
    let pick = opts.reduce((a, b) => Math.abs(sheetPx(b) - v) < Math.abs(sheetPx(a) - v) ? b : a);
    if (Math.abs(was.vy) > 0.5) { const k = opts.indexOf(sheetState); pick = opts[clamp(k + (was.vy < 0 ? 1 : -1), 0, 2)]; }
    setSheet(pick); was.moved = true; if (was.src === 'tabs') { tabs._noClick = Date.now(); }
  };
  // 손잡이·탭 줄은 터치 이벤트로 직접 처리 (브라우저가 화면 전체를 움직이지 못하게)
  const T = (el, src) => {
    el.addEventListener('touchstart', e => { if (!mq.matches || e.touches.length > 1) return; const t = e.touches[0]; begin(t.clientY, t.clientX, src); }, { passive: true });
    el.addEventListener('touchmove', e => { if (!st) return; const t = e.touches[0]; if (move(t.clientY, t.clientX) || src === 'grab') e.preventDefault(); }, { passive: false });
    el.addEventListener('touchend', e => { const t = e.changedTouches[0]; end(t.clientY); }, { passive: true });
    el.addEventListener('touchcancel', () => end(st ? st.y : 0), { passive: true });
  };
  T(g, 'grab'); T(tabs, 'tabs');
  tabs.addEventListener('click', e => { if (tabs._noClick && Date.now() - tabs._noClick < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  // 마우스(데스크톱 창을 좁힌 경우)
  g.addEventListener('mousedown', e => { if (!mq.matches) return; begin(e.clientY, e.clientX, 'grab'); const mm = ev => move(ev.clientY, ev.clientX), mu = ev => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); end(ev.clientY); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); });
  // 내용이 맨 위일 때 아래로 당기면 시트 내리기
  let pull = null;
  P.addEventListener('touchstart', e => { if (!mq.matches || e.touches.length > 1 || e.target.closest('#grab,#tabs,.rsz,input,textarea,select,[contenteditable]')) return; const sec = e.target.closest('#p>section'); if (!sec) return; const t = e.touches[0]; pull = { sec, y: t.clientY, x: t.clientX, top: sec.scrollTop <= 0, act: false }; }, { passive: true });
  P.addEventListener('touchmove', e => {
    if (!pull) return; const t = e.touches[0], dy = t.clientY - pull.y, dx = t.clientX - pull.x;
    if (!pull.act) { if (pull.top && pull.sec.scrollTop <= 0 && dy > 10 && dy > Math.abs(dx) * 1.5 && !e.target.closest('input[type=range],.hs,textarea,.chatlog,.rsz,.rugpats')) { pull.act = true; begin(t.clientY, t.clientX, 'pull'); st.on = true; document.body.classList.add('sheet-drag'); } else return; }
    e.preventDefault(); move(t.clientY, t.clientX);
  }, { passive: false });
  P.addEventListener('touchend', e => { if (pull && pull.act) end(e.changedTouches[0].clientY); pull = null; }, { passive: true });
})();
// 모바일: 페이지 전체가 밀리거나 튕기지 않게 — 스크롤 가능한 영역 밖의 터치 이동은 막는다
(() => {
  const scrollable = (el, dy, dx) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.id === 'c' || n.tagName === 'CANVAS') return true; // 3D 화면은 자체 처리(touch-action:none)
      if (n.matches && n.matches('input[type=range],input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable]')) return true; // 입력칸 안에서 커서 옮기기·글자 선택
      const cs = getComputedStyle(n);
      if (Math.abs(dy) >= Math.abs(dx)) { if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) { if ((dy > 0 && n.scrollTop > 0) || (dy < 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true; } }
      else if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  let sy = 0, sx = 0;
  document.addEventListener('touchstart', e => { if (e.touches.length === 1) { sy = e.touches[0].clientY; sx = e.touches[0].clientX; } }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!document.body.classList.contains('mob') || e.touches.length > 1 || e.defaultPrevented) return;
    const t = e.touches[0]; if (!scrollable(e.target, t.clientY - sy, t.clientX - sx)) e.preventDefault();
  }, { passive: false });
  // 키보드가 닫히거나 화면이 밀린 뒤 원위치
  const reset = () => { if (document.body.classList.contains('mob') && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0); };
  document.addEventListener('focusout', () => setTimeout(reset, 60));
  window.addEventListener('scroll', () => { if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) reset(); }, { passive: true });
  if (window.visualViewport) visualViewport.addEventListener('resize', () => setTimeout(() => { if (!document.body.classList.contains('kb')) reset(); }, 80));
})();
// 모바일 키보드: 입력칸이 키보드에 가리지 않게 시트·창을 키보드 바로 위로 올리고, 입력칸이 보이도록 스크롤
(() => {
  const vv = window.visualViewport; if (!vv) return;
  const field = el => !!el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]):not([type=button]),textarea,[contenteditable=true]');
  const root = document.documentElement; let raf = 0, tmr = 0;
  const scrollParent = el => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 1) return n; } return null; };
  const keep = a => { // 입력칸을 보이는 영역 안으로
    const sp = scrollParent(a); if (!sp) return; const r = a.getBoundingClientRect(), pr = sp.getBoundingClientRect();
    const top = Math.max(pr.top, vv.offsetTop) + 8, bot = Math.min(pr.bottom, vv.offsetTop + vv.height) - 12;
    if (r.bottom > bot) sp.scrollTop += r.bottom - bot + 8; else if (r.top < top) sp.scrollTop -= top - r.top + 8;
  };
  const upd = () => {
    raf = 0; const a = document.activeElement, mob = document.body.classList.contains('mob');
    const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)), on = mob && field(a) && kb > 80;
    document.body.classList.toggle('kb', on);
    root.style.setProperty('--kb', (on ? kb : 0) + 'px'); root.style.setProperty('--vvh', Math.round(vv.height) + 'px'); root.style.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    if (on) { clearTimeout(tmr); tmr = setTimeout(() => keep(a), 240); }
  };
  // 위쪽에 '지금 입력 중인 값' 표시 (키보드에 가려도 무엇이 입력되는지 확인)
  const kbv = document.createElement('div'); kbv.id = 'kbv'; kbv.innerHTML = '<small></small><b></b>'; document.body.append(kbv);
  const lblOf = a => { const l = a.closest('label.f,.f'); const sp = l && l.querySelector('span'); return (sp && sp.textContent) || a.getAttribute('aria-label') || a.placeholder || '입력'; };
  const echo = () => { const a = document.activeElement; if (!field(a)) return; const big = a.tagName === 'TEXTAREA' || a.closest('.mdl,.chatin'); document.body.classList.toggle('kbm', !!big); kbv.firstChild.textContent = lblOf(a); kbv.lastChild.textContent = a.value === '' ? '(비어 있음)' : a.value; };
  document.addEventListener('input', echo, true); document.addEventListener('focusin', () => setTimeout(echo, 0));
  const q = () => { if (!raf) raf = requestAnimationFrame(upd); };
  vv.addEventListener('resize', q); vv.addEventListener('scroll', q);
  document.addEventListener('focusin', e => { if (field(e.target)) { q(); setTimeout(q, 350); setTimeout(q, 700); } });
  document.addEventListener('focusout', () => setTimeout(q, 80));
})();
window.addEventListener('resize', () => { if (mq.matches) setSheet(sheetState); });

// ---------- 탭 ----------
function showTab(t) {
  PREF.tab = t; LS.set(K_PREF, PREF);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  reveal(document.querySelector(`#tabs button[data-t="${t}"]`));
  document.querySelectorAll('#p > section').forEach(s => { s.hidden = s.id !== 't-' + t; });
  if (t === 'list') renderList(); if (t === 'file') renderFile(); if (t === 'room') renderRoom(); if (t === 'light') renderLights(); if (t === 'ai') AI.render();
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { showTab(b.dataset.t); if (mq.matches && sheetState === 'peek') setSheet('half'); });

// 카탈로그
const openCats = LS.get('room3d.v2.opencats', { '거실': 1, '침실': 1 });
// ---------- 내 라이브러리: 내가 저장한 가구·사람 + 카테고리 (클라우드 users/{uid}/meta/library) ----------
// CUSTOM 항목: [이름, w, d, h, color, type, ex]  · ex.cat = 'my' | 'u…'(내가 만든 카테고리) | 'b:거실'(기본 카테고리)
const K_LIB = 'room3d.v2.lib', K_LASTCAT = 'room3d.v2.lastcat';
let LIB = Object.assign({ cats: [], ren: {}, t: 0 }, LS.get(K_LIB, {}));
function libNorm() { if (!Array.isArray(LIB.cats)) LIB.cats = []; if (!LIB.cats.some(c => c.id === 'my')) LIB.cats.unshift({ id: 'my', name: '내 가구' }); if (!LIB.ren || typeof LIB.ren !== 'object') LIB.ren = {}; }
libNorm();
const catOf = p => (p && p[6] && p[6].cat) || 'my';
const bName = c => LIB.ren[c] || c;
const catName = id => id && id.startsWith('b:') ? bName(id.slice(2)) : ((LIB.cats.find(c => c.id === id) || {}).name || '내 가구');
const catExists = id => id && (id.startsWith('b:') ? CAT.some(c => c[0] === id.slice(2)) : LIB.cats.some(c => c.id === id));
const catOpts = () => [...LIB.cats.map(c => [c.id, '📁 ' + c.name]), ...CAT.map(([c]) => ['b:' + c, bName(c) + ' (기본)'])];
let libCT = null;
function libChanged(quiet) { LIB.t = Date.now(); LS.set(K_LIB, LIB); LS.set(K_CUS, CUSTOM); renderCatalog(); if (!quiet) libCloudSoon(); }
function libCloudSoon() { if (!Cloud.user) return; clearTimeout(libCT); libCT = setTimeout(() => Cloud.setMeta('library', { custom: JSON.stringify(CUSTOM), cats: JSON.stringify(LIB.cats), ren: JSON.stringify(LIB.ren), libT: LIB.t, dev: DEV }).then(() => { if (syncState !== 'err') setSync('ok'); }).catch(e => setSync('err', e.message)), 700); }
function applyRemoteLib(d) {
  if (!d || !d.libT || d.libT <= (LIB.t || 0)) return false;
  try { CUSTOM = JSON.parse(d.custom || '[]'); LIB.cats = JSON.parse(d.cats || '[]'); LIB.ren = JSON.parse(d.ren || '{}'); } catch (e) { return false; }
  libNorm(); LIB.t = d.libT; LS.set(K_LIB, LIB); LS.set(K_CUS, CUSTOM); renderCatalog(); return true;
}
// 로그인 시: 더 최근에 바꾼 쪽이 원본 (삭제·이름 변경도 그대로 반영)
async function syncLib(legacyCustom) {
  const d = await Cloud.getMeta('library');
  if (d && d.libT) { if (d.libT > (LIB.t || 0)) applyRemoteLib(d); else if ((LIB.t || 0) > d.libT) libCloudSoon(); return; }
  // 예전 버전(설정 문서에 custom만 있던 때) → 합쳐서 새 라이브러리로 올림
  (legacyCustom || []).forEach(p => { if (!CUSTOM.some(c => c[0] === p[0])) CUSTOM.push(p); });
  LIB.t = Date.now(); LS.set(K_LIB, LIB); LS.set(K_CUS, CUSTOM); renderCatalog(); libCloudSoon();
}
let unwatchLib = null;
function watchLib() { if (unwatchLib) unwatchLib(); unwatchLib = Cloud.watchMeta ? Cloud.watchMeta('library', d => { if (d && d.dev !== DEV && applyRemoteLib(d)) toast('☁ 다른 기기에서 바꾼 내 가구·카테고리를 반영했습니다', 3500); }) : null; }
const uniqLib = (n, except) => { let k = n, i = 2; while (CUSTOM.some(p => p[0] === k && p !== except)) k = `${n} (${i++})`; return k; };
function newCat(name) { name = (name || '').trim(); if (!name) return null; const ex = LIB.cats.find(c => c.name === name); if (ex) return ex.id; const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); LIB.cats.push({ id, name }); return id; }
const EXK = ['body', 'desc', 'refs', 'rp', 'rs', 'rpsc', 'rugImg', 'rugFit', 'c2', 'mt', 'y', 'n', 'pv', 'sk', 'lt', 'nc', 'lg', 'cols', 'leg', 'sink', 'hb', 'temp', 'mat', 'mat2', 'cpat', 'sex', 'outfit', 'skin', 'hair', 'shoe', 'hs', 'pose', 'veil', 'face', 'glasses', 'flower', 'bouquet', 'tie', 'glassC', 'c3', 'sleeve', 'tieT', 'skirtL', 'shw', 'build', 'headS', 'fsz', 'fzoom', 'fox', 'foy', 'hv', 'bangs', 'aL', 'aR', 'zL', 'zR', 'eL', 'eR', 'yaw', 'sit', 'price', 'memo'];
// 간단한 창 (aiui 의 모달과 같은 모양)
function mdl(title, body) {
  const bg = h('div', { class: 'mdl' }), box = h('div', { class: 'mdl-box' }), close = () => bg.remove();
  box.append(h('div', { class: 'mdl-h' }, h('b', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': '닫기' }, '×')), h('div', { class: 'mdl-b' }, body));
  bg.append(box); bg.addEventListener('click', e => { if (e.target === bg) close(); }); document.body.append(bg); return { close, box };
}
// 카테고리 고르기 (기존 · 새로 만들기)
function catPicker(def) {
  const s = h('select', {}, catOpts().map(([v, t]) => h('option', { value: v }, t)), h('option', { value: '__new' }, '＋ 새 카테고리 만들기…'));
  const nn = h('input', { type: 'text', placeholder: '새 카테고리 이름 (예: 웨딩 소품, 우리집 가구)', hidden: true });
  s.value = catExists(def) ? def : 'my'; s.onchange = () => { nn.hidden = s.value !== '__new'; if (!nn.hidden) nn.focus(); };
  const el = h('div', { class: 'catpick' }, s, nn);
  return { el, get: () => s.value === '__new' ? newCat(nn.value) : s.value, setNew: () => { s.value = '__new'; nn.hidden = false; } };
}
// 내 가구로 저장: entries = [{ it, name }] (사진 인식 결과 여러 개도 한 번에)
function saveLibDialog(entries, def) {
  entries = entries.filter(e => e && e.it); if (!entries.length) return;
  const body = h('div', {}), names = entries.map(e => h('input', { type: 'text', value: e.name || e.it.name || '내 가구' }));
  const cp = catPicker(def || LS.get(K_LASTCAT, 'my')), ow = h('input', { type: 'checkbox' });
  app(body,
    h('p', { class: 'mu sm' }, entries.length > 1 ? `${entries.length}개를 한 카테고리에 저장합니다. 이름은 바꿔도 됩니다.` : '카탈로그에 저장해 두면 다음부터 버튼 하나로 추가됩니다.'),
    F('카테고리', cp.el),
    h('div', { class: 'svl' }, entries.map((e, i) => h('div', { class: 'svr' }, h('i', { style: `background:${e.it.color || '#999'}` }), names[i], h('small', {}, `${rd(e.it.w)}×${rd(e.it.d)}×${rd(e.it.h)}`)))),
    h('label', { class: 'ck' }, ow, ' 같은 이름이 있으면 덮어쓰기 (끄면 “이름 (2)”로 따로 저장)'),
    h('div', { class: 'r' }, BTN('저장', () => {
      const cat = cp.get(); if (!cat) return toast('새 카테고리 이름을 입력하세요');
      entries.forEach((e, i) => {
        const it = e.it, raw = names[i].value.trim() || it.name || '내 가구', old = CUSTOM.find(p => p[0] === raw);
        const n = old && ow.checked ? raw : uniqLib(raw); const ex = { cat }; EXK.forEach(k => { if (it[k] != null) ex[k] = it[k]; });
        if (old && ow.checked) CUSTOM = CUSTOM.filter(p => p !== old);
        CUSTOM.push([n, r1(it.w), r1(it.d), r1(it.h), it.color, it.type, ex]);
      });
      LS.set(K_LASTCAT, cat); openCats['c:' + cat] = 1; LS.set('room3d.v2.opencats', openCats); libChanged(); m.close();
      toast(`${entries.length}개를 '${catName(cat)}' 카테고리에 저장했습니다`, 3500);
    }, 'b'), BTN('취소', () => m.close())));
  const m = mdl(entries.length > 1 ? `💾 ${entries.length}개 내 가구로 저장` : '💾 내 가구로 저장', body);
  return m;
}
// 저장한 항목 편집 (이름 · 카테고리 · 삭제)
function libItemDialog(p) {
  const body = h('div', {}), nm = h('input', { type: 'text', value: p[0] }), cp = catPicker(catOf(p));
  app(body, F('이름', nm), F('카테고리', cp.el), h('p', { class: 'mu sm' }, `기본 크기 ${p[1]}×${p[2]}×${p[3]}cm`),
    h('div', { class: 'r' }, BTN('저장', () => {
      const cat = cp.get(); if (!cat) return toast('새 카테고리 이름을 입력하세요');
      const n = uniqLib(nm.value.trim() || p[0], p);
      if (n !== p[0]) { const ok = 'my|' + p[0], nk = 'my|' + n; if (SZ[ok]) { SZ[nk] = SZ[ok]; delete SZ[ok]; LS.set(K_SZ, SZ); cloudSettingsSoon(); } RECENT = RECENT.map(r => r === ok ? nk : r); LS.set(K_REC, RECENT); items.forEach(i => { if (i.pk === ok) i.pk = nk; }); }
      p[0] = n; p[6] = { ...(p[6] || {}), cat }; libChanged(); m.close(); toast('바꿨습니다');
    }, 'b'), BTN('🗑 삭제', () => { if (!confirm(`'${p[0]}'을(를) 삭제할까요?`)) return; CUSTOM = CUSTOM.filter(c => c !== p); libChanged(); m.close(); }, 'o danger'), BTN('닫기', () => m.close())));
  const m = mdl('✎ ' + p[0], body);
}
// 카테고리 관리 (이름 변경 · 순서 · 추가 · 삭제)
function catManager() {
  const body = h('div', {}); let m;
  const draw = () => {
    body.innerHTML = '';
    const cnt = id => CUSTOM.filter(p => catOf(p) === id).length;
    const nn = h('input', { type: 'text', placeholder: '새 카테고리 이름' });
    const add = () => { const id = newCat(nn.value); if (!id) return toast('이름을 입력하세요'); openCats['c:' + id] = 1; libChanged(); draw(); toast(`'${catName(id)}' 카테고리를 만들었습니다`); };
    nn.onkeydown = e => { if (e.key === 'Enter') add(); };
    app(body,
      h('h4', {}, '내 카테고리'),
      h('div', { class: 'catl' }, LIB.cats.map((c, i) => {
        const inp = h('input', { type: 'text', value: c.name }); inp.onchange = () => { const v = inp.value.trim(); if (!v) { inp.value = c.name; return; } c.name = v; libChanged(); };
        return h('div', { class: 'catr' }, h('span', { class: 'cn' }, cnt(c.id)), inp,
          BTN('↑', () => { if (i < 1) return; [LIB.cats[i - 1], LIB.cats[i]] = [LIB.cats[i], LIB.cats[i - 1]]; libChanged(); draw(); }, 'c', '위로'),
          BTN('↓', () => { if (i >= LIB.cats.length - 1) return; [LIB.cats[i + 1], LIB.cats[i]] = [LIB.cats[i], LIB.cats[i + 1]]; libChanged(); draw(); }, 'c', '아래로'),
          c.id === 'my' ? h('span', { class: 'mu sm', title: '기본 보관함이라 삭제할 수 없습니다 (이름은 변경 가능)' }, '기본') : BTN('🗑', () => {
            const n = cnt(c.id), mode = n ? prompt(`'${c.name}' 카테고리에 ${n}개가 있습니다.\n1 = 항목은 '${catName('my')}'(으)로 옮기고 카테고리만 삭제\n2 = 항목까지 모두 삭제`, '1') : '1';
            if (mode !== '1' && mode !== '2') return;
            if (mode === '2' && !confirm(`${n}개 항목까지 모두 삭제합니다. 계속할까요?`)) return;
            CUSTOM = mode === '2' ? CUSTOM.filter(p => catOf(p) !== c.id) : CUSTOM.map(p => { if (catOf(p) === c.id) p[6] = { ...(p[6] || {}), cat: 'my' }; return p; });
            LIB.cats = LIB.cats.filter(x => x !== c); libChanged(); draw(); toast(`'${c.name}' 카테고리를 삭제했습니다`);
          }, 'c danger', '카테고리 삭제'));
      })),
      h('div', { class: 'r' }, nn, BTN('＋ 추가', add, 'b')),
      h('h4', {}, '기본 카테고리 이름'),
      h('p', { class: 'mu sm' }, '보이는 이름만 바뀝니다. 내가 저장한 항목을 기본 카테고리에 넣을 수도 있습니다.'),
      h('div', { class: 'catl' }, CAT.map(([c, ls]) => {
        const inp = h('input', { type: 'text', value: bName(c), placeholder: c }); inp.onchange = () => { const v = inp.value.trim(); if (!v || v === c) delete LIB.ren[c]; else LIB.ren[c] = v; libChanged(); draw(); };
        return h('div', { class: 'catr' }, h('span', { class: 'cn' }, ls.length + cnt('b:' + c)), inp, LIB.ren[c] ? BTN('↺', () => { delete LIB.ren[c]; libChanged(); draw(); }, 'c', `원래 이름(${c})으로`) : h('span'));
      })),
      h('p', { class: 'mu sm' }, Cloud.user ? '☁ 바꾼 내용은 클라우드에 바로 저장되어 다른 기기에도 반영됩니다.' : '로그인하면 카테고리와 내 가구가 클라우드에 저장됩니다.'));
  };
  draw(); m = mdl('📁 카테고리 관리', body);
}

function renderCatalog() {
  const q = $('q').value.trim().toLowerCase(), box = $('pre'); box.innerHTML = '';
  const cats = [], mine = id => CUSTOM.filter(p => catOf(p) === id || (id === 'my' && !catExists(catOf(p)))).map(p => ({ p, pk: 'my|' + p[0], my: 1 }));
  box.append(h('div', { class: 'r cattb' }, BTN('📁 카테고리 관리', catManager, 'c'), CUSTOM.length ? h('span', { class: 'mu sm' }, `내가 저장한 항목 ${CUSTOM.length}개 · 칩의 ✎로 이름·카테고리 변경`) : h('span', { class: 'mu sm' }, '사진 인식 결과나 선택한 가구를 「내 가구로 저장」하면 여기에 모입니다')));
  LIB.cats.forEach(c => { const ls = mine(c.id); if (ls.length || c.id !== 'my') cats.push([c.name, ls, 'c:' + c.id, c.id]); });
  if (!q && RECENT.length) { const r = RECENT.map(findPreset).filter(Boolean); if (r.length) cats.push(['최근 사용', r, '최근 사용']); }
  CAT.forEach(([c, ls]) => cats.push([bName(c), [...mine('b:' + c), ...ls.map(p => ({ p, pk: c + '|' + p[0] }))], c, 'b:' + c]));
  let any = false;
  cats.forEach(([c, ls, key, cid]) => {
    const f = q ? ls.filter(x => x.p[0].toLowerCase().includes(q) || c.toLowerCase().includes(q) || (TYPES[x.p[5]] || '').includes(q)) : ls;
    if (!f.length && (q || !cid || cid.startsWith('b:'))) return; any = true;
    const userCat = cid && !cid.startsWith('b:');
    const ren = BTN('✎', ev => { ev.preventDefault(); ev.stopPropagation(); const v = (prompt('카테고리 이름', c) || '').trim(); if (!v || v === c) return; if (userCat) LIB.cats.find(x => x.id === cid).name = v; else LIB.ren[cid.slice(2)] = v; libChanged(); }, 'cbtn', '카테고리 이름 바꾸기');
    const det = h('details', { open: !!(q || openCats[key] || c === '최근 사용' || (userCat && openCats[key] !== 0)) }, h('summary', {}, (userCat ? '📁 ' : '') + c, h('small', {}, ` ${f.length}`), cid ? ren : null));
    det.ontoggle = () => { openCats[key] = det.open ? 1 : 0; LS.set('room3d.v2.opencats', openCats); };
    if (!f.length) det.append(h('p', { class: 'mu sm' }, '비어 있습니다 — 「내 가구로 저장」할 때 이 카테고리를 고르세요.'));
    const d = h('div', { class: 'ch' });
    f.forEach(x => {
      const u = SZ[x.pk], p = x.p;
      const b = h('button', { class: 'c' + (u ? ' u' : ''), title: `기본 ${p[1]}×${p[2]}×${p[3]}cm` + (u ? `\n내 크기 ${u.w}×${u.d}×${u.h}cm (다음 추가 시 적용)` : '') }, p[0]);
      b.onclick = () => { addPreset(x.pk, p); if (mq.matches) setSheet('peek'); };
      if (x.my) { b.classList.add('my'); b.prepend('★ '); const xx = h('span', { class: 'x ed', title: '이름·카테고리 변경 / 삭제' }, '✎'); xx.onclick = ev => { ev.stopPropagation(); libItemDialog(p); }; b.append(xx); }
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
  if (isMulti()) { const fl = floorOf(sel.list), u = unionBox(fl.length ? fl : sel.list), w = sel.list.filter(i => i.ov || i.wb || i.db || i.out).length; el.innerHTML = `<b>${sel.list.length}개 묶음</b> · ${rd(u[1] - u[0])}×${rd(u[3] - u[2])}cm · 왼쪽 <b>${rd(u[0] - BB.x0)}</b> · 오른쪽 <b>${rd(BB.x1 - u[1])}</b> · 뒤 <b>${rd(u[2] - BB.z0)}</b> · 앞 <b>${rd(BB.z1 - u[3])}</b> cm` + (w ? `<div class="warn">⚠ 확인 필요 ${w}개 (겹침·창문·문·방 밖)</div>` : ''); return; }
  if (sel.k === 'item') {
    const it = sel.o, b = aabb(it), w = [];
    if (it.ov) w.push('⚠ 다른 가구와 겹침'); if (it.wb) w.push('⚠ 창문을 가림'); if (it.db) w.push('⚠ 문 열림·통행 간섭'); if (it.out) w.push('⚠ 방 밖으로 나감');
    el.innerHTML = `<b>${itemLabel(it)}</b> · 외곽 기준 — 왼쪽 <b>${rd(b[0] - BB.x0)}</b> · 오른쪽 <b>${rd(BB.x1 - b[1])}</b> · 뒤 <b>${rd(b[2] - BB.z0)}</b> · 앞 <b>${rd(BB.z1 - b[3])}</b> cm` + (w.length ? `<div class="warn">${w.join(' · ')}</div>` : '');
  } else if (sel.k === 'op') { const o = sel.o, len = opLen(o); el.innerHTML = `<b>${opLabel(o)}</b> · 벽${o.wall + 1} 길이 ${rd(len)}cm · 왼쪽 끝까지 <b>${rd(o.s - o.w / 2)}</b> · 오른쪽 끝까지 <b>${rd(len - o.s - o.w / 2)}</b> cm <small>(방 안에서 벽을 바라볼 때)</small>`; }
  else el.textContent = '';
}
function renderSel() {
  const b = $('t-sel'); b.innerHTML = '';
  if (!sel) { app(b, h('p', { class: 'mu' }, '3D 화면이나 목록에서 가구·창호·조명·벽을 선택하세요.'), h('p', { class: 'mu sm' }, isMobile() ? '터치: 한 번 눌러 선택 → 다시 끌어서 이동 · 길게 누르면 상세 편집' : '더블클릭: 선택 대상으로 카메라 이동')); syncSel(); return; }
  if (sel.k === 'house') { housePanel(b, sel.o); app(b, h('div', { id: 'inf', class: 'inf' })); syncSel(); return; }
  if (isMulti()) { multiPanel(b); app(b, h('div', { id: 'inf', class: 'inf' })); infoSel(); syncSel(); return; }
  if (sel.k === 'item') itemPanel(b, sel.o); else if (sel.k === 'op') opPanel(b, sel.o); else if (sel.k === 'light') lightPanel(b, sel.o); else if (sel.k === 'edge') edgePanel(b, sel.i); else vertPanel(b, sel.i);
  if (isLocked(sel)) { b.querySelectorAll('input,select,textarea,button').forEach(el => { if (!el.closest('.keep')) el.disabled = true; }); b.prepend(h('div', { class: 'lockbar' }, '🔒 잠금 상태 — 위치·크기·모양을 바꿀 수 없습니다', BTN('잠금 해제', () => setLock(sel, 0), 'c'))); }
  if (sel.k === 'op' || sel.k === 'light') { const k = sel.k === 'light' ? 'pickLight' : sel.o.kind === 'win' ? 'pickWin' : 'pickDoor', nm = { pickWin: '창문', pickDoor: '문', pickLight: '조명' }[k]; app(b, h('div', { class: 'r keep' }, BTN(`🚫 ${nm} 클릭 선택 끄기`, () => { PREF[k] = 0; savePref(); syncTb(); onPref(k); }, 'c', `${nm}이(가) 클릭에 걸려 가구 선택이 불편할 때 — ☰ 메뉴에서 다시 켤 수 있습니다`))); }
  app(b, h('div', { id: 'inf', class: 'inf' })); infoSel(); syncSel();
}
function setLock(s, v) { if (!s) return; if (s.k === 'multi') { s.list.forEach(o => { o.lock = v ? 1 : 0; }); selectItems(s.list, s.o); markList(); commitSoon(0); return toast(v ? `🔒 ${s.list.length}개 잠금` : `🔓 ${s.list.length}개 잠금 해제`); } if (s.k === 'edge' || s.k === 'vert') { R.lock = v ? 1 : 0; buildHandles(); renderRoom(); } else s.o.lock = v ? 1 : 0; if (s.k === 'item') setSel(s); else { renderSel(); quick(); } renderRoom(); renderLights(); markList(); commitSoon(0); toast(v ? '🔒 잠갔습니다' : '🔓 잠금을 풀었습니다'); }
function colEditor(it) {
  if (!COLSTY[it.type]) return null;
  const pat = () => colPat(it, fpw(it)), opts = COLSTY[it.type];
  const setPat = p => { it.cpat = p; mk(it); fit(it, false); upd(); renderSel(); };
  return h('div', {}, h('h4', {}, '열 구성'),
    G(3, F('열 수', bnum(() => pat().length, v => { v = clamp(Math.round(v), 1, 12); const p = pat(); setPat(v > p.length ? p + p.slice(-1).repeat(v - p.length) : p.slice(0, v)); }, { min: 1, max: 12 })),
      F('모든 열을', bsel([['', '— 일괄 선택 —'], ...opts], () => '', v => { if (v) setPat(v.repeat(pat().length)); }), 'c2')),
    h('div', { class: 'cols' }, [...pat()].map((c, i) => F(`${i + 1}열`, bsel(opts, () => pat()[i] || opts[0][0], v => { const p = pat().split(''); p[i] = v; setPat(p.join('')); })))));
}
function itemPanel(b, it) {
  const RF = () => refreshItem(it, false), C2 = () => { mk(it); commitSoon(); };
  const u = it.pk && SZ[it.pk], isP = it.type === 'person';
  app(b,
    h('div', { class: 'lab' }, itemLabel(it)),
    G(5, F('이름', h('input', { type: 'text', value: it.name, oninput: e => { it.name = e.target.value; if (PREF.labels) mk(it); markList(); quick(); commitSoon(); } }), 'c3'), F(isP ? '상의' : '색상', bcol(() => it.color, v => { it.color = v; C2(); markList(); })), F(isP ? '하의' : '보조색', bcol(() => it.c2 || DEFA[it.type] || '#e9e4da', v => { it.c2 = v; C2(); }))),
    G(2, F('모델 (모양)', bsel(Object.entries(TYPES), () => it.type, v => { it.type = v; delete it.cpat; ensureNo(it, items, x => grp(x.type)); RF(); commitSoon(); renderSel(); })),
      F('설치 위치', bsel([['f', '바닥'], ['w', '벽 부착'], ['c', '천장 매달기']], () => it.mt || 'f', v => { it.mt = v === 'f' ? undefined : v; if (v === 'c') it.y = Math.max(0, R.H - it.h - 25); if (v === 'w') { const ne = nearestEdge(it.x, it.z); if (ne) { it.wall = ne.e.i; it.ws = ne.s; } if (!it.y) it.y = 100; } if (v === 'f') it.y = 0; RF(); commitSoon(); }))),
    !isP ? G(2, F('재질 (주)', bsel(MATS, () => it.mat || '', v => { it.mat = v; C2(); })), F('재질 (보조)', bsel(MATS, () => it.mat2 || '', v => { it.mat2 = v; C2(); }))) : null,
    isP ? personEditor(it, C2) : null,
    it.type === 'plant' ? F('식물 종류', bsel(PV, () => it.pv || 'leafy', v => { it.pv = v; C2(); })) : null,
    it.type === 'tree' ? F('나무 종류', bsel(TREES, () => it.pv || 'broad', v => { it.pv = v; C2(); })) : null,
    colEditor(it),
    h('h4', {}, '크기 (cm)'),
    G(3, F('가로', bnum(() => it.w, v => { setSize(it, 'w', v); sizeChanged(it); }, { min: 1 })), F('세로 (깊이)', bnum(() => it.d, v => { setSize(it, 'd', v); sizeChanged(it); }, { min: 1 })), F(isP ? '키' : '높이', bnum(() => it.h, v => { setSize(it, 'h', v); sizeChanged(it); }, { min: 1 }))),
    G(3, F('가로 %', bnum(() => it.w / it.bw * 100, v => { setSize(it, 'w', it.bw * v / 100); sizeChanged(it); }, { min: 1, step: 5 })), F('세로 %', bnum(() => it.d / it.bd * 100, v => { setSize(it, 'd', it.bd * v / 100); sizeChanged(it); }, { min: 1, step: 5 })), F('높이 %', bnum(() => it.h / it.bh * 100, v => { setSize(it, 'h', it.bh * v / 100); sizeChanged(it); }, { min: 1, step: 5 }))),
    F('전체 크기 % (기본 크기 대비 · 비율 유지)', (() => { let st = null; const r = brange(() => rd(pctAll(it)), v => { if (!st) st = { w: it.w, d: it.d, h: it.h, p: pctAll(it) }; const f = v / st.p; it.w = r1(Math.max(1, st.w * f)); it.d = r1(Math.max(1, st.d * f)); it.h = r1(Math.max(1, st.h * f)); sizeChanged(it); }, 10, 300, 1, v => v + '%'); r.querySelector('input').addEventListener('change', () => { st = null; }); return r; })()),
    h('div', { class: 'r' }, [50, 75, 90, 100, 110, 125, 150, 200].map(p => BTN(p + '%', () => { it.w = r1(it.bw * p / 100); it.d = r1(it.bd * p / 100); it.h = r1(it.bh * p / 100); sizeChanged(it); }, 'c')), BTN('−5%', () => { scaleIt(it, 1 / 1.05); sizeChanged(it); }, 'c'), BTN('+5%', () => { scaleIt(it, 1.05); sizeChanged(it); }, 'c')),
    h('div', { class: 'cg' }, bchk('가로·세로·높이 비율 유지', () => PREF.lock, v => { PREF.lock = v ? 1 : 0; savePref(); }), bchk('변경한 크기를 다음 추가 시에도 사용', () => PREF.remember, v => { PREF.remember = v ? 1 : 0; savePref(); if (v) remember(it); })),
    h('div', { class: 'mu sm' }, `기본 크기 ${it.bw}×${it.bd}×${it.bh}` + (u ? ` · 저장된 내 크기 ${u.w}×${u.d}×${u.h}` : it.pk ? ' · 저장된 내 크기 없음' : ' · 직접 입력 가구')),
    h('div', { class: 'r' },
      BTN('기본 크기로', () => { it.w = it.bw; it.d = it.bd; it.h = it.bh; if (it.pk && SZ[it.pk]) { delete SZ[it.pk]; LS.set(K_SZ, SZ); renderCatalog(); cloudSettingsSoon(); } refreshItem(it, false); commitSoon(); renderSel(); toast('기본 크기로 되돌리고 저장된 내 크기를 지웠습니다'); }, 'o'),
      u ? BTN('내 크기로', () => { it.w = u.w; it.d = u.d; it.h = u.h; refreshItem(it, false); commitSoon(); }, 'o') : null,
      it.pk ? BTN('이 크기를 내 기본으로 저장', () => { SZ[it.pk] = { w: it.w, d: it.d, h: it.h }; LS.set(K_SZ, SZ); renderCatalog(); renderSel(); cloudSettingsSoon(); toast('다음에 추가할 때 이 크기로 들어갑니다'); }, 'o') : null,
      it.pk ? BTN('같은 종류 모두 이 크기로', () => { let n = 0; items.forEach(o => { if (o !== it && o.pk === it.pk) { o.w = it.w; o.d = it.d; o.h = it.h; mk(o); fit(o, false); n++; } }); upd(); toast(`${n}개 가구에 적용했습니다`); }, 'o') : null),
    h('div', { class: 'r msr' }, BTN(`같은 종류 모두 선택 (${sameType(it).length})`, () => selectItems(sameType(it), it, 'sel'), 'c'), it.gid ? BTN(`⧉ 그룹${it.gid} 전체 선택`, () => selectItems(groupOf(it), it, 'sel'), 'c') : null, it.gid ? BTN('그룹에서 빼기', () => { delete it.gid; upd(); renderSel(); toast('그룹에서 뺐습니다'); }, 'c') : null, BTN('☑ 다른 가구도 함께 선택', () => setMMode(true), 'c')),
    h('h4', {}, '위치·회전'),
    it.mt === 'w' ? G(3, F('설치 벽', bsel(E.filter(straight).map(e => [e.i, '벽' + (e.i + 1)]), () => it.wall, v => { it.wall = +v; fit(it, false); upd(); })), F('벽 왼쪽 끝에서', bnum(() => (it.ws || 0) - fpw(it) / 2, v => { it.ws = v + fpw(it) / 2; fit(it, false); upd(); })), F('바닥에서 높이', bnum(() => it.y || 0, v => { it.y = v; fit(it, false); upd(); }, { min: 0 })))
      : G(4, F('왼쪽에서', bnum(() => it.x - fp(it)[0] / 2 - BB.x0, v => { it.x = BB.x0 + v + fp(it)[0] / 2; fit(it, false); upd(); })), F('뒤에서', bnum(() => it.z - fp(it)[1] / 2 - BB.z0, v => { it.z = BB.z0 + v + fp(it)[1] / 2; fit(it, false); upd(); })),
        F('바닥에서 높이', bnum(() => it.y || 0, v => { it.y = v; fit(it, false); upd(); }, { min: 0 })), F('각도 (시계°)', bnum(() => cwOf(it), v => { it.rot = norm360(-v); fit(it, false); upd(); }, { step: 15 }))),
    it.mt !== 'w' ? [rotWidget(it), h('div', { class: 'r' }, BTN('가로 중앙', () => { it.x = center()[0]; fit(it, false); upd(); }, 'c'), BTN('세로 중앙', () => { it.z = center()[1]; fit(it, false); upd(); }, 'c'))] : null,
    (it.type === 'rug' || it.type === 'rugR') ? rugPanel(it) : null,
    refsSection(it),
    h('h4', {}, '옵션'),
    h('div', { class: 'cg' },
      LEAF[it.type] ? bchk('날개 접기', () => it.fold, v => { it.fold = v; RF(); commitSoon(); }) : null,
      bchk('다른 가구 위에 올리기', () => it.sk, v => { it.sk = v ? 1 : 0; commitSoon(); }, '책상·테이블 위로 드래그하면 그 위에 올라갑니다'),
      bchk('겹침 검사 제외 (러그 등)', () => it.nc, v => { it.nc = v ? 1 : 0; RF(); upd(); }),
      h('span', { class: 'keep' }, bchk('잠금 (이동·크기 고정)', () => it.lock, v => setLock({ k: 'item', o: it }, v)))),
    NOPT[it.type] ? G(3, F(NOPT[it.type], bnum(() => it.n || (it.type === 'cab' ? 2 : 5), v => { if (v >= 1 && v <= 12) { it.n = Math.round(v); C2(); } }, { min: 1, max: 12 }))) : null,
    (LAMPS.has(it.type) || it.lt) ? h('div', { class: 'keep' }, G(3, F('조명', bsel([['1', '켜짐'], ['0', '꺼짐']], () => it.on === false ? '0' : '1', v => { it.on = v === '1'; C2(); })), F('색온도', bsel(TEMPS, () => it.temp || 2900, v => { it.temp = +v; C2(); })), F('밝기', brange(() => it.lum ?? 0.8, v => { it.lum = v; C2(); }, 0, 2, 0.1)))) : null,
    h('h4', {}, '견적·메모'),
    h('div', { class: 'keep' }, G(3, F('가격 (원)', bnum(() => it.price || 0, v => { it.price = v; markList(); commitSoon(); }, { min: 0, step: 1000 })), F('메모', h('input', { type: 'text', value: it.memo || '', placeholder: '구매처, 모델명 등', oninput: e => { it.memo = e.target.value; commitSoon(); } }), 'c2'))),
    h('div', { class: 'r keep' }, BTN('복제 (Ctrl+D)', dupSel), BTN('💾 내 가구로 저장…', () => saveCustom(it)), BTN('카메라 맞춤', focusSel)), h('div', { class: 'r' }, BTN('삭제 (Del)', delSel)),
  );
}
// ---------- 러그 무늬·모양 ----------
const RUGC = [['#efe6d6', '아이보리'], ['#d8cbb5', '베이지'], ['#c8ad7f', '내추럴'], ['#9aa3ad', '그레이'], ['#3a3d42', '차콜'], ['#8e2b2b', '레드'], ['#e8572a', '오렌지'], ['#b5735a', '테라코타'], ['#e9c46a', '머스타드'], ['#8a9a7b', '세이지'], ['#3f5a4a', '그린'], ['#2f4f6f', '블루'], ['#1f2f52', '네이비'], ['#7a6a9a', '퍼플'], ['#d98b9b', '핑크']];
function rugPanel(it) {
  const R2 = () => { mk(it); fit(it, false); upd(); renderSel(); };
  const fi = h('input', { type: 'file', accept: 'image/*', hidden: true });
  fi.onchange = async () => { const f = fi.files[0]; fi.value = ''; if (!f) return; const d = await fileToDataURL(f, 1400, 0.85), id = await putRef(d); it.rugImg = id; it.refs = [...(it.refs || []).filter(r => r.kind !== 'material' || r.id !== id), { id, kind: 'material', note: '러그 무늬 사진 (그대로 재현)' }]; R2(); toast('🖼 사진 무늬를 러그에 입혔습니다 — 실사 이미지에도 이 사진 무늬로 나옵니다', 4500); };
  const pats = h('div', { class: 'rugpats' }, RUG_PAT.map(([k, n]) => h('button', { type: 'button', class: 'rugp' + ((it.rp || 'solid') === k && !it.rugImg ? ' on' : ''), title: n, onclick: () => { it.rp = k; delete it.rugImg; R2(); } }, h('img', { src: rugThumb(it, k), alt: n }), h('span', {}, n))));
  return h('div', { class: 'rugbox' },
    h('h4', {}, '러그 무늬·모양'),
    F('모양', h('div', { class: 'ch' }, RUG_SHAPE.map(([k, n]) => BTN(n, () => { it.rs = k; if ((k === 'round' || k === 'oct') && Math.abs(it.w - it.d) > 1) { const m = Math.max(it.w, it.d); it.w = it.d = m; } R2(); }, 'c' + ((it.rs || (it.type === 'rugR' ? 'round' : 'rect')) === k ? ' on' : ''))))),
    F('무늬 (30종)', pats),
    G(3, F('바탕색', swatches(RUGC, () => it.color, v => { it.color = v; mk(it); })), F('포인트색', swatches(RUGC, () => it.c2 || '#8d7b62', v => { it.c2 = v; mk(it); })), F('세 번째 색', swatches(RUGC, () => it.c3 || '#e9e4da', v => { it.c3 = v; mk(it); }))),
    F('무늬 크기', brange(() => it.rpsc || 1, v => { it.rpsc = v; mk(it); }, 0.4, 2.5, 0.05, v => Math.round(v * 100) + '%')),
    h('div', { class: 'r' }, BTN(it.rugImg ? '🖼 다른 러그 사진으로' : '🖼 실제 러그 사진으로 무늬 입히기', () => fi.click(), 'b'), fi,
      it.rugImg ? BTN('사진 빼기', () => { delete it.rugImg; R2(); }, 'c') : null,
      it.rugImg ? bsel([['cover', '꽉 채우기'], ['contain', '전체 보이기']], () => it.rugFit || 'cover', v => { it.rugFit = v; R2(); }) : null),
    h('p', { class: 'mu sm' }, '판매 사진이나 집에 있는 러그를 위에서 찍은 사진을 올리면 그 무늬 그대로 입혀지고, 실사 이미지를 만들 때도 같은 무늬로 나옵니다.'));
}
// ---------- 📎 참고 사진 (객체·공간별) ----------
// target: 가구/사람 객체 또는 'space'
function refsSection(target) {
  const isSp = target === 'space', o = isSp ? R : target, kinds = REF_KINDS[isSp ? 'space' : o.type === 'person' ? 'person' : 'item'];
  const fi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }), cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const kindSel = h('select', { class: 'rkind' }, kinds.map(([k, n]) => h('option', { value: k }, n))); kindSel.value = LS.get('r3d_rkind_' + (isSp ? 's' : o.type === 'person' ? 'p' : 'i'), kinds[0][0]);
  kindSel.onchange = () => LS.set('r3d_rkind_' + (isSp ? 's' : o.type === 'person' ? 'p' : 'i'), kindSel.value);
  const rerender = () => { if (isSp) renderRoom(); else renderSel(); };
  const addFiles = async files => {
    if (!isSp && o.lock) return toast('잠긴 가구입니다');
    const list = o.refs = [...(o.refs || [])];
    for (const f of files) { const d = await fileToDataURL(f, 900, 0.82); const id = await putRef(d); list.push({ id, kind: kindSel.value }); }
    commitSoon(0); rerender(); toast(`📎 참고 사진 ${files.length}장 추가 — 「🤖 사진대로 적용」을 누르면 3D에 반영됩니다`, 4000);
  };
  fi.onchange = () => { addFiles([...fi.files]); fi.value = ''; }; cam.onchange = () => { addFiles([...cam.files]); cam.value = ''; };
  const refs = o.refs || [];
  const grid = h('div', { class: 'refg' }, refs.map((r, i) => {
    const img = h('img', { alt: '참고 사진', onclick: () => img.src && viewImg(img.src, r.note || '참고 사진') }); getRef(r.id).then(src => { if (src) img.src = src; else img.alt = '(이 기기에 없음)'; });
    const ks = h('select', {}, kinds.map(([k, n]) => h('option', { value: k }, n))); ks.value = r.kind; ks.onchange = () => { r.kind = ks.value; commitSoon(0); };
    const nt = h('input', { type: 'text', placeholder: '메모 (예: 이 소파의 패브릭)', value: r.note || '' }); nt.onchange = () => { r.note = nt.value.trim() || undefined; commitSoon(0); };
    const uk = h('label', { class: 'ck sm', title: '실사 이미지 만들 때 이 사진을 보낼지' }, h('input', { type: 'checkbox', checked: r.use !== 0, onchange: e => { r.use = e.target.checked ? undefined : 0; commitSoon(0); } }), '실사에 사용');
    return h('div', { class: 'refc' + (r.use === 0 ? ' off' : '') }, h('div', { class: 'refi' }, img), ks, nt, uk,
      h('button', { class: 'x', title: '빼기', onclick: () => { o.refs = refs.filter((_, j) => j !== i); if (!o.refs.length) delete o.refs; if (!items.some(it => (it.refs || []).some(x => x.id === r.id)) && !(R.refs || []).some(x => x.id === r.id)) delRef(r.id); commitSoon(0); rerender(); } }, '×'));
  }));
  const desc = h('textarea', { rows: 2, placeholder: isSp ? '분위기 설명 (실사 렌더에 반영) — 예: warm minimal Scandinavian, soft daylight' : '외형 설명 (실사 렌더에 반영) — AI가 사진을 분석하면 자동으로 채워집니다' }, o.desc || '');
  desc.onchange = () => { o.desc = desc.value.trim() || undefined; commitSoon(0); };
  return h('div', { class: 'refbox keep' },
    h('h4', {}, isSp ? '📎 공간 참고 사진 (분위기·마감·풍경)' : '📎 참고 사진 (실사·인식용)'),
    h('p', { class: 'mu sm' }, isSp ? '원하는 분위기·마감재·풍경 사진을 붙이면 AI가 바닥·벽·환경에 반영하고, 실사 이미지를 만들 때도 참고합니다.' : o.type === 'person' ? '얼굴·옷차림·체형·자세·헤어 사진을 각각 붙이세요. 「🤖 사진대로 적용」을 누르면 3D 사람에 반영되고, 실사 이미지에서도 사진처럼 표현합니다.' : '원하는 느낌·모양·재질·디테일 사진(또는 치수 도면)을 붙이세요. 3D 모양·색·재질에 반영되고 실사 이미지에서도 사진처럼 표현합니다.'),
    h('div', { class: 'r' }, F('용도', kindSel), BTN('🖼 사진 추가', () => fi.click(), 'b'), isMobile() ? BTN('📸 촬영', () => cam.click(), 'c') : null, fi, cam),
    refs.length ? grid : null,
    refs.length ? h('div', { class: 'r' }, BTN('🤖 사진대로 3D에 적용', () => AI.analyzeRefs(isSp ? 'space' : o, () => rerender()), 'b'),
      !isSp ? bchk('실사 이미지에 이 사진 참고', () => o.refUse !== 0, v => { o.refUse = v ? undefined : 0; commitSoon(0); }) : null) : null,
    F(isSp ? '분위기 설명' : '외형 설명', desc));
}
function personEditor(it, C2) {
  const chip = (list, key, def, after) => h('div', { class: 'ch' }, list.map(([v, t]) => BTN(t, () => { it[key] = v; if (after) after(v); C2(); renderSel(); }, 'c' + ((it[key] || def) === v ? ' on' : ''))));
  const sl = (lbl, k, min, max, step, fmt, def = 0) => F(lbl, brange(() => it[k] ?? (POSES[it.pose] || POSES.stand)[1][k] ?? def, v => { it[k] = v; C2(); }, min, max, step, fmt));
  const psl = (lbl, k, min, max, step, fmt) => F(lbl, brange(() => it[k] ?? (POSES[it.pose] || POSES.stand)[1][k] ?? 0, v => { it[k] = v; if (it.pose && !String(it.pose).startsWith('custom')) it.pose = 'custom_' + it.pose; C2(); }, min, max, step, fmt));
  const deg = v => Math.round(v) + '°', pct = v => Math.round(v * 100) + '%';
  const HAIRC = [['#1a1716', '검정'], ['#2a2220', '흑갈색'], ['#4a3426', '갈색'], ['#7a5634', '밝은 갈색'], ['#c9a46a', '금발'], ['#8d8d8d', '회색'], ['#e8e6e1', '흰색']];
  const SKINC = [['#f3d5bf', '밝은 피부'], ['#e8c4a2', '보통'], ['#d9a98a', '살짝 어두운'], ['#b9825f', '갈색'], ['#7d5038', '어두운']];
  const skirt = ['blouse', 'dress', 'longdress', 'gown', 'mermaid', 'hanbok'].includes(it.outfit);
  return h('div', { class: 'pe' },
    h('h4', {}, '기본'),
    G(3, F('성별', bsel([['m', '남성'], ['f', '여성'], ['c', '어린이']], () => it.sex || 'm', v => { it.sex = v; C2(); })), F('키 (cm)', bnum(() => it.h, v => { setSize(it, 'h', v); sizeChanged(it); }, { min: 50, max: 230 })), F('빠른 키', h('div', { class: 'r' }, BTN('180', () => { setSize(it, 'h', 180); sizeChanged(it); syncSel(); }, 'c'), BTN('165', () => { setSize(it, 'h', 165); sizeChanged(it); syncSel(); }, 'c'), BTN('120', () => { setSize(it, 'h', 120); sizeChanged(it); syncSel(); }, 'c')))),
    F('체형', chip(Object.entries(BODIES).map(([k, [n]]) => [k, n]), 'body', 'std')),
    G(3, sl('어깨 너비', 'shw', 0.8, 1.25, 0.01, pct, 1), sl('체형 (마름↔통통)', 'build', 0.75, 1.45, 0.01, pct, 1), sl('머리 크기', 'headS', 0.8, 1.3, 0.01, pct, 1)),
    h('h4', {}, '얼굴'),
    h('div', { class: 'facebox' }, it.face ? h('img', { src: it.face, class: 'facethumb' }) : h('span', { class: 'mu sm' }, '얼굴 사진 없음'),
      h('div', {}, h('div', { class: 'r' }, BTN(it.face ? '얼굴 사진 바꾸기' : '📷 얼굴 사진 넣기', () => AI.openFace(it, () => { mk(it); renderSel(); commitSoon(0); }), 'b'), it.face ? BTN('빼기', () => { delete it.face; mk(it); renderSel(); commitSoon(0); }, 'c') : null),
        it.face ? h('div', { class: 'r' }, BTN('사진에서 피부색 맞추기', async () => { it.skin = await sampleSkin(it.face); C2(); syncSel(); }, 'c'), BTN('얼굴 설정 초기화', () => { ['fsz', 'fzoom', 'fox', 'foy'].forEach(k => delete it[k]); C2(); renderSel(); }, 'c')) : null)),
    it.face ? G(2, sl('얼굴 영역 크기 (머리에서)', 'fsz', 0.5, 1.45, 0.01, pct, 1), sl('사진 확대·축소', 'fzoom', 0.5, 2.5, 0.01, pct, 1), sl('사진 좌우 이동', 'fox', -0.4, 0.4, 0.01, v => (v > 0 ? '→' : v < 0 ? '←' : '') + Math.round(Math.abs(v) * 100)), sl('사진 상하 이동', 'foy', -0.4, 0.4, 0.01, v => (v > 0 ? '↓' : v < 0 ? '↑' : '') + Math.round(Math.abs(v) * 100))) : null,
    F('피부색', swatches(SKINC, () => it.skin || '#e8c4a2', v => { it.skin = v; C2(); })),
    h('div', { class: 'cg' }, bchk('안경', () => it.glasses, v => { it.glasses = v ? 1 : 0; C2(); renderSel(); })), it.glasses ? F('안경테 색', swatches([['#2b2b2d', '검정'], ['#8a6a50', '갈색'], ['#c9a24a', '골드'], ['#b8bcc2', '실버']], () => it.glassC || '#2b2b2d', v => { it.glassC = v; C2(); })) : null,
    h('h4', {}, '헤어'),
    chip(HAIRS, 'hs', it.sex === 'f' ? 'long' : 'short'),
    G(2, sl('머리 볼륨', 'hv', 0.85, 1.3, 0.01, pct, 1), h('div', { class: 'cg' }, bchk('앞머리 (뱅)', () => it.bangs, v => { it.bangs = v ? 1 : 0; C2(); }))),
    F('머리색', swatches(HAIRC, () => it.hair || '#2a2220', v => { it.hair = v; C2(); })),
    h('h4', {}, '옷'),
    chip(OUTFITS, 'outfit', it.sex === 'f' ? 'dress' : 'suit', () => { delete it.skirtL; }),
    G(2, F('소매', bsel(SLEEVES, () => it.sleeve || '', v => { it.sleeve = v || undefined; C2(); })), F('넥타이', bsel(TIES, () => it.tieT || '', v => { it.tieT = v || undefined; C2(); }))),
    skirt ? sl('치마·드레스 길이', 'skirtL', 0.3, 1, 0.01, v => v >= 0.93 ? '바닥까지' : v > 0.7 ? '롱' : v > 0.5 ? '무릎 아래' : '무릎 위', { blouse: 0.5, dress: 0.55, longdress: 0.97, gown: 1, mermaid: 1, hanbok: 1 }[it.outfit]) : null,
    G(5, F('상의', bcol(() => it.color, v => { it.color = v; C2(); })), F('하의·치마', bcol(() => it.c2 || it.color, v => { it.c2 = v; C2(); })), F('포인트', bcol(() => it.c3 || '#f7f7f5', v => { it.c3 = v; C2(); })), F('넥타이', bcol(() => it.tie || '#1d1d1f', v => { it.tie = v; C2(); })), F('신발', bcol(() => it.shoe || '#1d1d1f', v => { it.shoe = v; C2(); }))),
    h('div', { class: 'cg' }, bchk('가슴꽃', () => it.flower, v => { it.flower = v ? 1 : 0; C2(); }), bchk('부케', () => it.bouquet, v => { it.bouquet = v ? 1 : 0; C2(); }), bchk('면사포', () => it.veil, v => { it.veil = v ? 1 : 0; C2(); })),
    h('h4', {}, '자세'),
    h('div', { class: 'ch' }, Object.entries(POSES).map(([k, [n, vals]]) => BTN(n, () => { Object.assign(it, vals); it.pose = k; C2(); renderSel(); }, 'c' + (it.pose === k ? ' on' : '')))),
    G(3, psl('왼팔 들기', 'aL', -60, 180, 1, deg), psl('왼팔 방향 (앞↔옆)', 'zL', 0, 100, 1, deg), psl('왼팔꿈치', 'eL', 0, 150, 1, deg)),
    G(3, psl('오른팔 들기', 'aR', -60, 180, 1, deg), psl('오른팔 방향 (앞↔옆)', 'zR', 0, 100, 1, deg), psl('오른팔꿈치', 'eR', 0, 150, 1, deg)),
    G(3, psl('걷기 보폭', 'leg', -1, 1, 0.05, v => Math.round(v * 100) + ''), psl('고개 좌우', 'yaw', -70, 70, 1, deg), F('앉기', h('div', { class: 'cg' }, bchk('앉은 자세', () => it.sit ?? (POSES[it.pose] || POSES.stand)[1].sit, v => { it.sit = v ? 1 : 0; C2(); })))),
    h('p', { class: 'mu sm' }, '왼쪽·오른쪽은 사람 본인 기준입니다. 슬라이더를 끌면 3D에서 바로 바뀝니다.'));
}
function saveCustom(it, name, def) { return saveLibDialog([{ it, name: name || it.name }], def); }
function opPanel(b, o) {
  const RB = () => { clampOp(o); buildRoom(); check(); dims(); syncSel(); infoSel(); markList(); commitSoon(); };
  const isWin = o.kind === 'win', st = o.st, swing = SWING.has(st);
  app(b,
    h('div', { class: 'lab' }, opLabel(o)),
    h('div', { class: 'cg keep' }, bchk('잠금 (위치·크기·종류 고정 — 열고 닫기는 가능)', () => o.lock, v => setLock({ k: 'op', o }, v))),
    G(2, F('종류', bsel(isWin ? WIN_ST : DOOR_ST, () => o.st, v => { o.st = v; if (isWin && v === 'full') { o.y = 5; o.h = R.H - 25; } RB(); renderSel(); renderRoom(); })), F('설치 벽', bsel(E.filter(straight).map(e => [e.i, `벽${e.i + 1} (${rd(e.len)}cm)`]), () => o.wall, v => { o.wall = +v; RB(); renderSel(); renderRoom(); }))),
    G(4, F('벽 왼쪽 끝에서', bnum(() => o.s - o.w / 2, v => { o.s = v + o.w / 2; RB(); }, { min: 0 })), F('폭', bnum(() => o.w, v => { const e0 = o.s - o.w / 2; o.w = v; o.s = e0 + v / 2; RB(); }, { min: 20 })), F('높이', bnum(() => o.h, v => { o.h = v; RB(); }, { min: 20 })), isWin ? F('바닥에서', bnum(() => o.y, v => { o.y = v; RB(); }, { min: 0 })) : F('', h('span'))),
    h('div', { class: 'r' }, BTN('벽 중앙에 맞추기', () => { o.s = opLen(o) / 2; RB(); }, 'c')),
    h('h4', {}, '열림 상태'),
    st === 'jung3' ? h('div', { class: 'keep' },
      h('div', { class: 'r' }, [[0, '모두 닫힘'], [1, '1짝 열림 (2번째 문에 겹침)'], [2, '2짝 열림 (마지막 문에 모두 겹침)']].map(([v, t]) => BTN(t, () => { o.open = v; RB(); renderSel(); }, (o.open || 0) === v ? 'b' : 'o'))),
      F('세밀 조정', brange(() => o.open || 0, v => { o.open = v; RB(); }, 0, 2, 0.05, v => v.toFixed(2) + '짝')),
      G(2, F('겹치는 쪽 (방 안에서 볼 때)', bsel([['L', '왼쪽'], ['R', '오른쪽']], () => o.hinge || 'L', v => { o.hinge = v; RB(); })))) : null,
    isWin && st !== 'fixed' && st !== 'grid' && st !== 'full' ? h('div', { class: 'keep' }, F(st === 'casement' || st === 'tilt' ? '창 열림 각도' : '창 열림 정도', brange(() => o.wo || 0, v => { o.wo = v; RB(); }, 0, 1, 0.05, v => st === 'casement' || st === 'tilt' ? rd(v * 90) + '°' : rd(v * 100) + '%'))) : null,
    isWin && (st === 'fixed' || st === 'grid' || st === 'full') ? h('p', { class: 'mu sm' }, '고정창은 열리지 않습니다.') : null,
    !isWin && st !== 'open' && st !== 'jung3' ? h('div', {},
      st !== 'double' ? G(2, F(swing ? '경첩 위치 (방 안에서 볼 때)' : '열리는 방향 (방 안에서 볼 때)', bsel([['L', '왼쪽'], ['R', '오른쪽']], () => o.hinge || 'L', v => { o.hinge = v; RB(); })), swing || st === 'folding' ? F('열림 방향', bsel([['in', '방 안쪽으로'], ['out', '바깥쪽으로']], () => o.sw || 'in', v => { o.sw = v; RB(); })) : F('', h('span'))) : null,
      h('div', { class: 'keep' }, F(swing ? '열림 각도' : '열림 정도', brange(() => o.ang || 0, v => { o.ang = v; RB(); }, 0, 90, 5, v => swing ? v + '°' : rd(v / 90 * 100) + '%'))),
      h('div', { class: 'r keep' }, BTN('닫기', () => { o.ang = 0; RB(); syncSel(); }, 'c'), BTN('반쯤', () => { o.ang = 45; RB(); syncSel(); }, 'c'), BTN('활짝', () => { o.ang = 90; RB(); syncSel(); }, 'c'))) : null,
    h('h4', {}, '색상'),
    F('프레임 색', swatches(FCOLS, () => o.fc || '#f3f2ee', v => { o.fc = v; RB(); })),
    !isWin && st !== 'open' ? F('문짝 색', swatches([['#f3f2ee', '화이트'], ['#e6dccb', '아이보리'], ['#a0714f', '우드'], ['#6b4e3d', '월넛'], ['#6d6f75', '그레이'], ['#3a3d42', '차콜'], ['#2f4f6f', '네이비']], () => o.dc || '#f3f2ee', v => { o.dc = v; RB(); })) : null,
    isWin || ['jung3', 'jung1', 'swingG', 'folding'].includes(st) || o.glass ? h('div', { class: 'keep' }, G(2, F('유리 투명도 (실사에도 반영)', brange(() => o.gop ?? 72, v => { o.gop = v; RB(); }, 0, 100, 1, v => v + '%')), F('유리 색', bsel(GTINT.map(t => [t[0], t[1]]), () => o.gtint || 'clear', v => { o.gtint = v; RB(); })))) : null,
    !isWin && ['swing', 'double', 'slide', 'entrance'].includes(st) ? h('div', { class: 'cg' }, bchk('유리 삽입', () => o.glass, v => { o.glass = v ? 1 : 0; RB(); })) : null,
    isWin ? h('div', { class: 'keep' }, h('h4', {}, '커튼 · 창밖 풍경'),
      G(2, F('커튼·블라인드', bsel(CURT, () => o.cur || 'none', v => { o.cur = v; RB(); renderSel(); })), o.cur && o.cur !== 'none' ? F('커튼 색', bcol(() => o.cc || '#e9e1d3', v => { o.cc = v; RB(); })) : F('', h('span'))),
      F('이 창의 풍경', bsel([['inherit', '방 전체 설정 따름'], ...VIEWS], () => o.view || 'inherit', v => { o.view = v; RB(); }))) : null,
    h('div', { class: 'r keep' }, BTN('복제', dupSel), BTN('카메라 맞춤', focusSel)), h('div', { class: 'r' }, BTN('삭제', delSel)),
    h('p', { class: 'mu sm' }, '3D 화면에서 창호를 드래그하면 벽을 따라 이동하고, 끝을 넘기면 옆 벽으로 옮겨집니다. 창문은 Shift+드래그로 높이 조절.'),
  );
}
function lightPanel(b, l) {
  const RB = () => { mkLight(l); updSelBox(); syncSel(); commitSoon(); renderLights(); }, k = LKIND[l.kind] || LKIND.down, isW = lightIsWall(l);
  app(b,
    h('div', { class: 'lab' }, lightLabel(l)),
    h('div', { class: 'cg keep' }, bchk('잠금 (위치·종류·크기 고정 — 켜기·밝기·색온도는 가능)', () => l.lock, v => setLock({ k: 'light', o: l }, v))),
    G(2, F('종류', bsel(Object.entries(LKIND).map(([a, v]) => [a, v.n]), () => l.kind, v => { const was = lightIsWall(l); l.kind = v; const nk = LKIND[v]; l.w = nk.w; l.d = nk.d; l.drop = nk.drop; if (!was && nk.mt === 'w') { const ne = nearestEdge(l.x, l.z); l.wall = ne ? ne.e.i : 0; l.s = ne ? ne.s : 50; l.y = nk.y < 0 ? R.H + nk.y : nk.y; } if (was && nk.mt !== 'w') { const [x, z] = EP(E[l.wall], l.s, 40); l.x = x; l.z = z; } RB(); renderSel(); })), h('div', { class: 'keep' }, F('켜기/끄기', bsel([['1', '켜짐'], ['0', '꺼짐']], () => l.on === false ? '0' : '1', v => { l.on = v === '1'; RB(); })))),
    h('div', { class: 'keep' }, G(2, F('색온도', bsel(TEMPS, () => l.temp || 3000, v => { l.temp = +v; RB(); })), F('밝기 (0 = 완전 어둡게)', brange(() => l.lum ?? 1, v => { l.lum = v; RB(); }, 0, 2.5, 0.1)))),
    F('기구 색', swatches([['#f2f2f0', '화이트'], ['#2b2b2d', '블랙'], ['#b59a5b', '골드'], ['#b8bcc2', '실버'], ['#a0714f', '우드']], () => l.color || '#f2f2f0', v => { l.color = v; RB(); })),
    isW ? G(3, F('설치 벽', bsel(E.filter(straight).map(e => [e.i, '벽' + (e.i + 1)]), () => l.wall, v => { l.wall = +v; RB(); })), F('벽 왼쪽 끝에서', bnum(() => l.s, v => { l.s = v; placeLight(l); updSelBox(); commitSoon(); })), F('바닥에서 높이', bnum(() => l.y, v => { l.y = v; placeLight(l); updSelBox(); commitSoon(); })))
      : G(3, F('왼쪽에서', bnum(() => l.x - BB.x0, v => { l.x = BB.x0 + v; placeLight(l); updSelBox(); commitSoon(); })), F('뒤에서', bnum(() => l.z - BB.z0, v => { l.z = BB.z0 + v; placeLight(l); updSelBox(); commitSoon(); })), k.rot ? F('각도 (시계°)', bnum(() => cwOf(l), v => { l.rot = norm360(-v); placeLight(l); updSelBox(); commitSoon(); }, { step: 15 })) : F('', h('span'))),
    !isW && k.rot ? rotWidget(l) : null,
    G(3, F(l.kind === 'panel' ? '가로' : '크기·길이', bnum(() => l.w || k.w, v => { l.w = v; RB(); }, { min: 4 })), l.kind === 'panel' ? F('세로', bnum(() => l.d || k.d, v => { l.d = v; RB(); }, { min: 4 })) : null, k.drop != null ? F('천장에서 내림', bnum(() => l.drop ?? k.drop, v => { l.drop = v; RB(); }, { min: 5 })) : null),
    h('div', { class: 'r keep' }, BTN('복제', dupSel), BTN('카메라 맞춤', focusSel)), h('div', { class: 'r' }, BTN('삭제', delSel)),
  );
}
function edgePanel(b, i) {
  const e = E[i]; if (!e) return;
  app(b, h('div', { class: 'lab' }, `벽${i + 1}`), h('div', { class: 'cg keep' }, bchk('방 모양·크기 잠금', () => R.lock, v => setLock({ k: 'edge', i }, v))),
    G(2, F('벽 길이 (cm)', bnum(() => E[i] && E[i].len, v => { if (v < 20) return; editShape(() => { const ee = E[i], n = R.pts.length, nb = [ee.a[0] + ee.u[0] * v, ee.a[1] + ee.u[1] * v], d = [nb[0] - ee.b[0], nb[1] - ee.b[1]]; R.pts[(i + 1) % n] = [r1(nb[0]), r1(nb[1])]; void d; }); }, { min: 20 })),
      F('벽 색', bcol(() => R.wcs[i] || R.wc, v => { R.wcs[i] = v; buildRoom(); }))),
    F('곡선 (볼록 +, 오목 −, cm)', brange(() => R.bul[i] || 0, v => { if (Math.abs(v) < 1) delete R.bul[i]; else R.bul[i] = v; OPS.forEach(o => { if (o.wall === i && Math.abs(v) >= 1) clampOp(o); }); schedRoom(true); commitSoon(); }, -rd(e.len / 2), rd(e.len / 2), 1, v => v + 'cm')),
    h('div', { class: 'r' }, BTN('직선으로', () => { delete R.bul[i]; roomEdited(); renderSel(); }, 'c'), BTN('반원 (볼록)', () => { R.bul[i] = r1(e.len / 2); OPS.forEach(o => { if (o.wall === i) clampOp(o); }); roomEdited(); renderSel(); }, 'c'), BTN('살짝 둥글게', () => { R.bul[i] = r1(e.len * 0.12); OPS.forEach(o => { if (o.wall === i) clampOp(o); }); roomEdited(); renderSel(); }, 'c')),
    h('div', { class: 'r' }, BTN('가운데에 꼭짓점 추가', () => insertVertex(i), 'b'), BTN('창문 추가', () => addOp('win', 'slide', i)), BTN('문 추가', () => addOp('door', 'swing', i))),
    h('p', { class: 'mu sm' }, '벽 바깥 주황 원을 드래그하면 벽 전체가 평행 이동합니다. 곡선 벽에는 창호를 달 수 없습니다.'));
}
function vertPanel(b, j) {
  let cd = 40;
  app(b, h('div', { class: 'lab' }, `꼭짓점${j + 1}`), h('div', { class: 'cg keep' }, bchk('방 모양·크기 잠금', () => R.lock, v => setLock({ k: 'vert', i: j }, v))),
    G(2, F('X (왼쪽에서)', bnum(() => R.pts[j] && R.pts[j][0], v => { editShape(() => { R.pts[j] = [v, R.pts[j][1]]; }); })), F('Z (뒤에서)', bnum(() => R.pts[j] && R.pts[j][1], v => { editShape(() => { R.pts[j] = [R.pts[j][0], v]; }); }))),
    G(2, F('모서리 크기 (cm)', bnum(() => cd, v => { cd = v; }, { min: 5 }))),
    h('div', { class: 'r' }, BTN('모서리 깎기', () => { chamfer(j, cd, false); setSel(null); }, 'b'), BTN('모서리 둥글게', () => { chamfer(j, cd, true); setSel(null); }, 'b'), BTN('꼭짓점 삭제', () => deleteVertex(j))),
    h('p', { class: 'mu sm' }, '파란 점을 드래그해 꼭짓점을 옮기고, 초록 점(벽 가운데)을 누르면 꼭짓점이 추가됩니다.'));
}

// 빠른 도구 막대
function quick() {
  const q = $('qb'); if (!sel) { q.hidden = !MMODE; if (MMODE) { $('qbn').textContent = '☑ 다중 선택 — 가구를 눌러 추가'; q.querySelectorAll('button,input,span.qi').forEach(e => { e.hidden = !['msel', 'none', 'marq'].includes(e.dataset.q); }); q.querySelector('[data-q=msel]').classList.add('on'); } return; } q.hidden = false;
  q.querySelectorAll('button,input,span.qi').forEach(e => { e.hidden = false; });
  q.querySelector('[data-q=msel]').classList.toggle('on', MMODE); q.querySelector('[data-q=marq]').hidden = !(MMODE || isMulti());
  const gb = q.querySelector('[data-q=grp]');
  if (isMulti()) {
    const one = isOneGroup(sel.list);
    $('qbn').textContent = (one ? `⧉ 그룹${sel.list[0].gid} · ` : '☑ ') + `${sel.list.length}개 선택`;
    gb.hidden = false; gb.textContent = one ? '⧉ 그룹 해제' : '⧉ 그룹';
    q.querySelector('[data-q=rot]').hidden = !floorOf(sel.list).length; q.querySelector('[data-q=dup]').hidden = false;
    if (document.activeElement !== $('qbp')) $('qbp').value = 100;
    const lb = q.querySelector('[data-q=lock]'); lb.textContent = isLocked(sel) ? '🔒' : '🔓'; lb.title = isLocked(sel) ? '모두 잠금 해제' : '모두 잠금';
    if (q._last !== sel.list.length) $('qbrot').hidden = true; q._last = sel.list.length;
    return;
  }
  const o = sel.o, it = sel.k === 'item';
  q.querySelector('[data-q=msel]').hidden = !it; gb.hidden = !(it && o.gid); gb.textContent = '⧉ 그룹 선택';
  $('qbn').textContent = it ? `${itemLabel(o)} ${o.name} · ${r1(fpw(o))}×${r1(o.d)}×${r1(o.h)}` : sel.k === 'op' ? `${opLabel(o)} · ${(o.kind === 'win' ? WIN_ST : DOOR_ST).find(s => s[0] === o.st)?.[1] || ''} ${rd(o.w)}×${rd(o.h)}` : sel.k === 'light' ? `${lightLabel(o)} · ${(LKIND[o.kind] || {}).n}` : labelOf(sel);
  q.querySelectorAll('.qi').forEach(e => e.hidden = !it);
  const canRot = (it && o.mt !== 'w') || (sel.k === 'light' && !lightIsWall(o) && (LKIND[o.kind] || {}).rot);
  q.querySelector('[data-q=rot]').hidden = !(canRot || sel.k === 'house');
  if (!canRot || q._last !== o) $('qbrot').hidden = true; q._last = o;
  q.querySelector('[data-q=dup]').hidden = !o;
  if (it && document.activeElement !== $('qbp')) $('qbp').value = rd(pctAll(o));
  const lb = q.querySelector('[data-q=lock]'); lb.hidden = false; lb.textContent = isLocked(sel) ? '🔒' : '🔓'; lb.title = isLocked(sel) ? '잠금 해제' : '잠금 (고정)';
}
$('qb').addEventListener('click', e => {
  const b = e.target.closest('[data-q]'); if (!b || (!sel && !['msel', 'none', 'marq'].includes(b.dataset.q))) return; const a = b.dataset.q, o = sel && sel.o;
  if (a === 'msel') return setMMode(!MMODE);
  if (a === 'marq') return startMarq();
  if (a === 'none') { setMMode(false); return setSel(null); }
  if (a === 'grp') { if (isMulti()) return isOneGroup(sel.list) ? ungroupSel() : groupSel(); if (sel.k === 'item' && sel.o.gid) return selectItems(groupOf(sel.o), sel.o); return; }
  if (isMulti() && (a === 'm' || a === 'p')) return scaleMulti(sel.list, a === 'p' ? 1.05 : 1 / 1.05, PREF.mSpread);
  if (a === 'lock') return setLock(sel, isLocked(sel) ? 0 : 1);
  if (a === 'rot') { const p = $('qbrot'); p.hidden = !p.hidden; if (!p.hidden) { p.replaceChildren(rotWidget(o, true)); } return; }
  if (a === 'dup' || a === 'del' || a === 'edit') $('qbrot').hidden = true;
  if (false) ; else if (a === 'dup') dupSel(); else if (a === 'del') delSel(); else if (a === 'edit') { showTab('sel'); if (mq.matches) setSheet('half'); } else if (a === 'focus') focusSel();
  else if (sel.k === 'item') {
    if (o.lock) return toast('잠긴 가구입니다');
    if (a === 'm') { scaleIt(o, 1 / 1.05); sizeChanged(o); } if (a === 'p') { scaleIt(o, 1.05); sizeChanged(o); }
  }
});
$('qbp').onchange = e => { const v = parseFloat(e.target.value); if (isMulti()) { if (v > 0) scaleMulti(sel.list, v / 100, PREF.mSpread); e.target.value = 100; return; } if (sel && sel.k === 'item' && v > 0 && !sel.o.lock) { scaleIt(sel.o, v / pctAll(sel.o)); sizeChanged(sel.o); } };

// 방·창호 탭
function roomArea() { return Math.abs(polyArea(OL)); }
function updArea() { const el = $('area'); if (el) { const a = roomArea() / 10000; el.textContent = `면적 ${a.toFixed(2)}㎡ (${(a / 3.3058).toFixed(2)}평) · 벽 ${E.length}개 · 외곽 ${R.W}×${R.D}cm`; } }
function renderRoom() {
  const b = $('t-room'); if (b.hidden && b.childElementCount) { b.dataset.dirty = 1; return; } b.innerHTML = '';
  const ws = h('select', {}, E.filter(straight).map(e => h('option', { value: e.i }, `벽${e.i + 1}`))), wst = h('select', {}, WIN_ST.map(([v, t]) => h('option', { value: v }, t)));
  const ds = h('select', {}, E.filter(straight).map(e => h('option', { value: e.i }, `벽${e.i + 1}`))), dst = h('select', {}, DOOR_ST.map(([v, t]) => h('option', { value: v }, t)));
  const rect = isRect(R.pts, R.bul);
  app(b, h('h3', {}, `공간 (${SPACES.length})`), spaceBlock(), refsSection('space'));
  if (R.kind === 'out') { outdoorPanel(b, rect); updArea(); syncSel(); delete b.dataset.dirty; return; }
  app(b,
    h('h3', {}, '방 치수 (cm)'),
    G(3, F(rect ? '가로 (좌↔우)' : '외곽 가로', bnum(() => R.W, v => setRoomDim('W', v), { min: 60 })), F(rect ? '깊이 (뒤↔앞)' : '외곽 깊이', bnum(() => R.D, v => setRoomDim('D', v), { min: 60 })), F('천장 높이', bnum(() => R.H, v => setRoomDim('H', v), { min: 150 }))),
    h('div', { class: 'mu sm', id: 'area' }),
    h('div', { class: 'cg' }, bchk('🔒 방 모양·크기 잠금 (벽 이동·꼭짓점·치수 변경 금지)', () => R.lock, v => setLock({ k: 'edge', i: 0 }, v))),
    h('h3', {}, '방 모양'),
    h('div', { class: 'ch' }, SHAPES.map(([k, n]) => BTN(n, () => { if (!rect && !confirm('방 모양을 바꾸면 현재 꼭짓점 편집이 초기화됩니다. 계속할까요?')) return; applyShape(k); }, 'c'))),
    h('div', { class: 'cg' }, bchk('방 모양 편집 모드 (꼭짓점 드래그·추가·삭제)', () => PREF.shapeEdit, v => { PREF.shapeEdit = v ? 1 : 0; savePref(); buildHandles(); syncTb(); if (v) toast('파란 점: 꼭짓점 이동 · 초록 점: 꼭짓점 추가 · 주황 원: 벽 이동'); }), bchk('벽 이동 핸들 (주황 원)', () => PREF.handles, v => { PREF.handles = v ? 1 : 0; savePref(); buildHandles(); syncTb(); })),
    h('div', { class: 'wl' }, E.map(e => h('button', { class: 'c' + (sel && sel.k === 'edge' && sel.i === e.i ? ' on' : ''), onclick: () => setSel({ k: 'edge', i: e.i }, 'sel') }, `벽${e.i + 1} ${rd(e.len)}${straight(e) ? '' : ' ◠'}`))),
    h('h3', {}, '마감재'),
    F('바닥재', G(2, bsel(FLOORS, () => R.fl, v => { R.fl = v; buildRoom(); commitSoon(); }), bcol(() => R.flc, v => { R.flc = v; buildRoom(); }))),
    h('div', { class: 'sw' }, [['#cdb892', '오크'], ['#e2cfa8', '메이플'], ['#a77b55', '티크'], ['#6b4a35', '월넛'], ['#d8d4cc', '그레이 타일'], ['#f1eee8', '화이트 타일'], ['#9a9894', '콘크리트']].map(([c, n]) => h('button', { class: 'swb', title: n, style: `background:${c}`, onclick: () => { R.flc = c; buildRoom(); syncSel(); commitSoon(); } }))),
    F('마루·타일 결 방향', h('div', { class: 'r' }, [[0, '가로'], [90, '세로'], [45, '대각선 ↗'], [135, '대각선 ↖']].map(([v, t]) => BTN(t, () => { R.fld = v; buildRoom(); commitSoon(); renderRoom(); }, (R.fld || 0) === v ? 'b' : 'c')))),
    F('벽 색 (전체)', swatches([['#f0ede6', '화이트'], ['#f5f1e8', '아이보리'], ['#e9e4dc', '웜그레이'], ['#dfe3e6', '쿨그레이'], ['#d9cbb8', '베이지'], ['#c9d3c4', '세이지'], ['#cfd9e3', '스카이'], ['#3f4652', '네이비']], () => R.wc, v => { R.wc = v; buildRoom(); })),
    F('걸레받이 색', bcol(() => R.bb, v => { R.bb = v; buildRoom(); })),
    h('h3', {}, '창밖 풍경'),
    G(2, F('풍경', bsel(VIEWS, () => R.view || 'city', v => { R.view = v; buildRoom(); commitSoon(); })), F('시간대', bsel(VTIME, () => R.vtime || 'auto', v => { R.vtime = v; buildRoom(); commitSoon(); }))),
    h('h3', {}, '창문·문 추가'),
    G(3, F('창문 종류', wst), F('벽', ws), F(' ', BTN('+ 창문', () => addOp('win', wst.value, +ws.value), 'b'))),
    G(3, F('문 종류', dst), F('벽', ds), F(' ', BTN('+ 문', () => addOp('door', dst.value, +ds.value), 'b'))),
    h('div', { class: 'cg' }, bchk('창문을 클릭해서 선택 (끄면 클릭이 뒤의 가구로 감)', () => PREF.pickWin, v => { PREF.pickWin = v ? 1 : 0; savePref(); syncTb(); onPref('pickWin'); }), bchk('문을 클릭해서 선택', () => PREF.pickDoor, v => { PREF.pickDoor = v ? 1 : 0; savePref(); syncTb(); onPref('pickDoor'); })),
    h('h3', {}, `창호 목록 (${OPS.length})`),
    OPS.length ? h('div', { class: 'r' }, BTN('🔒 창호 모두 잠금', () => { OPS.forEach(o => { o.lock = 1; }); renderRoom(); renderSel(); quick(); commitSoon(0); toast('창문·문을 모두 잠갔습니다'); }, 'c'), BTN('🔓 모두 해제', () => { OPS.forEach(o => { o.lock = 0; }); renderRoom(); renderSel(); quick(); commitSoon(0); }, 'c')) : null,
    h('div', {}, OPS.length ? OPS.map(o => {
      const nm = (o.kind === 'win' ? WIN_ST : DOOR_ST).find(s => s[0] === o.st)?.[1] || o.st, same = OPS.filter(x => x !== o && x.wall === o.wall && Math.abs(x.s - o.s) < (x.w + o.w) / 2 - 0.5);
      const row = h('div', { class: 'it' + (sel && sel.o === o ? ' s' : ''), onclick: () => setSel({ k: 'op', o }, 'sel') }, h('i', { style: `background:${o.kind === 'win' ? '#9ec9ff' : '#e8590c'}` }), h('span', {}, `${opLabel(o)} · ${nm}`), o.lock ? h('em', { class: 'g' }, '🔒') : null, same.length ? h('em', {}, '겹침') : null, h('small', {}, `벽${o.wall + 1} · ${rd(o.w)}×${rd(o.h)}`));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); if (lockGuard({ k: 'op', o })) return; OPS = OPS.filter(q => q !== o); if (sel && sel.o === o) setSel(null); buildRoom(); renderRoom(); upd(); }; row.append(x); return row;
    }) : h('p', { class: 'mu' }, '창호가 없습니다.')),
    h('div', { class: 'cg' }, bchk('문 표시 (끄면 투명)', () => PREF.vdoor, v => { PREF.vdoor = v ? 1 : 0; savePref(); applyVis(); syncTb(); }), bchk('창문 표시', () => PREF.vwin, v => { PREF.vwin = v ? 1 : 0; savePref(); applyVis(); syncTb(); })),
    h('h3', {}, '치수선 표시'),
    h('div', { class: 'cg' }, [['room', '벽 길이'], ['ops', '모든 창호 위치'], ['item', '선택 가구 크기'], ['gap', '주변 간격 (벽·가구까지)']].map(([k, n]) => bchk(n, () => PREF.dims[k], v => { PREF.dims[k] = v ? 1 : 0; savePref(); dims(); }))),
    h('p', { class: 'mu sm' }, '주변 간격이 빨간색이면 통로 폭이 60cm 미만입니다.'),
    MEAS.length ? h('div', { class: 'r' }, BTN(`줄자 측정선 ${MEAS.length}개 지우기`, () => { MEAS = []; dims(); upd(); renderRoom(); })) : null,
  );
  updArea(); syncSel(); delete b.dataset.dirty;
}
const OUT_TIME = [['auto', '자동 (주간/야간 모드)'], ['day', '맑은 낮'], ['cloudy', '흐린 낮'], ['dawn', '새벽·아침'], ['sunset', '노을'], ['night', '밤']];
function outdoorPanel(b, rect) {
  const D0 = ENV_DEF[R.env] || ENV_DEF.field, RB = () => { buildRoom(); commitSoon(); };
  app(b,
    h('h3', {}, '🏠 집·방 배치'), housesBlock(),
    (R.houses || []).length ? h('div', { class: 'r' }, BTN('지붕 모두 없애기 (방 안이 보이게)', () => { R.houses.forEach(x => { x.roof = 'none'; }); buildRoom(); upd(); }, 'c'), BTN('지붕 모두 평지붕', () => { R.houses.forEach(x => { x.roof = 'flat'; }); buildRoom(); upd(); }, 'c')) : null,
    h('h3', {}, '🔗 공간 연결 (붙이기·통로)'), corridorBlock(),
    h('h3', {}, '야외 환경'),
    h('div', { class: 'ch' }, ENVS.map(([k, n]) => BTN(n, () => { R.env = k; R.gk = ENV_DEF[k].g; R.gc = ENV_DEF[k].gc; RB(); renderRoom(); }, 'c' + (R.env === k ? ' on' : '')))),
    G(2, F('지면', bsel(GROUNDS, () => R.gk || D0.g, v => { R.gk = v; RB(); })), F('지면 색', bcol(() => R.gc || D0.gc, v => { R.gc = v; buildRoom(); }))),
    F('시간·날씨', bsel(OUT_TIME, () => R.vtime || 'auto', v => { R.vtime = v; RB(); })),
    h('h3', {}, '배치 영역 (사이트) 크기 cm'),
    G(3, F('가로', bnum(() => R.W, v => setRoomDim('W', v), { min: 100 })), F('깊이', bnum(() => R.D, v => setRoomDim('D', v), { min: 100 })), F('조명 설치 높이', bnum(() => R.H, v => setRoomDim('H', v), { min: 100 }))),
    h('div', { class: 'mu sm', id: 'area' }),
    h('p', { class: 'mu sm' }, '흰 점선 안이 배치 영역입니다. 가장자리 주황 손잡이로 끌어서 넓히거나 줄일 수 있고, 밖으로 나간 가구는 경고가 표시됩니다.'),
    h('div', { class: 'cg' }, bchk('🔒 영역 모양·크기 잠금', () => R.lock, v => setLock({ k: 'edge', i: 0 }, v))),
    h('h3', {}, '영역 모양'),
    h('div', { class: 'ch' }, SHAPES.map(([k, n]) => BTN(n, () => { if (!rect && !confirm('모양을 바꾸면 꼭짓점 편집이 초기화됩니다. 계속할까요?')) return; applyShape(k); }, 'c'))),
    h('div', { class: 'cg' }, bchk('모양 편집 모드 (꼭짓점 드래그·추가·삭제)', () => PREF.shapeEdit, v => { PREF.shapeEdit = v ? 1 : 0; savePref(); buildHandles(); syncTb(); })),
    h('h3', {}, '빠르게 꾸미기'),
    h('div', { class: 'r' }, BTN('🌳 둘레에 나무 심기', () => outdoorDecor('trees'), 'c'), BTN('🪨 바위·덤불 흩뿌리기', () => outdoorDecor('rocks'), 'c'), BTN('🌸 꽃밭 배치', () => outdoorDecor('flowers'), 'c'), BTN('💡 정원등 4개', () => outdoorDecor('lamps'), 'c')),
    h('p', { class: 'mu sm' }, '야외·조경 카테고리(추가 탭)에 나무·바위·파라솔·텐트·아치·데크 등이 있습니다. 창문·문은 실내 공간에서만 쓰입니다.'),
    h('h3', {}, '치수선 표시'),
    h('div', { class: 'cg' }, [['room', '영역 둘레 길이'], ['item', '선택 가구 크기'], ['gap', '주변 간격']].map(([k, n]) => bchk(n, () => PREF.dims[k], v => { PREF.dims[k] = v ? 1 : 0; savePref(); dims(); }))));
}
function outdoorDecor(kind) {
  const add = [], per = (u, k) => { const P = []; const L = 2 * (BB.W + BB.D); for (let i = 0; i < k; i++) { const t = (i + 0.5) / k * L; let x, z; if (t < BB.W) { x = BB.x0 + t; z = BB.z0 + u; } else if (t < BB.W + BB.D) { x = BB.x1 - u; z = BB.z0 + (t - BB.W); } else if (t < 2 * BB.W + BB.D) { x = BB.x1 - (t - BB.W - BB.D); z = BB.z1 - u; } else { x = BB.x0 + u; z = BB.z1 - (t - 2 * BB.W - BB.D); } P.push([x, z]); } return P; };
  let a = 41; const rr = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const TP = { field: '활엽수 (큰 나무) 500', mountain: '소나무 450', forest: '소나무 450', snow: '소나무 450', beach: '야자수 600', sand: '야자수 600', garden: '사이프러스 400', plaza: '사이프러스 400', rooftop: '사이프러스 400' }[R.env] || '활엽수 (큰 나무) 500';
  const tp = findPresetByName(TP), tu = tp ? Math.max(tp.p[1], tp.p[2]) / 2 + 15 : 160;
  if (kind === 'trees') per(tu, Math.max(4, Math.round((BB.W + BB.D) / 450))).forEach(([x, z]) => add.push({ preset: TP, x: x - BB.x0, z: z - BB.z0 }));
  if (kind === 'rocks') for (let i = 0; i < 8; i++) add.push({ preset: i % 2 ? '바위 (큰)' : '관목 (덤불) 120', x: 60 + rr() * (BB.W - 120), z: 60 + rr() * (BB.D - 120) });
  if (kind === 'flowers') per(120, 4).forEach(([x, z]) => add.push({ preset: '꽃밭·화단 200', x: x - BB.x0, z: z - BB.z0 }));
  if (kind === 'lamps') [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]].forEach(([u, v]) => add.push({ preset: '정원등·가로등', x: BB.W * u, z: BB.D * v }));
  runActions(add.map(item => ({ op: 'add', item }))); upd(); toast(`${add.length}개를 배치했습니다`);
}
function renderLights() {
  const b = $('t-light'); if (b.hidden && b.childElementCount) { b.dataset.dirty = 1; return; } b.innerHTML = '';
  const lamps = items.filter(i => LAMPS.has(i.type) || i.lt);
  app(b,
    h('h3', {}, '조명 분위기'),
    h('div', { class: 'r' }, BTN('☀ 주간', () => setNight(0), PREF.night ? 'o' : 'b'), BTN('🌙 야간 (조명 효과 보기)', () => setNight(1), PREF.night ? 'b' : 'o')),
    h('div', { class: 'r' }, BTN('전체 켜기', () => setAllLights({ on: true }), 'c'), BTN('전체 끄기', () => setAllLights({ on: false }), 'c'), BTN('전체 은은하게 (40%)', () => setAllLights({ lum: 0.4, on: true }), 'c'), BTN('전체 밝게', () => setAllLights({ lum: 1.6, on: true }), 'c')),
    LIGHTS.length ? h('div', { class: 'r' }, BTN('🔒 조명 모두 잠금', () => { LIGHTS.forEach(l => { l.lock = 1; }); renderLights(); renderSel(); quick(); commitSoon(0); toast('조명을 모두 잠갔습니다'); }, 'c'), BTN('🔓 모두 해제', () => { LIGHTS.forEach(l => { l.lock = 0; }); renderLights(); renderSel(); quick(); commitSoon(0); }, 'c')) : null,
    h('h3', {}, '천장·벽 조명 추가 (클릭)'),
    h('div', { class: 'ch' }, Object.entries(LKIND).map(([k, v]) => BTN(v.n, () => addLight(k), 'c'))),
    h('p', { class: 'mu sm' }, '가구를 선택한 상태에서 펜던트를 추가하면 그 가구 바로 위에 달립니다. 스탠드는 \'가구 추가 → 스탠드·조명\'에 있습니다.'),
    h('h3', {}, `설치된 조명 (${LIGHTS.length + lamps.length})`),
    h('div', {}, [...LIGHTS.map(l => {
      const row = h('div', { class: 'it' + (sel && sel.o === l ? ' s' : ''), onclick: () => setSel({ k: 'light', o: l }, 'sel') }, h('i', { style: `background:#${kelvin(l.temp).getHexString()};border:1px solid #ccc` }), h('span', {}, `💡 ${lightLabel(l)} · ${(LKIND[l.kind] || {}).n}`), l.lock ? h('em', { class: 'g' }, '🔒') : null, l.on === false || (l.lum ?? 1) === 0 ? h('em', {}, '꺼짐') : null, h('small', {}, `${l.temp}K · ${rd((l.lum ?? 1) * 100)}%`));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); if (lockGuard({ k: 'light', o: l })) return; ltG.remove(l.g); disposeTree(l.g); LIGHTS = LIGHTS.filter(q => q !== l); if (sel && sel.o === l) setSel(null); renderLights(); upd(); }; row.append(x); return row;
    }), ...lamps.map(it => h('div', { class: 'it' + (sel && sel.o === it ? ' s' : ''), onclick: () => setSel({ k: 'item', o: it }, 'sel') }, h('i', { style: `background:${it.color}` }), h('span', {}, `🛋 ${itemLabel(it)} · ${it.name}`), it.on === false ? h('em', {}, '꺼짐') : null, h('small', {}, `${it.temp || 2900}K`)))]),
    h('p', { class: 'mu sm' }, `실시간 광원은 최대 ${MAXL}개(스탠드 포함)까지 계산됩니다.`),
  );
  delete b.dataset.dirty;
}
function setAllLights(set) { LIGHTS.forEach(l => { Object.assign(l, set); mkLight(l); }); items.forEach(i => { if (LAMPS.has(i.type) || i.lt) { if (set.on != null) i.on = set.on; if (set.lum != null) i.lum = set.lum; if (set.temp) i.temp = set.temp; mk(i); } }); applyLightMode(); renderLights(); upd(); }
function setNight(v) { PREF.night = v ? 1 : 0; savePref(); applyLightMode(); buildRoom(); renderLights(); }

// 목록 탭
let listDirty = true;
function markList() { listDirty = true; if (!$('t-list').hidden) renderList(); }
const won = n => (n || 0).toLocaleString('ko-KR') + '원';
function renderList() {
  if (!listDirty && $('t-list').childElementCount) return; listDirty = false;
  const b = $('t-list'); b.innerHTML = '';
  const area = roomArea() || 1, occ = items.filter(i => !i.nc && (i.y || 0) < 1 && i.mt !== 'w').reduce((s, i) => s + fpw(i) * i.d, 0), price = items.reduce((s, i) => s + (+i.price || 0), 0);
  const warn = items.filter(i => i.ov || i.wb || i.db || i.out).length;
  app(b,
    h('div', { class: 'stats' },
      h('div', {}, h('b', {}, `${(area / 10000).toFixed(2)}㎡`), h('small', {}, `${(area / 10000 / 3.3058).toFixed(1)}평`)),
      h('div', {}, h('b', {}, `${items.length}개`), h('small', {}, '가구·소품')),
      h('div', {}, h('b', {}, `${rd(occ / area * 100)}%`), h('small', {}, '바닥 점유율')),
      h('div', {}, h('b', {}, won(price)), h('small', {}, '예상 금액'))),
    warn ? h('p', { class: 'warn' }, `⚠ 확인 필요한 가구 ${warn}개 (겹침 · 창문 가림 · 문 간섭 · 방 밖)`) : null,
    items.length ? h('div', { class: 'r lsel' }, BTN('☑ 전체 선택', () => selectItems(items, items[items.length - 1], 'sel'), 'c'), selItems().length ? BTN(`선택 ${selItems().length}개 편집`, () => showTab('sel'), 'b') : null, selItems().length ? BTN('선택 해제', () => setSel(null), 'c') : null, warn ? BTN('⚠ 문제 있는 것만', () => selectItems(items.filter(i => i.ov || i.wb || i.db || i.out), null, 'sel'), 'c') : null) : null,
    items.length ? h('p', { class: 'mu sm' }, '왼쪽 체크로 여러 개를 고르면 한꺼번에 이동·크기·정렬·그룹·복제할 수 있습니다' + (isMobile() ? '' : ' (Shift+클릭도 가능)')) : null,
    h('div', {}, items.length ? items.map(it => {
      const on = selItems().includes(it), cb = h('input', { type: 'checkbox', class: 'lcb', title: '여러 개 선택', onclick: ev => { ev.stopPropagation(); toggleItem(it); } }); cb.checked = on;
      const d = h('div', { class: 'it' + (on ? ' s' : ''), onclick: ev => { if (ev.shiftKey || ev.ctrlKey || ev.metaKey || MMODE) toggleItem(it); else setSel({ k: 'item', o: it }); }, ondblclick: () => { setSel({ k: 'item', o: it }); focusSel(); } }, cb, h('i', { style: `background:${it.color}` }), h('b', { class: 'tag' }, itemLabel(it)), it.gid ? h('b', { class: 'gtag', title: '그룹' }, '⧉' + it.gid) : null, h('span', {}, it.name));
      if (it.lock) d.append(h('em', { class: 'g' }, '🔒')); if (it.ov) d.append(h('em', {}, '겹침')); if (it.wb) d.append(h('em', {}, '창문 가림')); if (it.db) d.append(h('em', {}, '문 간섭')); if (it.out) d.append(h('em', {}, '방 밖'));
      d.append(h('small', {}, `${r1(fpw(it))}×${r1(it.d)}×${r1(it.h)}` + (it.price ? ` · ${won(it.price)}` : '')));
      const x = h('button', { class: 'x', title: '삭제' }, '×'); x.onclick = ev => { ev.stopPropagation(); setSel({ k: 'item', o: it }); delSel(); }; d.append(x);
      return d;
    }) : h('p', { class: 'mu' }, '가구가 없습니다. \'가구 추가\' 탭에서 추가하세요.')),
    h('div', { class: 'r' }, BTN('CSV(엑셀) 내보내기', exportCSV, 'b'), BTN('평면도 + 목록 인쇄', printPlan)),
  );
}
function exportCSV() {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['번호', '라벨', '이름', '분류', '모델', '재질', '가로', '세로', '높이', '바닥에서', '회전', '왼쪽에서', '뒤에서', '가격', '메모']];
  items.forEach((it, i) => { const b = aabb(it); rows.push([i + 1, itemLabel(it), it.name, (it.pk || '직접입력|').split('|')[0], TYPES[it.type] || it.type, MATN[it.mat || ''] || '', r1(fpw(it)), r1(it.d), r1(it.h), r1(it.y || 0), it.rot || 0, rd(b[0] - BB.x0), rd(b[2] - BB.z0), it.price || 0, it.memo || '']); });
  rows.push([]); rows.push(['', '', '합계', '', '', '', '', '', '', '', '', '', '', items.reduce((s, i) => s + (+i.price || 0), 0), '']);
  rows.push(['', '', `방 외곽 ${R.W}×${R.D}×${R.H}cm · 면적 ${(roomArea() / 10000).toFixed(2)}㎡`]);
  saveFile(fname('가구목록.csv'), '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function planState() { return { ...snap(), items: items.map(i => ({ ...clean(i), fw: fpw(i), label: itemLabel(i) })) }; }
const planCanvas = () => drawPlan(planState(), { title: projName });
function printPlan() {
  const img = planCanvas().toDataURL('image/png'), s3 = shot3D(), pr = $('pr');
  const price = items.reduce((s, i) => s + (+i.price || 0), 0);
  pr.innerHTML = '';
  pr.append(h('h1', {}, projName), h('img', { src: img, class: 'plan' }), h('img', { src: s3, class: 'v3' }),
    h('table', {}, h('thead', {}, h('tr', {}, ['#', '이름', '크기 (가로×세로×높이)', '재질', '가격', '메모'].map(t => h('th', {}, t)))),
      h('tbody', {}, items.map(it => h('tr', {}, [itemLabel(it), it.name, `${r1(fpw(it))}×${r1(it.d)}×${r1(it.h)}`, MATN[it.mat || ''] || '', it.price ? won(it.price) : '', it.memo || ''].map(t => h('td', {}, String(t)))))),
      h('tfoot', {}, h('tr', {}, h('td', { colspan: 4 }, '합계'), h('td', {}, won(price)), h('td', {})))));
  document.body.classList.add('printing');
  setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); }, 300);
}

// 파일·계정 탭
const gLogin = () => { if (!Cloud.enabled) { showTab('file'); if (mq.matches) setSheet('full'); return toast('이 기기는 아직 클라우드 연결 전입니다 — 저장 탭 안내를 따라 한 번만 연결하세요', 6000); } Cloud.loginGoogle().catch(e => toast(e.message, 7000)); };
function renderAccount() {
  const el = $('acct'); if (!el) return; el.innerHTML = '';
  if (Cloud.user) el.append(h('div', { class: 'acct' }, h('span', {}, `☁ ${Cloud.user.email || Cloud.user.displayName || '로그인됨'}`), BTN('로그아웃', () => Cloud.logout(), 'c')));
  else el.append(h('div', { class: 'acct' }, h('span', { class: 'mu' }, '로그인하면 모든 기기에서 이어서 작업'), BTN('Google 로그인', gLogin, 'b')));
  const mb = $('ddacct'); if (mb) mb.textContent = Cloud.user ? '☁ ' + (Cloud.user.email || '로그인됨') : '☁ 로그인';
}
// 현재 프로젝트 저장 상태 + 💾 저장 버튼
function projStatus() {
  const p = PROJ[projName] || {};
  const st = !Cloud.user ? (Cloud.enabled ? '이 기기에만 저장됨 · 로그인하면 클라우드에도 저장' : '이 기기에만 저장됨')
    : syncState === 'saving' || p.dirty ? '클라우드에 올리는 중…'
    : syncState === 'err' ? '⚠ 클라우드 저장 실패 — 다시 저장을 눌러 주세요'
    : p.ct ? `☁ 클라우드에 저장됨 · ${hhmm(p.ct)}` : '아직 클라우드에 저장 안 됨';
  return h('div', { class: 'box savebox' },
    h('div', { class: 'r' }, BTN('💾 저장', saveNow, 'b big'), h('span', { class: 'sm ' + (syncState === 'err' ? 'warn' : 'mu') }, st)),
    h('p', { class: 'mu sm' }, '바꿀 때마다 자동 저장되며, 로그인하면 클라우드에 올라가 다른 기기에서도 실시간으로 반영됩니다. (단축키 Ctrl+S)'));
}
// 저장 탭의 계정 영역: 연결 전 / 로그인 전 / 로그인 후
function loginBlock(cfgTa, em, pw) {
  const emailRow = () => [h('p', { class: 'mu sm' }, '또는 이메일로'), G(2, em, pw),
    h('div', { class: 'r' }, BTN('로그인', () => Cloud.loginEmail(em.value, pw.value).catch(e => toast(e.message, 6000))), BTN('회원가입', () => Cloud.loginEmail(em.value, pw.value, true).catch(e => toast(e.message, 6000))), BTN('비밀번호 재설정', () => Cloud.resetPw(em.value).then(() => toast('메일을 보냈습니다')).catch(e => toast(e.message))))];
  if (!Cloud.enabled) return h('div', { class: 'box login' },
    h('div', { class: 'r' }, BTN('Google 계정으로 로그인', gLogin, 'b dis')),
    h('p', { class: 'warn sm' }, '이 기기(브라우저)에는 아직 클라우드 연결 설정이 없어 로그인할 수 없습니다. 아래 중 한 가지만 한 번 하면 됩니다.'),
    h('ol', { class: 'steps sm' },
      h('li', {}, h('b', {}, '가장 쉬움: '), '이미 연결된 PC에서 저장 탭 → ', h('b', {}, '「📱 다른 기기 연결」'), ' → 나오는 QR 코드를 이 휴대폰 카메라로 찍기'),
      h('li', {}, h('b', {}, '한 번에 모든 기기: '), 'PC에서 「설정 파일 코드 복사」 → 프로젝트의 src/firebase.config.js 에 붙여 넣고 재배포 (또는 Vercel 환경변수 VITE_FIREBASE_*)'),
      h('li', {}, '직접: Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig 를 아래에 붙여 넣기')),
    h('details', {}, h('summary', {}, 'firebaseConfig 직접 붙여 넣기'),
      h('p', { class: 'mu sm' }, `프로젝트 ${Cloud.cfg.projectId} · 데이터베이스 '${Cloud.cfg.databaseId}'`), cfgTa,
      h('div', { class: 'r' }, BTN('설정 저장 후 연결', () => AI.saveFirebase(cfgTa.value), 'b'))),
    Cloud.error && !/없습니다/.test(Cloud.error) ? h('p', { class: 'warn' }, Cloud.error) : null);
  const tools = h('details', {}, h('summary', {}, 'Firebase 설정 변경 · 설정 파일 코드'), cfgTa,
    h('div', { class: 'r' }, BTN('설정 저장 후 다시 연결', () => AI.saveFirebase(cfgTa.value)), BTN('보안 규칙 복사', () => AI.copyRules()), BTN('설정 파일 코드 복사 (firebase.config.js)', () => AI.copyCfgFile())));
  const link = BTN('📱 다른 기기 연결 (QR)', () => AI.openLink());
  if (Cloud.user) return h('div', {}, h('div', { class: 'box' }, h('p', {}, `로그인: ${Cloud.user.email || Cloud.user.displayName}`), h('p', { class: 'mu sm' }, `프로젝트·내 크기·내 가구·AI 키·갤러리가 클라우드(${Cloud.cfg.databaseId})에 자동 저장되고, 다른 기기에서 같은 계정으로 로그인하면 자동으로 불러옵니다.`), h('div', { class: 'r' }, BTN('🔄 클라우드에서 다시 불러오기', () => pullNow(true)), link, BTN('로그아웃', () => Cloud.logout()))), tools);
  return h('div', {}, h('div', { class: 'box login' }, h('div', { class: 'r' }, BTN('Google 계정으로 로그인', gLogin, 'b big')), ...emailRow(), h('div', { class: 'r' }, link)), tools);
}
function renderFile() {
  const b = $('t-file'); if (b.hidden && b.childElementCount) return; b.innerHTML = '';
  const names = Object.keys(PROJ).sort((a, c) => (PROJ[c].t || 0) - (PROJ[a].t || 0));
  const fi = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  fi.onchange = () => { const f = fi.files[0]; if (!f) return; f.text().then(t => importJSON(t, f.name)).catch(() => toast('파일을 읽지 못했습니다')); fi.value = ''; };
  const em = h('input', { type: 'email', placeholder: '이메일', autocomplete: 'email' }), pw = h('input', { type: 'password', placeholder: '비밀번호 (6자 이상)', autocomplete: 'current-password' });
  const cfgTa = h('textarea', { rows: 5, placeholder: 'Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)의 firebaseConfig 코드를 그대로 붙여넣기' });
  app(b,
    h('h3', {}, `💾 저장 — ${projName}`),
    projStatus(),
    h('h3', {}, '☁ 클라우드 계정'),
    loginBlock(cfgTa, em, pw),
    h('h3', {}, '프로젝트'),
    F('현재 프로젝트', bsel(names.map(n => [n, n]), () => projName, v => { if (v !== projName) { openProject(v); } })),
    h('div', { class: 'r' },
      BTN('+ 새 프로젝트', () => { const n = uniq(prompt('새 프로젝트 이름', '새 방') || ''); if (!n) return; const empty = confirm('빈 방으로 시작할까요?\n(취소를 누르면 예시 가구가 들어간 방으로 시작)'); openProject(n, empty ? emptyState() : exampleState()); renderFile(); }, 'b'),
      BTN('다른 이름으로 저장', () => { const n = uniq(prompt('저장할 이름', projName + ' 복사본') || ''); if (!n) return; flush(); const s = snap(); openProject(n, s); renderFile(); toast(`'${n}'(으)로 저장했습니다`); }),
      BTN('이름 변경', () => { const n = (prompt('새 이름', projName) || '').trim(); if (!n || n === projName) return; if (PROJ[n]) return toast('같은 이름이 있습니다'); PROJ[n] = { ...PROJ[projName], ct: undefined, dirty: 1 }; delete PROJ[projName]; if (Cloud.user) { cloudQ[projName] = 1; cloudQ[n] = 1; cloudFlushSoon(); } projName = n; LS.set(K_PROJ, PROJ); LS.set(K_CUR, n); renderFile(); }),
      BTN('삭제', () => { if (Object.keys(PROJ).length <= 1) return toast('마지막 프로젝트는 삭제할 수 없습니다'); if (!confirm(`'${projName}' 프로젝트를 삭제할까요?`)) return; delete PROJ[projName]; if (Cloud.user) { cloudQ[projName] = 0; cloudFlushSoon(); } LS.set(K_PROJ, PROJ); openProject(Object.keys(PROJ)[0]); renderFile(); })),
    h('h3', {}, '파일로 저장·불러오기'),
    h('div', { class: 'r' }, BTN('JSON 파일로 내보내기', exportJSON, 'b'), BTN('JSON 파일 가져오기', () => fi.click()), fi),
    h('h3', {}, '이미지·인쇄'),
    h('div', { class: 'r' }, BTN('3D 화면 PNG', () => saveFile(fname('3D.png'), shot3D(), 'image/png')), BTN('평면도 PNG', () => saveFile(fname('평면도.png'), planCanvas(), 'image/png')), BTN('고화질·여러 각도 캡처 / AI 실사', () => AI.openRender(), 'b'), BTN('평면도 + 목록 인쇄/PDF', printPlan)),
    h('h3', {}, `저장된 내 크기 (${Object.keys(SZ).length})`),
    h('div', { class: 'cg' }, bchk('가구 크기를 바꾸면 다음 추가 시에도 그 크기 사용', () => PREF.remember, v => { PREF.remember = v ? 1 : 0; savePref(); })),
    h('div', {}, Object.keys(SZ).length ? Object.entries(SZ).map(([pk, v]) => { const row = h('div', { class: 'it' }, h('span', {}, pk.split('|')[1]), h('small', {}, `${v.w}×${v.d}×${v.h}`)); const x = h('button', { class: 'x', title: '기본 크기로 되돌리기' }, '×'); x.onclick = () => { delete SZ[pk]; LS.set(K_SZ, SZ); renderCatalog(); renderFile(); cloudSettingsSoon(); }; row.append(x); return row; }) : h('p', { class: 'mu sm' }, '아직 없습니다. 가구 크기를 바꾸면 여기에 기록됩니다.')),
    h('h3', {}, '터치 조작'),
    h('div', { class: 'cg' }, bchk('터치: 먼저 선택한 가구만 끌어서 이동 (실수로 밀림 방지)', () => PREF.touchSafe, v => { PREF.touchSafe = v ? 1 : 0; savePref(); })),
    h('h3', {}, '초기화'),
    h('div', { class: 'r' }, BTN('가구 모두 지우기', () => { if (!confirm('이 프로젝트의 가구를 모두 지울까요? (Ctrl+Z로 되돌릴 수 있음)')) return; items.forEach(i => { fG.remove(i.g); disposeTree(i.g); }); items = []; setSel(null); upd(); }), BTN('예시 상태로 되돌리기', () => { if (!confirm('처음 예시 상태로 되돌릴까요? (Ctrl+Z로 되돌릴 수 있음)')) return; load(exampleState()); upd(); fitView(); })),
  );
  syncSel();
}
function uniq(n) { n = n.trim(); if (!n) return ''; let k = n, i = 2; while (PROJ[k]) k = `${n} (${i++})`; return k; }
function exportJSON() { flush(); saveFile(fname('배치.json'), JSON.stringify({ app: 'room3d', v: 3, name: projName, state: snap(), sizes: SZ, custom: CUSTOM, cats: LIB.cats, ren: LIB.ren }, null, 1), 'application/json'); }
function importJSON(t, fn) {
  let d; try { d = JSON.parse(t); } catch (e) { return toast('JSON 형식이 아닙니다'); }
  let st = d.state; if (!st && d.R && Array.isArray(d.items)) st = d.R.wz != null ? migrateV1(d) : d;
  if (!st) return toast('배치 파일이 아닙니다');
  if (d.sizes) { SZ = { ...SZ, ...d.sizes }; LS.set(K_SZ, SZ); }
  if (Array.isArray(d.cats)) d.cats.forEach(c => { if (c && c.id && !LIB.cats.some(x => x.id === c.id)) LIB.cats.push({ id: c.id, name: c.name }); });
  if (Array.isArray(d.custom)) { d.custom.forEach(p => { if (!CUSTOM.some(c => c[0] === p[0])) CUSTOM.push(p); }); libChanged(); }
  const n = uniq(d.name || fn.replace(/\.json$/i, '') || '가져온 방'); openProject(n, st); renderCatalog(); renderFile(); cloudSettingsSoon(); toast(`'${n}'을(를) 불러왔습니다`);
}

// ---------- 툴바 ----------
const TBK = [['pickWin', '창문 클릭해서 선택'], ['pickDoor', '문 클릭해서 선택'], ['pickLight', '조명 클릭해서 선택'], ['site', '옆 공간·야외 배경 함께 보기'], ['snap', '스냅·벽/가구 붙이기'], ['handles', '벽 이동 핸들'], ['shapeEdit', '방 모양 편집 (꼭짓점)'], ['labels', '라벨 (책장1 등)'], ['ceil', '천장 표시'], ['vdoor', '문 표시'], ['vwin', '창문 표시'], ['stack', '소품 위에 올리기'], ['touchSafe', '터치: 선택 후 이동']];
$('spcPill').onclick = () => spaceMenu();
function spaceMenu() {
  const body = h('div', {});
  app(body, h('div', { class: 'spl' }, SPACES.map(sp => h('button', { class: 'it' + (sp.id === SPID ? ' s' : ''), type: 'button', onclick: () => { m.close(); switchSpace(sp.id); } }, h('span', {}, (sp.kind === 'out' ? '🌳 ' : '🏠 ') + sp.name), sp.id === SPID ? h('small', {}, '현재') : null))),
    h('div', { class: 'r' }, BTN('🏘 모든 공간 함께 보기', () => { m.close(); goOverview(); }, 'b'), BTN('＋ 방 추가', () => { m.close(); addSpaceDlg('room'); }, 'b'), BTN('＋ 야외 추가', () => { m.close(); addSpaceDlg('out'); }, 'b'), BTN('📷 사진·도면으로', () => { m.close(); AI.openPhoto('room'); }, 'o')),
    h('div', { class: 'r' }, BTN('공간 설정 열기', () => { m.close(); showTab('room'); if (mq.matches) setSheet('half'); }, 'c')));
  const m = mdl('공간 — ' + projName, body);
}
$('ddm').append(h('div', { class: 'ddb' },
  h('button', { id: 'ddspc', type: 'button', class: 'o', onclick: () => { $('dd').open = false; spaceMenu(); } }, '🏠 공간'),
  h('button', { id: 'ddacct', type: 'button', class: 'b', onclick: () => { $('dd').open = false; if (Cloud.user) { showTab('file'); if (mq.matches) setSheet('half'); } else gLogin(); } }, '☁ 로그인'),
  h('button', { type: 'button', class: 'o', onclick: () => { $('dd').open = false; setMMode(true); } }, '☑ 여러 개 선택 모드'),
  h('button', { type: 'button', class: 'o', onclick: () => { $('dd').open = false; startMarq(); } }, '▭ 영역으로 선택'),
  h('button', { type: 'button', class: 'o', onclick: () => { $('dd').open = false; if (items.length) selectItems(items, items[items.length - 1], 'sel'); } }, '◼ 가구 전체 선택'),
  h('button', { type: 'button', class: 'o', onclick: () => { $('dd').open = false; saveFile(fname('3D.png'), shot3D(), 'image/png'); } }, '📷 3D 화면 저장'),
  h('button', { type: 'button', class: 'o', onclick: () => { $('dd').open = false; saveFile(fname('평면도.png'), planCanvas(), 'image/png'); } }, '🗺 평면도 저장')));
$('ddm').append(...TBK.map(([k, n]) => { const i = h('input', { type: 'checkbox', 'data-k': k }); i.onchange = () => { PREF[k] = i.checked ? 1 : 0; savePref(); onPref(k); }; return h('label', {}, i, ' ' + n); }));
$('dd').addEventListener('toggle', () => { const m = $('ddm'); m.style.left = ''; m.style.right = ''; if (!$('dd').open || mq.matches) return; requestAnimationFrame(() => { const r = m.getBoundingClientRect(); if (r.right > innerWidth - 8) { m.style.left = 'auto'; m.style.right = '0'; } }); });
document.addEventListener('pointerdown', e => { const d = $('dd'); if (d.open && !d.contains(e.target)) d.open = false; });
function syncTb() { document.querySelectorAll('#ddm input').forEach(i => { i.checked = !!PREF[i.dataset.k]; }); }
function onPref(k) {
  if (k === 'handles' || k === 'shapeEdit') buildHandles(); else if (k === 'labels') items.forEach(mk); else if (k === 'ceil') roomG.children.forEach(c => { if (c.userData.ceil) c.visible = !!PREF.ceil; });
  else if (k === 'vdoor' || k === 'vwin') applyVis();
  else if (k === 'site') { buildSiteView(); applyLightMode(); }
  else if (/^pick/.test(k)) { if (!PREF[k] && sel && ((k === 'pickWin' && sel.k === 'op' && sel.o.kind === 'win') || (k === 'pickDoor' && sel.k === 'op' && sel.o.kind === 'door') || (k === 'pickLight' && sel.k === 'light'))) setSel(null); renderRoom(); toast(PREF[k] ? `${({ pickWin: '창문', pickDoor: '문', pickLight: '조명' })[k]}을(를) 다시 클릭해서 선택할 수 있습니다` : `${({ pickWin: '창문', pickDoor: '문', pickLight: '조명' })[k]}은(는) 클릭해도 선택되지 않습니다 — 뒤에 있는 가구가 선택됩니다 (목록에서는 선택 가능)`, 4000); }
  syncSel();
}
function closeMenus() { document.querySelectorAll('details.menu[open]').forEach(d => { d.open = false; }); }
function setMode(m) { mode = m; mzTemp = null; $('mz').classList.toggle('on', m === 'measure'); cv.style.cursor = m === 'measure' ? 'crosshair' : 'default'; $('hint').textContent = m === 'measure' ? '줄자: 바닥의 두 점을 차례로 누르세요 · Esc 종료' : HINT; if (m === 'measure') toast('줄자: 바닥의 두 점을 차례로 누르세요'); dims(); }
$('mz').onclick = () => { setMode(mode === 'measure' ? null : 'measure'); closeMenus(); };
$('night').onclick = () => { setNight(PREF.night ? 0 : 1); closeMenus(); };
$('shot').onclick = () => { saveFile(fname('3D.png'), shot3D(), 'image/png'); closeMenus(); };
$('undo').onclick = undo; $('redo').onclick = redo;
$('fabAdd').onclick = () => { showTab('add'); setSheet('half'); setTimeout(() => $('q').focus({ preventScroll: true }), 300); };
$('fabAI').onclick = () => { showTab('ai'); setSheet('half'); };
$('fabCam').onclick = () => AI.openPhoto('furniture');
const HINT = 'Shift+클릭: 여러 개 선택 · Shift+빈 곳 드래그: 영역 선택 · Ctrl+A 전체 · Ctrl+G 그룹 · 드래그: 이동 · 빈 곳 드래그: 회전 · 우클릭 드래그: 이동 · 휠: 확대 · 파란 점/주황 화살표: 크기 · R/Shift+R 시계·반시계 90° · Q/E 45° · Del 삭제 · Ctrl+Z 되돌리기 · 더블클릭: 확대';
$('hint').textContent = HINT;
document.addEventListener('click', e => { document.querySelectorAll('details.menu[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; }); });

// ---------- AI 연결용 API ----------
const typeKeys = Object.keys(TYPES);
function resolveItems(t) {
  if (t == null) return [];
  if (Array.isArray(t)) return [...new Set(t.flatMap(resolveItems))];
  if (t === 'all' || t === '전체') return [...items];
  const s = String(t).trim(), q = s.replace(/\s/g, '').toLowerCase(), idm = /^#?(\d+)$/.exec(s);
  let r = items.filter(i => itemLabel(i).toLowerCase() === q);
  if (!r.length && idm) r = items.filter(i => i.id === +idm[1]);
  if (!r.length) r = items.filter(i => i.name.replace(/\s/g, '').toLowerCase() === q);
  if (!r.length && /^group:/.test(s)) r = items.filter(i => grp(i.type) === s.slice(6));
  if (!r.length) r = items.filter(i => i.name.replace(/\s/g, '').toLowerCase().includes(q));
  return r;
}
function resolveLights(t) {
  if (t == null) return [];
  if (Array.isArray(t)) return [...new Set(t.flatMap(resolveLights))];
  if (t === 'all' || t === '전체') return [...LIGHTS, ...items.filter(i => LAMPS.has(i.type) || i.lt)];
  const s = String(t).replace(/\s/g, ''), m = /^조명(\d+)$/.exec(s) || /^(\d+)$/.exec(s);
  if (m) return LIGHTS.filter(l => l.no === +m[1]);
  return resolveItems(t).filter(i => LAMPS.has(i.type) || i.lt);
}
function resolveOps(t) { if (Array.isArray(t)) return t.flatMap(resolveOps); const s = String(t || '').replace(/\s/g, ''); return OPS.filter(o => opLabel(o) === s || String(o.id) === s.replace('#', '')); }
function wallIdx(w) { if (w == null) return undefined; if (typeof w === 'number') return clamp(Math.round(w), 0, E.length - 1); const m = /(\d+)/.exec(String(w)); if (m) return clamp(+m[1] - 1, 0, E.length - 1); const map = { N: 0, E: 1, S: 2, W: 3, 뒷벽: 0, 오른쪽: 1, 앞벽: 2, 왼쪽: 3 }; for (const k in map) if (String(w).includes(k)) return Math.min(map[k], E.length - 1); return undefined; }
const ITEM_KEYS = ['gid', 'body', 'desc', 'refs', 'refUse', 'face', 'skin', 'rp', 'rs', 'rpsc', 'rugImg', 'rugFit', 'name', 'type', 'w', 'd', 'h', 'color', 'c2', 'mat', 'mat2', 'x', 'z', 'y', 'rot', 'mt', 'n', 'cpat', 'pv', 'lock', 'price', 'memo', 'sex', 'outfit', 'skin', 'hair', 'hs', 'shoe', 'pose', 'veil', 'on', 'lum', 'temp', 'fold', 'nc', 'sk', 'wall', 'ws', 'glasses', 'flower', 'bouquet', 'tie', 'glassC', 'c3', 'sleeve', 'tieT', 'skirtL', 'shw', 'build', 'headS', 'fsz', 'fzoom', 'fox', 'foy', 'hv', 'bangs', 'aL', 'aR', 'zL', 'zR', 'eL', 'eR', 'yaw', 'sit', 'face', 'leg'];
function applySet(it, set) {
  ITEM_KEYS.forEach(k => { if (set[k] !== undefined && set[k] !== null) it[k] = set[k]; });
  if (set.type && !TYPES[set.type]) it.type = 'box';
  if (set.mt === 'f') delete it.mt;
  if (set.x !== undefined) it.x = BB.x0 + +set.x; if (set.z !== undefined) it.z = BB.z0 + +set.z;
  if (set.wall !== undefined) it.wall = wallIdx(set.wall);
  if (set.scale) { scaleIt(it, +set.scale); }
  if (set.dx) it.x += +set.dx; if (set.dz) it.z += +set.dz; if (set.drot) it.rot = norm360((it.rot || 0) + +set.drot);
  if (set.cpat) it.cpat = String(set.cpat).toUpperCase().replace(/[^A-Z0-9]/g, '');
  ['w', 'd', 'h'].forEach(k => { it[k] = Math.max(1, +it[k] || 1); });
  if (set.w != null && !it.bw) it.bw = it.w; if (set.d != null && !it.bd) it.bd = it.d; if (set.h != null && !it.bh) it.bh = it.h;
  ensureNo(it, items, x => grp(x.type));
}
function specToItem(spec) {
  let it;
  const pr = spec.preset ? findPresetByName(spec.preset) : null;
  if (pr) it = presetItem(pr.pk, pr.p).it; else it = newItem({ name: spec.name || TYPES[spec.type] || '새 가구', type: TYPES[spec.type] ? spec.type : 'box', w: 60, d: 60, h: 60, color: '#b0a090' });
  const pos = spec.x != null && spec.z != null;
  applySet(it, { ...spec, x: undefined, z: undefined });
  it.bw = it.bw || it.w; it.bd = it.bd || it.d; it.bh = it.bh || it.h;
  if (!pr) { it.bw = it.w; it.bd = it.d; it.bh = it.h; }
  if (LAMPS.has(it.type)) { it.lt = 1; if (it.on == null) it.on = true; }
  if (pos) { it.x = BB.x0 + +spec.x; it.z = BB.z0 + +spec.z; }
  return { it, pos };
}
function runActions(actions = []) {
  const log = [];
  for (const a of actions) {
    try {
      const op = a.op || a.action;
      if (op === 'add') { const { it, pos } = specToItem(a.item || a); placeNew(it, pos); if (it.mt === 'w' && a.item && a.item.wall != null) { it.wall = wallIdx(a.item.wall); it.ws = a.item.ws ?? E[it.wall].len / 2; fit(it, false); } log.push(`➕ ${itemLabel(it)} ${it.name} 추가`); }
      else if (op === 'update' || op === 'move' || op === 'modify') { const ts = resolveItems(a.target ?? a.targets); if (!ts.length) { log.push(`⚠ 대상 '${a.target}' 없음`); continue; } const st0 = a.set || a, unlock = st0.lock === 0 || st0.lock === false, ok = ts.filter(it => !it.lock || unlock), sk = ts.filter(it => !ok.includes(it)); ok.forEach(it => { applySet(it, st0); mk(it); fit(it, false); }); if (ok.length) log.push(`✏️ ${ok.map(itemLabel).join(', ')} 변경`); if (sk.length) log.push(`🔒 ${sk.map(itemLabel).join(', ')} 잠김 — 변경 안 함`); }
      else if (['group', 'ungroup', 'align', 'distribute', 'mirror', 'rotateGroup', 'moveGroup', 'select'].includes(op)) {
        const ts = resolveItems(a.target ?? a.targets); if (!ts.length) { log.push(`⚠ 대상 '${a.target}' 없음`); continue; }
        if (op === 'group') { const g = nextGid(); ts.forEach(o => { o.gid = g; }); log.push(`⧉ ${ts.length}개를 그룹${g}(으)로 묶음`); }
        else if (op === 'ungroup') { ts.forEach(o => { delete o.gid; }); log.push(`그룹 해제 ${ts.length}개`); }
        else if (op === 'align') { alignMulti(ts, a.how || 'cx'); log.push(`↔ ${ts.length}개 정렬`); }
        else if (op === 'distribute') { distMulti(ts, a.axis === 'z' ? 'z' : 'x', a.gap == null ? null : +a.gap); log.push(`${ts.length}개 간격 정리`); }
        else if (op === 'mirror') { mirrorMulti(ts, a.axis === 'z' ? 'z' : 'x'); log.push(`${ts.length}개 반전`); }
        else if (op === 'rotateGroup') { rotMulti(ts, -(+a.cw || +a.deg || 90), !!a.each); log.push(`⟳ ${ts.length}개 회전`); }
        else if (op === 'moveGroup') { moveMulti(ts, +a.dx || 0, +a.dz || 0); log.push(`${ts.length}개 이동`); }
        if (op === 'select' || op === 'group') selectItems(ts, ts[ts.length - 1]);
      }
      else if (op === 'delete' || op === 'remove') { const ts = resolveItems(a.target ?? a.targets), ok = ts.filter(it => !it.lock); ok.forEach(it => delObj({ k: 'item', o: it })); log.push(`🗑 ${ok.length}개 삭제`); if (ok.length < ts.length) log.push(`🔒 잠긴 ${ts.length - ok.length}개는 삭제 안 함`); }
      else if (op === 'light' || op === 'lights') {
        const ts = resolveLights(a.targets ?? a.target ?? 'all'), set = a.set || {};
        ts.forEach(l => { (l.lock && set.lock !== 0 && set.lock !== false ? ['on', 'lum', 'temp'] : ['on', 'lum', 'temp', 'color', 'w', 'drop', 'kind', 'lock']).forEach(k => { if (set[k] != null) l[k] = set[k]; }); if (set.lum === 0) l.on = l.on; if (l.g && LIGHTS.includes(l)) mkLight(l); else mk(l); });
        applyLightMode(); log.push(`💡 ${ts.length}개 조명 변경`);
      }
      else if (op === 'addLight') { const L = a.light || a; const x = { ...L }; delete x.op; if (x.x != null) x.x = BB.x0 + +x.x; if (x.z != null) x.z = BB.z0 + +x.z; if (x.wall != null) x.wall = wallIdx(x.wall); const l = addLight(L.kind || 'down', x); log.push(`💡 ${lightLabel(l)} 추가`); }
      else if (op === 'deleteLight') { const ts = resolveLights(a.targets ?? a.target).filter(l => LIGHTS.includes(l) && !l.lock); ts.forEach(l => delObj({ k: 'light', o: l })); log.push(`🗑 조명 ${ts.length}개 삭제`); }
      else if (op === 'room') {
        const s = a.set || a;
        if (s.lock != null) R.lock = s.lock ? 1 : 0;
        if (R.lock && (s.shape || s.W || s.D || s.H)) log.push('🔒 방 모양·크기가 잠겨 있어 치수는 바꾸지 않음');
        if (s.shape && SHAPES.some(x => x[0] === s.shape)) applyShape(s.shape);
        if (s.W) setRoomDim('W', +s.W); if (s.D) setRoomDim('D', +s.D); if (s.H) setRoomDim('H', +s.H);
        ['fl', 'flc', 'fld', 'wc', 'bb', 'view', 'vtime', 'env', 'gk', 'gc', 'desc'].forEach(k => { if (s[k] != null) R[k] = s[k]; }); if (s.env && ENV_DEF[s.env] && s.gk == null) { R.gk = ENV_DEF[s.env].g; R.gc = s.gc || ENV_DEF[s.env].gc; }
        if (s.wallColors) Object.entries(s.wallColors).forEach(([k, v]) => { const i = wallIdx(k); if (i != null) R.wcs[i] = v; });
        buildRoom(); log.push('🏠 방 설정 변경');
      }
      else if (op === 'addOpening') { const o = a.opening || a; const ex = {}; ['w', 'h', 'y', 's', 'fc', 'dc', 'hinge', 'sw', 'ang', 'open', 'wo', 'cur', 'cc', 'glass', 'view'].forEach(k => { if (o[k] != null) ex[k] = o[k]; }); const r = addOp(o.kind === 'door' ? 'door' : 'win', o.st || (o.kind === 'door' ? 'swing' : 'slide'), wallIdx(o.wall) ?? 0, ex); if (r) log.push(`🪟 ${opLabel(r)} 추가`); }
      else if (op === 'updateOpening') { const ts = resolveOps(a.target ?? a.targets), s = a.set || {}; ts.forEach(o => { const lk = o.lock && s.lock !== 0 && s.lock !== false; (lk ? ['ang', 'open', 'wo', 'cur', 'cc', 'view'] : ['w', 'h', 'y', 's', 'st', 'fc', 'dc', 'hinge', 'sw', 'ang', 'open', 'wo', 'cur', 'cc', 'glass', 'view', 'lock']).forEach(k => { if (s[k] != null) o[k] = s[k]; }); if (s.wall != null && !lk) o.wall = wallIdx(s.wall); clampOp(o); }); buildRoom(); log.push(`🪟 ${ts.map(opLabel).join(', ')} 변경`); }
      else if (op === 'deleteOpening') { const ts = resolveOps(a.target ?? a.targets).filter(o => !o.lock); OPS = OPS.filter(o => !ts.includes(o)); buildRoom(); log.push(`🗑 창호 ${ts.length}개 삭제`); }
      else if (op === 'addSpace' || op === 'space') {
        const kind = a.kind === 'outdoor' || a.kind === 'out' || a.env ? 'out' : 'room', W = +a.W || (kind === 'out' ? 1200 : 350), D = +a.D || (kind === 'out' ? 1000 : 330);
        const st = kind === 'out' ? outdoorState(ENV_DEF[a.env] ? a.env : 'field', W, D) : roomState(W, D, +a.H || 230);
        const roomsNow = SPACES.filter(x => x.kind !== 'out').map(x => x.id);
        addSpace(a.name || (kind === 'out' ? '야외' : '방'), st); log.push(`＋ 공간 '${a.name || ''}' 추가 (${kind === 'out' ? '야외' : '방'})`);
        if (kind === 'out' && a.house !== false && roomsNow.length) { placeHouses(roomsNow); log.push(`🏠 집(방 ${roomsNow.length}개)을 야외에 배치`); }
      }
      else if (op === 'overview') { goOverview(); log.push('🏘 모든 공간 함께 보기'); }
      else if (op === 'switchSpace') { const sp = SPACES.find(x => x.name === a.name || x.id === a.id); if (sp) { switchSpace(sp.id); log.push(`→ '${sp.name}'(으)로 이동`); } else log.push(`⚠ 공간 '${a.name}' 없음`); }
      else if (op === 'night') { setNight(a.value ? 1 : 0); log.push(a.value ? '🌙 야간 모드' : '☀ 주간 모드'); }
      else if (op === 'view') { view(a.value || 'iso'); }
      else if (op === 'clearItems') { items.forEach(i => { fG.remove(i.g); disposeTree(i.g); }); items = []; log.push('🗑 가구 모두 삭제'); }
      else if (op === 'render') { AI.openRender(a); log.push('🎨 실사 렌더 창을 열었습니다'); }
    } catch (e) { log.push('⚠ ' + (a.op || '') + ': ' + e.message); }
  }
  setSel(sel && sel.o && (items.includes(sel.o) || OPS.includes(sel.o) || LIGHTS.includes(sel.o)) ? sel : null);
  renderRoom(); renderLights(); upd(); commitSoon(0);
  return log;
}
function describe() {
  const P1 = v => rd(v);
  const spc = SPACES.find(x => x.id === SPID) || {};
  return {
    space: { name: spc.name, kind: R.kind === 'out' ? 'outdoor' : 'room', env: R.env, envName: R.kind === 'out' ? (ENVS.find(e => e[0] === R.env) || [])[1] : undefined, ground: R.kind === 'out' ? (GROUNDS.find(g => g[0] === (R.gk || (ENV_DEF[R.env] || {}).g)) || [])[1] : undefined, groundColor: R.gc, time: vtimeNow(), desc: R.desc },
    spaces: SPACES.map(x => ({ name: x.name, kind: x.kind === 'out' ? 'outdoor' : 'room', current: x.id === SPID })),
    houses: R.kind === 'out' ? (R.houses || []).filter(x => x.g).map(x => ({ room: x._name, w: rd(x._w), d: rd(x._d), h: rd(x._h), x: rd(x.x - BB.x0), z: rd(x.z - BB.z0), rot: x.rot || 0, roof: x.roof || 'flat' })) : undefined,
    unit: 'cm', coord: 'x=왼쪽 외곽에서 가구 중심까지, z=뒤쪽 외곽에서 가구 중심까지, rot=반시계 회전(도, 위에서 볼 때). 시계방향 N° 회전은 drot:-N, 반시계 N°는 drot:N. 벽 번호는 1부터.',
    room: { W: R.W, D: R.D, H: R.H, locked: !!R.lock, shape: isRect(R.pts, R.bul) ? 'rect' : 'custom', area_m2: +(roomArea() / 10000).toFixed(2), floor: { type: R.fl, color: R.flc, dir: R.fld || 0 }, wallColor: R.wc, outsideView: R.view, viewTime: R.vtime, night: !!PREF.night, walls: E.map(e => ({ label: '벽' + (e.i + 1), from: e.a.map(P1), to: e.b.map(P1), len: P1(e.len), curved: !straight(e), color: R.wcs[e.i] || R.wc })) },
    items: items.map(i => ({ desc: i.desc || (i.type === 'rug' || i.type === 'rugR' ? (i.rugImg ? 'rug with EXACTLY the pattern of its reference photo' : rugDesc(i)) : undefined), body: i.body, refs: (i.refs || []).length || undefined, label: itemLabel(i), id: i.id, name: i.name, type: i.type, w: i.w, d: i.d, h: i.h, x: P1(i.x - BB.x0), z: P1(i.z - BB.z0), y: P1(i.y || 0), rot: i.rot || 0, color: i.color, c2: i.c2, mat: i.mat || '', mat2: i.mat2 || '', mt: i.mt || 'f', wall: i.mt === 'w' ? '벽' + ((i.wall ?? 0) + 1) : undefined, n: i.n, cpat: COLSTY[i.type] ? colPat(i, fpw(i)) : undefined, pv: i.pv, lock: i.lock ? true : undefined, sex: i.sex, outfit: i.outfit, on: LAMPS.has(i.type) ? i.on !== false : undefined, lum: LAMPS.has(i.type) ? (i.lum ?? 0.8) : undefined, warn: [i.ov && '겹침', i.wb && '창문가림', i.db && '문간섭', i.out && '방밖'].filter(Boolean).join(',') || undefined })),
    lights: LIGHTS.map(l => ({ label: lightLabel(l), kind: l.kind, kindName: (LKIND[l.kind] || {}).n, x: l.x != null && !lightIsWall(l) ? P1(l.x - BB.x0) : undefined, z: l.z != null && !lightIsWall(l) ? P1(l.z - BB.z0) : undefined, wall: lightIsWall(l) ? '벽' + (l.wall + 1) : undefined, on: l.on !== false, lum: l.lum ?? 1, temp: l.temp, lock: l.lock ? true : undefined })),
    openings: OPS.map(o => ({ label: opLabel(o), kind: o.kind, st: o.st, stName: (o.kind === 'win' ? WIN_ST : DOOR_ST).find(s => s[0] === o.st)?.[1], wall: '벽' + (o.wall + 1), s: P1(o.s), w: o.w, h: o.h, y: o.y, open: o.st === 'jung3' ? o.open || 0 : o.kind === 'win' ? o.wo || 0 : o.ang || 0, curtain: o.cur, lock: o.lock ? true : undefined })),
  };
}
const API = {
  get items() { return items; }, get lights() { return LIGHTS; }, get ops() { return OPS; }, get R() { return R; }, get E() { return E; }, get sel() { return sel; }, get projName() { return projName; }, get night() { return !!PREF.night; },
  CAT, TYPES, MATS, LKIND, WIN_ST, DOOR_ST, SHAPES, COLSTY, OUTFITS, HAIRS, POSES, VIEWS, FLOORS,
  describe, runActions, captureView, captureGuide, layoutText, itemBox, notify, askNotifyPerm, planCanvas, shot3D, toast, saveFile, fname, showTab, setSheet, h, BTN, F, G, app, isMobile,
  itemLabel, lightLabel, opLabel, grp, addPreset, placeNew, newItem, specToItem, saveCustom, saveLibDialog, renderCatalog, commit: () => commitSoon(0), selectItem: it => selectItems([it], it),
  newSpace({ kind, env, W, D, H, name, house = true }) { const out = kind === 'outdoor' || kind === 'out'; const st = out ? outdoorState(ENV_DEF[env] ? env : 'field', +W || 1200, +D || 1000) : roomState(+W || 350, +D || 330, +H || 230); const rooms = SPACES.filter(x => x.kind !== 'out').map(x => x.id); const id = addSpace(name || (out ? '야외' : '방'), st); if (out && house && rooms.length) placeHouses(rooms); return id; },
  applyRoomSpec(spec) {
    const pts = Array.isArray(spec.pts) && spec.pts.length >= 3 && spec.pts.every(p => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1])) ? spec.pts.map(p => [+p[0], +p[1]]) : null;
    if (pts) { R.pts = orient(pts); R.bul = {}; normalizeRoom(); geo(); spec = { ...spec, W: 0, D: 0 }; }
    ['fl', 'flc', 'wc', 'bb', 'view', 'vtime', 'env', 'gk', 'gc', 'desc'].forEach(k => { if (spec[k] != null && spec[k] !== '') R[k] = spec[k]; });
    if (spec.env && ENV_DEF[spec.env] && !spec.gk) { R.gk = ENV_DEF[spec.env].g; if (!spec.gc) R.gc = ENV_DEF[spec.env].gc; }
    if (spec.W || spec.D) { if (spec.shape && SHAPES.some(x => x[0] === spec.shape)) { R.pts = shapePreset(spec.shape, +spec.W || R.W, +spec.D || R.D).pts; R.bul = {}; geo(); } else { R.pts = RECT(+spec.W || R.W, +spec.D || R.D); R.bul = {}; geo(); } }
    if (spec.H) R.H = +spec.H;
    if (Array.isArray(spec.openings)) { OPS = []; buildRoom(); spec.openings.forEach(o => runActions([{ op: 'addOpening', opening: o }])); }
    buildRoom(); items.forEach(i => fit(i, false)); LIGHTS.forEach(placeLight); renderRoom(); upd(); fitView();
  },
  floorName: k => (FLOORS.find(f => f[0] === k) || [])[1], matName: k => MATN[k || ''] || '',
  LS, cloudSettingsSoon, onLogin, renderFile, renderAccount, renderRoom, renderSel,
};
const AI = initAI(API);
window.__room3d = Object.defineProperties(Object.create(API), Object.getOwnPropertyDescriptors({ scene, THREE, get cam() { return cam; }, scr(x, y, z) { const v = new THREE.Vector3(x, y, z).project(cam), r = cv.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, get SZ() { return SZ; }, get LIB() { return LIB; }, get CUSTOM() { return CUSTOM; }, catManager, libItemDialog, addOp, addLight, setSel, view, undo, redo, setRoom: setRoomDim, applyShape, insertVertex, chamfer, drawPlan: planCanvas }));

// ---------- 시작 ----------
window.addEventListener('beforeunload', () => { flush(); cloudFlush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { flush(); cloudFlush(); } });
(function init() {
  if (!Object.keys(PROJ).length) { const v1 = LS.get('roomLayoutV1', null); PROJ['내 방'] = { t: Date.now(), s: v1 && v1.R ? migrateV1(v1) : exampleState() }; }
  let cur = LS.get(K_CUR, null); if (!cur || !PROJ[cur]) cur = Object.keys(PROJ)[0];
  syncTb(); renderCatalog(); layout(); rsz(); initHScroll();
  showTab(PREF.tab === 'sel' ? 'add' : PREF.tab || 'add');
  openProject(cur); view('door');
  if (mq.matches) setSheet('peek');
  const linked = takeCfgFromURL(); Cloud.on(u => { onLogin(u); renderAccount(); }); Cloud.init();
  if (linked) setTimeout(() => { toast(Cloud.enabled ? '✅ 이 기기에 클라우드 연결을 적용했습니다 — Google 로그인을 누르세요' : '연결 링크를 읽었지만 연결하지 못했습니다: ' + Cloud.error, 7000); showTab('file'); if (mq.matches) setSheet('half'); }, 700); renderAccount(); setSync('local');
})();
(function loop() { requestAnimationFrame(loop); ctl.update(); renderer.render(scene, cam); })();
