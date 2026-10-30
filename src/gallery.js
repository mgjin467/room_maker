// 이 기기 갤러리 (IndexedDB) — 실사 이미지·캡처를 만들 때마다 자동 보관. 로그인 상태면 클라우드 갤러리와 함께 보여 줌
const DBN = 'room3d-gallery', ST = 'g', MAX = 120; let dbp = null;
const idb = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open(DBN, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
const tx = async (mode, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(ST, mode), s = t.objectStore(ST), out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); }); };
export async function listLocal() { try { const all = await tx('readonly', s => s.getAll()); return (all || []).sort((a, b) => b.t - a.t); } catch (e) { return []; } }
export async function putLocal(v) {
  try { await tx('readwrite', s => s.put(v)); const all = await listLocal(); if (all.length > MAX) await tx('readwrite', s => { all.slice(MAX).forEach(x => s.delete(x.id)); }); } catch (e) { console.warn('gallery', e); }
}
export async function delLocal(id) { try { await tx('readwrite', s => s.delete(id)); } catch (e) { } }
export async function markLocal(id, patch) { try { const all = await listLocal(), v = all.find(x => x.id === id); if (v) await tx('readwrite', s => s.put({ ...v, ...patch })); } catch (e) { } }
