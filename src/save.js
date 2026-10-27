// 파일 저장 — PC: 바로 다운로드 / 모바일: 미리보기 + 공유(사진 앱 저장) + 다운로드 + 길게 눌러 저장
export const isMobile = () => matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function toBlob(data, type) {
  if (data instanceof Blob) return data;
  if (typeof data === 'string' && data.startsWith('data:')) { const r = await fetch(data); return r.blob(); }
  if (data && data.toBlob) return new Promise(res => data.toBlob(res, type || 'image/png', 0.95));
  return new Blob([data], { type: type || 'application/octet-stream' });
}
function directDownload(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.append(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}
async function share(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  return false;
}
let modal = null;
function ensureModal() {
  if (modal) return modal;
  modal = document.createElement('div'); modal.id = 'savem'; modal.hidden = true;
  modal.innerHTML = '<div class="sv-box"><div class="sv-h"><b class="sv-t"></b><button class="x sv-c" aria-label="닫기">×</button></div><div class="sv-img"></div><p class="sv-hint mu sm"></p><div class="r sv-btns"></div></div>';
  document.body.append(modal);
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.sv-c')) close(); });
  return modal;
}
function close() { if (modal) { modal.hidden = true; const u = modal.dataset.url; if (u) URL.revokeObjectURL(u); modal.dataset.url = ''; } }

// name: 파일명, data: Blob | dataURL | canvas | string
export async function saveFile(name, data, type, { preview } = {}) {
  const blob = await toBlob(data, type), img = blob.type.startsWith('image/');
  if (!isMobile() && !preview) return directDownload(blob, name);
  if (!img && isMobile()) { try { if (await share(blob, name)) return; } catch (e) { if (e.name === 'AbortError') return; } return directDownload(blob, name); }
  const m = ensureModal(), url = URL.createObjectURL(blob);
  m.dataset.url = url; m.querySelector('.sv-t').textContent = name;
  m.querySelector('.sv-img').innerHTML = img ? `<img src="${url}" alt="${name}">` : '<p>파일이 준비되었습니다.</p>';
  m.querySelector('.sv-hint').textContent = img ? (isIOS() ? '‘공유 · 사진에 저장’을 누르거나, 이미지를 길게 눌러 ‘사진 앱에 저장’을 선택하세요.' : '‘공유·저장’ 또는 ‘다운로드’를 누르세요. 이미지를 길게 눌러 저장할 수도 있습니다.') : '';
  const btns = m.querySelector('.sv-btns'); btns.innerHTML = '';
  const b1 = document.createElement('button'); b1.className = 'b'; b1.textContent = '공유 · 사진에 저장';
  b1.onclick = async () => { try { if (!(await share(blob, name))) directDownload(blob, name); } catch (e) { if (e.name !== 'AbortError') directDownload(blob, name); } };
  const b2 = document.createElement('button'); b2.className = 'o'; b2.textContent = '다운로드'; b2.onclick = () => directDownload(blob, name);
  const b3 = document.createElement('button'); b3.className = 'o'; b3.textContent = '새 탭에서 열기'; b3.onclick = () => window.open(url, '_blank');
  if (navigator.canShare) btns.append(b1); btns.append(b2, b3);
  m.hidden = false;
}
