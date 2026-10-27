// 전체 화면 이미지 뷰어 — 화면 꽉 채움, 탭/클릭·X·Esc·뒤로가기로 닫기, 핀치·휠 확대, 세로 화면에서 가로 이미지는 돌려 보기
let cur = null;
export function viewImg(src, title = '') {
  if (!src) return;
  if (cur) cur.close(true);
  const ov = document.createElement('div'); ov.className = 'lbx';
  ov.innerHTML = `<img alt=""><div class="lbx-bar"><span class="lbx-t"></span><button class="lbx-rot" title="돌려서 크게 보기">⟳ 가로로</button><button class="lbx-x" title="닫기" aria-label="닫기">✕</button></div><div class="lbx-hint">탭하면 닫힘 · 두 손가락/휠로 확대</div>`;
  const img = ov.querySelector('img'), rotB = ov.querySelector('.lbx-rot');
  ov.querySelector('.lbx-t').textContent = title; img.src = src; img.alt = title;
  let s = 1, tx = 0, ty = 0, rot = 0, nw = 0, nh = 0;
  const vw = () => window.innerWidth, vh = () => window.innerHeight;
  const fit = () => { // 회전 여부를 반영해 화면에 꽉 차는 크기
    if (!nw) return;
    const r = rot % 180 !== 0, iw = r ? nh : nw, ih = r ? nw : nh, k = Math.min(vw() / iw, vh() / ih);
    img.style.width = nw * k + 'px'; img.style.height = nh * k + 'px';
    const portrait = vh() > vw(), wideImg = nw > nh * 1.15;
    rotB.style.display = (portrait && wideImg) || rot ? '' : 'none';
    rotB.textContent = rot ? '↺ 원래대로' : '⟳ 가로로';
    apply();
  };
  const apply = () => { img.style.transform = `translate(-50%,-50%) translate(${tx}px,${ty}px) rotate(${rot}deg) scale(${s})`; };
  const reset = () => { s = 1; tx = ty = 0; apply(); };
  img.onload = () => { nw = img.naturalWidth; nh = img.naturalHeight; fit(); };
  const onRes = () => { if (rot && vw() > vh()) rot = 0; fit(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  const onPop = () => close(true);
  function close(fromPop) {
    if (!cur || cur.ov !== ov) return; cur = null;
    window.removeEventListener('resize', onRes); window.removeEventListener('orientationchange', onRes);
    document.removeEventListener('keydown', onKey, true); window.removeEventListener('popstate', onPop);
    try { if (document.fullscreenElement === ov) document.exitFullscreen(); } catch {}
    ov.classList.remove('on'); setTimeout(() => ov.remove(), 160);
    if (!fromPop && history.state && history.state.lbx) history.back();
  }
  ov.querySelector('.lbx-x').onclick = e => { e.stopPropagation(); close(); };
  rotB.onclick = e => { e.stopPropagation(); rot = rot ? 0 : 90; reset(); fit(); };
  // 클릭(마우스) — 드래그가 아니면 닫기
  let md = null;
  ov.addEventListener('mousedown', e => { if (e.target.closest('.lbx-bar button')) return; md = { x: e.clientX, y: e.clientY, tx, ty, moved: false }; });
  window.addEventListener('mousemove', e => { if (!md || !cur || cur.ov !== ov) return; const dx = e.clientX - md.x, dy = e.clientY - md.y; if (Math.hypot(dx, dy) > 6) md.moved = true; if (md.moved && s > 1) { tx = md.tx + dx; ty = md.ty + dy; apply(); } });
  ov.addEventListener('mouseup', e => { const m = md; md = null; if (m && !m.moved && !e.target.closest('.lbx-bar button')) close(); });
  ov.addEventListener('wheel', e => { e.preventDefault(); const k = Math.exp(-e.deltaY * 0.0015), ns = Math.min(8, Math.max(1, s * k)); const cx = e.clientX - vw() / 2, cy = e.clientY - vh() / 2; tx = cx - (cx - tx) * ns / s; ty = cy - (cy - ty) * ns / s; s = ns; if (s === 1) tx = ty = 0; apply(); }, { passive: false });
  ov.addEventListener('dblclick', e => e.preventDefault());
  // 터치 — 한 손가락 탭 = 닫기, 두 손가락 = 확대, 확대 중 드래그 = 이동
  let t = null, lastTap = 0;
  const dist = ts => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  const mid = ts => ({ x: (ts[0].clientX + ts[1].clientX) / 2 - vw() / 2, y: (ts[0].clientY + ts[1].clientY) / 2 - vh() / 2 });
  ov.addEventListener('touchstart', e => {
    if (e.target.closest('.lbx-bar button')) return;
    e.preventDefault(); const ts = e.touches;
    if (ts.length >= 2) t = { pinch: true, d: dist(ts), m: mid(ts), s, tx, ty, moved: true };
    else if (!t) t = { x: ts[0].clientX, y: ts[0].clientY, tx, ty, t0: Date.now(), moved: false };
  }, { passive: false });
  ov.addEventListener('touchmove', e => {
    if (!t) return; e.preventDefault(); const ts = e.touches;
    if (t.pinch && ts.length >= 2) { const ns = Math.min(8, Math.max(1, t.s * dist(ts) / t.d)), m = mid(ts); tx = m.x - (t.m.x - t.tx) * ns / t.s; ty = m.y - (t.m.y - t.ty) * ns / t.s; s = ns; if (s === 1) tx = ty = 0; apply(); }
    else if (!t.pinch) { const dx = ts[0].clientX - t.x, dy = ts[0].clientY - t.y; if (Math.hypot(dx, dy) > 10) t.moved = true; if (t.moved && s > 1) { tx = t.tx + dx; ty = t.ty + dy; apply(); } }
  }, { passive: false });
  ov.addEventListener('touchend', e => {
    if (!t || e.touches.length) return; const g = t; t = null;
    if (g.moved || Date.now() - g.t0 > 600) return;
    const now = Date.now();
    if (now - lastTap < 280) { lastTap = 0; clearTimeout(ov._tap); s > 1 ? reset() : (s = 2.5, apply()); return; } // 두 번 탭 = 확대/원래대로
    lastTap = now; ov._tap = setTimeout(close, 260);
  });
  document.body.append(ov); requestAnimationFrame(() => ov.classList.add('on'));
  window.addEventListener('resize', onRes); window.addEventListener('orientationchange', onRes);
  document.addEventListener('keydown', onKey, true);
  try { history.pushState({ ...(history.state || {}), lbx: 1 }, ''); window.addEventListener('popstate', onPop); } catch {}
  cur = { ov, close };
  return cur;
}
