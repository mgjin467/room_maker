// 사진에서 얼굴 잘라내기 + 3D 머리에 입힐 텍스처
import * as THREE from 'three';

export const FACE_W = 160, FACE_H = 200;
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했습니다')); i.src = src; });

// box: [ymin, xmin, ymax, xmax] (0~1000 정규화, Gemini 형식) · adj: { dx, dy, s } 미세 조정
export async function cropFace(src, box, adj = {}) {
  const img = await loadImg(src), W = img.width, H = img.height;
  const b = box && box.length === 4 ? box : [380, 380, 620, 620];
  const y0 = b[0] / 1000 * H, x0 = b[1] / 1000 * W, y1 = b[2] / 1000 * H, x1 = b[3] / 1000 * W;
  const fw = Math.max(4, x1 - x0), fh = Math.max(4, y1 - y0), s = adj.s || 1;
  let cw = Math.max(fw * 1.12, fh * 1.08 * FACE_W / FACE_H) * s, ch = cw * FACE_H / FACE_W;
  const cx = (x0 + x1) / 2 + (adj.dx || 0) * fw * 0.08, cy = (y0 + y1) / 2 - fh * 0.04 + (adj.dy || 0) * fh * 0.08;
  const c = document.createElement('canvas'); c.width = FACE_W; c.height = FACE_H;
  const g = c.getContext('2d'); g.fillStyle = '#d9b99b'; g.fillRect(0, 0, FACE_W, FACE_H);
  g.drawImage(img, cx - cw / 2, cy - ch / 2, cw, ch, 0, 0, FACE_W, FACE_H);
  return c.toDataURL('image/jpeg', 0.88);
}
// 가운데 정사각형 기본 상자 (AI 없이 사진을 넣을 때)
export const centerBox = [250, 300, 650, 700];

const CACHE = new Map();
// 가장자리를 타원형으로 부드럽게 투명 처리한 텍스처 (zoom: 사진 확대, ox/oy: -0.5~0.5 이동)
export function faceTexture(dataURL, zoom = 1, ox = 0, oy = 0) {
  const key = dataURL.length + ':' + dataURL.slice(-40) + ':' + zoom + ':' + ox + ':' + oy;
  if (CACHE.has(key)) return CACHE.get(key);
  const c = document.createElement('canvas'); c.width = FACE_W; c.height = FACE_H;
  const tex = new THREE.CanvasTexture(c);
  loadImg(dataURL).then(img => {
    const g = c.getContext('2d'), z = Math.max(0.3, zoom || 1), w = FACE_W * z, h = FACE_H * z;
    g.fillStyle = '#000'; g.fillRect(0, 0, FACE_W, FACE_H);
    g.drawImage(img, (FACE_W - w) / 2 - (ox || 0) * FACE_W, (FACE_H - h) / 2 - (oy || 0) * FACE_H, w, h);
    g.globalCompositeOperation = 'destination-in';
    g.save(); g.translate(FACE_W / 2, FACE_H * 0.5); g.scale(1, FACE_H / FACE_W);
    const r = FACE_W / 2, gr = g.createRadialGradient(0, 0, r * 0.72, 0, 0, r);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.restore();
    tex.needsUpdate = true;
  }).catch(() => { });
  CACHE.set(key, tex); if (CACHE.size > 80) CACHE.delete(CACHE.keys().next().value);
  return tex;
}
// 얼굴 사진의 볼 부위 평균색 → 머리·목·손 피부색
export async function sampleSkin(dataURL) {
  const img = await loadImg(dataURL), c = document.createElement('canvas'); c.width = 40; c.height = 50;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0, 40, 50);
  let r = 0, gg = 0, b = 0, n = 0;
  [[8, 28, 8, 8], [24, 28, 8, 8], [16, 36, 8, 6]].forEach(([x, y, w, h]) => { const d = g.getImageData(x, y, w, h).data; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } });
  const hx = v => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + hx(r) + hx(gg) + hx(b);
}
