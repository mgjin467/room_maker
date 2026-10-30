// 가구 3D 모델 빌더 — 모든 좌표는 cm, 원점은 바닥면 중앙. -z = 뒷면(벽쪽), +z = 앞면
const PI = Math.PI;

export function rng(seed) {
  let a = (Math.imul(seed | 0, 2654435761) >>> 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LEAF = { sq: 0.5, wings: 0.5, half: 0.55 };

// 칸 수 옵션이 의미 있는 모델과 라벨
export const NOPT = {
  shelfW: '단 수', shelfM: '단 수', shelfC: '단 수', shelfR: '단 수', bookcase: '단 수', rack: '단 수',
  wshelf: '단 수', ladder: '단 수', vitrine: '단 수', cab: '문 개수', drawer: '서랍 단수', fridge: '도어 수',
  frame: '액자 개수', monitor: '모니터 대수', kitchen: '도어 수', screen: '패널 수', mshelf: '단 수',
};

// 보조색 기본값
export const DEFA = {
  tree: '#4f7f3a', bush: '#4a7a3c', flowerbed: '#e86a92', parasol: '#d9d2c3', sunbed: '#f1ece2', tent: '#3d5a5b', campchair: '#2b2b2d', arch: '#f6efe0', grill: '#9aa0a6', campfire: '#ff8c42', postlamp: '#fff3d6', deck: '#a0714f', boat: '#f2f2f0', sign: '#f6efe0',
  plant: '#3f7a3a', bed: '#e9e4da', flamp: '#efe6d2', tripod: '#f1ead9', arcLamp: '#d8d3c8', mlamp: '#f6efe0',
  tlamp: '#f3eee4', uplight: '#f6efe0', lamp: '#f6efe0', frame: '#d98b5f', island: '#e7e4de', kitchen: '#e7e4de',
  mdesk: '#2b2b2d', barstool: '#a0714f', catTower: '#cfc6b8', petHouse: '#c96f4a', hanger: '#a7b3c4',
  screen: '#f3ecdc', dchair: '#e5dccb', rug: '#8d7b62', rugR: '#b3a284', humid: '#9fc3d6', fan: '#d7dee3',
};

export const TYPES = {
  box: '박스 (기본)', bed: '침대', bunk: '이층 침대', crib: '아기 침대', sofa: '소파', sofaL: 'L자 소파', beanbag: '빈백',
  pouf: '스툴·오토만', ctable: '거실 테이블', rtable: '원형 테이블', porbo: '확장 식탁', sq: '접이식 식탁', wings: '날개 식탁',
  half: '반타원 식탁', panel: '책상·식탁 (판다리)', ldesk: 'L자 책상', mdesk: '모션데스크', vanity: '화장대', island: '아일랜드 식탁',
  kitchen: '싱크대·하부장', dchair: '식탁 의자', office: '회전 의자', bench: '벤치', barstool: '바 스툴', massage: '안마의자',
  cab: '수납장 (도어)', drawer: '서랍장', vitrine: '유리 장식장', bookcase: '책장 (책 포함)', shelfS: '덱스터 책장',
  shelfW: '와이드 책장', shelfM: '철제 책장', shelfC: '코너 책장', shelfR: '회전 책장', rack: '철제 선반·렌지대',
  wshelf: '벽 선반', ladder: '사다리 선반', hanger: '행거', tv: 'TV', monitor: '모니터', pc: 'PC 본체', appl: '소형 가전',
  speaker: '스피커', soundbar: '사운드바', fridge: '냉장고', wine: '와인셀러', washer: '세탁기·건조기', styler: '의류관리기',
  acStand: '스탠드 에어컨', acWall: '벽걸이 에어컨', purifier: '공기청정기', humid: '가습기', fan: '선풍기', circ: '서큘레이터',
  robot: '로봇청소기', piano: '업라이트 피아노', dpiano: '디지털 피아노', treadmill: '러닝머신', lamp: '단스탠드',
  flamp: '장스탠드', arcLamp: '아크 스탠드', tripod: '삼각대 스탠드', mlamp: '버섯 램프', tlamp: '테이블 램프',
  uplight: '업라이트 스탠드', plant: '식물·화분', vase: '꽃병·오브제', basket: '바구니', books: '책 더미', rug: '러그',
  rugR: '원형 러그', curtainI: '커튼', frame: '액자', mirrorR: '원형 거울', mirrorF: '전신 거울', clock: '벽시계',
  screen: '접이식 파티션', catTower: '캣타워', petHouse: '펫 하우스', mshelf: '메탈 프레임 선반장', person: '사람',
  tree: '나무 (야외)', bush: '관목·덤불', rock: '바위·돌', flowerbed: '꽃밭·화단', parasol: '파라솔', sunbed: '선베드', tent: '텐트', campchair: '캠핑 의자', picnic: '피크닉 테이블', fence: '울타리', arch: '아치 (웨딩·정원)', grill: '바비큐 그릴', campfire: '모닥불', postlamp: '가로등·정원등', deck: '데크·단상', surf: '서핑보드', boat: '보트·카약', sign: '안내판·이젤',
};

export const TREES = [['broad', '활엽수 (둥근 수형)'], ['pine', '소나무·침엽수'], ['palm', '야자수'], ['birch', '자작나무'], ['cherry', '벚나무 (꽃)'], ['maple', '단풍나무'], ['cypress', '측백·사이프러스']];
export const PV = [
  ['monstera', '몬스테라'], ['leafy', '관엽 (일반)'], ['fiddle', '떡갈 고무나무'], ['bird', '여인초·극락조'],
  ['tree', '나무형 (올리브·뱅갈)'], ['palm', '야자류'], ['fern', '고사리'], ['dracaena', '행운목'], ['stucky', '스투키'],
  ['sanse', '산세베리아'], ['cactus', '선인장'], ['succ', '다육이'], ['hang', '행잉 플랜트'], ['flower', '꽃병 (생화)'],
  ['none', '빈 화분'],
];

// 조명이 나오는 모델 (스탠드 등)
export const LAMPS = new Set(['lamp', 'flamp', 'arcLamp', 'tripod', 'mlamp', 'tlamp', 'uplight', 'campfire', 'postlamp']);

let P, LP, CTX;
const B = (x, y, z, w, h, d, c, o) => P.push({ g: 'b', x, y, z, w, h, d, c, ...o });
const C = (x, y, z, rt, rb, h, c, o) => P.push({ g: 'c', x, y, z, rt, rb, h, c, ...o });
const S = (x, y, z, r, c, o) => P.push({ g: 's', x, y, z, r, c, ...o }); // y = 중심
const T = (x, y, z, r, t, c, o) => P.push({ g: 't', x, y, z, r, t, c, ...o }); // 중심, XY 평면
const Disc = (x, cy, z, r, t, c, o) => C(x, cy - t / 2, z, r, r, t, c, { rx: PI / 2, ...o }); // +z 방향을 보는 원판
const Lt = (x, y, z) => LP.push([x, y, z]);
function Stick(x0, y0, z0, x1, y1, z1, rb, rt, c, o) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, L = Math.hypot(dx, dy, dz);
  if (L < 0.01) return;
  const hz = Math.hypot(dx, dz);
  C((x0 + x1) / 2, (y0 + y1) / 2 - L / 2, (z0 + z1) / 2, rt, rb, L, c, { rz: Math.atan2(hz, dy), ry: Math.atan2(dz, -dx), seg: 8, ...o });
}

const WD = 0xdcb27c, K = 0x2b2b2d, CH = 0xc5c9cf, RT = 0xc9a46a, GD = 0xb59a5b, WH = 0xf4f2ee, GL = 0x9ec9ff,
  SCR = 0x16191e, MIR = 0xd5e3ea, STEM = 0x4f6b34, BARK = 0x6b4f3a, Q4 = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const BOOK = [0x8c3b2e, 0x2f4f6f, 0x6b7d3a, 0xc9a46a, 0x5b4636, 0x9a8f84, 0x3d5a5b, 0xb5651d, 0x7a6a9a, 0xe0d6c2, 0x2b2b2d, 0xa33d3d];
const FLOW = [0xe86a92, 0xf2c14e, 0xffffff, 0xd7263d, 0xf49ac2, 0x9b5de5, 0xff8c42];
const ART = [0xd98b5f, 0x5f8fa8, 0xe9c46a, 0x2a9d8f, 0x264653, 0xe76f51, 0xf4a261, 0x8e7dbe, 0xf1faee];

// 러그: 위쪽 면에 무늬 텍스처(tex:'rug') — 모양 it.rs: rect|round|oval|hex|oct|half
function buildRug(it, w, def) {
  const { d } = it, th = Math.max(0.4, it.h || 1), sh = it.rs || def, top = 0.15, o = { tex: 'rug' };
  if (sh === 'rect') { B(0, 0, 0, w, th - top, d, 'd'); B(0, th - top, 0, w, top, d, null, o); return; }
  if (sh === 'half') { const so = { ts: -PI / 2, tl: PI, sz: d / (w / 2), seg: 48 }; C(0, 0, -d / 2, w / 2, w / 2, th - top, 'd', so); C(0, th - top, -d / 2, w / 2, w / 2, top, null, { ...so, ...o }); return; }
  const seg = sh === 'hex' ? 6 : sh === 'oct' ? 8 : 64, so = { sz: d / w, seg, ts: seg < 10 ? PI / seg : 0 };
  C(0, 0, 0, w / 2, w / 2, th - top, 'd', so); C(0, th - top, 0, w / 2, w / 2, top, null, { ...so, ...o });
}
function leaf(it, w) { if (it.fold && LEAF[it.type]) { const l = it.w - w; B(w / 2 - 1, it.h - 3 - l, 0, 2, l, it.d - 4); } }
function frame(w, d, h, i, c) { B(0, h - 9, d / 2 - i, w - 2 * i, 6, 2, c); B(0, h - 9, -d / 2 + i, w - 2 * i, 6, 2, c); B(w / 2 - i, h - 9, 0, 2, 6, d - 2 * i, c); B(-w / 2 + i, h - 9, 0, 2, 6, d - 2 * i, c); }
export const COLSTY = {
  shelfW: [['O', '오픈'], ['P', '포인트 패널'], ['R', '하단 서랍'], ['D', '하단 도어']],
  shelfM: [['O', '오픈'], ['R', '하단 서랍'], ['P', '포인트 패널'], ['D', '하단 도어']],
  shelfC: [['O', '오픈'], ['P', '포인트 패널'], ['R', '하단 서랍'], ['D', '하단 도어']],
  shelfS: [['A', '4칸 (기본)'], ['B', '3칸 (띄움)'], ['C', '5칸']],
  bookcase: [['B', '책 진열'], ['O', '오픈 (빈칸)'], ['D', '하단 도어'], ['R', '하단 서랍'], ['G', '유리 도어']],
  mshelf: [['O', '기본형 (오픈)'], ['R', '서랍형'], ['D', '도어형'], ['3', '3단 서랍'], ['C', '큐브 칸막이']],
};
export function colPat(it, len) {
  if (it.cpat && it.cpat.length) return String(it.cpat);
  const t = it.type;
  if (t === 'shelfS') return 'ABA';
  if (t === 'bookcase') return 'B'.repeat(Math.max(1, Math.round(len / 80)));
  if (t === 'mshelf') return 'O'.repeat(Math.max(1, Math.round(len / 80)));
  const cn = Math.max(1, Math.round(len / (t === 'shelfM' ? 80 : 60)));
  let p = ''; for (let i = 0; i < cn; i++) p += t === 'shelfM' ? (i % 2 ? 'O' : 'R') : (i % 2 ? 'P' : 'O'); return p;
}
function SH(it, u0, v0, len, dep, sw, st) {
  const h = it.h, n = it.n || 5, pat = colPat(it, len), cn = pat.length, cw = len / cn;
  const b = (u, y, v, l, hh, t, c) => sw ? B(v, y, u, t, hh, l, c) : B(u, y, v, l, hh, t, c);
  for (let k = 0; k <= n; k++) b(u0, k * (h - 2) / n, v0, len, 2, dep);
  b(u0, 0, v0 - dep / 2 + 0.5, len, h, 1, 'd');
  for (let i = 0; i <= cn; i++) { const u = u0 - len / 2 + i * cw; if (st === 'M') [1, -1].forEach(s => b(u, 0, v0 + s * (dep / 2 - 1.5), 3, h, 3, K)); else b(u, 0, v0, 3, h, dep, K); }
  for (let i = 0; i < cn; i++) {
    const u = u0 - len / 2 + (i + 0.5) * cw, c = pat[i], sec = (h - 2) / n;
    if (c === 'R') b(u, 0, v0 + dep / 2 - 1, cw - 4, Math.min(h * 0.3, sec * 1.4), 1.5, 'd');
    else if (c === 'P') b(u, h * 0.36, v0 + dep / 2 - 1, cw - 4, h * 0.24, 1.5, K);
    else if (c === 'D') { [-1, 1].forEach(s => b(u + s * cw / 4, 2, v0 + dep / 2 - 1, cw / 2 - 2.5, sec * 2 - 2, 1.5, 'f')); }
  }
}
function legsC(w, d, h, ins, r, c) { Q4.forEach(([a, b]) => C(a * (w / 2 - ins), 0, b * (d / 2 - ins), r, r * 0.8, h, c)); }
function keyboard(y, z, len, dep) {
  B(0, y, z, len, 1.5, dep, 0xf7f5ef);
  const n = 52, kw = len / n, pat = [1, 0, 1, 1, 0, 1, 1];
  for (let i = 0; i < n - 1; i++) if (pat[i % 7]) B(-len / 2 + (i + 1) * kw, y + 1.5, z - dep * 0.18, kw * 0.55, 1, dep * 0.6, 0x111111);
}
function sofaPart(x0, z0, w, d, h, aL, aR) {
  const ar = Math.min(18, w * 0.12), lg = 8, sh = h * 0.3, bt = Math.min(d * 0.24, 22);
  const iw = w - (aL ? ar : 0) - (aR ? ar : 0), ix = x0 + ((aL ? ar : 0) - (aR ? ar : 0)) / 2;
  B(x0, lg, z0, w, sh, d);
  B(x0, lg, z0 - d / 2 + bt / 2, w, h - lg, bt);
  if (aL) B(x0 - w / 2 + ar / 2, lg, z0, ar, h * 0.62 - lg + 6, d);
  if (aR) B(x0 + w / 2 - ar / 2, lg, z0, ar, h * 0.62 - lg + 6, d);
  const n = iw > 150 ? 3 : iw > 95 ? 2 : 1, cw = iw / n;
  for (let i = 0; i < n; i++) {
    const cx = ix - iw / 2 + cw * (i + 0.5);
    B(cx, lg + sh, z0 + bt / 2, cw - 2, h * 0.13, d - bt - 2, 'l');
    B(cx, lg + sh + h * 0.1, z0 - d / 2 + bt + 6, cw - 4, h * 0.42, 12, 'l', { rx: -0.12 });
  }
  Q4.forEach(([a, b]) => C(x0 + a * (w / 2 - 6), 0, z0 + b * (d / 2 - 6), 2, 1.4, lg, K));
}

const BUILD = {
  box: (it, w) => B(0, 0, 0, w, it.h, it.d),
  bed: (it, w) => {
    const { d, h } = it, fh = h * 0.45, hb = it.hb ?? 40;
    B(0, 0, 0, w, fh, d, 'd');
    B(0, fh, 2, w - 4, h - fh, d - 8, WH);
    B(0, 0, -d / 2 + 2.5, w, h + hb, 5, 'd');
    const np = w >= 130 ? 2 : 1, pw = (w - 14) / np - 6;
    for (let i = 0; i < np; i++) B(-w / 2 + 10 + pw / 2 + i * (pw + 6), h, -d / 2 + 24, pw, 10, 34, 0xffffff);
    B(0, h - 12, d * 0.12, w + 1, 15, d * 0.62, 'a');
  },
  bunk: (it, w) => {
    const { d, h } = it;
    Q4.forEach(([a, b]) => B(a * (w / 2 - 3), 0, b * (d / 2 - 3), 6, h, 6, 'd'));
    [14, h * 0.55].forEach(y => { B(0, y, 0, w, 6, d); B(0, y + 6, 0, w - 8, 14, d - 8, WH); });
    const y1 = h * 0.55;
    [1, -1].forEach(a => B(a * (w / 2 - 2), y1 + 20, -d * 0.1, 3, 14, d * 0.7, 'd'));
    B(0, y1 + 20, -d / 2 + 2, w, 14, 3, 'd');
    const lz = d / 2 - 22;
    [-14, 14].forEach(o => B(w / 2 - 2, 0, lz + o, 3, y1 + 20, 3, 'd'));
    for (let y = 30; y < y1 + 15; y += 28) B(w / 2 - 2, y, lz, 3, 3, 28, 'd');
  },
  crib: (it, w) => {
    const { d, h } = it;
    B(0, 25, 0, w - 6, 12, d - 6, WH);
    Q4.forEach(([a, b]) => B(a * (w / 2 - 2.5), 0, b * (d / 2 - 2.5), 5, h, 5));
    [1, -1].forEach(s => {
      B(0, h - 4, s * (d / 2 - 2), w, 4, 4); B(0, 20, s * (d / 2 - 2), w, 4, 4);
      for (let x = -w / 2 + 8; x < w / 2 - 4; x += 8) B(x, 24, s * (d / 2 - 2), 2, h - 28, 2);
      B(s * (w / 2 - 2), h - 4, 0, 4, 4, d); B(s * (w / 2 - 2), 20, 0, 4, 4, d);
      for (let z = -d / 2 + 8; z < d / 2 - 4; z += 8) B(s * (w / 2 - 2), 24, z, 2, h - 28, 2);
    });
  },
  sofa: (it, w) => sofaPart(0, 0, w, it.d, it.h, 1, 1),
  sofaL: (it, w) => {
    const { d, h } = it, sd = Math.min(95, d * 0.6), cw = Math.min(95, w * 0.38), lg = 8, sh = h * 0.3;
    sofaPart(0, -d / 2 + sd / 2, w, sd, h, 1, 0);
    B(w / 2 - cw / 2, lg, sd / 2, cw, sh, d - sd);
    B(w / 2 - cw / 2, lg + sh, sd / 2, cw - 4, h * 0.13, d - sd - 2, 'l');
    [w / 2 - 6, w / 2 - cw + 6].forEach(x => C(x, 0, d / 2 - 6, 2, 1.4, lg, K));
  },
  beanbag: (it, w) => { S(0, it.h * 0.5, 0, w / 2, null, { sy: it.h / w, sz: it.d / w, ws: 24, hs: 16 }); S(0, it.h * 0.78, it.d * 0.08, w * 0.3, 'd', { sy: 0.25, sz: it.d / w }); },
  pouf: (it, w) => { const s = it.d / w; C(0, 0, 0, w / 2, w / 2 * 0.96, it.h - 2, null, { sz: s, seg: 32 }); C(0, it.h - 2, 0, w / 2 - 1, w / 2, 2, 'l', { sz: s, seg: 32 }); },
  ctable: (it, w) => {
    const { d, h } = it;
    B(0, h - 4, 0, w, 4, d);
    B(0, h * 0.25, 0, w - 10, 2.5, d - 10, 'f');
    Q4.forEach(([a, b]) => B(a * (w / 2 - 4), 0, b * (d / 2 - 4), 4, h - 4, 4, 'd'));
  },
  rtable: (it, w) => {
    const { d, h } = it, r = w / 2, s = d / w;
    C(0, h - 3, 0, r, r, 3, null, { sz: s, seg: 48 });
    if (it.leg === 3) {
      for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; Stick(Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8 * s, Math.cos(a) * r * 0.5, h - 3, Math.sin(a) * r * 0.5 * s, 1.4, 1.8, 'd'); }
    } else {
      C(0, 0, 0, Math.max(3, r * 0.08), Math.max(4, r * 0.1), h - 3, 'd');
      C(0, 0, 0, r * 0.42, r * 0.48, 2.5, 'd', { sz: s, seg: 32 });
    }
  },
  porbo: (it, w) => { const { d, h } = it; B(0, h - 3, 0, w, 3, d); frame(w, d, h, 10); Q4.forEach(([a, b]) => C(a * (w / 2 - 10), 0, b * (d / 2 - 10), 3.3, 1.8, h - 3)); },
  sq: (it, w) => { const { d, h } = it; B(0, h - 3, 0, w, 3, d); frame(w, d, h, 6, 'd'); leaf(it, w); Q4.forEach(([a, b]) => B(a * (w / 2 - 8), 0, b * (d / 2 - 8), 5, h - 3, 5, 'd')); },
  wings: (it, w) => { const { d, h } = it, bx = -w / 2 + w * 0.35; B(0, h - 3, 0, w, 3, d, 'l'); frame(w, d, h, 5, WD); leaf(it, w); B(bx, 0, 0, 24, h - 3, d - 10, WD); [0, 1, 2].forEach(i => B(bx, 3 + i * (h - 9) / 3, d / 2 - 4.5, 20, (h - 9) / 3 - 3, 1.5, 0xe9c895)); Q4.forEach(([a, b]) => B(a * (w / 2 - 5), 0, b * (d / 2 - 5), 4, h - 3, 4, WD)); },
  half: (it, w) => { const { d, h } = it, ex = d * 0.45; B(ex / 2, h - 3, 0, w - ex, 3, d); C(-w / 2 + ex, h - 3, 0, d / 2, d / 2, 3, null, { ts: PI, tl: PI, sx: ex / (d / 2) }); leaf(it, w); [1, -1].forEach(b => B(ex / 2, h - 9, b * (d / 2 - 8), w - ex - 16, 6, 2, WD)); Q4.forEach(([a, b]) => C(a > 0 ? w / 2 - 8 : -w / 2 + ex + 6, 0, b * (d / 2 - 8), 2.6, 1.8, h - 3, WD)); },
  panel: (it, w) => { const { d, h } = it; B(0, h - 4, 0, w, 4, d); [1, -1].forEach(a => B(a * (w / 2 - Math.min(20, w * 0.12)), 0, 0, 6, h - 4, d - Math.min(14, d * 0.2), 'd')); B(0, h - 14, 0, w * 0.6, 8, 3, 'd'); },
  ldesk: (it, w) => {
    const { d, h } = it, dd = Math.min(70, d * 0.5), rw = Math.min(70, w * 0.45);
    B(0, h - 3, -d / 2 + dd / 2, w, 3, dd);
    B(w / 2 - rw / 2, h - 3, dd / 2, rw, 3, d - dd);
    B(-w / 2 + 2, 0, -d / 2 + dd / 2, 3, h - 3, dd - 6, 'd');
    B(w / 2 - rw / 2, 0, d / 2 - 2, rw - 6, h - 3, 3, 'd');
    C(w / 2 - rw + 3, 0, -d / 2 + dd - 3, 2, 2, h - 3, 'd');
    B(0, h - 12, -d / 2 + 2, w - 8, 8, 2, 'd');
  },
  mdesk: (it, w) => {
    const { d, h } = it;
    B(0, h - 2.5, 0, w, 2.5, d);
    [1, -1].forEach(a => { B(a * (w / 2 - 14), 0, 0, 7, 3, d * 0.85, 'a'); B(a * (w / 2 - 14), 3, 0, 7, h - 8, 6, 'a'); B(a * (w / 2 - 14), h - 6, 0, 6, 3.5, d * 0.75, 'a'); });
    B(0, h - 9, 0, w - 34, 5, 5, 'a');
  },
  vanity: (it, w) => {
    const { d, h } = it, dh = Math.min(76, h * 0.55);
    B(0, dh - 4, 0, w, 4, d);
    B(0, dh - 14, d / 2 - 22, w * 0.55, 10, 40, 'f');
    B(0, dh - 10, d / 2 + 0.2, 10, 1.5, 1.5, CH);
    Q4.forEach(([a, b]) => B(a * (w / 2 - 3), 0, b * (d / 2 - 3), 4, dh - 4, 4, 'd'));
    const mh = h - dh - 6, mw = Math.min(w * 0.6, mh * 0.8);
    if (mh > 10) { B(0, dh, -d / 2 + 6, mw * 0.3, 6, 10, 'd'); Disc(0, dh + 6 + mh / 2, -d / 2 + 6, 1, 2, null, { sx: mw / 2, sz: mh / 2, seg: 40 }); Disc(0, dh + 6 + mh / 2, -d / 2 + 7.1, 1, 0.3, MIR, { sx: mw / 2 - 2, sz: mh / 2 - 2, seg: 40 }); }
  },
  island: (it, w) => {
    const { d, h } = it, ov = Math.min(25, d * 0.3), bd = d - ov;
    B(0, 0, -ov / 2, w - 4, h - 4, bd);
    const n = Math.max(2, Math.round(w / 50)), fw = (w - 4) / n;
    for (let i = 0; i < n; i++) { B(-w / 2 + 2 + fw * (i + 0.5), 10, -d / 2 - 0.4, fw - 1.2, h - 16, 0.8, 'f'); }
    B(0, h - 4, 0, w, 4, d, 'a');
  },
  kitchen: (it, w) => {
    const { d, h } = it, n = it.n || Math.max(1, Math.round(w / 60)), fw = w / n;
    B(0, 0, -3, w, 10, d - 8, 'dd');
    B(0, 10, -1, w, h - 14, d - 2);
    for (let i = 0; i < n; i++) { const x = -w / 2 + fw * (i + 0.5); B(x, 11, d / 2 - 1.6, fw - 1.2, h - 16, 0.8, 'f'); B(x + (i % 2 ? -1 : 1) * (fw / 2 - 5), h - 14, d / 2 - 0.6, 1.5, 8, 1.5, CH); }
    B(0, h - 4, 0, w + 2, 4, d + 2, 'a');
    if (it.sink) {
      const sx = w > 150 ? w * 0.22 : 0, sw = Math.min(80, w * 0.35);
      B(sx, h - 0.2, 2, sw, 0.4, d * 0.6, 0x9aa0a6);
      C(sx, h, -d / 2 + 8, 1.6, 1.6, 30, CH);
      B(sx, h + 27, -d / 2 + 14, 2.2, 2.2, 14, CH);
      if (w > 150) B(-w * 0.22, h, 1, 60, 0.6, 50, 0x111111);
    }
  },
  dchair: (it, w) => {
    const { d, h } = it, sy = h * 0.55;
    Q4.forEach(([a, b]) => B(a * (w / 2 - 3), 0, b * (d / 2 - 3), 3, sy, 3, 'd'));
    B(0, sy, 0, w, 4, d);
    if (it.c2) B(0, sy + 4, 1, w - 4, 4, d - 6, 'a');
    [1, -1].forEach(a => B(a * (w / 2 - 3), sy, -d / 2 + 3, 3, h - sy, 3, 'd'));
    B(0, h - 12, -d / 2 + 2.5, w - 4, 10, 2.5, it.c2 ? 'a' : null);
    B(0, sy + 14, -d / 2 + 2.5, w - 6, 5, 2, null);
  },
  office: (it, w) => { const { d, h } = it, sy = h * 0.48, q = w * 0.46; B(0, sy, 0, w * 0.82, 9, d * 0.78); B(0, sy + 9, -d * 0.38, w * 0.7, h - sy - 9, 3, K); B(0, sy + 14, -d * 0.38 + 1.5, w * 0.56, h - sy - 24, 1.5, RT); [1, -1].forEach(a => { B(a * w * 0.4, sy + 16, 0, 3, 3, d * 0.5, K); B(a * w * 0.4, sy + 9, 0, 2, 8, 2, CH); }); C(0, 5, 0, 2.2, 2.2, sy - 5, CH); for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; B(Math.cos(a) * q / 2, 3, -Math.sin(a) * q / 2, q, 2, 3.5, CH, { ry: a }); C(Math.cos(a) * q, 0, -Math.sin(a) * q, 2.2, 2.2, 3, K); } },
  bench: (it, w) => { const { d, h } = it; B(0, h - 10, 0, w, 10, d); [1, -1].forEach(a => { B(a * (w / 2 - 7), 2, 0, 2, 2, d - 8, CH); [1, -1].forEach(b => C(a * (w / 2 - 7), 2, b * (d / 2 - 4), 1.2, 1.2, h - 12, CH)); }); },
  barstool: (it, w) => {
    const { h } = it, r = w / 2;
    C(0, 0, 0, r * 0.8, r * 0.85, 2, 'd', { seg: 28 });
    C(0, 2, 0, 2.2, 2.2, h - 8, 'd');
    T(0, h * 0.32, 0, r * 0.6, 1, 'd', { rx: PI / 2 });
    C(0, h - 6, 0, r, r * 0.92, 6, 'a', { seg: 28 });
  },
  massage: (it, w) => {
    const { d, h } = it;
    B(0, 0, -d * 0.1, w * 0.9, h * 0.35, d * 0.6, 'd');
    B(0, h * 0.35, -d * 0.05, w * 0.65, 12, d * 0.45, 'l');
    [1, -1].forEach(a => B(a * (w / 2 - w * 0.09), h * 0.2, -d * 0.08, w * 0.18, h * 0.38, d * 0.6));
    B(0, h * 0.3, -d / 2 + 14, w * 0.75, h * 0.68, 20, null, { rx: -0.22 });
    B(0, 4, d / 2 - d * 0.16, w * 0.5, h * 0.3, d * 0.22, 'f', { rx: 0.45 });
  },
  cab: (it, w) => {
    const { d, h } = it, lg = it.lg || 0, n = it.n || 2, bh = h - lg, fw = w / n, tall = bh > 110, up = it.mt === 'w';
    B(0, lg, 0, w, bh, d);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + fw * (i + 0.5), hx = x + (i % 2 ? -1 : 1) * (fw / 2 - 4);
      B(x, lg + 1, d / 2 + 0.4, fw - 1.2, bh - 2, 0.8, 'f');
      if (tall) B(hx, lg + bh * 0.4, d / 2 + 1.2, 1.5, Math.min(30, bh * 0.18), 1.5, CH);
      else B(n > 1 ? hx : x, up ? lg + 5 : lg + bh - 12, d / 2 + 1.2, 1.5, 7, 1.5, CH);
    }
    if (lg) legsC(w, d, lg, 4, 1.6, 'd');
  },
  drawer: (it, w) => {
    const { d, h } = it, lg = it.lg || 0, n = it.n || 4, cols = it.cols || 1, bh = h - lg, rh = (bh - 4) / n, cw = w / cols;
    B(0, lg, 0, w, bh, d);
    for (let c = 0; c < cols; c++) for (let i = 0; i < n; i++) {
      const x = -w / 2 + cw * (c + 0.5), y = lg + 1 + i * rh;
      B(x, y + 0.4, d / 2 + 0.4, cw - 1.6, rh - 0.8, 0.8, 'f');
      B(x, y + rh * 0.55, d / 2 + 1.2, Math.min(14, cw * 0.3), 1.5, 1.5, CH);
    }
    if (lg) legsC(w, d, lg, 4, 1.6, 'd');
  },
  vitrine: (it, w) => {
    const { d, h } = it, n = it.n || 4, r = rng(it.id || 1);
    B(0, 0, 0, w, 6, d); B(0, h - 4, 0, w, 4, d);
    [1, -1].forEach(a => B(a * (w / 2 - 1.5), 0, 0, 3, h, d));
    B(0, 0, -d / 2 + 0.5, w, h, 1, 'd');
    for (let k = 1; k < n; k++) B(0, 6 + k * (h - 10) / n, 0, w - 3, 1, d - 3, GL, { op: 0.35 });
    B(0, 6, d / 2 - 1, w - 3, h - 10, 0.5, GL, { op: 0.18 });
    for (let k = 0; k < n; k++) { const y = 7 + k * (h - 10) / n, sh = (h - 10) / n; for (let j = 0; j < 3; j++) { const rad = 2 + r() * 4, hh = sh * (0.3 + r() * 0.5); C(-w / 2 + (j + 0.5) * (w / 3), y, (r() - 0.5) * (d - 14), rad, rad * 0.8, hh, ART[(r() * ART.length) | 0]); } }
  },
  bookcase: (it, w) => {
    const { d, h } = it, n = it.n || 5, t = 2, sh = (h - t) / n, r = rng(it.id || 1), pat = colPat(it, w), cn = pat.length, cw = (w - t) / cn;
    B(-w / 2 + t / 2, 0, 0, t, h, d); B(w / 2 - t / 2, 0, 0, t, h, d); B(0, 0, -d / 2 + 0.5, w, h, 1, 'd');
    for (let k = 0; k <= n; k++) B(0, k * sh, 0, w - 2 * t, t, d);
    for (let i = 1; i < cn; i++) B(-w / 2 + t / 2 + i * cw, 0, 0, t, h, d);
    const bd = Math.min(d - 4, 22);
    for (let ci = 0; ci < cn; ci++) {
      const c = pat[ci], x0 = -w / 2 + t + ci * cw, x1 = x0 + cw - t, xc = (x0 + x1) / 2;
      const low = c === 'D' || c === 'R' ? Math.min(2, n) : 0;
      if (c === 'D') [-1, 1].forEach(s => B(xc + s * (x1 - x0) / 4, 1, d / 2 - 0.5, (x1 - x0) / 2 - 0.6, low * sh - 1, 1, 'f'));
      if (c === 'R') for (let k = 0; k < low; k++) { B(xc, k * sh + t + 0.3, d / 2 - 0.5, x1 - x0 - 0.6, sh - t - 0.6, 1, 'f'); B(xc, k * sh + sh * 0.6, d / 2 + 0.4, Math.min(12, cw * 0.3), 1.2, 1.2, CH); }
      if (c === 'G') B(xc, t, d / 2 - 0.5, x1 - x0 - 0.6, h - 2 * t, 0.4, GL, { op: 0.25 });
      for (let k = low; k < n; k++) {
        let x = x0 + 1; const y = k * sh + t;
        if (c === 'O') break;
        while (x < x1 - 4) {
          const bw = 2 + r() * 3.5, bh = Math.min(sh - 3, sh * (0.55 + r() * 0.35));
          if (r() < 0.14) { x += 6 + r() * 8; continue; }
          if (x + bw > x1 - 1) break;
          B(x + bw / 2, y, -d / 2 + 1 + bd / 2, bw, bh, bd, BOOK[(r() * BOOK.length) | 0]);
          x += bw + 0.3;
        }
      }
    }
  },
  mshelf: (it, w) => {
    const { d, h } = it, n = it.n || 5, pat = colPat(it, w), cn = pat.length, cw = w / cn, sec = (h - 6) / n, t = 2.4;
    for (let i = 0; i <= cn; i++) { const x = -w / 2 + i * cw + (i === 0 ? 1.5 : i === cn ? -1.5 : 0); [1, -1].forEach(s => B(x, 0, s * (d / 2 - 1.5), 3, h, 3, K)); B(x, h - 3, 0, 3, 3, d, K); B(x, 2, 0, 3, 3, d, K); }
    B(0, 3, -d / 2 + 0.6, w - 2, h - 6, 1, 0x2e3035);
    for (let k = 0; k <= n; k++) B(0, 3 + k * sec - (k === n ? t : 0), 0, w - 3, t, d - 2);
    [...pat].forEach((c, i) => {
      const xc = -w / 2 + cw * (i + 0.5), iw = cw - 4;
      if (c === 'R') { B(xc, 3 + t, d / 2 - 1, iw, sec - t - 0.5, 1.5, 'f'); B(xc, 3 + sec * 0.6, d / 2 + 0.3, Math.min(20, iw * 0.3), 1.2, 1.2, CH); }
      if (c === 'D') { [-1, 1].forEach(s => { B(xc + s * iw / 4, 3 + t, d / 2 - 1, iw / 2 - 0.5, sec * 2 - t - 0.5, 1.5, 'f'); B(xc + s * 2, 3 + sec, d / 2 + 0.3, 1.2, 12, 1.2, CH); }); }
      if (c === '3') { const hh = (sec * 2 - t) / 3; for (let j = 0; j < 3; j++) { B(xc, 3 + t + j * hh, d / 2 - 1, iw, hh - 0.6, 1.5, 'f'); B(xc, 3 + t + j * hh + hh * 0.55, d / 2 + 0.3, Math.min(18, iw * 0.3), 1.2, 1.2, CH); } }
      if (c === 'C') { for (let k = 1; k < n; k += 2) { const off = (k % 4 === 1 ? -1 : 1) * iw * 0.25; B(xc + off, 3 + k * sec, 0, t, sec, d - 2); B(xc + off - (k % 4 === 1 ? -1 : 1) * iw * 0.12, 3 + k * sec, -d / 2 + 2, iw * 0.24, sec - t, 1, 'f'); } }
    });
  },
  shelfW: (it, w) => SH(it, 0, 0, w, it.d, 0, 'W'),
  shelfM: (it, w) => SH(it, 0, 0, w, it.d, 0, 'M'),
  shelfC: (it, w) => { const d = it.d, t = Math.min(32, w / 2); SH(it, 0, -d / 2 + t / 2, w, t, 0, 'W'); SH(it, t / 2, -w / 2 + t / 2, d - t, t, 1, 'W'); },
  shelfS: (it, w) => {
    const { d, h } = it, pat = colPat(it, w), cw = w / pat.length, t = 2.5;
    const cell = (x, y, dp, ch) => { B(x, y, 0, cw, t, dp); B(x, y + ch - t, 0, cw, t, dp); B(x - cw / 2 + t / 2, y, 0, t, ch, dp); B(x + cw / 2 - t / 2, y, 0, t, ch, dp); };
    const ST = { A: [4, 0, 1, 0.92], B: [3, 0.06, 0.88, 1], C: [5, 0, 1, 1] };
    [...pat].forEach((c, i) => { const [m, oy, f, df] = ST[c] || ST.A, x = -w / 2 + cw * (i + 0.5), ch = h * f / m; for (let k = 0; k < m; k++) cell(x, h * oy + k * ch, d * df, ch); });
  },
  shelfR: (it, w) => { const { h } = it, r = Math.min(w, it.d) / 2, n = it.n || 4; for (let k = 0; k <= n; k++) C(0, k * (h - 3) / n, 0, r, r, 3); B(0, 0, 0, r * 1.7, h, 2.5, 'd'); B(0, 0, 0, 2.5, h, r * 1.7, 'd'); },
  rack: (it, w) => {
    const { d, h } = it, n = Math.max(2, it.n || 4);
    Q4.forEach(([a, b]) => C(a * (w / 2 - 1.5), 0, b * (d / 2 - 1.5), 1.2, 1.2, h, null, { seg: 10 }));
    for (let k = 0; k < n; k++) { const y = 4 + k * (h - 7) / (n - 1); B(0, y, 0, w - 1, 1.2, d - 1, 'f'); B(0, y - 1.5, d / 2 - 0.8, w, 2.5, 1, null); }
  },
  wshelf: (it, w) => {
    const { d, h } = it, n = it.n || 1, t = Math.min(3, h), r = rng(it.id || 1);
    for (let k = 0; k < n; k++) {
      const y = n > 1 ? k * (h - t) / (n - 1) : 0;
      B(0, y, 0, w, t, d);
      [1, -1].forEach(a => B(a * (w / 2 - 10), y - 5, -d / 2 + d * 0.3, 1.5, 5, d * 0.6, K));
    }
    const ty = n > 1 ? h : t;
    if (w > 40) { for (let i = 0; i < 5; i++) B(-w / 2 + 8 + i * 3, ty, -d / 2 + 8, 2.6, 16 + r() * 6, Math.min(14, d - 4), BOOK[(r() * BOOK.length) | 0]); C(w / 4, ty, 0, 4, 3, 12, ART[(r() * ART.length) | 0]); }
  },
  ladder: (it, w) => {
    const { d, h } = it, n = it.n || 5, ang = -Math.atan2(d - 4, h), L = Math.hypot(h, d - 4);
    [1, -1].forEach(a => B(a * (w / 2 - 2), h / 2 - L / 2, 0, 3, L, 3, 'd', { rx: ang }));
    for (let k = 0; k < n; k++) {
      const y = 12 + k * (h - 28) / Math.max(1, n - 1), zr = (d / 2 - 2) - (y / h) * (d - 4), dep = zr + d / 2;
      if (dep > 6) B(0, y, (zr - d / 2) / 2, w - 6, 2, dep);
    }
  },
  hanger: (it, w) => {
    const { d, h } = it, r = rng(it.id || 1);
    [1, -1].forEach(a => { B(a * (w / 2 - 2), 0, 0, 3, h, 3); B(a * (w / 2 - 2), 0, 0, 4, 2, d); });
    B(0, h - 3, 0, w, 2.5, 2.5); B(0, 10, 0, w - 4, 1.5, d - 4, null);
    let x = -w / 2 + 8;
    while (x < w / 2 - 8) { const cw = 3 + r() * 4, ch = 40 + r() * 55; B(x + cw / 2, h - 6 - ch, 0, cw, ch, d * 0.7, r() < 0.5 ? 'a' : (r() < 0.5 ? 'ad' : 'al')); x += cw + 1.5; }
  },
  tv: (it, w) => {
    const { d, h } = it, wall = it.mt === 'w', st = wall ? 0 : Math.min(h * 0.12, 10), sd = Math.min(d, 6), z = wall ? -d / 2 + sd / 2 : 0;
    B(0, st, z, w, h - st, sd, K);
    B(0, st + 1.2, z + sd / 2 + 0.05, w - 2.4, h - st - 2.4, 0.2, SCR);
    if (!wall) { B(0, 0, 0, w * 0.35, 1.5, d * 0.8, K); B(0, 1.5, 0, w * 0.06, st, 2, K); }
  },
  monitor: (it, w) => {
    const { d, h } = it, n = it.n || 1, mw = (w - (n - 1) * 2) / n, sh = h * 0.62;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + mw / 2 + i * (mw + 2), ry = n > 1 ? (i < (n - 1) / 2 ? 0.15 : i > (n - 1) / 2 ? -0.15 : 0) : 0;
      B(x, h - sh, 0, mw, sh, 2.5, K, { ry }); B(x, h - sh + 1, 1.3, mw - 2, sh - 2, 0.3, SCR, { ry });
      B(x, 0, -d / 2 + 8, Math.min(22, mw * 0.4), 1.5, Math.min(18, d * 0.8), K); B(x, 1.5, -2, 4, h - sh + sh * 0.3, 3, K);
    }
  },
  pc: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, h * 0.82, d / 2 + 0.1, w * 0.6, 1.2, 0.3, 0x3b82f6); B(0, h * 0.2, d / 2 + 0.1, w * 0.8, h * 0.5, 0.3, 'd'); },
  appl: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(-w * 0.12, h * 0.15, d / 2 + 0.1, w * 0.62, h * 0.7, 0.3, SCR); B(w * 0.36, h * 0.2, d / 2 + 0.1, w * 0.14, h * 0.6, 0.3, 'd'); },
  speaker: (it, w) => { const { d, h } = it, r1 = w * 0.3, r2 = w * 0.38; B(0, 0, 0, w, h, d); Disc(0, h - r1 - w * 0.15, d / 2 + 0.5, r1 * 0.6, 1, SCR); Disc(0, Math.max(r2 + 1, h - 2 * r1 - r2 - w * 0.3), d / 2 + 0.5, r2, 1, SCR); },
  soundbar: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d, K); B(0, 0.5, d / 2 + 0.05, w - 2, h - 1, 0.2, 0x3a3d42); },
  fridge: (it, w) => {
    const { d, h } = it, n = it.n || 2, zf = d / 2 - 2;
    B(0, 0, -2, w, h, d - 4);
    const D = (x, y, ww, hh, hs) => { B(x, y + 0.3, zf, ww - 0.6, hh - 0.6, 4, 'f'); if (hs) B(x + hs * (ww / 2 - 3), y + hh * 0.25, d / 2 + 0.8, 1.5, Math.min(hh * 0.5, 60), 2, CH); };
    if (n <= 1) D(0, 0, w, h, -1);
    else if (n === 2) { D(-w / 4, 0, w / 2, h, 1); D(w / 4, 0, w / 2, h, -1); }
    else if (n === 3) { const th = h * 0.42; D(0, h - th, w, th, -1); D(0, (h - th) / 2, w, (h - th) / 2, 0); D(0, 0, w, (h - th) / 2, 0); [0, (h - th) / 2].forEach(y => B(0, y + (h - th) / 2 - 6, d / 2 + 0.8, w * 0.5, 1.5, 2, CH)); }
    else { const th = h * 0.6; D(-w / 4, h - th, w / 2, th, 1); D(w / 4, h - th, w / 2, th, -1); D(-w / 4, 0, w / 2, h - th, 0); D(w / 4, 0, w / 2, h - th, 0); [-w / 4, w / 4].forEach(x => B(x, h - th - 8, d / 2 + 0.8, w * 0.3, 1.5, 2, CH)); }
  },
  wine: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, 6, d / 2 + 0.1, w - 4, h - 10, 0.4, 0x1e2a33, { op: 0.85 }); B(w / 2 - 5, h * 0.3, d / 2 + 0.8, 1.5, h * 0.4, 1.5, CH); for (let y = 12; y < h - 8; y += 12) B(0, y, 0, w - 6, 1, d - 6, 0x8a6a50); },
  washer: (it, w) => { const { d, h } = it, r = Math.min(w, h) * 0.3; B(0, 0, 0, w, h, d); B(0, h - 12, d / 2 + 0.05, w - 2, 10, 0.3, 'f'); T(0, h * 0.42, d / 2 + 1, r, 2.5, 0xb8bcc2); Disc(0, h * 0.42, d / 2 + 0.6, r, 1.2, 0x2a3440, { op: 0.85 }); Disc(w * 0.3, h - 7, d / 2 + 0.4, 2.5, 0.6, 0x6d6f75); },
  styler: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, 2, d / 2 + 0.1, w - 2, h - 4, 0.4, 0x1f2228); B(0, h * 0.78, d / 2 + 0.6, w * 0.3, 2, 0.3, 0x5aa9e6); },
  acStand: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, h * 0.42, d / 2 + 0.1, w * 0.82, h * 0.5, 0.3, 'f'); for (let i = 0; i < 2; i++) Disc(0, h * 0.58 + i * h * 0.16, d / 2 + 0.5, w * 0.3, 0.6, 0x9aa0a6); B(0, h * 0.06, d / 2 + 0.1, w * 0.7, h * 0.08, 0.3, 0x9aa0a6); },
  acWall: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, 1, d / 2 - 6, w * 0.88, 3, 8, 0x55595e); B(w * 0.35, h * 0.55, d / 2 + 0.1, 6, 2, 0.3, 0x5aa9e6); },
  purifier: (it, w) => { const { d, h } = it; B(0, 0, 0, w, h, d); B(0, h, 0, w - 4, 0.6, d - 4, 0x55595e); B(0, h * 0.85, d / 2 + 0.1, w * 0.5, 1.2, 0.3, 0x5aa9e6); B(0, 4, d / 2 + 0.1, w - 4, h * 0.6, 0.3, 'f'); },
  humid: (it, w) => { const { d, h } = it; C(0, 0, 0, w / 2 * 0.9, w / 2, h * 0.75, null, { sz: d / w, seg: 28 }); C(0, h * 0.75, 0, w / 2 * 0.55, w / 2 * 0.9, h * 0.25, 'a', { sz: d / w, seg: 28, op: 0.7 }); },
  fan: (it, w) => {
    const { d, h } = it, m = Math.min(w, d), r = Math.min(w, h * 0.42) / 2, cy = h - r;
    C(0, 0, 0, m * 0.4, m * 0.45, 3, null, { seg: 28 }); C(0, 3, 0, 1.6, 1.6, cy - 3, null);
    B(0, cy - 5, -8, 9, 10, 12, null);
    T(0, cy, 0, r, 0.6, 'a'); Disc(0, cy, 1, r * 0.22, 4, null);
    for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; S(Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, 0, r * 0.38, 'a', { sx: 1, sy: 0.55, sz: 0.08, rz: a, op: 0.85 }); }
  },
  circ: (it, w) => { const { h } = it, r = Math.min(w, h * 0.8) / 2; C(0, 0, 0, w * 0.35, w * 0.4, 3, null); B(0, 3, 0, 3, h - r * 2, 3, null); S(0, h - r, 0, r * 0.95, 'l', { ws: 20, hs: 14 }); T(0, h - r, r * 0.6, r * 0.75, 0.8, 'd'); },
  robot: (it, w) => { const { d, h } = it; B(0, 0, -d / 2 + 9, w, h, 18); C(0, 0, d / 2 - 17, 17, 17, 9, 'f', { seg: 32 }); Disc(0, 6, d / 2 - 17 + 17, 3, 1, 0x5aa9e6); },
  piano: (it, w) => {
    const { d, h } = it, kd = Math.min(25, d * 0.4), ky = Math.min(h * 0.58, 72);
    B(0, 0, -d / 2 + (d - kd) / 2, w, h, d - kd);
    B(0, ky - 4, d / 2 - kd / 2, w, 4, kd);
    keyboard(ky, d / 2 - kd * 0.55, w - 10, kd * 0.6);
    B(0, ky + 6, d / 2 - kd - 1, w - 10, 12, 2, 'd');
    [1, -1].forEach(a => B(a * (w / 2 - 4), 0, d / 2 - 4, 5, ky - 4, 5));
    [-8, 0, 8].forEach(x => B(x, 3, d / 2 - kd - 2, 3, 1.5, 8, GD));
  },
  dpiano: (it, w) => {
    const { d, h } = it;
    B(0, h - 14, 0, w, 14, d);
    keyboard(h - 13, d / 2 - d * 0.32, w - 8, d * 0.5);
    [1, -1].forEach(a => B(a * (w / 2 - 2), 0, 0, 3, h - 14, d - 6));
    B(0, 12, -d / 2 + 4, w - 6, h * 0.42, 1.5);
  },
  treadmill: (it, w) => {
    const { d, h } = it;
    B(0, 0, d * 0.05, w, 14, d * 0.9);
    B(0, 14, d * 0.05, w * 0.7, 0.5, d * 0.85, 0x1a1a1a);
    [1, -1].forEach(a => B(a * (w / 2 - 4), 10, -d / 2 + 14, 4, h - 30, 6, null, { rx: -0.15 }));
    B(0, h - 22, -d / 2 + 14, w, 18, 14, 'l', { rx: -0.4 });
    [1, -1].forEach(a => B(a * (w / 2 - 4), h * 0.62, -d / 2 + 30, 3, 3, 30, CH));
  },
  lamp: (it, w) => { const { d, h } = it, r = Math.min(d / 2, h * 0.2), m = Math.min(w, d); C(0, 0, 0, m * 0.32, m * 0.36, 2.5, GD); C(0, 2.5, 0, 0.9, 0.9, h * 0.55, GD); C(0, h * 0.5, 0, 2, 2, h * 0.12, GD); C(0, h - r * 0.8 - w * 0.425, 0, r, r, w * 0.85, null, { rz: PI / 2, sx: 0.75 }); Lt(0, h - r * 1.6, 0); },
  flamp: (it, w) => { const { h } = it, m = Math.min(w, it.d), sh = Math.min(h * 0.22, m * 0.8), sr = m / 2; C(0, 0, 0, m * 0.32, m * 0.36, 2.5, null); C(0, 2.5, 0, 1, 1, h - sh * 0.6 - 2.5, null); C(0, h - sh, 0, sr * 0.62, sr, sh, 'a', { em: 1, seg: 28 }); Lt(0, h - sh * 0.55, 0); },
  tripod: (it, w) => {
    const { h } = it, m = Math.min(w, it.d), sh = Math.min(h * 0.2, m * 0.55), sr = m * 0.33, lh = h - sh;
    for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3 + PI / 2; Stick(Math.cos(a) * m * 0.45, 0, Math.sin(a) * m * 0.45, 0, lh + 2, 0, 1.2, 1, null); }
    C(0, lh, 0, sr, sr, sh, 'a', { em: 1, seg: 28 }); Lt(0, lh + sh * 0.4, 0);
  },
  arcLamp: (it, w) => {
    const { d, h } = it, sr = Math.min(22, w * 0.14), bs = Math.min(34, d), bx = -w / 2 + bs / 2, reach = w / 2 - sr - bx, Ra = Math.max(10, Math.min(reach, h * 0.45)), ph = h - Ra - 4;
    B(bx, 0, 0, bs, 5, bs, 0xe9e6e0);
    C(bx, 5, 0, 1.2, 1.2, ph - 5, null);
    T(bx + Ra, ph, 0, Ra, 1.1, null, { arc: PI / 2, rz: PI / 2, ts: 24 });
    if (reach > Ra + 1) B((2 * bx + Ra + reach) / 2, ph + Ra - 1.1, 0, reach - Ra, 2.2, 2.2, null);
    const sx = bx + reach;
    C(sx, ph + Ra - 21, 0, 3, sr, 20, 'a', { em: 1, seg: 28 }); Lt(sx, ph + Ra - 24, 0);
  },
  mlamp: (it, w) => { const { h } = it, m = Math.min(w, it.d); C(0, 0, 0, m * 0.3, m * 0.35, 2, null); C(0, 2, 0, m * 0.12, m * 0.16, h * 0.58, null); S(0, h * 0.6, 0, m / 2, 'a', { sy: (h * 0.4) / (m / 2), tl: PI / 2, em: 1, ws: 24, hs: 10 }); C(0, h * 0.6 - 0.5, 0, m / 2, m / 2, 0.5, 'a', { em: 1, seg: 24 }); Lt(0, h * 0.5, 0); },
  tlamp: (it, w) => { const { h } = it, m = Math.min(w, it.d); S(0, h * 0.22, 0, m * 0.28, null, { sy: 1.3, ws: 20, hs: 14 }); C(0, h * 0.42, 0, 1, 1, h * 0.14, GD); C(0, h * 0.55, 0, m * 0.36, m / 2, h * 0.45, 'a', { em: 1, seg: 28 }); Lt(0, h * 0.7, 0); },
  uplight: (it, w) => { const { h } = it, m = Math.min(w, it.d); C(0, 0, 0, m * 0.35, m * 0.4, 2.5, null); C(0, 2.5, 0, 1.1, 1.1, h - 14, null); C(0, h - 12, 0, m / 2, m * 0.1, 12, 'a', { em: 1, seg: 28 }); Lt(0, h - 2, 0); },
  plant: (it, w) => buildPlant(it, w),
  person: it => buildPerson(it),
  vase: (it, w) => { const { h } = it, m = Math.min(w, it.d); S(0, h * 0.35, 0, m / 2, null, { sy: (h * 0.7) / m, ws: 20, hs: 14 }); C(0, h * 0.6, 0, m * 0.16, m * 0.22, h * 0.4, null, { seg: 16 }); },
  basket: (it, w) => { const { d, h } = it; C(0, 0, 0, w / 2, w / 2 * 0.86, h, null, { sz: d / w, seg: 24 }); C(0, h - 0.3, 0, w / 2 - 1.5, w / 2 - 1.5, 0.4, 'd', { sz: d / w, seg: 24 }); T(0, h, 0, w / 2, 0.8, 'd', { rx: PI / 2, sy: d / w }); },
  books: (it, w) => { const { d, h } = it, r = rng(it.id || 1); let y = 0; while (y < h - 1.5) { const bh = 2 + r() * 2.5; B((r() - 0.5) * 3, y, (r() - 0.5) * 2, w * (0.75 + r() * 0.25), Math.min(bh, h - y), d * (0.75 + r() * 0.25), y === 0 ? null : BOOK[(r() * BOOK.length) | 0], { ry: (r() - 0.5) * 0.3 }); y += bh; } },
  rug: (it, w) => buildRug(it, w, 'rect'),
  rugR: (it, w) => buildRug(it, w, 'round'),
  curtainI: (it, w) => { const { d, h } = it, n = Math.max(4, Math.round(w / 12)), pw = w / n; B(0, h - 3, -d / 2 + 2, w + 12, 2.5, 2.5, CH); for (let i = 0; i < n; i++) B(-w / 2 + pw * (i + 0.5), 0, (i % 2 ? 0.2 : -0.2) * d * 0.6, pw * 1.05, h - 4, d * 0.35, i % 2 ? null : 'f'); },
  frame: (it, w) => {
    const { d, h } = it, n = it.n || 1, gp = n > 1 ? 8 : 0, fw = (w - gp * (n - 1)) / n, r = rng((it.id || 1) * 13);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + fw / 2 + i * (fw + gp), fh = n > 1 && i % 2 ? h * 0.75 : h, y = (h - fh) / 2, mg = Math.min(fw, fh) * 0.07;
      B(x, y, 0, fw, fh, d);
      B(x, y + mg, d / 2 + 0.05, fw - 2 * mg, fh - 2 * mg, 0.2, 0xf7f5f0);
      B(x, y + mg * 2.4, d / 2 + 0.2, fw - 4.8 * mg, fh - 4.8 * mg, 0.2, i === 0 ? 'a' : ART[(r() * ART.length) | 0]);
      B(x + (r() - 0.5) * fw * 0.25, y + fh * (0.3 + r() * 0.2), d / 2 + 0.35, fw * 0.3, fh * 0.25, 0.2, ART[(r() * ART.length) | 0]);
    }
  },
  mirrorR: (it, w) => { const { d, h } = it, r = Math.min(w, h) / 2; Disc(0, h / 2, 0, 1, d, null, { sx: w / 2, sz: h / 2, seg: 48 }); Disc(0, h / 2, d / 2 + 0.1, 1, 0.3, MIR, { sx: w / 2 - Math.max(2, r * 0.08), sz: h / 2 - Math.max(2, r * 0.08), seg: 48 }); },
  mirrorF: (it, w) => {
    const { d, h } = it, wall = it.mt === 'w', t = wall ? d : 4;
    if (!wall) { B(0, 0, 0, w, 3, d, 'd'); B(0, 0, -d / 2 + 4, w * 0.3, h * 0.8, 3, 'd', { rx: -0.25 }); }
    B(0, wall ? 0 : 3, 0, w, h - (wall ? 0 : 3), t);
    B(0, (wall ? 0 : 3) + 3, t / 2 + 0.1, w - 6, h - (wall ? 0 : 3) - 6, 0.3, MIR);
  },
  clock: (it, w) => {
    const { d, h } = it, r = Math.min(w, h) / 2, cy = h / 2;
    Disc(0, cy, 0, r, d, null, { seg: 40 }); Disc(0, cy, d / 2 + 0.1, r * 0.88, 0.3, 0xfbfaf6, { seg: 40 });
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; B(Math.sin(a) * r * 0.75, cy + Math.cos(a) * r * 0.75 - 1, d / 2 + 0.3, 0.8, 2, 0.3, K, { rz: -a }); }
    [[r * 0.45, 1.4, 2.1], [r * 0.7, 0.8, 0.6]].forEach(([L, t, a]) => B(Math.sin(a) * L / 2, cy + Math.cos(a) * L / 2 - L / 2, d / 2 + 0.5, t, L, 0.3, K, { rz: -a }));
  },
  screen: (it, w) => {
    const { d, h } = it, n = Math.max(2, it.n || 4), pw = w / n, amp = Math.min(d / 2 - 1.5, pw * 0.45), L = Math.hypot(pw, 2 * amp), ang = Math.atan2(2 * amp, pw);
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + pw * (i + 0.5), ry = i % 2 ? -ang : ang;
      B(cx, 0, 0, L, h, 2.5, null, { ry }); B(cx, 6, 0, L - 6, h - 12, 2.8, 'a', { ry });
    }
  },
  catTower: (it, w) => {
    const { d, h } = it, PO = 0xd8c49a;
    B(0, 0, 0, w, 3, d, 'a');
    C(-w * 0.28, 3, -d * 0.2, 5, 5, h - 6, PO); C(w * 0.25, 3, d * 0.18, 5, 5, h * 0.62 - 3, PO); C(-w * 0.1, 3, d * 0.25, 4.5, 4.5, h * 0.35 - 3, PO);
    B(-w * 0.15, h - 3, -d * 0.12, w * 0.6, 3, d * 0.65, 'a'); B(w * 0.2, h * 0.62, d * 0.08, w * 0.55, 3, d * 0.6, 'a');
    B(-w * 0.12, h * 0.35, d * 0.05, w * 0.5, h * 0.2, d * 0.6, null); Disc(-w * 0.12, h * 0.45, d * 0.05 + d * 0.3 + 0.1, Math.min(h * 0.07, w * 0.12), 0.3, 0x3a2c22);
  },
  petHouse: (it, w) => {
    const { d, h } = it, bh = h * 0.6, rw = Math.hypot(w / 2, h - bh) + 2, ra = Math.atan2(h - bh, w / 2);
    B(0, 0, 0, w, bh, d);
    B(-w / 4, bh + (h - bh) / 2 - 1.5, 0, rw, 3, d + 4, 'a', { rz: ra }); B(w / 4, bh + (h - bh) / 2 - 1.5, 0, rw, 3, d + 4, 'a', { rz: -ra });
    Disc(0, bh * 0.45, d / 2 + 0.1, Math.min(bh * 0.35, w * 0.28), 0.3, 0x2b2420);
  },
  // ---------- 야외·조경 ----------
  tree: (it, w) => {
    const { d, h } = it, v = it.pv || 'broad', r = rng((it.id || 1) * 13 + 5), m = Math.min(w, d), tr = Math.max(4, m * 0.045);
    if (v === 'pine' || v === 'cypress') {
      const th = h * (v === 'pine' ? 0.28 : 0.12); C(0, 0, 0, tr * 0.7, tr, th + h * 0.2, BARK, { seg: 10 });
      const n = v === 'pine' ? 5 : 3; for (let i = 0; i < n; i++) { const y = th + (h - th) * i / n * 0.86, rr = (m / 2) * (v === 'pine' ? 1 - i / (n + 0.6) : 0.55 - i * 0.08); C(0, y, 0, rr * 0.12, rr, (h - th) / n * (v === 'pine' ? 1.5 : 2.6), 'a', { seg: 14, sz: d / w }); }
      return;
    }
    if (v === 'palm') {
      let x = 0, y = 0; const n = 7, lean = (r() - 0.5) * 0.5, seg = h * 0.82 / n;
      for (let i = 0; i < n; i++) { const nx = x + lean * seg * (i / n) * 0.9; Stick(x, y, 0, nx, y + seg, 0, tr * (1.1 - i * 0.05), tr * (1.05 - i * 0.05), BARK); x = nx; y += seg; }
      for (let i = 0; i < 9; i++) { const a = i * 2 * PI / 9 + r() * 0.3, L = m * 0.55, e = -0.25 - r() * 0.35; S(x + Math.cos(a) * L * 0.45, y + Math.sin(e) * L * 0.4, Math.sin(a) * L * 0.45, 1, 'a', { sx: L / 2, sy: 0.8, sz: L * 0.11, ry: -a, rz: e, ws: 10, hs: 6 }); }
      S(x, y, 0, tr * 1.4, 0x7a5a3a); return;
    }
    const th = h * (v === 'birch' ? 0.5 : 0.38), bark = v === 'birch' ? 0xe9e5dc : BARK;
    C(0, 0, 0, tr * 0.75, tr * 1.1, th + h * 0.15, bark, { seg: 10 });
    if (v === 'birch') for (let i = 0; i < 6; i++) B(0, th * (0.1 + i * 0.14), tr * 0.8, tr * 1.1, 1.2, 0.6, 0x2b2b2d);
    const cr = m / 2, ch = h - th, n = v === 'cherry' || v === 'maple' ? 9 : 7;
    for (let i = 0; i < n; i++) { const a = r() * PI * 2, rr = cr * (0.35 + r() * 0.3), px = Math.cos(a) * cr * 0.42, pz = Math.sin(a) * cr * 0.42 * (d / w), py = th + ch * (0.35 + r() * 0.35); S(px, py, pz, rr, i % 3 === 0 ? 'al' : i % 3 === 1 ? 'ad' : 'a', { sy: 0.8, ws: 12, hs: 9 }); }
    S(0, th + ch * 0.6, 0, cr * 0.62, 'a', { sy: 0.85, sz: d / w, ws: 14, hs: 10 });
  },
  bush: (it, w) => { const { d, h } = it, r = rng((it.id || 1) * 3 + 1), n = Math.max(4, Math.round(w / 25)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, rr = Math.min(h, d) * (0.42 + r() * 0.2); S(-w / 2 + w * t, rr * 0.75, (r() - 0.5) * d * 0.3, rr, i % 2 ? null : 'd', { sy: h / (rr * 2) * 0.95, ws: 12, hs: 9 }); } },
  rock: (it, w) => { const { d, h } = it, r = rng((it.id || 1) * 17 + 3), n = 1 + Math.round(r() * 2); for (let i = 0; i < n; i++) { const s = i ? 0.45 + r() * 0.2 : 1; S((i ? (r() - 0.5) * w * 0.6 : 0), h * 0.42 * s, (i ? (r() - 0.5) * d * 0.5 : 0), w / 2 * s, i ? 'd' : null, { sy: (h / w) * 0.9, sz: d / w, ry: r() * 3, rz: (r() - 0.5) * 0.3, ws: 7, hs: 5 }); } },
  flowerbed: (it, w) => { const { d, h } = it, r = rng((it.id || 1) * 5 + 2); B(0, 0, 0, w, Math.min(12, h * 0.4), d, 0x8a7a6a); B(0, Math.min(12, h * 0.4) - 1, 0, w - 4, 1.5, d - 4, 0x4a3a2a); const n = Math.round(w * d / 300); for (let i = 0; i < n; i++) { const x = (r() - 0.5) * (w - 10), z = (r() - 0.5) * (d - 10), sh = h * (0.5 + r() * 0.5); C(x, 10, z, 0.4, 0.5, sh - 10, STEM, { seg: 5 }); S(x, sh, z, 3 + r() * 2, r() < 0.7 ? null : FLOW[(r() * FLOW.length) | 0], { ws: 8, hs: 6 }); } },
  parasol: (it, w) => { const { h } = it, rr = w / 2; C(0, 0, 0, Math.min(25, rr * 0.25), Math.min(28, rr * 0.28), 8, 'd', { seg: 20 }); C(0, 8, 0, 1.8, 1.8, h - 8, 0xd8d3c8, { seg: 10 }); C(0, h - rr * 0.32, 0, 2, rr, rr * 0.3, null, { seg: 8 }); C(0, h - rr * 0.32 - 4, 0, rr, rr, 4, 'd', { seg: 8, op: 0.9 }); },
  sunbed: (it, w) => { const { d, h } = it, sh = Math.min(h * 0.55, 32); B(0, sh - 5, d * 0.12, w, 5, d * 0.72, 'a'); B(0, sh, d * 0.12, w - 4, 4, d * 0.7, null); B(0, sh + 2, -d * 0.36, w - 4, 4, d * 0.34, null, { rx: -0.85 }); Q4.forEach(([a, b]) => B(a * (w / 2 - 4), 0, b * (d / 2 - 8) + d * 0.08, 4, sh - 5, 4, 'a')); },
  tent: (it, w) => { const { d, h } = it; S(0, 0, 0, w / 2, null, { sy: h / (w / 2), sz: d / w, tl: PI / 2, ws: 18, hs: 8 }); Disc(0, h * 0.32, d / 2 * 0.86, Math.min(w, h) * 0.24, 0.5, 'd', { sx: 1, sz: 1.5 }); B(0, 0, 0, w * 1.05, 0.6, d * 1.05, 0x2b2b2d, { op: 0.6 }); },
  campchair: (it, w) => { const { d, h } = it, sh = h * 0.42; Stick(-w / 2 + 3, 0, d / 2 - 3, w / 2 - 3, sh, -d / 2 + 6, 1.1, 1.1, K); Stick(w / 2 - 3, 0, d / 2 - 3, -w / 2 + 3, sh, -d / 2 + 6, 1.1, 1.1, K); B(0, sh - 3, 0, w - 6, 3, d - 8, null, { rx: 0.08 }); B(0, sh, -d / 2 + 4, w - 6, h - sh, 2, null, { rx: -0.18 }); [1, -1].forEach(a => B(a * (w / 2 - 2), sh + 16, 0, 4, 2, d * 0.6, K)); },
  picnic: (it, w) => { const { d, h } = it, PW = 0xb8865a; B(0, h - 4, 0, w, 4, d * 0.46, PW); [1, -1].forEach(b => { B(0, h * 0.58 - 3, b * d * 0.38, w, 3, d * 0.2, PW); [1, -1].forEach(a => { Stick(a * (w / 2 - 12), 0, b * d * 0.45, a * (w / 2 - 12), h - 4, b * d * 0.02, 2, 2, PW); }); }); },
  fence: (it, w) => { const { d, h } = it, n = Math.max(2, Math.round(w / 90) + 1); for (let i = 0; i < n; i++) B(-w / 2 + (w - 6) * i / (n - 1) + 3, 0, 0, 6, h, Math.min(8, d), 'd'); [0.3, 0.75].forEach(t => B(0, h * t, 0, w, 6, Math.min(4, d), null)); const m = Math.max(3, Math.round(w / 14)); for (let i = 0; i < m; i++) B(-w / 2 + (i + 0.5) * w / m, 2, Math.min(4, d) / 2 + 0.8, 7, h * 0.92, 1.5, null); },
  arch: (it, w) => { const { d, h } = it, r = w / 2 - 3, py = h - r; [1, -1].forEach(a => { B(a * r, 0, 0, 6, py, Math.min(d, 8), null); }); T(0, py, 0, r, 3, null, { arc: PI, ts: 32 }); const rr = rng((it.id || 1) * 9 + 4); for (let i = 0; i < 26; i++) { const t = rr(), ang = t * PI, x = Math.cos(ang) * r, y = py + Math.sin(ang) * r; S(x, y, (rr() - 0.5) * 6, 4 + rr() * 4, i % 3 ? 'a' : 0x4f6b34, { ws: 8, hs: 6 }); } [1, -1].forEach(a => { for (let i = 0; i < 6; i++) S(a * r + (rr() - 0.5) * 8, py * (0.2 + i * 0.13), (rr() - 0.5) * 6, 4 + rr() * 3, i % 2 ? 'a' : 0x4f6b34, { ws: 8, hs: 6 }); }); },
  grill: (it, w) => { const { d, h } = it; Q4.forEach(([a, b]) => Stick(a * w * 0.3, 0, b * d * 0.3, a * w * 0.2, h * 0.6, b * d * 0.2, 1, 1, K)); S(0, h * 0.68, 0, w / 2, K, { sy: 0.55, sz: d / w, phs: 0, tl: PI }); S(0, h * 0.7, 0, w / 2 * 0.98, null, { sy: 0.5, sz: d / w, tl: PI / 2 }); C(0, h - 4, 0, 2, 2, 4, CH); },
  campfire: (it, w) => { const { d, h } = it, r = rng(it.id || 1); for (let i = 0; i < 9; i++) { const a = i * 2 * PI / 9; S(Math.cos(a) * w * 0.42, 3, Math.sin(a) * d * 0.42, 5 + r() * 3, 0x8a8580, { sy: 0.7, ws: 7, hs: 5 }); } for (let i = 0; i < 5; i++) { const a = i * 2 * PI / 5; Stick(Math.cos(a) * w * 0.3, 1, Math.sin(a) * d * 0.3, 0, h * 0.35, 0, 2.5, 2, BARK); } C(0, 4, 0, 0.5, w * 0.18, h * 0.85, null, { em: 1, seg: 10 }); C(0, 4, 0, 0.5, w * 0.1, h * 0.6, 0xffd166, { em: 1, seg: 8 }); Lt(0, h * 0.4, 0); },
  postlamp: (it, w) => { const { h } = it, m = Math.min(w, it.d); C(0, 0, 0, m * 0.35, m * 0.4, 6, K, { seg: 12 }); C(0, 6, 0, 2.2, 2.6, h - 30, K, { seg: 10 }); C(0, h - 26, 0, m * 0.3, m * 0.22, 22, null, { em: 1, op: 0.9, seg: 8 }); C(0, h - 4, 0, 1, m * 0.34, 5, K, { seg: 8 }); Lt(0, h - 15, 0); },
  deck: (it, w) => { const { d, h } = it, n = Math.max(3, Math.round(d / 14)); B(0, 0, 0, w, Math.max(1, h - 3), d, 'd'); for (let i = 0; i < n; i++) B(0, Math.max(1, h - 3), -d / 2 + (i + 0.5) * d / n, w, 3, d / n - 0.8, i % 2 ? null : 'l'); },
  surf: (it, w) => { const { d, h } = it; S(0, h / 2, 0, w / 2, null, { sx: 1, sy: (h / 2) / (w / 2), sz: (d / 2) / (w / 2), ws: 20, hs: 10 }); B(0, h * 0.5, 0, w * 0.04, h * 0.9, 0.4, 'a'); },
  boat: (it, w) => { const { d, h } = it; S(0, h, 0, w / 2, null, { sy: h / (w / 2), sz: (d / 2) / (w / 2), phs: 0, ths: PI / 2, tl: PI / 2, ws: 24, hs: 10 }); B(0, h - 2, 0, w * 0.7, 2, d * 0.5, 'a'); B(0, h * 0.5, 0, w * 0.06, 2, d * 0.75, 'd'); },
  sign: (it, w) => { const { d, h } = it; Stick(-w * 0.35, 0, d * 0.3, -w * 0.1, h, -d * 0.1, 1.2, 1.2, BARK); Stick(w * 0.35, 0, d * 0.3, w * 0.1, h, -d * 0.1, 1.2, 1.2, BARK); Stick(0, 0, -d * 0.4, 0, h, -d * 0.1, 1.2, 1.2, BARK); B(0, h * 0.42, d * 0.08, w * 0.95, h * 0.5, 1.5, null, { rx: -0.12 }); B(0, h * 0.4, d * 0.12, w * 0.98, 2, 3, BARK); },
};

export const OUTFITS = [['suit', '정장'], ['suit3', '쓰리피스 정장'], ['tux', '턱시도'], ['casual', '셔츠+바지'], ['tshirt', '티셔츠+반바지'], ['hoodie', '후드티'], ['knit', '니트+바지'], ['sport', '트레이닝복'], ['coat', '롱코트'], ['blouse', '블라우스+치마'], ['dress', '원피스'], ['longdress', '롱드레스'], ['gown', '웨딩드레스'], ['mermaid', '머메이드 드레스'], ['hanbok', '한복 (치마)'], ['hanbokM', '한복 (바지)'], ['beachM', '하와이안 셔츠+반바지'], ['tank', '민소매+반바지'], ['rash', '래쉬가드+보드숏'], ['swimF', '원피스 수영복'], ['apron', '앞치마 (작업복)'], ['blazer', '블레이저+슬랙스'], ['jeans', '티셔츠+청바지']];
// 체형 프리셋: b=몸통 굵기 s=어깨 h=골반 a=팔·다리 굵기
export const BODIES = { std: ['표준', { b: 1, s: 1, h: 1, a: 1 }], slim: ['마른', { b: 0.84, s: 0.93, h: 0.94, a: 0.84 }], muscle: ['근육질', { b: 1.1, s: 1.22, h: 0.98, a: 1.38 }], curvy: ['볼륨감 (글래머)', { b: 1.03, s: 1, h: 1.2, a: 1.02, bust: 1 }], plump: ['통통', { b: 1.3, s: 1.08, h: 1.18, a: 1.22 }], petite: ['아담', { b: 0.92, s: 0.95, h: 0.96, a: 0.9 }] };
export const HAIRS = [['short', '짧은 머리'], ['crew', '스포츠'], ['part', '가르마'], ['twoblock', '투블럭'], ['pixie', '숏컷'], ['bob', '단발'], ['long', '긴 생머리'], ['wavy', '긴 웨이브'], ['pony', '포니테일'], ['bun', '올림머리'], ['lowbun', '낮은 쪽머리'], ['curly', '곱슬'], ['bald', '민머리']];
export const SLEEVES = [['', '옷에 맞춤'], ['long', '긴팔'], ['short', '반팔'], ['none', '민소매']];
export const TIES = [['', '옷에 맞춤'], ['none', '없음'], ['tie', '넥타이'], ['bow', '나비넥타이']];
// 자세 프리셋: a=팔 들기(°, 음수=뒤로) · z=팔 방향(0 앞 ~ 90 옆) · e=팔꿈치 굽힘 · leg=걷기 보폭 · sit=앉기
export const POSES = {
  stand: ['서 있기', { aL: 8, aR: 8, zL: 80, zR: 80, eL: 12, eR: 12, leg: 0, sit: 0 }],
  attn: ['차렷', { aL: 3, aR: 3, zL: 90, zR: 90, eL: 0, eR: 0, leg: 0, sit: 0 }],
  walk: ['걷기', { aL: 22, aR: -22, zL: 0, zR: 0, eL: 20, eR: 10, leg: 0.7, sit: 0 }],
  wave: ['손 흔들기', { aL: 8, aR: 150, zL: 80, zR: 60, eL: 10, eR: 35, leg: 0, sit: 0 }],
  hold: ['두 손 모으기', { aL: 22, aR: 22, zL: 20, zR: 20, eL: 75, eR: 75, leg: 0, sit: 0 }],
  cross: ['팔짱', { aL: 28, aR: 28, zL: 5, zR: 5, eL: 125, eR: 125, leg: 0, sit: 0 }],
  hips: ['허리에 손', { aL: 38, aR: 38, zL: 95, zR: 95, eL: 115, eR: 115, leg: 0, sit: 0 }],
  point: ['가리키기', { aL: 8, aR: 85, zL: 80, zR: 5, eL: 12, eR: 0, leg: 0, sit: 0 }],
  cheer: ['만세', { aL: 165, aR: 165, zL: 70, zR: 70, eL: 10, eR: 10, leg: 0, sit: 0 }],
  sit: ['앉기', { aL: 22, aR: 22, zL: 15, zR: 15, eL: 55, eR: 55, leg: 0, sit: 1 }],
  sitW: ['앉아서 손 흔들기', { aL: 22, aR: 140, zL: 15, zR: 60, eL: 55, eR: 35, leg: 0, sit: 1 }],
};
const SKIRTL = { blouse: 0.5, dress: 0.55, longdress: 0.97, gown: 1, mermaid: 1, hanbok: 1 };
const PANTS = new Set(['suit', 'suit3', 'tux', 'casual', 'hoodie', 'knit', 'sport', 'coat', 'hanbokM', 'apron', 'blazer', 'jeans']);
const SHORTS = new Set(['tshirt', 'beachM', 'tank', 'rash']);
function buildPerson(it) {
  const H = it.h, sex = it.sex || 'm', ch = sex === 'c', of = it.outfit || (sex === 'f' ? 'dress' : 'suit');
  const pz = (POSES[it.pose] || POSES.stand)[1], v = k => (it[k] ?? pz[k] ?? 0), sit = !!v('sit');
  const SK = it.skin || '#e8c4a2', HRc = it.hair || '#2a2220', SH = it.shoe || '#1d1d1f', TOP = null, BOT = 'a';
  const C3 = it.c3 || ({ suit3: '#8a7c66', hanbok: '#b23a48', sport: '#ffffff', hoodie: '#f2f2f2', hanbokM: '#6b5a45' }[of] || '#f7f7f5');
  const BD = (BODIES[it.body] || BODIES.std)[1], bs = (it.build || 1) * BD.b, shw = (it.shw || 1) * BD.s, hs0 = it.headS || 1, am = BD.a;
  const hd = ch ? H / 6 : H / 7.6, hr = hd * 0.5 * hs0, sw = (sex === 'm' ? 0.125 : 0.11) * H * shw, hw = (sex === 'm' ? 0.085 : 0.095) * H * Math.sqrt(bs) * BD.h;
  const hip0 = H * 0.52, dy = sit ? (H * 0.27 - hip0) : 0, hipY = hip0 + dy, shY = H * 0.815 + dy, topY = H + dy;
  const lr = H * 0.034 * Math.sqrt(bs) * (0.6 + 0.4 * am), lx = hw * 0.55, skirt = SKIRTL[of] != null, pants = PANTS.has(of), shorts = SHORTS.has(of);
  const slv = it.sleeve || ({ tshirt: 'short', gown: 'none', dress: 'short', mermaid: 'none', longdress: 'none', beachM: 'short', tank: 'none', swimF: 'none', jeans: 'short', apron: 'short' }[of] || 'long');
  const tieT = it.tieT || ({ suit: 'tie', suit3: 'tie', coat: 'tie', tux: 'bow' }[of] || 'none'), C3b = it.c3 || ({ apron: '#e8e1d3', beachM: '#f2c14e' }[of] || null);
  const skL = it.skirtL ?? SKIRTL[of] ?? 0.55, fullSkirt = skirt && skL >= 0.93;
  const zf = sw * 0.55 * bs;
  // 다리
  if (sit) {
    [-1, 1].forEach(k => { const up = skirt ? SK : BOT; Stick(k * lx, hipY, 0, k * lx, hipY, H * 0.24, lr, lr * 0.9, fullSkirt ? TOP : up); Stick(k * lx, hipY, H * 0.24, k * lx, H * 0.05, H * 0.25, lr * 0.85, lr * 0.7, pants ? BOT : SK); B(k * lx, 0, H * 0.28, H * 0.045, H * 0.045, H * 0.11, SH); });
  } else if (!fullSkirt) {
    const st0 = v('leg') * 0.42;
    [-1, 1].forEach(k => {
      const st = st0 * k, fy = H * 0.045, L = hipY - fy, foot = [k * lx, hipY - Math.cos(st) * L, Math.sin(st) * L], knee = [k * lx * 1.02, (hipY + foot[1]) / 2, foot[2] / 2], wide = of === 'hanbokM' ? 1.6 : 1;
      Stick(foot[0], foot[1], foot[2], knee[0], knee[1], knee[2], lr * 0.75 * wide, lr * 0.85 * wide, pants ? BOT : SK);
      Stick(knee[0], knee[1], knee[2], k * lx * 1.05, hipY, 0, lr * 0.85 * wide, lr * wide, pants || shorts ? BOT : SK);
      if (shorts) Stick(k * lx, (knee[1] + hipY) / 2 - H * 0.03, knee[2] * 0.6, k * lx * 1.05, hipY, 0, lr * 1.12, lr * 1.18, BOT);
      if (of === 'sport') Stick(foot[0] + k * lr * 0.8, foot[1] + 2, foot[2], k * lx * 1.05 + k * lr * 0.9, hipY - 2, 0, 0.5, 0.5, C3);
      B(foot[0], 0, foot[2] + H * 0.02, H * 0.045, H * 0.045, H * 0.11, SH, { ry: 0 });
    });
  }
  // 치마·드레스
  if (skirt) {
    const col = of === 'blouse' || of === 'hanbok' ? BOT : TOP, topK = of === 'hanbok' ? shY - H * 0.07 : hipY + H * (of === 'blouse' ? 0.05 : 0.08), hemY = Math.max(0, hipY * (1 - skL));
    const rTop = of === 'hanbok' ? sw * 0.85 : hw * 1.05, rBot = of === 'gown' ? H * 0.31 * (0.4 + 0.6 * skL) : of === 'hanbok' ? H * 0.24 * (0.5 + 0.5 * skL) : of === 'longdress' ? hw * 1.9 : hw * (1.3 + 0.5 * skL);
    if (sit) { C(0, hipY - 3, H * 0.1, rTop * 1.1, rTop * 1.7, Math.max(4, topK - hipY + 3), col, { seg: 28 }); if (skL > 0.6) C(0, 0, H * 0.2, rTop * 1.6, rBot * 0.85, hipY - 3, col, { seg: 28 }); }
    else if (of === 'mermaid') { const kY = H * 0.22; C(0, kY, 0, rTop, hw * 0.95, topK - kY, col, { seg: 28 }); C(0, 0, 0, hw * 0.95, H * 0.21, kY, col, { seg: 28 }); }
    else C(0, hemY, 0, rTop, rBot, topK - hemY, col, { seg: 32 });
  }
  if (of === 'coat' && !sit) C(0, H * 0.28, 0, hw * 1.12, hw * 1.5, hipY - H * 0.28 + 2, TOP, { seg: 20 });
  // 상체
  C(0, hipY, 0, sw * 0.95, hw * 1.05, shY - hipY, of === 'hanbok' ? SK : TOP, { sz: 0.55 * bs, seg: 20 });
  if (of === 'hanbok' || of === 'hanbokM') { C(0, shY - H * (of === 'hanbok' ? 0.1 : 0.18), 0, sw * 0.98, sw * 0.9, H * (of === 'hanbok' ? 0.1 : 0.18), TOP, { sz: 0.58 * bs, seg: 20 }); B(sw * 0.22, shY - H * 0.21, zf + 0.5, H * 0.02, H * 0.13, 0.4, C3); B(0, shY - H * 0.04, zf - 0.2, sw * 0.5, H * 0.03, 0.4, 0xffffff, { rz: 0.4 }); }
  if (of === 'gown' || of === 'mermaid' || (of === 'longdress' && slv === 'none')) C(0, shY - H * 0.04, 0, sw * 0.7, sw * 0.9, H * 0.04, SK, { sz: 0.5, seg: 16 });
  const jacket = of === 'suit' || of === 'suit3' || of === 'tux' || of === 'coat';
  if (jacket) {
    if (of === 'suit3') B(0, hipY + H * 0.04, zf - 0.1, sw * 0.62, shY - hipY - H * 0.1, 0.6, C3);
    B(0, shY - H * 0.17, zf + 0.3, sw * 0.4, H * 0.16, 0.5, 0xf7f7f5);
    [-1, 1].forEach(k => B(k * sw * 0.27, shY - H * 0.22, zf + 0.6, sw * 0.16, H * 0.2, 0.4, 'd', { rz: k * 0.28 }));
  }
  if (of === 'casual' || of === 'blouse') { B(0, shY - H * 0.03, zf + 0.2, sw * 0.5, H * 0.025, 0.5, 'l'); for (let i = 0; i < 4; i++) S(0, shY - H * (0.07 + i * 0.06), zf + 0.4, H * 0.005, 'd'); }
  if (of === 'knit') T(0, shY - 0.5, 0, sw * 0.32, H * 0.012, 'd', { rx: PI / 2, sz: 0.6 });
  if (of === 'hoodie') { T(0, shY + H * 0.005, -sw * 0.25, sw * 0.42, H * 0.03, TOP, { rx: PI / 2.4 }); B(0, hipY + H * 0.04, zf + 0.3, sw * 0.95, H * 0.08, 0.5, 'd'); [-1, 1].forEach(k => B(k * sw * 0.12, shY - H * 0.12, zf + 0.5, 0.5, H * 0.1, 0.4, C3)); }
  if (of === 'sport') B(0, hipY, zf + 0.3, 0.8, shY - hipY - 1, 0.4, C3);
  if (BD.bust && sex === 'f') [-1, 1].forEach(k => S(k * sw * 0.32, shY - H * 0.11, zf * 0.55, H * 0.04, of === 'hanbok' ? 'a' : TOP, { sz: 0.8, ws: 12, hs: 10 }));
  if (of === 'beachM') { for (let i = 0; i < 5; i++) S(0, shY - H * (0.05 + i * 0.05), zf + 0.4, H * 0.005, 'd'); for (let i = 0; i < 6; i++) B(((i % 3) - 1) * sw * 0.35, shY - H * (0.06 + Math.floor(i / 3) * 0.12), zf + 0.25, H * 0.03, H * 0.03, 0.3, C3b, { rz: 0.6 }); }
  if (of === 'apron') { B(0, H * 0.36, zf + 0.7, sw * 1.2, shY - H * 0.36 - H * 0.04, 0.5, C3b); B(0, shY - H * 0.04, zf + 0.7, sw * 0.6, H * 0.012, 0.4, C3b); }
  if (of === 'blazer') [-1, 1].forEach(k => B(k * sw * 0.27, shY - H * 0.22, zf + 0.6, sw * 0.16, H * 0.2, 0.4, 'd', { rz: k * 0.28 }));
  if (of === 'swimF') { B(0, hipY - H * 0.02, 0, hw * 1.9, H * 0.05, zf * 1.4, TOP); }
  if (tieT === 'tie') { B(0, shY - H * 0.17, zf + 0.6, H * 0.016, H * 0.15, 0.5, it.tie || 0x1d1d1f); B(0, shY - H * 0.03, zf + 0.6, H * 0.022, H * 0.018, 0.6, it.tie || 0x1d1d1f); }
  if (tieT === 'bow') [-1, 1].forEach(k => B(k * H * 0.012, shY - H * 0.045, zf + 0.7, H * 0.022, H * 0.016, 0.8, it.tie || 0x1d1d1f, { rz: k * 0.35 }));
  // 팔
  const hands = [];
  [1, -1].forEach(k => {
    const a = v(k > 0 ? 'aL' : 'aR') * PI / 180, az = v(k > 0 ? 'zL' : 'zR') * PI / 180, eb = v(k > 0 ? 'eL' : 'eR') * PI / 180;
    const S0 = [k * (sw + H * 0.012), shY - H * 0.02, 0], dx = k * Math.sin(az), dz = Math.cos(az);
    const ud = [dx * Math.sin(a), -Math.cos(a), dz * Math.sin(a)], Lu = H * 0.17, Lf = H * 0.155;
    const El = [S0[0] + ud[0] * Lu, S0[1] + ud[1] * Lu, S0[2] + ud[2] * Lu];
    let F = [-k * 0.5, 0.25, 1], fd2 = F[0] * ud[0] + F[1] * ud[1] + F[2] * ud[2], pp = [F[0] - ud[0] * fd2, F[1] - ud[1] * fd2, F[2] - ud[2] * fd2], pl = Math.hypot(...pp) || 1; pp = pp.map(q => q / pl);
    const fd = [ud[0] * Math.cos(eb) + pp[0] * Math.sin(eb), ud[1] * Math.cos(eb) + pp[1] * Math.sin(eb), ud[2] * Math.cos(eb) + pp[2] * Math.sin(eb)];
    const Hd = [El[0] + fd[0] * Lf, El[1] + fd[1] * Lf, El[2] + fd[2] * Lf]; hands.push(Hd);
    const upC = slv === 'none' || of === 'hanbok' && false ? SK : TOP, foC = slv === 'long' ? TOP : SK;
    Stick(...S0, ...El, H * 0.03 * Math.sqrt(bs) * am, H * 0.027 * Math.sqrt(bs) * am, slv === 'none' ? SK : TOP);
    Stick(...El, ...Hd, H * 0.027 * Math.sqrt(bs) * am, H * 0.023 * Math.sqrt(bs) * am, foC); void upC;
    if (am > 1.25) S(S0[0] - k * 1, S0[1] - H * 0.01, 0, H * 0.04 * am * 0.85, slv === 'none' ? SK : TOP, { ws: 10, hs: 8 });
    S(Hd[0] + fd[0] * H * 0.018, Hd[1] + fd[1] * H * 0.018, Hd[2] + fd[2] * H * 0.018, H * 0.023, SK, { sy: 1.3 });
  });
  // 목·머리 (고개 회전)
  C(0, shY - 1, 0, H * 0.026, H * 0.028, H * 0.045, SK, { seg: 12 });
  // 고개: 좌우(yaw) + 상하(pitch: +는 들기, -는 숙이기). 목 위쪽을 축으로 머리·머리카락·안경을 함께 돌림
  const yaw = v('yaw') * PI / 180, cyw = Math.cos(yaw), syw = Math.sin(yaw), HP = (x, z) => [x * cyw + z * syw, -x * syw + z * cyw];
  const pit = Math.max(-50, Math.min(50, v('pitch'))) * PI / 180, cpt = Math.cos(pit), spt = Math.sin(pit), pvY = topY - hr * 2.05;
  const HP3 = (x, y, z) => { const y1 = pvY + (y - pvY) * cpt + z * spt, z1 = -(y - pvY) * spt + z * cpt, [px, pz2] = HP(x, z1); return [px, y1, pz2]; };
  const Sh = (x, y, z, r, c, o = {}) => { const [px, py, pz2] = HP3(x, y, z); S(px, py, pz2, r, c, { ...o, rx: (o.rx || 0) - pit, ry: (o.ry || 0) + yaw, ro: 'YXZ' }); };
  const Bh = (x, y, z, w2, hh, d2, c, o = {}) => { const [px, py, pz2] = HP3(x, y + hh / 2, z); B(px, py - hh / 2, pz2, w2, hh, d2, c, { ...o, rx: (o.rx || 0) - pit, ry: (o.ry || 0) + yaw, ro: 'YXZ' }); };
  const hy = topY - hr * 1.1, face = !!it.face, fsz = Math.max(0.5, Math.min(1.45, it.fsz || 1)), phlF = 1.9 * fsz, tlF = 1.9 * fsz;
  Sh(0, hy, 0, hr * 0.92, SK, { sy: 1.15, ws: 22, hs: 16 });
  [-1, 1].forEach(k => Sh(k * hr * 0.9, hy - hr * 0.05, -hr * 0.05, hr * 0.17, SK, { sx: 0.5 }));
  if (face) Sh(0, hy, 0, hr * 0.92 * 1.015, null, { sy: 1.15, ws: 26, hs: 20, phs: PI / 2 - phlF / 2, phl: phlF, ths: Math.max(0.02, 1.23 - tlF / 2), tl: tlF, tex: 'face' });
  const hs = it.hs || (sex === 'f' ? 'long' : 'short'), R0 = hr * 0.98 * (it.hv || 1), hcY = hy + hr * 0.12, hcZ = -hr * 0.08;
  const cap = (tl, o = {}) => Sh(0, hcY, hcZ, R0, HRc, { sy: 1.1, ws: 22, hs: 10, tl, ...o });
  if (hs !== 'bald') {
    const cover = hs === 'crew' ? 0.46 : hs === 'curly' ? 0.62 : 0.58;
    if (face) { cap(PI * cover, { phs: PI / 2 + phlF * 0.45, phl: 2 * PI - phlF * 0.9 }); cap(PI * (hs === 'twoblock' ? 0.17 : 0.12)); }
    else cap(PI * (hs === 'crew' ? 0.48 : 0.55));
    if (it.bangs || hs === 'pixie') cap(PI * 0.27, { phs: PI / 2 - 0.85, phl: 1.7, ths: PI * 0.06 });
    if (hs === 'part') Sh(hr * 0.3, hy + hr * 0.82, hr * 0.05, hr * 0.5, HRc, { sx: 1.3, sy: 0.42 });
    if (hs === 'twoblock') Sh(0, hy + hr * 0.78, hr * 0.05, hr * 0.85, HRc, { sy: 0.45 });
    if (hs === 'bob') { [-1, 1].forEach(k => Bh(k * hr * 0.84, hy - hr * 0.85, -hr * 0.3, hr * 0.3, hr * 1.3, hr * 1.0, HRc)); Bh(0, hy - hr * 0.85, -hr * 0.78, hr * 1.9, hr * 1.4, hr * 0.42, HRc); }
    if (hs === 'long') { Bh(0, shY - H * 0.09, -hr * 0.62, hr * 1.75, hy - shY + H * 0.09, hr * 0.6, HRc); [-1, 1].forEach(k => Bh(k * hr * 0.82, hy - hr * 1.6, -hr * 0.2, hr * 0.28, hr * 1.7, hr * 0.7, HRc)); }
    if (hs === 'wavy') for (let i = 0; i < 7; i++) [-1, 0, 1].forEach(k => Sh(k * hr * 0.62, hy - i * hr * 0.42, -hr * 0.62 + (k ? hr * 0.28 : 0), hr * 0.36, HRc));
    if (hs === 'pony') { const [x0, y0, z0] = HP3(0, hy + hr * 0.2, -hr * 1.0), [x1, y1, z1] = HP3(0, hy - hr * 2.2, -hr * 1.3); Stick(x0, y0, z0, x1, y1, z1, hr * 0.24, hr * 0.12, HRc); Sh(0, hy + hr * 0.25, -hr * 0.97, hr * 0.17, HRc); }
    if (hs === 'bun') Sh(0, hy + hr * 0.6, -hr * 0.78, hr * 0.45, HRc);
    if (hs === 'lowbun') Sh(0, hy - hr * 0.3, -hr * 1.02, hr * 0.42, HRc);
    if (hs === 'curly') for (let i = 0; i < 22; i++) { const th = 0.2 + (i % 4) * 0.33, ph = i * 2.4; const x = Math.sin(th) * Math.cos(ph), z = Math.sin(th) * Math.sin(ph); if (face && z > 0.35 && th > 0.4) continue; Sh(x * R0, hcY + Math.cos(th) * R0 * 1.05, hcZ + z * R0, hr * 0.27, HRc); }
  }
  if (it.glasses) { const gz = hr * 0.92 * 0.97, gy = hy + hr * 0.1, gr2 = hr * 0.2, gc = it.glassC || 0x2b2b2d; [-1, 1].forEach(k => { const [px, py, pz2] = HP3(k * hr * 0.33, gy, gz); T(px, py, pz2, gr2, Math.max(0.15, hr * 0.03), gc, { ts: 20, rx: -pit, ry: yaw, ro: 'YXZ' }); }); Bh(0, gy - hr * 0.02, gz, hr * 0.26, hr * 0.04, hr * 0.04, gc); }
  if (it.veil) { const [vx, vz] = HP(0, -hr * 1.4); C(vx, sit ? hipY : H * 0.2, vz, hr * 0.6, H * 0.2, hy - (sit ? hipY : H * 0.2), 0xffffff, { op: 0.35, seg: 20 }); }
  if (it.flower && of !== 'gown' && of !== 'mermaid') S(-sw * 0.5, shY - H * 0.09, zf + 0.6, H * 0.017, 0xffffff, { ws: 10, hs: 8 });
  if (it.bouquet) {
    const [h1, h2] = hands, close = Math.hypot(h1[0] - h2[0], h1[1] - h2[1], h1[2] - h2[2]) < H * 0.18;
    const bp = close ? [(h1[0] + h2[0]) / 2, (h1[1] + h2[1]) / 2 + H * 0.03, (h1[2] + h2[2]) / 2 + H * 0.02] : [0, hipY + H * 0.08, zf + H * 0.05];
    Stick(bp[0], bp[1] - H * 0.08, bp[2] - H * 0.01, bp[0], bp[1], bp[2], H * 0.008, H * 0.01, 0x6b8f4a);
    S(bp[0], bp[1] + H * 0.02, bp[2], H * 0.055, 0xfaf7f2, { sy: 0.85, ws: 14, hs: 10 });
    [[-1, 0], [1, 0.3], [0.2, -1]].forEach(([q, r2]) => S(bp[0] + q * H * 0.03, bp[1] + H * 0.04, bp[2] + r2 * H * 0.02, H * 0.018, 0xf2c6cf, { ws: 8, hs: 6 }));
  }
}

function buildPlant(it, w) {
  const { d, h } = it, m = Math.min(w, d), fr = m / 2, v = it.pv || 'leafy', r = rng((it.id || 1) * 7 + 3);
  const POTF = { leafy: 0.3, monstera: 0.26, fiddle: 0.26, bird: 0.24, tree: 0.26, palm: 0.26, fern: 0.3, dracaena: 0.28, stucky: 0.42, sanse: 0.4, cactus: 0.36, succ: 0.44, hang: 0.32, flower: 0.3, none: 0.48 };
  const pr = m * (POTF[v] || 0.3), ph = v === 'none' ? h : Math.min(h * 0.32, pr * 2.2), top = v === 'hang' ? h : ph, H = Math.max(5, h - top);
  const leafS = (bx, by, bz, a, tilt, ls, wid, c = 'a') => { const ct = Math.cos(tilt), st = Math.sin(tilt); S(bx + Math.cos(a) * ct * ls * 0.85, by + st * ls * 0.85, bz + Math.sin(a) * ct * ls * 0.85, ls, c, { sx: 1, sy: 0.09, sz: wid, ry: -a, rz: tilt, ws: 12, hs: 8 }); };
  const frond = (bx, by, bz, a, e, L, wid, c = 'a') => { const ce = Math.cos(e), se = Math.sin(e); S(bx + Math.cos(a) * ce * L / 2, by + se * L / 2, bz + Math.sin(a) * ce * L / 2, 1, c, { sx: L / 2, sy: 0.6, sz: Math.max(1, L * wid), ry: -a, rz: e, ws: 12, hs: 6 }); };
  const CC = ['a', 'ad', 'al'];
  if (v === 'flower') C(0, 0, 0, pr * 0.85, pr * 0.7, ph, null, { op: 0.45, seg: 20 });
  else if (v !== 'hang') { C(0, 0, 0, pr, pr * 0.78, ph, null, { seg: 24 }); if (v !== 'none') C(0, ph - 1.5, 0, pr * 0.93, pr * 0.93, 1.2, 0x4a3a2a, { seg: 20 }); }
  switch (v) {
    case 'monstera': case 'leafy': {
      const n = v === 'leafy' ? 10 : 13, ls = fr * 0.38;
      for (let i = 0; i < n; i++) {
        const a = r() * PI * 2, rr = fr * (0.08 + r() * 0.3), tilt = (r() - 0.3) * 0.7, ey = Math.min(top + H * (0.3 + r() * 0.6), h - ls * 0.9);
        Stick(Math.cos(a) * pr * 0.3, top, Math.sin(a) * pr * 0.3, Math.cos(a) * rr, ey, Math.sin(a) * rr, 0.5, 0.4, STEM);
        leafS(Math.cos(a) * rr, ey, Math.sin(a) * rr, a, tilt, ls, v === 'monstera' ? 0.85 : 0.5, CC[i % 3]);
      }
      break;
    }
    case 'fiddle': {
      Stick(0, top, 0, 0, h * 0.94, 0, m * 0.03, m * 0.02, BARK);
      const n = 15;
      for (let i = 0; i < n; i++) { const f = i / (n - 1), y = top + (h - top) * (0.25 + 0.68 * f), a = i * 2.4, ls = fr * (0.22 + 0.1 * (1 - f)); leafS(Math.cos(a) * 1.5, Math.min(y, h - ls * 0.5), Math.sin(a) * 1.5, a, 0.15 + r() * 0.4, ls, 0.75, CC[i % 3]); }
      break;
    }
    case 'bird': {
      const n = 9, ls = Math.min(fr * 0.45, H * 0.3);
      for (let i = 0; i < n; i++) {
        const a = r() * PI * 2, rr = fr * (0.08 + r() * 0.22), tilt = 0.95 + r() * 0.35, ey = Math.min(top + H * (0.45 + r() * 0.4), h - ls * 1.6 * Math.sin(tilt));
        Stick(Math.cos(a) * pr * 0.2, top, Math.sin(a) * pr * 0.2, Math.cos(a) * rr, ey, Math.sin(a) * rr, 0.8, 0.6, STEM);
        leafS(Math.cos(a) * rr, ey, Math.sin(a) * rr, a, tilt, ls, 0.32, CC[i % 3]);
      }
      break;
    }
    case 'tree': {
      const ty = top + H * 0.55, cy = top + H * 0.72, cr = fr * 0.7, chh = H * 0.24;
      Stick(0, top, 0, fr * 0.05, ty, 0, m * 0.035, m * 0.025, BARK);
      for (let i = 0; i < 3; i++) { const a = i * 2.1; Stick(fr * 0.05, ty - H * 0.08, 0, Math.cos(a) * cr * 0.5, cy, Math.sin(a) * cr * 0.5, m * 0.015, m * 0.01, BARK); }
      for (let i = 0; i < 14; i++) { const rad = fr * (0.2 + r() * 0.16), x = (r() * 2 - 1) * (cr - rad * 0.6), z = (r() * 2 - 1) * (cr - rad * 0.6), y = Math.min(cy + (r() * 2 - 1) * chh * 0.6, h - rad * 0.85); S(x, y, z, rad, CC[i % 3], { sy: 0.85, ws: 10, hs: 8 }); }
      break;
    }
    case 'palm': case 'fern': {
      const n = v === 'palm' ? 13 : 18;
      for (let i = 0; i < n; i++) {
        const a = i / n * PI * 2 + r() * 0.3, e = v === 'palm' ? 0.55 + r() * 0.75 : -0.15 + r() * 0.75;
        const L = Math.min(e > 0.05 ? H / Math.sin(e) : 1e9, fr / Math.max(0.2, Math.cos(e))) * (0.8 + r() * 0.15);
        if (v === 'palm') Stick(0, top, 0, Math.cos(a) * Math.cos(e) * L * 0.4, top + Math.sin(e) * L * 0.4, Math.sin(a) * Math.cos(e) * L * 0.4, 0.5, 0.4, STEM);
        frond(0, top, 0, a, e, L, v === 'palm' ? 0.13 : 0.16, CC[i % 3]);
      }
      break;
    }
    case 'dracaena': {
      [[0.35, -1, 0], [0.55, 1, 0.6], [0.78, 0, -1]].forEach(([f, ox, oz], k) => {
        const tx = ox * pr * 0.35, tz = oz * pr * 0.35, th = top + H * f * 0.85;
        Stick(tx, top, tz, tx, th, tz, m * 0.04, m * 0.035, BARK);
        for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2 + k, e = -0.2 + r() * 1.2, L = Math.min(fr * 0.6, e > 0.05 ? (h - th) / Math.sin(e) : 1e9) * (0.8 + r() * 0.2); frond(tx, th, tz, a, e, L, 0.09, CC[i % 3]); }
      });
      break;
    }
    case 'stucky': {
      for (let i = 0; i < 10; i++) { const a = r() * PI * 2, rr = r() * pr * 0.6, x = Math.cos(a) * rr, z = Math.sin(a) * rr, len = H * (0.55 + r() * 0.45); Stick(x, top - 1, z, x + (r() - 0.5) * m * 0.15, top + len, z + (r() - 0.5) * m * 0.15, Math.max(0.8, m * 0.05), 0.4, CC[i % 3]); }
      break;
    }
    case 'sanse': {
      for (let i = 0; i < 9; i++) { const a = r() * PI * 2, rr = r() * pr * 0.55, bl = H * (0.6 + r() * 0.4), bw = m * 0.1; S(Math.cos(a) * rr, top + bl / 2, Math.sin(a) * rr, 1, CC[i % 3], { sx: bw, sy: bl / 2, sz: 0.8, ry: r() * PI, rz: (r() - 0.5) * 0.25, ws: 10, hs: 8 }); }
      break;
    }
    case 'cactus': {
      const cr = Math.min(pr * 0.75, fr * 0.33), ch = H * 0.95 - cr;
      C(0, top, 0, cr, cr, ch, 'a', { seg: 12 }); S(0, top + ch, 0, cr, 'a', { tl: PI / 2, ws: 12, hs: 6 });
      [-1, 1].forEach(k => { const ay = top + ch * (0.3 + r() * 0.2), al = cr * 2.1, ax = k * (cr + al * 0.6), ar = cr * 0.55, vh = ch * 0.35; Stick(k * cr * 0.7, ay, 0, ax, ay, 0, ar, ar, 'a'); C(ax, ay, 0, ar, ar, vh, 'a', { seg: 10 }); S(ax, ay + vh, 0, ar, 'a', { tl: PI / 2, ws: 10, hs: 6 }); });
      break;
    }
    case 'succ': {
      for (let L = 0; L < 3; L++) { const n = 8 - L * 2; for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + L * 0.4; leafS(Math.cos(a) * pr * 0.1, top + L * 1.5, Math.sin(a) * pr * 0.1, a, 0.5 + L * 0.3, pr * (0.55 - L * 0.12), 0.45, CC[(i + L) % 3]); } }
      break;
    }
    case 'hang': {
      const py = h - ph, cl = Math.max(0, (CTX.H || 230) - (it.y || 0) - h);
      C(0, py, 0, pr, pr * 0.78, ph, null, { seg: 24 });
      if (cl > 1) for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; Stick(Math.cos(a) * pr, h, Math.sin(a) * pr, 0, h + cl, 0, 0.2, 0.2, 0x8a7a66); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; leafS(Math.cos(a) * pr * 0.6, h - 1, Math.sin(a) * pr * 0.6, a, 0.2, fr * 0.25, 0.6, CC[i % 3]); }
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * PI * 2 + r() * 0.3, len = (h - ph) * (0.45 + r() * 0.55);
        for (let k = 0; k * 6 < len; k++) { const rr = Math.min(fr - 3, pr + k * 0.7); S(Math.cos(a) * rr, py + 2 - k * 6, Math.sin(a) * rr, 3.2, CC[(i + k) % 3], { sy: 0.35, sz: 0.8, ws: 8, hs: 6, ry: r() * PI }); }
      }
      break;
    }
    case 'flower': {
      for (let i = 0; i < 7; i++) {
        const a = r() * PI * 2, rr = fr * (0.1 + r() * 0.6), x = Math.cos(a) * rr, z = Math.sin(a) * rr, fy = Math.min(top + H * (0.55 + r() * 0.4), h - m * 0.07);
        Stick(Math.cos(a) * pr * 0.2, top * 0.6, Math.sin(a) * pr * 0.2, x, fy, z, 0.35, 0.3, STEM);
        S(x, fy, z, Math.max(1.5, m * 0.07), FLOW[(r() * FLOW.length) | 0], { sy: 0.8, ws: 10, hs: 8 });
        if (i % 2) leafS(x * 0.5, top + H * 0.3, z * 0.5, a, 0.4, m * 0.12, 0.4, 'a');
      }
      break;
    }
    default: break;
  }
}

export function buildParts(it, w, ctx) {
  P = []; LP = []; CTX = ctx || {};
  (BUILD[it.type] || BUILD.box)(it, w);
  return { P, LP };
}
