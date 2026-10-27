// AI 기능 UI: 대화 명령 · 사진 인식(가구/사람/방) · 실사 렌더 · 설정(키·모델) · 갤러리
import { PROVIDERS, TASKS, DEFAULT_MODELS, parseKeys, aiText, aiImage, parseJSON, listModels, fileToDataURL, coverResize } from './ai.js';
import { Cloud, parseCfg, saveCfg, loadCfg, RULES, cfgLink, cfgFileCode, BUILTIN } from './cloud.js';
import qrcode from 'qrcode-generator';
import { cropFace, centerBox, sampleSkin } from './faces.js';

const K_KEYS = 'room3d.v2.aikeys', K_MODELS = 'room3d.v2.aimodels', K_EXTRA = 'room3d.v2.aiextra', K_CHAT = 'room3d.v2.chat';
const ASPECTS = [['1:1', 1], ['2:3', 2 / 3], ['3:2', 1.5], ['3:4', 0.75], ['4:3', 4 / 3], ['4:5', 0.8], ['5:4', 1.25], ['9:16', 9 / 16], ['16:9', 16 / 9], ['21:9', 21 / 9]];
const nearestAspect = r => ASPECTS.reduce((a, b) => (Math.abs(Math.log(b[1] / r)) < Math.abs(Math.log(a[1] / r)) ? b : a))[0];
export const SIZES = [
  ['yt', '유튜브 16:9 · FHD 1920×1080', 1920, 1080], ['yt4k', '유튜브 4K 16:9 · 3840×2160', 3840, 2160], ['shorts', '쇼츠·릴스 9:16 · 1080×1920', 1080, 1920],
  ['mobP', '모바일 세로 · 1170×2532', 1170, 2532], ['mobL', '모바일 가로 · 2532×1170', 2532, 1170], ['pc', 'PC 모니터 16:9 · 2560×1440', 2560, 1440],
  ['pc1610', 'PC·맥북 16:10 · 2560×1600', 2560, 1600], ['wide', '울트라와이드 21:9 · 3440×1440', 3440, 1440], ['tab', '태블릿 4:3 · 2048×1536', 2048, 1536],
  ['insta', '인스타 정사각 1:1 · 1080×1080', 1080, 1080], ['insta45', '인스타 세로 4:5 · 1080×1350', 1080, 1350], ['a4', 'A4 가로 인쇄 · 3508×2480', 3508, 2480], ['custom', '직접 입력', 0, 0],
];
const STYLES = [['real', '있는 그대로 (사실적)'], ['warm', '따뜻한 저녁 분위기'], ['noon', '밝은 오후 자연광'], ['mag', '인테리어 매거진 화보'], ['hotel', '호텔 라운지 느낌'], ['nordic', '북유럽 감성'], ['minimal', '모던 미니멀'], ['vintage', '빈티지 필름 톤'], ['cine', '시네마틱 영화 장면']];
const STYLEP = { real: 'Keep the mood neutral and realistic.', warm: 'Warm cozy evening mood, warm white artificial light, soft shadows.', noon: 'Bright afternoon natural daylight from the windows, soft bounced light.', mag: 'High-end interior design magazine photograph, perfectly styled, crisp details.', hotel: 'Luxury hotel lounge ambience, refined lighting.', nordic: 'Scandinavian, airy, light tones, natural textures.', minimal: 'Modern minimal, clean surfaces.', vintage: 'Vintage analog film look, slight grain, warm tones.', cine: 'Cinematic film still, dramatic but natural lighting, shallow depth of field.' };

export function initAI(A) {
  const { h, BTN, F, G, app, toast, LS } = A;
  let KEYS = LS.get(K_KEYS, {}), MODELS = { ...DEFAULT_MODELS, ...LS.get(K_MODELS, {}) }, EXTRA = LS.get(K_EXTRA, {});
  let CHAT = LS.get(K_CHAT, []), busy = false, attach = [];
  const keyOf = p => KEYS[PROVIDERS[p]?.key] || '';
  const modelFor = t => { const [p, m] = MODELS[t] || DEFAULT_MODELS[t]; return { provider: p, model: m, key: keyOf(p) }; };
  const saveLocal = () => { LS.set(K_KEYS, KEYS); LS.set(K_MODELS, MODELS); LS.set(K_EXTRA, EXTRA); };
  async function saveCloud() { if (!Cloud.user) return; try { await Cloud.setMeta('aikeys', { keys: KEYS }); await Cloud.setMeta('aimodels', { models: JSON.stringify(MODELS), extra: JSON.stringify(EXTRA) }); } catch (e) { toast('클라우드 저장 실패: ' + e.message, 5000); } }

  // ---------- 모달 ----------
  function modal(title, body, { wide, onClose } = {}) {
    const bg = h('div', { class: 'mdl' }), box = h('div', { class: 'mdl-box' + (wide ? ' wide' : '') }), close = () => { bg.remove(); onClose && onClose(); };
    box.append(h('div', { class: 'mdl-h' }, h('b', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': '닫기' }, '×')), h('div', { class: 'mdl-b' }, body));
    bg.append(box); bg.addEventListener('click', e => { if (e.target === bg) close(); }); document.body.append(bg);
    return { bg, box, close };
  }
  const modelOpts = (p, kind) => { const base = PROVIDERS[p][kind === 'image' ? 'image' : 'text'], ex = (EXTRA[p] && EXTRA[p][kind === 'image' ? 'image' : 'text']) || []; const seen = new Set(base.map(x => x[0])); return [...base, ...ex.filter(m => !seen.has(m)).map(m => [m, m + ' (API 목록)'])]; };
  function modelPicker(task, onChange) {
    const kind = task === 'image' ? 'image' : 'text', provs = Object.keys(PROVIDERS).filter(p => PROVIDERS[p][kind === 'image' ? 'image' : 'text'].length || (EXTRA[p] && (EXTRA[p][kind] || []).length));
    const cur = MODELS[task] || DEFAULT_MODELS[task];
    const ps = h('select', {}, provs.map(p => h('option', { value: p }, PROVIDERS[p].name))), ms = h('select', {}), cu = h('input', { type: 'text', placeholder: '모델 ID 직접 입력 (선택)' });
    const fill = () => { ms.innerHTML = ''; modelOpts(ps.value, kind).forEach(([v, t]) => ms.append(h('option', { value: v }, t))); };
    ps.value = cur[0]; fill(); if ([...ms.options].some(o => o.value === cur[1])) ms.value = cur[1]; else cu.value = cur[1];
    const set = () => { MODELS[task] = [ps.value, cu.value.trim() || ms.value]; saveLocal(); onChange && onChange(); };
    ps.onchange = () => { fill(); cu.value = ''; set(); }; ms.onchange = () => { cu.value = ''; set(); }; cu.onchange = set;
    return h('div', { class: 'mp' }, G(2, ps, ms), cu);
  }

  // ---------- 설정 ----------
  function openSettings() {
    const body = h('div', {});
    const where = h('p', { class: 'mu sm' }, Cloud.user ? `☁ 로그인됨 (${Cloud.user.email || ''}) — 키와 모델 설정이 클라우드(users/${Cloud.user.uid.slice(0, 6)}…/meta)에 저장되어 다른 기기에서도 쓰입니다.` : '로그인하지 않아 이 브라우저에만 저장됩니다. ‘저장·출력’ 탭에서 로그인하면 클라우드에 저장됩니다.');
    const paste = h('textarea', { rows: 4, placeholder: 'geminiApiKey, AIza…\ngroqApiKey, gsk_…\nopenaiApiKey, sk-proj-…\nclaude API, sk-ant-…\n(이 형식 그대로 붙여 넣으면 자동 인식)' });
    const render = () => {
      body.innerHTML = '';
      app(body, where, h('h3', {}, 'API 키'),
        ...Object.entries(PROVIDERS).map(([p, v]) => {
          const inp = h('input', { type: 'password', placeholder: v.hint, value: KEYS[v.key] || '', autocomplete: 'off' }), st = h('small', { class: 'mu' }, KEYS[v.key] ? `저장됨 ••••${KEYS[v.key].slice(-4)}` : '없음');
          return h('div', { class: 'kc' }, h('div', { class: 'kh' }, h('b', {}, v.name), st),
            h('div', { class: 'kr' }, inp, BTN('👁', () => { inp.type = inp.type === 'password' ? 'text' : 'password'; }, 'c')),
            h('div', { class: 'r' },
              BTN('저장/업데이트', async () => { KEYS[v.key] = inp.value.trim(); saveLocal(); await saveCloud(); toast(`${v.name} 키를 저장했습니다`); render(); }, 'b'),
              BTN('삭제', async () => { delete KEYS[v.key]; saveLocal(); await saveCloud(); toast('삭제했습니다'); render(); }),
              BTN('연결 테스트 · 모델 목록 불러오기', async e => { const b = e.target; b.disabled = true; b.textContent = '확인 중…'; try { const r = await listModels(p, inp.value.trim() || KEYS[v.key]); EXTRA[p] = r; saveLocal(); await saveCloud(); toast(`✅ 연결됨 · 모델 ${r.text.length + r.image.length}개`); render(); } catch (err) { toast('❌ ' + err.message, 7000); b.disabled = false; b.textContent = '다시 시도'; } })));
        }),
        h('h4', {}, '키 한 번에 붙여넣기'), paste,
        h('div', { class: 'r' }, BTN('인식해서 저장', async () => { const k = parseKeys(paste.value); if (!Object.keys(k).length) return toast('인식된 키가 없습니다'); Object.assign(KEYS, k); saveLocal(); await saveCloud(); toast(`${Object.keys(k).length}개 키를 저장했습니다`); paste.value = ''; render(); }, 'b'), BTN('이 기기에서 모든 키 지우기', () => { if (!confirm('이 브라우저에 저장된 키를 지울까요? (클라우드 사본은 유지)')) return; KEYS = {}; LS.set(K_KEYS, {}); render(); })),
        h('p', { class: 'mu sm' }, 'Claude는 Console의 API 키(sk-ant-api…)가 필요합니다. 키는 브라우저에서 각 AI 회사 서버로 직접 전송됩니다.'),
        h('h3', {}, '작업별 AI 모델'),
        ...TASKS.map(([t, n]) => F(n, modelPicker(t))),
        h('p', { class: 'mu sm' }, '실사 이미지는 Gemini(Nano Banana) 또는 OpenAI(GPT Image) 이미지 모델만 가능합니다. 새 모델이 나오면 ‘모델 목록 불러오기’ 또는 직접 입력으로 바로 쓸 수 있습니다.'),
        h('div', { class: 'r' }, BTN('모델 설정 클라우드에 저장', async () => { saveLocal(); await saveCloud(); toast('저장했습니다'); }, 'b')));
    };
    render(); modal('⚙ AI 설정 — 키 · 모델', body, { wide: true });
  }

  // ---------- 프롬프트 ----------
  const catalogNames = () => A.CAT.map(([c, ls]) => `${c}: ${ls.map(p => p[0]).join(', ')}`).join('\n');
  const typeList = () => Object.entries(A.TYPES).map(([k, v]) => `${k}=${v}`).join(', ');
  const colList = () => Object.entries(A.COLSTY).map(([k, v]) => `${k}: ${v.map(([c, n]) => c + '=' + n).join(' ')}`).join('\n');
  function chatSystem() {
    return `당신은 한국어로 대화하는 인테리어 3D 배치 앱의 AI 비서입니다. 사용자의 요청을 앱 동작(JSON)으로 바꾸고 짧게 설명합니다.
반드시 JSON 객체 하나만 출력: {"reply":"한국어 답변(무엇을 했는지/조언)","actions":[...]}
좌표계: 단위 cm. x=방 외곽 왼쪽에서 가구 중심, z=방 외곽 뒤쪽(벽1 쪽)에서 가구 중심, rot=도(0=정면이 앞쪽(+z)을 향함, 90=왼쪽 벽에 등, 180=앞벽에 등, 270=오른쪽 벽에 등). 가구는 벽·다른 가구와 겹치지 않게, 통로 60cm 이상, 창문·문 앞을 막지 않게 배치.
라벨: 가구는 '책장1','침대1' 같은 라벨, 천장/벽 조명은 '조명1', 스탠드는 '스탠드1', 창문 '창문1', 문 '문1', 벽은 '벽1'… 사용자가 말한 이름/번호를 상태의 label 로 정확히 매칭.
actions 종류:
- {"op":"add","item":{"preset":"카탈로그 이름(있으면)","name":"","type":"모델키","w":,"d":,"h":,"x":,"z":,"y":0,"rot":0,"color":"#hex","c2":"#hex","mat":"재질키","mat2":"","mt":"f|w|c","wall":"벽2(벽 부착일 때)","ws":벽왼쪽끝에서중심거리,"n":단수,"cpat":"열패턴","pv":"식물종류"}}
- {"op":"update","target":"책장1" 또는 ["책장1","의자2"] 또는 "all","set":{변경할 필드만, "scale":1.2 배율, "dx":,"dz":, "drot":}}
- {"op":"delete","target":...}
- 여러 개 일괄: {"op":"group","target":["의자1","의자2","식탁1"]} (그룹 묶기) · {"op":"ungroup","target":[...]}
- {"op":"align","target":[...],"how":"l|cx|r|b|cz|f|floor|roomC"} (왼쪽/가로가운데/오른쪽/뒤/세로가운데/앞 맞춤, 바닥으로, 묶음을 방 가운데로)
- {"op":"distribute","target":[...],"axis":"x|z","gap":30} (gap 생략 시 균등 분배, 숫자면 그 간격 cm로 나란히)
- {"op":"mirror","target":[...],"axis":"x|z"} · {"op":"rotateGroup","target":[...],"cw":90} (묶음 가운데 기준 시계방향 회전) · {"op":"moveGroup","target":[...],"dx":50,"dz":0} (간격 유지한 채 평행 이동)
- {"op":"select","target":[...]} (사용자 화면에서 그 가구들을 선택 상태로)
- {"op":"light","targets":["조명1","조명2"] 또는 "all"(전체 조명=천장·벽 조명과 스탠드 모두),"set":{"on":true/false,"lum":0~2.5(0=완전 어둡게, 1=기본),"temp":2700~6500}}
- {"op":"addLight","light":{"kind":"down|spot|panel|round|pendant|pendantG|pendantL|chand|rail|fan|wall|strip","x":,"z":,"wall":"벽1","s":,"y":,"temp":,"lum":}} / {"op":"deleteLight","targets":[...]}
- {"op":"room","set":{"W":,"D":,"H":,"shape":"${A.SHAPES.map(s => s[0]).join('|')}","fl":"${A.FLOORS.map(f => f[0]).join('|')}","flc":"#hex","fld":0|90|45,"wc":"#hex","wallColors":{"벽2":"#hex"},"bb":"#hex","view":"none|city|apt|nature|park|sea|snow","vtime":"auto|day|sunset|night"}}
- {"op":"addOpening","opening":{"kind":"win|door","st":"창문:${A.WIN_ST.map(s => s[0]).join('|')} 문:${A.DOOR_ST.map(s => s[0]).join('|')}","wall":"벽1","s":벽왼쪽끝에서중심,"w":,"h":,"y":}} / {"op":"updateOpening","target":"문1","set":{"open":0~2(3연동 중문 열린 짝 수),"ang":0~90,"wo":0~1(창 열림),"cur":"none|curtain|sheer|blind|roll","cc":"#hex","fc":"#hex","dc":"#hex"}} / {"op":"deleteOpening","target":...}
- {"op":"night","value":true|false}  {"op":"view","value":"door|iso|isoL|top|plan|eye0"}  {"op":"render","views":["eye0","iso"],"size":"yt","style":"real"}  {"op":"clearItems"}
모델키(type): ${typeList()}
재질키(mat): ${A.MATS.map(m => m[0] || '""').join(', ')}
열 패턴(cpat, 열마다 한 글자): \n${colList()}
사람(person): sex m|f|c, outfit ${A.OUTFITS.map(o => o[0]).join('|')}, hs(머리) ${A.HAIRS.map(o => o[0]).join('|')}, bangs 앞머리 1/0, hair/skin/shoe/tie/c3 #hex, color=상의 c2=하의, sleeve long|short|none, tieT none|tie|bow, skirtL 0.3~1, pose ${Object.keys(A.POSES).join('|')} 또는 각도 aL/aR(팔 들기 -60~180) zL/zR(0앞~90옆) eL/eR(팔꿈치 0~150) leg(보폭 -1~1) yaw(고개 -70~70) sit 1/0, 체형 shw/build/headS(0.8~1.4), 얼굴사진 크기 fsz(0.5~1.45) fzoom(0.5~2.5) fox/foy(-0.4~0.4), glasses/flower/bouquet/veil 1/0. 기본 키 남180 여165 어린이120. 왼쪽/오른쪽 팔은 사람 본인 기준(L=본인 왼쪽).
카탈로그(preset 이름으로 쓰면 크기·모양이 자동 적용):\n${catalogNames()}
잠금: 상태에서 lock:true 인 가구·창호·조명과 room.locked 인 방은 위치·크기·모양을 바꾸거나 삭제하지 마세요(조명 켜기·밝기·색온도, 문·창 열고 닫기, 커튼은 가능). 사용자가 잠금/고정을 요청하면 set에 "lock":1, 해제는 "lock":0 (방은 room set의 "lock").
질문·분석(동선, 견적, 스타일 조언)만 요청하면 actions는 빈 배열. 모호하면 합리적으로 가정하고 reply에 밝히세요. 색은 반드시 #hex.`;
  }
  const FURN_SYS = () => `당신은 가구 상품 사진/상세페이지를 읽고 3D 배치용 데이터로 바꾸는 전문가입니다. JSON 객체 하나만 출력.
{"items":[{"name":"짧은 한국어 상품명","type":"모델키","w":가로cm,"d":깊이cm,"h":높이cm,"color":"#hex 주색","c2":"#hex 보조색","mat":"재질키","mat2":"보조재질키","n":단수(책장·서랍 등),"cpat":"열 패턴","pv":"식물 종류","mt":"f|w|c","dims_source":"사진 표기|추정","variants":[{"label":"예: 1200형 / 서랍형","w":,"d":,"h":,"cpat":"","n":,"color":"#hex"}],"note":"메모"}]}
규칙: 사진에 표시된 치수·스펙(mm면 cm로 변환, 예 750×750×730mm → 75×75×73)을 최우선으로 사용. 여러 사이즈/형태가 나열되면 variants에 모두 넣고 대표값을 items에 둠(색상 옵션도 variants 가능). 가로=정면 폭, 깊이=앞뒤, 높이=바닥~상단.
여러 열로 된 책장/선반은 열 수만큼 cpat 글자를 쓰고 열마다 모양을 고름. 철제 프레임+원목 선반 책장은 type "mshelf".
모델키: ${typeList()}
재질키: ${A.MATS.map(m => m[0]).filter(Boolean).join(', ')}
열 패턴: \n${colList()}`;
  const PEOPLE_SYS = () => `사진 속 사람을 왼쪽부터 한 명씩 모두 찾아 3D 인물 모델 데이터로 만듭니다. 누구인지(신원·이름)는 추정하지 말고, 얼굴 위치와 외형(옷차림·색·머리·안경·소품)만 기록합니다. JSON 하나만:
{"people":[{"label":"왼쪽 1번째 · 남성 정장","img":사진번호(0부터),"face_box":[ymin,xmin,ymax,xmax](얼굴 영역, 이마~턱·양 귀, 사진 크기 기준 0~1000 정규화 정수),"sex":"m|f|c","rel_height":사진속상대키(가장 큰 사람=1.0),"glasses":true|false,"tie":"#hex 넥타이색(없으면 생략)","flower":가슴꽃 여부,"bouquet":부케 여부,"outfit":"${A.OUTFITS.map(o => o[0]).join('|')}","top":"#hex 상의/드레스/저고리","bottom":"#hex 하의/치마","shoes":"#hex","skin":"#hex","hair":"#hex","hs":"short|long|bun|bob|bald","veil":true|false,"pose":"stand|sit"}]}`;
  const ROOM_SYS = () => `방 사진 또는 평면도(도면) 이미지를 분석해 방 크기·창호·가구를 추출합니다. 치수가 표기되어 있으면(mm→cm) 사용, 없으면 일반적인 한국 아파트 기준으로 추정. JSON 하나만:
{"room":{"W":가로,"D":깊이,"H":천장높이,"shape":"rect|L|Lr|T|U|cham|trap"},"openings":[{"kind":"win|door","st":"창:${A.WIN_ST.map(s => s[0]).join('|')} 문:${A.DOOR_ST.map(s => s[0]).join('|')}","wall":"벽1(뒷벽)|벽2(오른쪽)|벽3(앞벽)|벽4(왼쪽)","s":방안에서 벽을 볼때 왼쪽끝에서 창호중심,"w":,"h":,"y":}],"items":[{"name":"","type":"모델키","w":,"d":,"h":,"x":왼쪽에서중심,"z":뒤에서중심,"rot":0,"color":"#hex","mat":""}],"note":"추정 근거"}
모델키: ${typeList()}`;

  // ---------- 대화 ----------
  const chatBox = () => document.getElementById('chatlog');
  function pushMsg(role, text, extra = {}) { CHAT.push({ role, text, t: Date.now(), ...extra }); CHAT = CHAT.slice(-60); LS.set(K_CHAT, CHAT); drawChat(); }
  function drawChat() {
    const box = chatBox(); if (!box) return; box.innerHTML = '';
    if (!CHAT.length) box.append(h('div', { class: 'mu sm hello' }, '예) “창가에 몬스테라 추가해줘”, “책장1을 가로 120 세로 30 높이 180 월넛 재질 3열 서랍형으로 바꿔줘”, “조명1, 2, 5, 7 완전 어둡게”, “전체 조명 어둡게”, “이 방 동선 분석해줘”'));
    CHAT.forEach((m, i) => {
      const b = h('div', { class: 'msg ' + m.role }, h('div', { class: 'bub' }, m.text));
      if (m.imgs) b.querySelector('.bub').prepend(...m.imgs.map(s => h('img', { src: s, class: 'thumb' })));
      if (m.log && m.log.length) b.append(h('div', { class: 'log' }, m.log.map(l => h('div', {}, l))));
      if (m.undo && i === CHAT.length - 1) b.append(h('div', { class: 'r' }, BTN('↶ 이 변경 되돌리기', () => { document.getElementById('undo').click(); pushMsg('sys', '되돌렸습니다.'); }, 'c')));
      box.append(b);
    });
    box.scrollTop = box.scrollHeight;
  }
  async function send(text) {
    text = (text || '').trim(); if (!text || busy) return;
    const m = modelFor('chat'); if (!m.key) { toast('AI 키가 없습니다. ⚙ AI 설정에서 키를 넣어 주세요.'); openSettings(); return; }
    const imgs = attach.slice(); attach = []; drawAttach();
    pushMsg('user', text, imgs.length ? { imgs } : {});
    busy = true; setBusy(true);
    try {
      const vis = imgs.length ? modelFor('vision') : m;
      const hist = CHAT.slice(-9, -1).filter(c => c.role !== 'sys').map(c => ({ role: c.role === 'user' ? 'user' : 'assistant', text: c.text }));
      const out = await aiText({ ...vis, system: chatSystem(), prompt: `현재 상태(JSON):\n${JSON.stringify(A.describe())}\n\n사용자 요청: ${text}`, images: imgs, json: true, history: hist });
      const j = parseJSON(out), acts = Array.isArray(j.actions) ? j.actions : [];
      const log = acts.length ? A.runActions(acts) : [];
      pushMsg('assistant', j.reply || (acts.length ? '적용했습니다.' : '…'), { log, undo: acts.length > 0 });
    } catch (e) { pushMsg('sys', '⚠ ' + e.message); }
    busy = false; setBusy(false);
  }
  function setBusy(b) { const s = document.getElementById('chatsend'); if (s) { s.disabled = b; s.textContent = b ? '…' : '보내기'; } const l = document.getElementById('chatbusy'); if (l) l.hidden = !b; }
  function drawAttach() { const el = document.getElementById('chatatt'); if (!el) return; el.innerHTML = ''; attach.forEach((s, i) => el.append(h('span', { class: 'att' }, h('img', { src: s }), h('button', { class: 'x', onclick: () => { attach.splice(i, 1); drawAttach(); } }, '×')))); }
  let rec = null;
  function voice(ta) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast('이 브라우저는 음성 입력을 지원하지 않습니다');
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = false;
    const mic = document.getElementById('chatmic'); mic && mic.classList.add('on');
    rec.onresult = e => { ta.value = [...e.results].map(r => r[0].transcript).join(''); };
    rec.onend = () => { rec = null; mic && mic.classList.remove('on'); if (ta.value.trim()) send(ta.value).then(() => { ta.value = ''; }); };
    rec.onerror = e => toast('음성 인식 오류: ' + e.error);
    rec.start();
  }
  function render() {
    const b = document.getElementById('t-ai'); b.innerHTML = '';
    const m = modelFor('chat'), ta = h('textarea', { rows: 2, placeholder: '무엇을 할까요? (예: 창가에 1인 소파 추가)', enterkeyhint: 'send' });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const v = ta.value; ta.value = ''; send(v); } });
    const fi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    fi.onchange = async () => { for (const f of fi.files) attach.push(await fileToDataURL(f, 1400)); fi.value = ''; drawAttach(); };
    const chips = ['전체 조명 어둡게 해줘', '조명 모두 켜고 밝게', '야간 모드로 보여줘', '이 방 동선과 배치 문제점 분석해줘', '북유럽 스타일로 색과 재질 바꿔줘', '빈 공간에 어울리는 식물 2개 배치', '침대 옆에 협탁 추가', '가구 예상 가격 채워줘', '이 방을 아늑한 서재로 꾸며줘', '창밖 풍경을 바다 노을로'];
    app(b,
      h('div', { class: 'aitools' },
        BTN('📷 사진으로 가구 추가', () => openPhoto('furniture'), 'b'), BTN('👤 사진에서 사람 추가', () => openPhoto('people'), 'o'), BTN('🏠 방·도면 사진 인식', () => openPhoto('room'), 'o'),
        BTN('🎨 실사 이미지 만들기', () => openRender(), 'b'), BTN('🖼 갤러리', openGallery, 'o'), BTN('⚙ AI 설정', openSettings, 'o')),
      h('div', { class: 'mu sm' }, `대화 모델: ${PROVIDERS[m.provider]?.name} · ${m.model}`, m.key ? '' : ' — ⚠ 키 없음'),
      h('div', { id: 'chatlog', class: 'chatlog' }),
      h('div', { id: 'chatbusy', class: 'mu sm', hidden: true }, 'AI가 생각하는 중…'),
      h('div', { class: 'chips' }, chips.map(c => h('button', { class: 'c', onclick: () => send(c) }, c))),
      h('div', { id: 'chatatt', class: 'attrow' }),
      h('div', { class: 'chatin' }, h('button', { class: 'c ic', title: '사진 첨부', onclick: () => fi.click() }, '📎'), h('button', { id: 'chatmic', class: 'c ic', title: '음성 입력', onclick: () => voice(ta) }, '🎤'), ta, h('button', { id: 'chatsend', class: 'b', onclick: () => { const v = ta.value; ta.value = ''; send(v); } }, '보내기'), fi),
      h('div', { class: 'r' }, BTN('대화 지우기', () => { CHAT = []; LS.set(K_CHAT, CHAT); drawChat(); }, 'c')));
    drawChat(); drawAttach();
  }

  // ---------- 사진 인식 ----------
  function openPhoto(mode0 = 'furniture') {
    let mode = mode0, imgs = [], result = null;
    const body = h('div', {}), fi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }), cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const addFiles = async files => { for (const f of files) imgs.push(await fileToDataURL(f, 1800)); draw(); };
    fi.onchange = () => { addFiles(fi.files); fi.value = ''; }; cam.onchange = () => { addFiles(cam.files); cam.value = ''; };
    const hint = { furniture: '상품 사진·상세페이지 캡처(치수표 포함)를 올리면 품목·사이즈·형태를 인식합니다. 여러 사이즈가 있으면 선택할 수 있습니다.', people: '사진 속 사람을 한 명씩 인식해 3D 사람 모델로 만듭니다 (기본 키: 남 180cm / 여 165cm).', room: '방 사진이나 평면도(도면)를 올리면 방 크기·창문·문·가구를 추정해 적용합니다.' };
    let ratio = false;
    const draw = () => {
      body.innerHTML = '';
      app(body,
        h('div', { class: 'seg' }, [['furniture', '🪑 가구·소품'], ['people', '👤 사람'], ['room', '🏠 방·도면']].map(([k, n]) => h('button', { class: mode === k ? 'on' : '', onclick: () => { mode = k; result = null; draw(); } }, n))),
        h('p', { class: 'mu sm' }, hint[mode]),
        h('div', { class: 'r' }, BTN('🖼 사진 선택', () => fi.click(), 'b'), A.isMobile() ? BTN('📸 카메라로 촬영', () => cam.click()) : null, fi, cam, imgs.length ? BTN('사진 모두 지우기', () => { imgs = []; result = null; draw(); }, 'c') : null),
        h('div', { class: 'attrow' }, imgs.map((s, i) => h('span', { class: 'att big' }, h('img', { src: s }), h('button', { class: 'x', onclick: () => { imgs.splice(i, 1); draw(); } }, '×')))),
        h('div', { class: 'mu sm' }, `인식 모델: ${PROVIDERS[modelFor('vision').provider]?.name} · ${modelFor('vision').model}`),
        h('div', { class: 'r' }, BTN(imgs.length ? '🤖 AI로 인식하기' : '먼저 사진을 선택하세요', run, 'b')),
        result ? showResult() : null);
    };
    const run = async e => {
      if (!imgs.length) return fi.click();
      const m = modelFor('vision'); if (!m.key) { toast('AI 키가 없습니다'); return openSettings(); }
      const b = e.target; b.disabled = true; b.textContent = '인식 중… (10~40초)';
      try {
        const sys = mode === 'furniture' ? FURN_SYS() : mode === 'people' ? PEOPLE_SYS() : ROOM_SYS();
        const out = await aiText({ ...m, system: sys, prompt: mode === 'furniture' ? '사진 속 가구/소품을 모두 추출하세요. 치수표를 꼼꼼히 읽으세요.' : mode === 'people' ? '사진 속 모든 사람을 왼쪽부터 추출하세요.' : '방/도면을 분석하세요.', images: imgs, json: true });
        result = parseJSON(out);
        if (mode === 'furniture') (result.items || []).forEach(it => { it._on = true; it._v = -1; });
        if (mode === 'people') { for (const p of (result.people || [])) { p._on = true; p._faceOn = true; p._adj = { dx: 0, dy: 0, s: 1 }; p.height = p.sex === 'f' ? 165 : p.sex === 'c' ? 120 : 180; const src = imgs[Math.min(imgs.length - 1, Math.max(0, p.img | 0))]; p._src = src; if (Array.isArray(p.face_box) && p.face_box.length === 4) { try { p.face = await cropFace(src, p.face_box, p._adj); p.skin = await sampleSkin(p.face); } catch (e) { } } } }
      } catch (err) { toast('⚠ ' + err.message, 7000); }
      draw();
    };
    const showResult = () => {
      if (mode === 'furniture') {
        const list = result.items || []; if (!list.length) return h('p', { class: 'warn' }, '인식된 가구가 없습니다.');
        return h('div', {}, h('h3', {}, `인식 결과 ${list.length}개`), ...list.map(it => {
          const vs = it.variants || [], apply = v => { if (v >= 0) { const x = vs[v]; ['w', 'd', 'h', 'cpat', 'n', 'color'].forEach(k => { if (x[k] != null && x[k] !== '') it[k] = x[k]; }); } };
          const num = k => h('input', { type: 'number', inputmode: 'decimal', value: it[k] ?? '', oninput: e => { it[k] = +e.target.value; } });
          return h('div', { class: 'rc' },
            h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: it._on, onchange: e => { it._on = e.target.checked; } }), h('b', {}, it.name || '가구')),
            h('small', { class: 'mu' }, `${A.TYPES[it.type] || it.type} · ${it.dims_source || ''}${it.note ? ' · ' + it.note : ''}`),
            vs.length ? F('사이즈/형태 선택', (() => { const s = h('select', {}, h('option', { value: -1 }, `대표 (${it.w}×${it.d}×${it.h})`), vs.map((v, i) => h('option', { value: i }, `${v.label || ''} ${v.w ?? ''}×${v.d ?? ''}×${v.h ?? ''}`))); s.value = it._v; s.onchange = () => { it._v = +s.value; apply(it._v); draw(); }; return s; })()) : null,
            G(4, F('모델', (() => { const s = h('select', {}, Object.entries(A.TYPES).map(([k, v]) => h('option', { value: k }, v))); s.value = A.TYPES[it.type] ? it.type : 'box'; s.onchange = () => { it.type = s.value; }; return s; })()), F('가로', num('w')), F('세로', num('d')), F('높이', num('h'))),
            G(3, F('색', h('input', { type: 'color', value: it.color || '#b0a090', oninput: e => { it.color = e.target.value; } })), F('재질', (() => { const s = h('select', {}, A.MATS.map(([k, v]) => h('option', { value: k }, v))); s.value = it.mat || ''; s.onchange = () => { it.mat = s.value; }; return s; })()), A.COLSTY[it.type] ? F('열 패턴', h('input', { type: 'text', value: it.cpat || '', oninput: e => { it.cpat = e.target.value.toUpperCase(); } })) : F('', h('span'))),
            h('div', { class: 'r' }, BTN('배치에 추가', () => addFurn([it]), 'c'), BTN('내 가구로 저장', () => addFurn([it], true), 'c')));
        }), h('div', { class: 'r' }, BTN('선택 항목 모두 배치에 추가', () => addFurn(list.filter(x => x._on)), 'b'), BTN('선택 항목 내 가구로 저장', () => addFurn(list.filter(x => x._on), true))));
      }
      if (mode === 'people') {
        const list = result.people || []; if (!list.length) return h('p', { class: 'warn' }, '인식된 사람이 없습니다.');
        const recalc = () => { const ref = list.find(p => p.sex === 'm') || list.find(p => p.sex === 'f') || list[0]; const refH = ref.sex === 'f' ? 165 : ref.sex === 'c' ? 120 : 180; list.forEach(p => { p.height = ratio ? Math.round(refH * (p.rel_height || 1) / (ref.rel_height || 1)) : p.sex === 'f' ? 165 : p.sex === 'c' ? 120 : 180; }); draw(); };
        return h('div', {}, h('h3', {}, `인식된 사람 ${list.length}명`),
          h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: ratio, onchange: e => { ratio = e.target.checked; recalc(); } }), '사진 속 키 비율 반영 (기준: 남 180 / 여 165)'),
          ...list.map(p => h('div', { class: 'rc' },
            h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: p._on, onchange: e => { p._on = e.target.checked; } }), h('b', {}, p.label || '사람')),
            h('div', { class: 'pface' }, p.face ? faceAdjuster(p) : h('span', { class: 'mu sm' }, '얼굴 위치를 찾지 못했습니다'),
              h('div', {}, h('div', { class: 'sw' }, ['top', 'bottom', 'shoes', 'skin', 'hair'].map(k => h('span', { class: 'swb', title: k, style: `background:${p[k] || '#888'}` }))),
                p.face ? h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: p._faceOn, onchange: e => { p._faceOn = e.target.checked; } }), '얼굴 사진 입히기') : null,
                h('div', { class: 'cg' }, ...[['glasses', '안경'], ['flower', '가슴꽃'], ['bouquet', '부케'], ['veil', '면사포']].map(([k, t]) => h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: !!p[k], onchange: e => { p[k] = e.target.checked; } }), t))))),
            G(4, F('성별', (() => { const s = h('select', {}, [['m', '남성'], ['f', '여성'], ['c', '어린이']].map(([v, t]) => h('option', { value: v }, t))); s.value = p.sex || 'm'; s.onchange = () => { p.sex = s.value; }; return s; })()), F('옷', (() => { const s = h('select', {}, A.OUTFITS.map(([v, t]) => h('option', { value: v }, t))); s.value = p.outfit || 'casual'; s.onchange = () => { p.outfit = s.value; }; return s; })()), F('키 (cm)', h('input', { type: 'number', inputmode: 'decimal', value: p.height, oninput: e => { p.height = +e.target.value; } })), F('이름', h('input', { type: 'text', value: p.name || '', placeholder: '예: 신랑', oninput: e => { p.name = e.target.value; } }))),
            h('div', { class: 'r' }, BTN('배치에 추가', () => addPeople([p]), 'c'), BTN('사람 목록(내 가구)에 저장', () => addPeople([p], true), 'c')))),
          h('div', { class: 'r' }, BTN('선택한 사람 모두 배치에 추가', () => addPeople(list.filter(x => x._on)), 'b'), BTN('모두 내 가구에 저장', () => addPeople(list.filter(x => x._on), true))));
      }
      const r = result.room || {};
      return h('div', {}, h('h3', {}, '인식된 방'), h('p', {}, `가로 ${r.W} · 깊이 ${r.D} · 높이 ${r.H || '-'} cm · 모양 ${r.shape || 'rect'}`),
        h('p', { class: 'sm' }, `창호 ${(result.openings || []).length}개 · 가구 ${(result.items || []).length}개`), result.note ? h('p', { class: 'mu sm' }, result.note) : null,
        h('div', { class: 'r' }, BTN('방 크기·창호 적용', () => { A.applyRoomSpec({ ...r, openings: result.openings }); toast('방에 적용했습니다'); }, 'b'), BTN('가구도 함께 추가', () => { A.applyRoomSpec({ ...r, openings: result.openings }); A.runActions((result.items || []).map(it => ({ op: 'add', item: it }))); toast('적용했습니다'); })));
    };
    draw(); return modal('📷 사진으로 인식', body, { wide: true });
  }
  function addFurn(list, save) {
    list.forEach(it => { const spec = { ...it }; ['_on', '_v', 'variants', 'note', 'dims_source'].forEach(k => delete spec[k]); if (save) { const { it: obj } = A.specToItem(spec); A.saveCustom(obj, spec.name || obj.name); } else A.runActions([{ op: 'add', item: spec }]); });
    toast(save ? `${list.length}개를 내 가구에 저장했습니다` : `${list.length}개를 배치했습니다`);
  }
  function personSpec(p) {
    const H = +p.height || (p.sex === 'f' ? 165 : 180), of = p.outfit || 'casual', f = H / (p.sex === 'f' ? 165 : p.sex === 'c' ? 120 : 180);
    const [w, d] = of === 'gown' ? [102, 102] : of === 'hanbok' ? [80, 80] : p.sex === 'f' ? [48, 30] : p.sex === 'c' ? [38, 24] : [58, 32];
    return { name: p.name || p.label || '사람', type: 'person', w: Math.round(w * f), d: Math.round(d * f), h: H, color: p.top || '#3a3d42', c2: p.bottom || p.top || '#3a3d42', sex: p.sex || 'm', outfit: of, skin: p.skin, hair: p.hair, shoe: p.shoes, hs: p.hs, veil: p.veil ? 1 : 0, pose: p.pose === 'sit' ? 'sit' : 'stand', nc: 1, face: p._faceOn !== false && p.face ? p.face : undefined, glasses: p.glasses ? 1 : 0, flower: p.flower ? 1 : 0, bouquet: p.bouquet ? 1 : 0, tie: p.tie || undefined };
  }
  // 얼굴 미리보기 + 위치·크기 미세 조정 (p: { _src, face_box, _adj, face })
  function faceAdjuster(p, onChange) {
    const img = h('img', { src: p.face, class: 'facethumb' });
    const nudge = async (dx, dy, ds) => { p._adj = { dx: (p._adj.dx || 0) + dx, dy: (p._adj.dy || 0) + dy, s: Math.max(0.4, Math.min(2.5, (p._adj.s || 1) * ds)) }; p.face = await cropFace(p._src, p.face_box, p._adj); img.src = p.face; onChange && onChange(); };
    const b = (t, f, tt) => h('button', { class: 'c', type: 'button', title: tt, onclick: f }, t);
    return h('div', { class: 'fadj' }, img, h('div', { class: 'fpad' },
      b('↑', () => nudge(0, -1, 1), '위로'), b('↓', () => nudge(0, 1, 1), '아래로'), b('←', () => nudge(-1, 0, 1), '왼쪽'), b('→', () => nudge(1, 0, 1), '오른쪽'), b('＋', () => nudge(0, 0, 0.9), '확대'), b('−', () => nudge(0, 0, 1.1), '축소')));
  }
  // 이미 배치된 사람에 얼굴 사진 넣기
  function openFace(it, done) {
    const body = h('div', {}), fi = h('input', { type: 'file', accept: 'image/*', hidden: true }), cam = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true });
    let src = null, faces = [], cur = null;
    const draw = () => {
      body.innerHTML = '';
      app(body, h('p', { class: 'mu sm' }, '얼굴이 잘 보이는 정면 사진을 고르세요. AI 키가 있으면 얼굴 위치를 자동으로 찾고, 여러 명이면 사람을 고를 수 있습니다.'),
        h('div', { class: 'r' }, BTN('🖼 사진 선택', () => fi.click(), 'b'), A.isMobile() ? BTN('🤳 셀카 촬영', () => cam.click()) : null, fi, cam),
        faces.length > 1 ? h('div', { class: 'ch' }, faces.map((f, i) => h('button', { class: 'c' + (cur === f ? ' on' : ''), onclick: async () => { cur = f; if (!cur.face) cur.face = await cropFace(src, cur.face_box, cur._adj); draw(); } }, f.label || `${i + 1}번`))) : null,
        cur && cur.face ? faceAdjuster(cur) : null,
        cur && cur.face ? h('div', { class: 'r' }, BTN('이 얼굴 적용', async () => { it.face = cur.face; try { it.skin = await sampleSkin(cur.face); } catch (e) { } done && done(); m.close(); toast('얼굴을 적용했습니다 — 선택 탭에서 크기·위치를 조절할 수 있습니다'); }, 'b')) : null);
    };
    const pick = async files => {
      if (!files[0]) return; src = await fileToDataURL(files[0], 1600); faces = []; cur = null;
      body.querySelector('.r').append(h('span', { class: 'mu sm' }, ' 얼굴 찾는 중…'));
      const v = modelFor('vision');
      if (v.key) { try { const j = parseJSON(await aiText({ ...v, system: '사진 속 사람 얼굴 위치를 찾습니다. 신원은 추정하지 않습니다. JSON 하나만: {"faces":[{"label":"왼쪽 1번째 남성","face_box":[ymin,xmin,ymax,xmax] (0~1000 정규화)}]}', prompt: '모든 얼굴을 왼쪽부터 찾으세요.', images: [src], json: true })); faces = (j.faces || []).filter(f => Array.isArray(f.face_box)); } catch (e) { toast('얼굴 자동 찾기 실패: ' + e.message, 5000); } }
      if (!faces.length) faces = [{ label: '가운데', face_box: centerBox }];
      faces.forEach(f => { f._src = src; f._adj = { dx: 0, dy: 0, s: 1 }; });
      cur = faces[0]; cur.face = await cropFace(src, cur.face_box, cur._adj); draw();
    };
    fi.onchange = () => { pick(fi.files); fi.value = ''; }; cam.onchange = () => { pick(cam.files); cam.value = ''; };
    draw(); const m = modal('📷 얼굴 사진 넣기 — ' + (it.name || '사람'), body); return m;
  }
  function addPeople(list, save) {
    const R = A.R, n = list.length;
    list.forEach((p, i) => { const s = personSpec(p); if (save) { const { it } = A.specToItem(s); A.saveCustom(it, s.name); } else A.runActions([{ op: 'add', item: { ...s, x: R.W * (i + 1) / (n + 1), z: R.D * 0.55, rot: 0 } }]); });
    toast(save ? `${n}명을 '내 가구'에 저장했습니다` : `${n}명을 배치했습니다`);
  }

  // ---------- 실사 렌더 ----------
  function sceneText(viewKey) {
    const d = A.describe(), r = d.room, L = [];
    L.push(`Room: ${r.W}cm wide x ${r.D}cm deep, ceiling ${r.H}cm, ${r.shape === 'rect' ? 'rectangular' : 'custom-shaped (' + r.walls.length + ' walls' + (r.walls.some(w => w.curved) ? ', with curved wall' : '') + ')'}.`);
    L.push(`Floor: ${A.floorName(r.floor.type) || r.floor.type} (${r.floor.color}), plank/tile direction ${r.floor.dir}°. Walls: ${r.wallColor}${r.walls.some(w => w.color !== r.wallColor) ? ', accent walls ' + r.walls.filter(w => w.color !== r.wallColor).map(w => w.label + ' ' + w.color).join(', ') : ''}.`);
    L.push(`Windows/doors: ${d.openings.map(o => `${o.label} ${o.stName} ${o.w}x${o.h}cm on ${o.wall}${o.kind === 'win' && o.curtain && o.curtain !== 'none' ? ' with ' + o.curtain : ''}${o.open ? ' (open ' + o.open + ')' : ''}`).join('; ') || 'none'}. View outside windows: ${r.outsideView}, ${r.viewTime === 'auto' ? (r.night ? 'night' : 'daytime') : r.viewTime}.`);
    L.push('Furniture & objects (exact sizes, keep them): ' + d.items.map(i => `${i.name} [${A.TYPES[i.type] || i.type}] ${i.w}x${i.d}x${i.h}cm, color ${i.color}${i.c2 ? '/' + i.c2 : ''}${i.mat ? ', material ' + A.matName(i.mat) : ''}${i.mat2 ? '/' + A.matName(i.mat2) : ''}${i.type === 'person' ? `, a ${i.sex === 'f' ? 'woman' : i.sex === 'c' ? 'child' : 'man'} ${i.h}cm tall in ${i.outfit}` : ''}${i.on === false ? ', lamp OFF' : i.on ? `, lamp ON ${Math.round((i.lum ?? 0.8) * 100)}%` : ''}`).join('; ') + '.');
    L.push('Lighting fixtures: ' + (d.lights.map(l => `${l.kindName} ${l.on && l.lum > 0 ? `ON at ${Math.round(l.lum * 100)}% brightness, ${l.temp}K` : 'OFF (dark)'}`).join('; ') || 'none') + `. Overall: ${r.night ? 'NIGHT — room lit only by the listed lights that are ON; lights that are OFF must stay dark' : 'DAYTIME — natural light through windows plus listed lights'}.`);
    L.push(`Camera: ${{ cur: 'same as the input image', door: 'from the entrance looking in', iso: 'elevated three-quarter view', isoL: 'elevated three-quarter view from the left', top: 'top-down view', sel: 'close-up' }[viewKey] || 'eye-level from a corner of the room (150cm high)'}.`);
    return L.join('\n');
  }
  function renderPrompt(viewKey, o) {
    return `Transform this 3D interior layout render into a single photorealistic interior photograph.
STRICT RULES: keep the EXACT same camera angle, framing, perspective and room geometry; keep every piece of furniture, object, person, window and door in exactly the same position, size, proportion, shape, color and material as in the input; do not move, add or remove furniture${o.decor ? ' (you MAY add a few small decorative accessories like books, cushions, a throw, small vases)' : ' and do not add new objects'}. Replace simplified geometry with realistic real-world equivalents of the same design (e.g. a box labeled bookshelf becomes a real bookshelf of the same size). Respect the lighting state exactly: fixtures that are OFF stay dark, dimmed lights stay dim. Realistic global illumination, soft shadows, accurate materials, natural textures, 35mm lens look, high dynamic range, no text, no watermark, no people unless people are present in the input.
${STYLEP[o.style] || ''} ${o.extra || ''}
SCENE DATA:
${sceneText(viewKey)}`;
  }
  async function toGalleryDoc(url, meta) {
    let q = 0.86, s = 1, out = url;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    for (let k = 0; k < 8; k++) { const c = document.createElement('canvas'), m = Math.min(1, 1920 / Math.max(img.width, img.height)) * s; c.width = Math.round(img.width * m); c.height = Math.round(img.height * m); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', q); if (out.length < 900000) break; q -= 0.1; if (q < 0.5) { s *= 0.8; q = 0.8; } }
    return { img: out, t: Date.now(), ...meta };
  }
  function openRender(pre = {}) {
    const R = A.R, nCorner = Math.min(6, R.pts.length);
    const VIEWS = [['cur', '현재 화면'], ['door', '입구 시점'], ['iso', '대각선 (오른쪽)'], ['isoL', '대각선 (왼쪽)'], ['top', '위에서'], ...Array.from({ length: nCorner }, (_, i) => [`eye${i}`, `눈높이 · 모서리 ${i + 1}`]), ['sel', '선택 대상 클로즈업']];
    const st = { size: pre.size || 'yt', cw: 1920, ch: 1080, views: new Set(pre.views || ['cur']), style: pre.style || 'real', extra: pre.extra || '', decor: false, ai: true, quality: 'high' };
    const body = h('div', {}), res = h('div', { class: 'rgrid' });
    const draw = () => {
      body.innerHTML = '';
      const im = modelFor('image');
      app(body,
        h('div', { class: 'seg' }, h('button', { class: st.ai ? 'on' : '', onclick: () => { st.ai = true; draw(); } }, '🤖 AI 실사 변환'), h('button', { class: !st.ai ? 'on' : '', onclick: () => { st.ai = false; draw(); } }, '📷 3D 캡처만 (AI 없음)')),
        F('화면 크기', (() => { const s = h('select', {}, SIZES.map(([k, n]) => h('option', { value: k }, n))); s.value = st.size; s.onchange = () => { st.size = s.value; draw(); }; return s; })()),
        st.size === 'custom' ? G(2, F('가로 px', h('input', { type: 'number', value: st.cw, oninput: e => { st.cw = +e.target.value; } })), F('세로 px', h('input', { type: 'number', value: st.ch, oninput: e => { st.ch = +e.target.value; } }))) : null,
        h('h4', {}, '각도 (여러 개 선택 가능)'),
        h('div', { class: 'cg' }, VIEWS.map(([k, n]) => h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.views.has(k), onchange: e => { e.target.checked ? st.views.add(k) : st.views.delete(k); } }), n))),
        st.ai ? h('div', {},
          h('h4', {}, '스타일'),
          h('div', { class: 'ch' }, STYLES.map(([k, n]) => h('button', { class: 'c' + (st.style === k ? ' on' : ''), onclick: () => { st.style = k; draw(); } }, n))),
          F('추가 요청 (선택)', h('textarea', { rows: 2, placeholder: '예: 창밖에 비 오는 저녁, 벽에 은은한 간접조명 반사', oninput: e => { st.extra = e.target.value; } }, st.extra)),
          h('div', { class: 'cg' }, h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.decor, onchange: e => { st.decor = e.target.checked; } }), '작은 소품(쿠션·책 등) 추가 허용')),
          F('이미지 모델', modelPicker('image', draw)),
          h('p', { class: 'mu sm' }, `${PROVIDERS[im.provider]?.name} · ${im.model}${im.key ? '' : ' — ⚠ 키 없음 (⚙ AI 설정)'} · 배치·크기·재질·조명 설정이 프롬프트에 그대로 들어갑니다.`)) : null,
        h('div', { class: 'r' }, BTN(st.ai ? '🎨 생성 시작' : '📷 캡처', go, 'b'), BTN('프롬프트 보기', () => modal('프롬프트', h('pre', { class: 'pre' }, renderPrompt([...st.views][0] || 'cur', st))), 'c')),
        res);
    };
    const go = async () => {
      const sz = SIZES.find(s => s[0] === st.size), W = st.size === 'custom' ? st.cw : sz[2], H = st.size === 'custom' ? st.ch : sz[3];
      if (!(W > 100 && H > 100)) return toast('크기를 확인하세요'); if (!st.views.size) return toast('각도를 하나 이상 선택하세요');
      const im = modelFor('image'); if (st.ai && !im.key) { toast('이미지 모델 키가 없습니다'); return openSettings(); }
      const asp = nearestAspect(W / H), sc = Math.min(1, 1536 / Math.max(W, H));
      for (const vk of st.views) {
        const name = VIEWS.find(v => v[0] === vk)?.[1] || vk;
        const card = h('div', { class: 'rcard' }, h('div', { class: 'ph' }, h('span', { class: 'spin' }), h('small', {}, `${name} · 준비 중…`)));
        res.prepend(card);
        try {
          const cap = A.captureView(vk, Math.round(W * (st.ai ? sc : 1)), Math.round(H * (st.ai ? sc : 1)));
          let out = cap;
          if (st.ai) { card.querySelector('small').textContent = `${name} · AI 생성 중… (20~90초)`; const gen = await aiImage({ ...im, prompt: renderPrompt(vk, st), image: cap, aspect: asp, quality: st.quality }); out = await coverResize(gen, W, H); }
          showResult(card, out, cap, name, W, H);
        } catch (e) { card.innerHTML = ''; card.append(h('p', { class: 'warn' }, `${name}: ${e.message}`)); }
      }
    };
    const showResult = (card, url, cap, name, W, H) => {
      card.innerHTML = '';
      const img = h('img', { src: url, alt: name, onclick: () => modal(name, h('img', { src: url, class: 'full' }), { wide: true }) });
      const file = A.fname(`${name}_${W}x${H}.png`.replace(/\s|·/g, ''));
      app(card, img, h('small', {}, `${name} · ${W}×${H}`),
        h('div', { class: 'r' }, BTN('저장·공유', () => A.saveFile(file, url, 'image/png', { preview: A.isMobile() }), 'c'),
          st.ai ? BTN('3D 원본', () => { img.src = img.src === url ? cap : url; }, 'c') : null,
          BTN('☁ 갤러리', async e => { if (!Cloud.user) return toast('클라우드 갤러리는 로그인 후 사용할 수 있습니다'); e.target.disabled = true; try { await Cloud.saveGallery('g' + Date.now().toString(36), await toGalleryDoc(url, { name, project: A.projName, size: `${W}x${H}`, style: st.style })); toast('갤러리에 저장했습니다'); } catch (err) { toast(err.message); } e.target.disabled = false; }, 'c')));
    };
    draw(); modal('🎨 실사 이미지 · 고화질 캡처', body, { wide: true });
    if (pre.views && pre.auto !== false && pre.op === 'render') setTimeout(go, 300);
  }
  async function openGallery() {
    if (!Cloud.user) return toast('갤러리는 클라우드 로그인 후 사용할 수 있습니다 (저장·출력 탭)');
    const body = h('div', { class: 'rgrid' }, h('p', { class: 'mu' }, '불러오는 중…')); modal('🖼 갤러리 (클라우드)', body, { wide: true });
    try {
      const ls = await Cloud.listGallery(); body.innerHTML = '';
      if (!ls.length) body.append(h('p', { class: 'mu' }, '저장된 이미지가 없습니다.'));
      ls.forEach(g => body.append(h('div', { class: 'rcard' }, h('img', { src: g.img, onclick: () => modal(g.name, h('img', { src: g.img, class: 'full' }), { wide: true }) }), h('small', {}, `${g.project || ''} · ${g.name || ''} · ${new Date(g.t).toLocaleString('ko-KR')}`),
        h('div', { class: 'r' }, BTN('저장·공유', () => A.saveFile(`${g.project || 'room'}_${g.name || 'render'}.jpg`, g.img, 'image/jpeg', { preview: A.isMobile() }), 'c'), BTN('삭제', async e => { if (!confirm('삭제할까요?')) return; await Cloud.delGallery(g.id); e.target.closest('.rcard').remove(); }, 'c')))));
    } catch (e) { body.innerHTML = ''; body.append(h('p', { class: 'warn' }, e.message)); }
  }

  // ---------- Firebase 설정 ----------
  function saveFirebase(text) {
    const c = parseCfg(text || ''); if (!c.apiKey || !c.appId) return toast('apiKey 와 appId 를 찾지 못했습니다. firebaseConfig 코드를 그대로 붙여 넣어 주세요.', 6000);
    const cur = loadCfg(); saveCfg({ ...cur, ...c, databaseId: c.databaseId || cur.databaseId || 'room-maker' }); toast('저장했습니다. 다시 불러옵니다…'); setTimeout(() => location.reload(), 600);
  }
  const copy = (t, msg) => { const ok = () => toast(msg || '복사했습니다'); if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, () => prompt('아래 내용을 길게 눌러 복사하세요', t)); else prompt('아래 내용을 복사하세요', t); };
  // 다른 기기(휴대폰) 연결: QR 코드 + 링크 (Firebase 공개 웹 설정만 담김, AI 키·비밀번호는 포함 안 됨)
  function openLink() {
    const c = loadCfg(); if (!c.apiKey || !c.appId) return toast('이 기기에 먼저 Firebase 설정이 있어야 합니다', 5000);
    const url = cfgLink(c), qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    const img = h('img', { class: 'qr', alt: '연결 QR 코드', src: qr.createDataURL(6, 2) });
    modal('📱 다른 기기에서 로그인 연결', h('div', {},
      h('p', { class: 'sm' }, '휴대폰 카메라로 QR 코드를 찍어 열면, 그 기기에도 클라우드 연결 설정이 자동으로 들어가고 바로 「Google 로그인」 버튼이 나타납니다.'),
      h('div', { class: 'qrw' }, img),
      h('div', { class: 'r' }, BTN('링크 복사', () => copy(url, '연결 링크를 복사했습니다 — 휴대폰으로 보내서 여세요'), 'b'), navigator.share ? BTN('공유…', () => navigator.share({ title: '방 가구 배치 3D 연결', url }).catch(() => { })) : null),
      h('p', { class: 'mu sm' }, '※ 링크에는 Firebase 공개 웹 설정만 담기며 AI 키·비밀번호는 들어 있지 않습니다. AI 키는 로그인하면 클라우드에서 자동으로 불러옵니다.'),
      BUILTIN ? null : h('details', {}, h('summary', {}, '매번 하기 싫다면: 앱에 설정 내장 (1회)'),
        h('p', { class: 'sm' }, '아래 코드를 프로젝트의 src/firebase.config.js 파일에 통째로 덮어쓰고 다시 배포(Vercel)하면, 모든 기기에서 처음부터 로그인 버튼이 보입니다.'),
        h('pre', { class: 'pre' }, cfgFileCode(c)), h('div', { class: 'r' }, BTN('설정 파일 코드 복사', () => copy(cfgFileCode(c), 'firebase.config.js 내용을 복사했습니다'), 'b')))
    ), {});
  }
  function copyCfgFile() { copy(cfgFileCode(loadCfg()), 'firebase.config.js 내용을 복사했습니다'); }
  function copyRules() {
    navigator.clipboard && navigator.clipboard.writeText(RULES).catch(() => { });
    modal('Firestore 보안 규칙 (room-maker)', h('div', {}, h('p', { class: 'sm' }, 'Firebase 콘솔 → Firestore → room-maker → 규칙 탭에 아래 내용을 붙여 넣고 ‘게시’를 누르세요. (클립보드에 복사됨)'), h('pre', { class: 'pre' }, RULES)));
  }
  async function onLogin() {
    if (!Cloud.user) return;
    try {
      const k = await Cloud.getMeta('aikeys'), m = await Cloud.getMeta('aimodels');
      if (k && k.keys) { KEYS = { ...KEYS, ...k.keys }; } else if (Object.keys(KEYS).length) await Cloud.setMeta('aikeys', { keys: KEYS });
      if (m && m.models) { try { MODELS = { ...MODELS, ...JSON.parse(m.models) }; EXTRA = { ...EXTRA, ...JSON.parse(m.extra || '{}') }; } catch (e) { } }
      saveLocal(); if (!document.getElementById('t-ai').hidden) render();
    } catch (e) { toast('AI 설정 동기화 실패: ' + e.message); }
  }
  return { render, openPhoto, openRender, openSettings, openGallery, saveFirebase, copyRules, onLogin, modelFor, openFace, openLink, copyCfgFile };
}
