// 참고 사진 저장소 — 이 기기(IndexedDB) + 클라우드(users/{uid}/refs/{id})
// 가구·사람·공간에는 { id, kind, note } 만 저장하고 이미지는 여기서 꺼내 씀 (프로젝트 저장 용량 절약)
import { Cloud } from './cloud.js';

const DBN = 'room3d-refs', ST = 'refs', MEM = new Map(); let dbp = null;
const idb = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
async function lget(id) { try { const d = await idb(); return await new Promise(res => { const q = d.transaction(ST).objectStore(ST).get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); } catch (e) { return null; } }
async function lset(id, v) { try { const d = await idb(); await new Promise(res => { const q = d.transaction(ST, 'readwrite').objectStore(ST).put(v, id); q.onsuccess = q.onerror = () => res(); }); } catch (e) { } }
async function ldel(id) { try { const d = await idb(); await new Promise(res => { const q = d.transaction(ST, 'readwrite').objectStore(ST).delete(id); q.onsuccess = q.onerror = () => res(); }); } catch (e) { } }

export const REF_KINDS = {
  person: [['face', '얼굴'], ['outfit', '옷차림'], ['body', '체형'], ['pose', '자세·느낌'], ['hair', '헤어'], ['look', '전체 느낌']],
  item: [['look', '전체 느낌'], ['shape', '모양·형태'], ['material', '재질·색감'], ['detail', '디테일'], ['dims', '치수·도면']],
  space: [['style', '전체 분위기'], ['material', '마감·재질'], ['layout', '도면·치수'], ['view', '주변 풍경']],
};
export const REF_EN = { face: 'FACE and facial features', outfit: 'CLOTHING (garments, fabric, colors, accessories)', body: 'BODY SHAPE / build', pose: 'POSE and mood', hair: 'HAIRSTYLE and hair color', look: 'overall LOOK and style', shape: 'SHAPE and form', material: 'MATERIALS, textures and colors', detail: 'DETAILS (hardware, stitching, edges)', dims: 'proportions / dimensions', style: 'overall interior/exterior STYLE and atmosphere', layout: 'layout', view: 'surrounding scenery' };

export async function putRef(dataURL) {
  const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  MEM.set(id, dataURL); await lset(id, dataURL);
  if (Cloud.user) Cloud.setRef(id, dataURL).catch(e => console.warn('ref upload', e));
  return id;
}
export async function getRef(id) {
  if (!id) return null; if (MEM.has(id)) return MEM.get(id);
  let v = await lget(id);
  if (!v && Cloud.user) { try { v = await Cloud.getRef(id); if (v) lset(id, v); } catch (e) { } }
  if (v) MEM.set(id, v); return v;
}
export async function delRef(id) { MEM.delete(id); await ldel(id); if (Cloud.user) Cloud.delRef(id).catch(() => { }); }
// 로그인 직후: 이 기기에만 있는 참고 사진을 클라우드에 올림
export async function uploadMissing(ids) {
  if (!Cloud.user) return 0; let n = 0;
  for (const id of new Set(ids)) { try { const loc = await lget(id); if (!loc) continue; const r = await Cloud.getRef(id); if (!r) { await Cloud.setRef(id, loc); n++; } } catch (e) { } }
  return n;
}
