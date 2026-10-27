// 가구 재질(질감) 텍스처와 창밖 풍경
import * as THREE from 'three';

export const MATS = [
  ['', '기본 (단색)'], ['wood', '원목 결'], ['walnut', '월넛 (진한 원목)'], ['oak', '오크 (밝은 원목)'], ['fabric', '패브릭'], ['linen', '린넨'],
  ['velvet', '벨벳'], ['boucle', '부클레'], ['leather', '가죽'], ['metal', '메탈 (무광)'], ['chrome', '크롬 (유광)'], ['gold', '골드 메탈'],
  ['marble', '대리석'], ['ceramic', '세라믹'], ['glass', '유리'], ['rattan', '라탄'], ['concrete', '콘크리트'], ['lacquer', '하이그로시 (유광)'], ['matte', '무광 도장'],
];
export const MATN = Object.fromEntries(MATS);

let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const TEX = {};
function canvasTex(key, N, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); seed = 11; draw(g, N);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return (TEX[key] = t);
}
// 흰색 바탕의 명암 패턴 → material.color 로 색을 입힘
export function matTexture(m) {
  switch (m) {
    case 'wood': case 'walnut': case 'oak': return canvasTex('wood', 256, (g, N) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 90; i++) { const y = r() * N; g.strokeStyle = `rgba(0,0,0,${0.04 + r() * (m === 'walnut' ? 0.16 : 0.1)})`; g.lineWidth = 0.5 + r() * 2; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= N; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + (r() - 0.5) * 2); g.stroke(); }
      for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(r() * N, r() * N, 6 + r() * 10, 2 + r() * 3, 0, 0, Math.PI * 2); g.stroke(); }
    });
    case 'fabric': case 'linen': case 'boucle': case 'velvet': return canvasTex(m, 128, (g, N) => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
      if (m === 'boucle') { for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.14})`; g.beginPath(); g.arc(r() * N, r() * N, 0.6 + r() * 1.6, 0, Math.PI * 2); g.fill(); } return; }
      if (m === 'velvet') { const gr = g.createLinearGradient(0, 0, N, N); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(0.5, 'rgba(0,0,0,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, N, N); }
      for (let y = 0; y < N; y += 2) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`; g.fillRect(0, y, N, 1); }
      for (let x = 0; x < N; x += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + r() * (m === 'linen' ? 0.08 : 0.04)})`; g.fillRect(x, 0, 1, N); }
    });
    case 'leather': return canvasTex('leather', 128, (g, N) => { g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(0,0,0,${r() * 0.1})`; g.beginPath(); const x = r() * N, y = r() * N; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 6, y + (r() - 0.5) * 6); g.stroke(); } });
    case 'marble': return canvasTex('marble', 256, (g, N) => { g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); for (let i = 0; i < 10; i++) { g.strokeStyle = `rgba(80,80,90,${0.08 + r() * 0.2})`; g.lineWidth = 0.5 + r() * 2; g.beginPath(); let x = r() * N, y = 0; g.moveTo(x, y); while (y < N) { x += (r() - 0.5) * 40; y += 10 + r() * 30; g.lineTo(x, y); } g.stroke(); } });
    case 'rattan': return canvasTex('rattan', 128, (g, N) => { g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2; for (let k = -N; k < N * 2; k += 10) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke(); g.beginPath(); g.moveTo(k, N); g.lineTo(k + N, 0); g.stroke(); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc((i % 7) * 20 + 5, Math.floor(i / 7) * 20 + 5, 3, 0, Math.PI * 2); g.fill(); } });
    case 'concrete': return canvasTex('concrete', 128, (g, N) => { g.fillStyle = '#fff'; g.fillRect(0, 0, N, N); for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * N, r() * N, 1 + r() * 2, 1 + r() * 2); } });
    default: return null;
  }
}
// 재질 적용 (color: hex number) → material
export function makeMat(m, color, extra = {}) {
  let mt;
  const c = new THREE.Color(color);
  if (m === 'walnut') c.multiplyScalar(0.8);
  if (m === 'metal' || m === 'chrome' || m === 'gold' || m === 'lacquer' || m === 'ceramic' || m === 'glass') {
    const sh = { metal: 30, chrome: 120, gold: 90, lacquer: 100, ceramic: 60, glass: 120 }[m];
    mt = new THREE.MeshPhongMaterial({ color: m === 'gold' ? new THREE.Color(0xc9a24a).lerp(c, 0.25) : c, shininess: sh, specular: new THREE.Color(m === 'metal' ? 0x555555 : 0xbbbbbb) });
    if (m === 'glass') { mt.transparent = true; mt.opacity = 0.35; mt.depthWrite = false; mt.side = THREE.DoubleSide; }
  } else {
    mt = new THREE.MeshLambertMaterial({ color: c });
    const t = matTexture(m); if (t) { mt.map = t; }
  }
  Object.assign(mt, extra);
  return mt;
}

// ---------- 창밖 풍경 ----------
export const VIEWS = [['none', '없음 (하늘색)'], ['city', '도시 (빌딩)'], ['apt', '아파트 단지'], ['nature', '자연 (산·숲)'], ['park', '공원·정원'], ['sea', '바다'], ['snow', '설경']];
export const VTIME = [['auto', '자동 (주간/야간 모드 따라감)'], ['day', '낮'], ['sunset', '노을'], ['night', '밤']];
const VTEX = {};
export function viewTexture(kind, time) {
  const k = kind + time; if (VTEX[k]) return VTEX[k];
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); seed = 3;
  const night = time === 'night', sunset = time === 'sunset';
  const sky = g.createLinearGradient(0, 0, 0, H);
  if (night) { sky.addColorStop(0, '#060a1a'); sky.addColorStop(1, '#1b2340'); }
  else if (sunset) { sky.addColorStop(0, '#3b4a7a'); sky.addColorStop(0.5, '#f08a5d'); sky.addColorStop(1, '#ffd38a'); }
  else { sky.addColorStop(0, '#6fa8e6'); sky.addColorStop(1, '#d8ecfb'); }
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  if (night) { for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(r() * W, r() * H * 0.5, 1.5, 1.5); } g.fillStyle = '#f4f1d8'; g.beginPath(); g.arc(W * 0.8, H * 0.18, 22, 0, Math.PI * 2); g.fill(); }
  else if (!sunset && kind !== 'none') { g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 6; i++) { const x = r() * W, y = 30 + r() * 120; for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(x + j * 22, y + (j % 2) * 8, 18 + r() * 12, 0, Math.PI * 2); g.fill(); } } }
  if (sunset) { g.fillStyle = 'rgba(255,220,150,.9)'; g.beginPath(); g.arc(W * 0.3, H * 0.62, 40, 0, Math.PI * 2); g.fill(); }
  const shade = (base, f) => { const col = new THREE.Color(base); if (night) col.multiplyScalar(0.25); else if (sunset) col.lerp(new THREE.Color(0xc0604a), 0.3).multiplyScalar(0.75); return '#' + col.multiplyScalar(f).getHexString(); };
  const hills = (y0, amp, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, y0 - Math.sin(x / 140 + y0) * amp - Math.sin(x / 47) * amp * 0.3); g.lineTo(W, H); g.fill(); };
  const tree = (x, y, s, col) => { g.fillStyle = shade('#5b4636', 1); g.fillRect(x - s * 0.08, y - s * 0.4, s * 0.16, s * 0.4); g.fillStyle = col; g.beginPath(); g.arc(x, y - s * 0.6, s * 0.38, 0, Math.PI * 2); g.fill(); };
  const buildings = (y0, n, hmin, hmax, colr, lit) => {
    let x = -20; while (x < W) {
      const bw = 40 + r() * 70, bh = hmin + r() * (hmax - hmin); g.fillStyle = shade(colr, 0.85 + r() * 0.3); g.fillRect(x, y0 - bh, bw, bh);
      for (let wy = y0 - bh + 8; wy < y0 - 6; wy += 12) for (let wx = x + 6; wx < x + bw - 6; wx += 10) { const on = r() < (night ? lit : 0.15); g.fillStyle = on ? (night ? `rgba(255,${200 + r() * 40},${120 + r() * 60},.95)` : 'rgba(255,255,255,.5)') : (night ? 'rgba(20,25,40,.9)' : 'rgba(80,110,140,.45)'); g.fillRect(wx, wy, 5, 7); }
      x += bw + 4 + r() * 10; void n;
    }
  };
  switch (kind) {
    case 'city': buildings(H * 0.92, 0, 120, 330, '#8a96a8', 0.45); buildings(H, 0, 60, 200, '#6d7684', 0.55); break;
    case 'apt': hills(H * 0.55, 20, shade('#7f9a77', 1)); { let x = 20; while (x < W) { const bw = 70, bh = 200 + r() * 90; g.fillStyle = shade('#e8e2d6', 1); g.fillRect(x, H * 0.95 - bh, bw, bh); for (let wy = H * 0.95 - bh + 10; wy < H * 0.95 - 8; wy += 14) for (let wx = x + 8; wx < x + bw - 8; wx += 14) { g.fillStyle = night && r() < 0.5 ? 'rgba(255,215,150,.95)' : shade('#7d8fa3', 1); g.fillRect(wx, wy, 8, 7); } x += bw + 50 + r() * 30; } } for (let i = 0; i < 30; i++) tree(r() * W, H, 40 + r() * 30, shade('#4f7d43', 0.8 + r() * 0.4)); break;
    case 'nature': hills(H * 0.45, 40, shade('#8aa3b8', 1)); hills(H * 0.6, 30, shade('#5e8a5a', 1)); hills(H * 0.78, 20, shade('#3f6e3d', 1)); for (let i = 0; i < 40; i++) tree(r() * W, H * 0.8 + r() * H * 0.2, 40 + r() * 60, shade('#356b33', 0.8 + r() * 0.4)); break;
    case 'park': g.fillStyle = shade('#7fae5a', 1); g.fillRect(0, H * 0.7, W, H * 0.3); for (let i = 0; i < 18; i++) tree(r() * W, H * 0.72 + r() * H * 0.25, 80 + r() * 90, shade('#3f7a3a', 0.8 + r() * 0.4)); for (let i = 0; i < 60; i++) { g.fillStyle = ['#f49ac2', '#f2c14e', '#ffffff', '#e86a92'][i % 4]; g.globalAlpha = night ? 0.3 : 0.9; g.beginPath(); g.arc(r() * W, H * 0.85 + r() * H * 0.15, 3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; break;
    case 'sea': { const sea = g.createLinearGradient(0, H * 0.55, 0, H); sea.addColorStop(0, shade('#3f7fb0', 1)); sea.addColorStop(1, shade('#1f4f78', 1)); g.fillStyle = sea; g.fillRect(0, H * 0.55, W, H * 0.45); g.strokeStyle = night ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.35)'; for (let i = 0; i < 80; i++) { const y = H * 0.56 + r() * H * 0.44; g.beginPath(); g.moveTo(r() * W, y); g.lineTo(r() * W, y); g.stroke(); } g.fillStyle = shade('#e7d7b0', 1); g.fillRect(0, H * 0.93, W, H * 0.07); break; }
    case 'snow': hills(H * 0.5, 40, night ? '#46506a' : '#e8eef5'); hills(H * 0.7, 25, night ? '#5a647e' : '#f6f8fb'); for (let i = 0; i < 30; i++) { const x = r() * W, y = H * 0.72 + r() * H * 0.25, s = 40 + r() * 50; g.fillStyle = shade('#2f5a3d', 1); g.beginPath(); g.moveTo(x, y - s); g.lineTo(x - s * 0.3, y); g.lineTo(x + s * 0.3, y); g.fill(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.moveTo(x, y - s); g.lineTo(x - s * 0.12, y - s * 0.6); g.lineTo(x + s * 0.12, y - s * 0.6); g.fill(); } break;
    default: break;
  }
  const t = new THREE.CanvasTexture(c); return (VTEX[k] = t);
}
