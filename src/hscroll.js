// 가로로 넘치는 칩·탭 줄: 스크롤바 표시, 양끝 페이드, 휠/마우스 드래그로 가로 스크롤
const SEL = '#tabs, .chips, .seg, .hs-auto';
const done = new WeakSet();
let ro;
function fades(el) {
  const max = el.scrollWidth - el.clientWidth;
  el.classList.toggle('fl', max > 2 && el.scrollLeft > 2);
  el.classList.toggle('fr', max > 2 && el.scrollLeft < max - 2);
}
export function hscroll(el) {
  if (done.has(el)) return; done.add(el);
  el.classList.add('hs');
  el.addEventListener('scroll', () => fades(el), { passive: true });
  // 세로 휠 → 가로 스크롤 (넘칠 때만)
  el.addEventListener('wheel', e => {
    const max = el.scrollWidth - el.clientWidth; if (max <= 2 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const nx = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
    if (nx === el.scrollLeft) return; e.preventDefault(); el.style.scrollBehavior = 'auto'; el.scrollLeft = nx; el.style.scrollBehavior = '';
  }, { passive: false });
  // 마우스로 잡아 끌기 (터치는 기본 스크롤 사용)
  let sx = 0, sl = 0, id = null, moved = false;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth + 2) return; id = e.pointerId; sx = e.clientX; sl = el.scrollLeft; moved = false; });
  el.addEventListener('pointermove', e => {
    if (id !== e.pointerId) return; const dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 6) { moved = true; el.classList.add('drag'); try { el.setPointerCapture(id); } catch { } }
    if (moved) el.scrollLeft = sl - dx;
  });
  const end = e => { if (id !== e.pointerId) return; id = null; if (moved) { el.classList.remove('drag'); const kill = ev => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener('click', kill, { capture: true, once: true }); setTimeout(() => el.removeEventListener('click', kill, { capture: true }), 50); } };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  ro.observe(el); requestAnimationFrame(() => fades(el));
}
// 선택된 탭/칩이 화면 밖이면 보이게 스크롤
export function reveal(btn) {
  const el = btn && btn.parentElement; if (!el || !el.classList.contains('hs')) return;
  const l = btn.offsetLeft - el.offsetLeft, r = l + btn.offsetWidth;
  if (l < el.scrollLeft + 8) el.scrollLeft = Math.max(0, l - 24);
  else if (r > el.scrollLeft + el.clientWidth - 8) el.scrollLeft = r - el.clientWidth + 24;
}
export function initHScroll(root = document.body) {
  ro = new ResizeObserver(es => es.forEach(e => fades(e.target)));
  const scan = n => { if (n.nodeType !== 1) return; if (n.matches(SEL)) hscroll(n); n.querySelectorAll(SEL).forEach(hscroll); };
  scan(root);
  new MutationObserver(ms => ms.forEach(m => { m.addedNodes.forEach(scan); if (m.target.nodeType === 1 && m.target.classList.contains('hs')) fades(m.target); })).observe(root, { childList: true, subtree: true });
}
