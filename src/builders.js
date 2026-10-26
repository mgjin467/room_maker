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
  frame: '액자 개수', monitor: '모니터 대수', kitchen: '도어 수', screen: '패널 수',
};

// 보조색 기본값
export const DEFA = {
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
  screen: '접이식 파티션', catTower: '캣타워', petHouse: '펫 하우스',
};

export const PV = [
  ['monstera', '몬스테라'], ['leafy', '관엽 (일반)'], ['fiddle', '떡갈 고무나무'], ['bird', '여인초·극락조'],
  ['tree', '나무형 (올리브·뱅갈)'], ['palm', '야자류'], ['fern', '고사리'], ['dracaena', '행운목'], ['stucky', '스투키'],
  ['sanse', '산세베리아'], ['cactus', '선인장'], ['succ', '다육이'], ['hang', '행잉 플랜트'], ['flower', '꽃병 (생화)'],
  ['none', '빈 화분'],
];

// 조명이 나오는 모델 (스탠드 등)
export const LAMPS = new Set(['lamp', 'flamp', 'arcLamp', 'tripod', 'mlamp', 'tlamp', 'uplight']);

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

function leaf(it, w) { if (it.fold && LEAF[it.type]) { const l = it.w - w; B(w / 2 - 1, it.h - 3 - l, 0, 2, l, it.d - 4); } }
function frame(w, d, h, i, c) { B(0, h - 9, d / 2 - i, w - 2 * i, 6, 2, c); B(0, h - 9, -d / 2 + i, w - 2 * i, 6, 2, c); B(w / 2 - i, h - 9, 0, 2, 6, d - 2 * i, c); B(-w / 2 + i, h - 9, 0, 2, 6, d - 2 * i, c); }
function SH(it, u0, v0, len, dep, sw, st) {
  const h = it.h, n = it.n || 5, cn = Math.max(1, Math.round(len / (st === 'M' ? 80 : 60))), cw = len / cn;
  const b = (u, y, v, l, hh, t, c) => sw ? B(v, y, u, t, hh, l, c) : B(u, y, v, l, hh, t, c);
  for (let k = 0; k <= n; k++) b(u0, k * (h - 2) / n, v0, len, 2, dep);
  b(u0, 0, v0 - dep / 2 + 0.5, len, h, 1, 'd');
  for (let i = 0; i <= cn; i++) { const u = u0 - len / 2 + i * cw; if (st === 'M') [1, -1].forEach(s => b(u, 0, v0 + s * (dep / 2 - 1.5), 3, h, 3, K)); else b(u, 0, v0, 3, h, dep, K); }
  for (let i = 0; i < cn; i++) { const u = u0 - len / 2 + (i + 0.5) * cw; if (st === 'M') { if (i % 2 == 0) b(u, 0, v0 + dep / 2 - 1, cw - 4, h * 0.3, 1.5, 'd'); } else if (i % 2) b(u, h * 0.36, v0 + dep / 2 - 1, cw - 4, h * 0.24, 1.5, K); }
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
    const { d, h } = it, n = it.n || 5, t = 2, sh = (h - t) / n, r = rng(it.id || 1);
    B(-w / 2 + t / 2, 0, 0, t, h, d); B(w / 2 - t / 2, 0, 0, t, h, d); B(0, 0, -d / 2 + 0.5, w, h, 1, 'd');
    for (let k = 0; k <= n; k++) B(0, k * sh, 0, w - 2 * t, t, d);
    const bd = Math.min(d - 4, 22);
    for (let k = 0; k < n; k++) {
      let x = -w / 2 + t + 1; const y = k * sh + t, end = w / 2 - t - 1;
      while (x < end - 3) {
        const bw = 2 + r() * 3.5, bh = Math.min(sh - 3, sh * (0.55 + r() * 0.35));
        if (r() < 0.14) { x += 6 + r() * 8; continue; }
        if (x + bw > end) break;
        B(x + bw / 2, y, -d / 2 + 1 + bd / 2, bw, bh, bd, BOOK[(r() * BOOK.length) | 0]);
        x += bw + 0.3;
      }
    }
  },
  shelfW: (it, w) => SH(it, 0, 0, w, it.d, 0, 'W'),
  shelfM: (it, w) => SH(it, 0, 0, w, it.d, 0, 'M'),
  shelfC: (it, w) => { const d = it.d, t = Math.min(32, w / 2); SH(it, 0, -d / 2 + t / 2, w, t, 0, 'W'); SH(it, t / 2, -w / 2 + t / 2, d - t, t, 1, 'W'); },
  shelfS: (it, w) => { const { d, h } = it, cw = w / 3, t = 2.5, cell = (x, y, dp, ch) => { B(x, y, 0, cw, t, dp); B(x, y + ch - t, 0, cw, t, dp); B(x - cw / 2 + t / 2, y, 0, t, ch, dp); B(x + cw / 2 - t / 2, y, 0, t, ch, dp); }; [[-cw, 4, 0, 1, d * 0.92], [0, 3, h * 0.06, 0.88, d], [cw, 4, 0, 1, d * 0.92]].forEach(([x, m, oy, f, dp]) => { const ch = h * f / m; for (let i = 0; i < m; i++) cell(x, oy + i * ch, dp, ch); }); },
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
  vase: (it, w) => { const { h } = it, m = Math.min(w, it.d); S(0, h * 0.35, 0, m / 2, null, { sy: (h * 0.7) / m, ws: 20, hs: 14 }); C(0, h * 0.6, 0, m * 0.16, m * 0.22, h * 0.4, null, { seg: 16 }); },
  basket: (it, w) => { const { d, h } = it; C(0, 0, 0, w / 2, w / 2 * 0.86, h, null, { sz: d / w, seg: 24 }); C(0, h - 0.3, 0, w / 2 - 1.5, w / 2 - 1.5, 0.4, 'd', { sz: d / w, seg: 24 }); T(0, h, 0, w / 2, 0.8, 'd', { rx: PI / 2, sy: d / w }); },
  books: (it, w) => { const { d, h } = it, r = rng(it.id || 1); let y = 0; while (y < h - 1.5) { const bh = 2 + r() * 2.5; B((r() - 0.5) * 3, y, (r() - 0.5) * 2, w * (0.75 + r() * 0.25), Math.min(bh, h - y), d * (0.75 + r() * 0.25), y === 0 ? null : BOOK[(r() * BOOK.length) | 0], { ry: (r() - 0.5) * 0.3 }); y += bh; } },
  rug: (it, w) => { const { d, h } = it, bw = Math.min(16, w * 0.1), bd = Math.min(16, d * 0.1); B(0, 0, 0, w, h, d, 'a'); B(0, h, 0, w - bw, 0.12, d - bd, null); B(0, h + 0.1, 0, (w - bw) * 0.45, 0.08, (d - bd) * 0.45, 'a', { ry: 0 }); },
  rugR: (it, w) => { const { d, h } = it, s = d / w; C(0, 0, 0, w / 2, w / 2, h, 'a', { sz: s, seg: 56 }); C(0, h, 0, w / 2 * 0.88, w / 2 * 0.88, 0.12, null, { sz: s, seg: 56 }); C(0, h + 0.1, 0, w / 2 * 0.35, w / 2 * 0.35, 0.08, 'a', { sz: s, seg: 40 }); },
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
};

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
