// AI 기능 UI: 대화 명령 · 사진 인식(가구/사람/방) · 실사 렌더 · 설정(키·모델) · 갤러리
import { PROVIDERS, TASKS, DEFAULT_MODELS, parseKeys, aiText, aiImage, parseJSON, listModels, fileToDataURL, coverResize, splitKeys, testKeys } from './ai.js';
import { Cloud, parseCfg, saveCfg, loadCfg, RULES, cfgLink, cfgFileCode, BUILTIN } from './cloud.js';
import qrcode from 'qrcode-generator';
import { cropFace, centerBox, sampleSkin } from './faces.js';
import { getRef, putRef, REF_KINDS, REF_EN } from './refs.js';
import { viewImg } from './viewer.js';
import { listLocal, putLocal, delLocal, markLocal } from './gallery.js';

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
          const ks = splitKeys(KEYS[v.key]), inp = h('textarea', { class: 'keyta mask', rows: Math.max(1, Math.min(4, ks.length || 1)), placeholder: v.hint, autocomplete: 'off', spellcheck: 'false' }, (KEYS[v.key] || '').split(/[\s,;]+/).filter(Boolean).join('\n')), st = h('small', { class: 'mu' }, ks.length ? `키 ${ks.length}개 · ${ks.map(k => '••••' + k.slice(-4)).join(', ')}${ks.length > 1 ? ' · 위에서부터 차례로, 실패하면 다음 키' : ''}` : '없음');
          const tres = h('div', { class: 'tres' });
          return h('div', { class: 'kc' }, h('div', { class: 'kh' }, h('b', {}, v.name), st),
            h('div', { class: 'kr' }, inp, BTN('👁', () => { inp.classList.toggle('mask'); }, 'c')),
            h('p', { class: 'mu sm' }, '키를 여러 개 넣으려면 한 줄에 하나씩 — 크레딧 소진(402)·한도 초과(429)·잘못된 키면 자동으로 다음 키를 씁니다.'),
            h('div', { class: 'r' },
              BTN('🔌 키별 연결 확인', async e => { const b = e.target, val = inp.value.trim() || KEYS[v.key]; if (!val) return toast('키를 먼저 넣으세요'); b.disabled = true; b.textContent = '확인 중…'; tres.innerHTML = ''; const r = await testKeys(p, val); r.forEach(x => tres.append(h('div', { class: x.ok ? 'ok' : 'warn' }, `${x.ok ? '✅' : '❌'} ••••${x.k.slice(-4)} — ${x.ok ? `사용 가능 (모델 ${x.n}개)` : x.msg}`))); const good = r.find(x => x.ok); if (good) { EXTRA[p] = good.r; saveLocal(); } b.disabled = false; b.textContent = '🔌 키별 연결 확인'; toast(good ? `✅ ${v.name}: ${r.filter(x => x.ok).length}/${r.length}개 키 사용 가능` : `⚠ ${v.name}: 사용 가능한 키가 없습니다`, 6000, null, { type: good ? 'ok' : 'err' }); }, 'c'),
              BTN('저장/업데이트', async () => { KEYS[v.key] = splitKeys(inp.value).join('\n'); saveLocal(); await saveCloud(); toast(`${v.name} 키를 저장했습니다`); render(); }, 'b'),
              BTN('삭제', async () => { delete KEYS[v.key]; saveLocal(); await saveCloud(); toast('삭제했습니다'); render(); }),
              BTN('연결 테스트 · 모델 목록 불러오기', async e => { const b = e.target; b.disabled = true; b.textContent = '확인 중…'; try { const r = await listModels(p, inp.value.trim() || KEYS[v.key]); EXTRA[p] = r; saveLocal(); await saveCloud(); toast(`✅ 연결됨 · 모델 ${r.text.length + r.image.length}개`); render(); } catch (err) { toast('❌ ' + err.message, 7000); b.disabled = false; b.textContent = '다시 시도'; } })), tres);
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
- {"op":"mirror","target":[...],"axis":"x|z"} (여러 개 배치를 거울상으로) · {"op":"flip","target":"소파1","axis":"x|y|z"} (x=좌우 반전, y=상하 반전, z=앞뒤 반전; 같은 명령 다시 = 해제, "on":true/false로 지정 가능) · {"op":"rotateGroup","target":[...],"cw":90} (묶음 가운데 기준 시계방향 회전) · {"op":"moveGroup","target":[...],"dx":50,"dz":0} (간격 유지한 채 평행 이동)
- {"op":"select","target":[...]} (사용자 화면에서 그 가구들을 선택 상태로)
- {"op":"light","targets":["조명1","조명2"] 또는 "all"(전체 조명=천장·벽 조명과 스탠드 모두),"set":{"on":true/false,"lum":0~2.5(0=완전 어둡게, 1=기본),"temp":2700~6500}}
- {"op":"addLight","light":{"kind":"down|spot|panel|round|pendant|pendantG|pendantL|chand|rail|fan|wall|strip","x":,"z":,"wall":"벽1","s":,"y":,"temp":,"lum":}} / {"op":"deleteLight","targets":[...]}
- {"op":"room","set":{"W":,"D":,"H":,"shape":"${A.SHAPES.map(s => s[0]).join('|')}","fl":"${A.FLOORS.map(f => f[0]).join('|')}","flc":"#hex","fld":0|90|45,"wc":"#hex","wallColors":{"벽2":"#hex"},"bb":"#hex","view":"none|city|apt|nature|park|sea|snow","vtime":"auto|day|sunset|night"}}
- {"op":"addOpening","opening":{"kind":"win|door","st":"창문:${A.WIN_ST.map(s => s[0]).join('|')} 문:${A.DOOR_ST.map(s => s[0]).join('|')}","wall":"벽1","s":벽왼쪽끝에서중심,"w":,"h":,"y":}} / {"op":"updateOpening","target":"문1","set":{"open":0~2(3연동 중문 열린 짝 수),"ang":0~90,"wo":0~1(창 열림),"cur":"none|curtain|sheer|blind|roll","cc":"#hex","fc":"#hex","dc":"#hex"}} / {"op":"deleteOpening","target":...}
- {"op":"night","value":true|false}  {"op":"view","value":"door|iso|isoL|top|plan|eye0"}  {"op":"render","views":["eye0","iso"],"size":"yt","style":"real"}  {"op":"clearItems"}
모델키(type): ${typeList()}
재질키(mat): ${A.MATS.map(m => m[0] || '""').join(', ')}
열 패턴(cpat, 열마다 한 글자): \n${colList()}
사람(person): sex m|f|c, outfit ${A.OUTFITS.map(o => o[0]).join('|')}, hs(머리) ${A.HAIRS.map(o => o[0]).join('|')}, bangs 앞머리 1/0, hair/skin/shoe/tie/c3 #hex, color=상의 c2=하의, sleeve long|short|none, tieT none|tie|bow, skirtL 0.3~1, pose ${Object.keys(A.POSES).join('|')} 또는 각도 aL/aR(팔 들기 -60~180) zL/zR(0앞~90옆) eL/eR(팔꿈치 0~150) leg(보폭 -1~1) yaw(고개 좌우 -70~70) pitch(고개 상하: +들기 -숙이기, -45~45) sit 1/0, 체형 shw/build/headS(0.8~1.4), 얼굴사진 크기 fsz(0.5~1.45) fzoom(0.5~2.5) fox/foy(-0.4~0.4), glasses/flower/bouquet/veil 1/0. 기본 키 남180 여165 어린이120. 왼쪽/오른쪽 팔은 사람 본인 기준(L=본인 왼쪽).
카탈로그(preset 이름으로 쓰면 크기·모양이 자동 적용):\n${catalogNames()}
공간: 한 프로젝트에 여러 공간(방·야외)이 있습니다(상태의 space/spaces). 새 공간: {"op":"addSpace","kind":"room|outdoor","name":"","W":,"D":,"H":,"env":"${['field','mountain','forest','gravel','beach','lake','valley','sand','snow','garden','plaza','rooftop','deckyard','farm'].join('|')}"} · 이동: {"op":"switchSpace","name":"공간 이름"} · 모든 공간 함께 보기(야외 배경 위에 방들 배치): {"op":"overview"} · 야외 환경 변경: {"op":"room","set":{"env":"beach","gk":"grass|moss|gravel|sand|dune|snow|pavers|stone|concrete|deck|farm|soil","gc":"#hex","vtime":"day|cloudy|dawn|sunset|night"}}. 야외에는 창문·문이 없고 나무(tree, pv broad|pine|palm|birch|cherry|maple|cypress)·바위·파라솔·텐트·아치 등 야외·조경 카탈로그를 씁니다. 사람 체형 body: std|slim|muscle|curvy|plump|petite.
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
  const ROOM_SYS = () => `이미지(방 사진·인테리어 사진·평면도/도면·야외 풍경 사진)를 분석해 3D 공간 데이터로 바꿉니다. 여러 장이면 같은 공간의 다른 각도/도면으로 보고 합칩니다.
치수: 도면에 숫자가 있으면 그대로(mm→cm), 없으면 사진 속 문(폭 90·높이 210), 사람, 가구, 바닥 타일 크기로 추정. 실내는 한국 아파트 기준 천장 230 내외.
JSON 하나만:
{"space":{"kind":"room|outdoor","name":"짧은 한국어 공간 이름","env":"(야외만) field|mountain|forest|gravel|beach|lake|valley|sand|snow|garden|plaza|rooftop|deckyard|farm","gk":"(야외 지면) grass|moss|gravel|sand|dune|snow|pavers|stone|concrete|deck|farm|soil","gc":"#hex 지면색","vtime":"day|cloudy|dawn|sunset|night"},
"room":{"W":외곽 가로cm,"D":외곽 깊이cm,"H":천장높이(실내),"shape":"rect|L|Lr|T|U|cham|trap","pts":[[x,z],...] (직사각형이 아니면 위에서 본 꼭짓점 좌표 cm: 왼쪽 뒤 모서리가 (0,0), x=오른쪽, z=앞쪽, 시계방향),"fl":"(실내 바닥재) ${A.FLOORS.map(f => f[0]).join('|')}","flc":"#hex 바닥색","wc":"#hex 벽색","view":"창밖 풍경 ${A.VIEWS.map(v => v[0]).join('|')}"},
"openings":[{"kind":"win|door","st":"창:${A.WIN_ST.map(s => s[0]).join('|')} 문:${A.DOOR_ST.map(s => s[0]).join('|')}","wall":"벽1(뒷벽)|벽2(오른쪽)|벽3(앞벽)|벽4(왼쪽)","s":방안에서 벽을 볼때 왼쪽끝에서 창호중심,"w":,"h":,"y":}],
"items":[{"name":"","type":"모델키","w":,"d":,"h":,"x":왼쪽에서중심,"z":뒤에서중심,"rot":0,"color":"#hex","c2":"#hex","mat":"","pv":"식물/나무 종류","desc":"영어 외형 설명(짧게)"}],
"desc":"실사 렌더용 영어 분위기 설명 (재질·조명·스타일·풍경; 60단어 이내)","note":"치수 근거와 추정 내용 (한국어)"}
야외 사진이면 kind=outdoor 로 하고 나무(tree, pv broad|pine|palm|birch|cherry|maple|cypress)·바위(rock)·관목(bush)·파라솔·텐트·벤치·아치·데크 등을 items 로. 창호는 실내만.
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
      toast(acts.length ? `✅ AI가 ${acts.length}개 작업을 적용했습니다${log.length ? ' — ' + log.slice(0, 2).join(' · ') : ''}` : `💬 AI 답변: ${(j.reply || '').slice(0, 60)}`, 6000, acts.length ? ['되돌리기', () => document.getElementById('undo').click()] : ['보기', () => A.showTab('ai')], { type: acts.length ? 'ok' : 'info', sys: true });
    } catch (e) { pushMsg('sys', '⚠ ' + e.message); toast('⚠ AI 대화 오류: ' + e.message, 8000, null, { type: 'err' }); }
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
    const m = modelFor('chat'), ta = h('textarea', { rows: 4, placeholder: '무엇을 할까요? (예: 창가에 1인 소파 추가)\nEnter 보내기 · Shift+Enter 줄바꿈', enterkeyhint: 'send', id: 'chatta' });
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); const v = ta.value; ta.value = ''; send(v); } });
    const fi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    fi.onchange = async () => { for (const f of fi.files) attach.push(await fileToDataURL(f, 1400)); fi.value = ''; drawAttach(); };
    const chips = ['전체 조명 어둡게 해줘', '조명 모두 켜고 밝게', '야간 모드로 보여줘', '이 방 동선과 배치 문제점 분석해줘', '북유럽 스타일로 색과 재질 바꿔줘', '빈 공간에 어울리는 식물 2개 배치', '침대 옆에 협탁 추가', '가구 예상 가격 채워줘', '이 방을 아늑한 서재로 꾸며줘', '창밖 풍경을 바다 노을로'];
    app(b,
      h('div', { class: 'aitools' },
        BTN('📷 사진으로 가구 추가', () => openPhoto('furniture'), 'b'), BTN('👤 사진에서 사람 추가', () => openPhoto('people'), 'o'), BTN('🏠 공간·도면·야외 인식', () => openPhoto('room'), 'o'),
        BTN('🎨 실사 이미지 만들기', () => openRender(), 'b'), BTN('🖼 갤러리', openGallery, 'o'), BTN('⚙ AI 설정', openSettings, 'o')),
      h('div', { class: 'mu sm' }, `대화 모델: ${PROVIDERS[m.provider]?.name} · ${m.model}`, m.key ? '' : ' — ⚠ 키 없음'),
      h('div', { id: 'chatlog', class: 'chatlog' }), h('div', { class: 'rsz', id: 'logrsz', title: '끌어서 대화창 크기 조절' }, h('span')),
      h('div', { id: 'chatbusy', class: 'mu sm', hidden: true }, 'AI가 생각하는 중…'),
      h('div', { class: 'chips' }, chips.map(c => h('button', { class: 'c', onclick: () => send(c) }, c))),
      h('div', { id: 'chatatt', class: 'attrow' }),
      h('div', { class: 'chatin' }, h('div', { class: 'rsz', id: 'tarsz', title: '끌어서 입력창 크기 조절' }, h('span')), ta,
        h('div', { class: 'chatbar' }, h('button', { class: 'c ic', title: '사진 첨부', onclick: () => fi.click() }, '📎'), h('button', { id: 'chatmic', class: 'c ic', title: '음성 입력', onclick: () => voice(ta) }, '🎤'),
          h('span', { class: 'mu sm grow' }, '⇕ 위 막대를 끌어 크기 조절'), h('button', { id: 'chatsend', class: 'b', onclick: () => { const v = ta.value; ta.value = ''; send(v); } }, '보내기'), fi)),
      h('div', { class: 'r' }, BTN('대화 지우기', () => { CHAT = []; LS.set(K_CHAT, CHAT); drawChat(); }, 'c')));
    drawChat(); drawAttach();
    // 크기 조절 (마우스·터치 모두) — 크기는 이 기기에 기억
    const fitH = () => { const lh = LS.get('room3d.v2.chatH', null), th = LS.get('room3d.v2.taH', null); const log = document.getElementById('chatlog'); if (lh && log) { log.style.height = lh + 'px'; log.style.maxHeight = 'none'; } if (th) ta.style.height = th + 'px'; };
    fitH();
    const drag = (handle, el, key, min, sign) => {
      if (!handle || !el) return;
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); handle.setPointerCapture(e.pointerId); const y0 = e.clientY, h0 = el.getBoundingClientRect().height; handle.classList.add('on');
        const mv = ev => { const v = Math.max(min, Math.min(window.innerHeight * 0.85, h0 + sign * (ev.clientY - y0))); el.style.height = v + 'px'; el.style.maxHeight = 'none'; };
        const up = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); handle.classList.remove('on'); LS.set(key, Math.round(el.getBoundingClientRect().height)); };
        handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
      });
      handle.addEventListener('dblclick', () => { el.style.height = ''; el.style.maxHeight = ''; LS.set(key, null); });
    };
    drag(document.getElementById('logrsz'), document.getElementById('chatlog'), 'room3d.v2.chatH', 80, 1);
    drag(document.getElementById('tarsz'), ta, 'room3d.v2.taH', 60, -1);
  }

  // ---------- 사진 인식 ----------
  function openPhoto(mode0 = 'furniture') {
    let mode = mode0, imgs = [], result = null;
    const body = h('div', {}), fi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }), cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const addFiles = async files => { for (const f of files) imgs.push(await fileToDataURL(f, 1800)); draw(); };
    fi.onchange = () => { addFiles(fi.files); fi.value = ''; }; cam.onchange = () => { addFiles(cam.files); cam.value = ''; };
    const hint = { furniture: '상품 사진·상세페이지 캡처(치수표 포함)를 올리면 품목·사이즈·형태를 인식합니다. 여러 사이즈가 있으면 선택할 수 있습니다.', people: '사진 속 사람을 한 명씩 인식해 3D 사람 모델로 만듭니다 (기본 키: 남 180cm / 여 165cm).', room: '방·인테리어 사진, 평면도·도면(치수 표기), 야외 풍경 사진(들판·산·바다·자갈 등)을 올리면 공간 모양·치수·마감·환경·가구를 인식합니다. 지금 공간에 적용하거나 새 공간으로 추가할 수 있습니다.' };
    let ratio = false;
    const draw = () => {
      body.innerHTML = '';
      app(body,
        h('div', { class: 'seg' }, [['furniture', '🪑 가구·소품'], ['people', '👤 사람'], ['room', '🏠 공간·도면·야외']].map(([k, n]) => h('button', { class: mode === k ? 'on' : '', onclick: () => { mode = k; result = null; draw(); } }, n))),
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
        const out = await aiText({ ...m, system: sys, prompt: mode === 'furniture' ? '사진 속 가구/소품을 모두 추출하세요. 치수표를 꼼꼼히 읽으세요.' : mode === 'people' ? '사진 속 모든 사람을 왼쪽부터 추출하세요.' : '공간(실내/야외)·도면을 분석하세요. 치수 표기를 꼼꼼히 읽으세요.', images: imgs, json: true });
        result = parseJSON(out);
        if (mode === 'furniture') (result.items || []).forEach(it => { it._on = true; it._v = -1; });
        if (mode === 'people') { for (const p of (result.people || [])) { p._on = true; p._faceOn = true; p._adj = { dx: 0, dy: 0, s: 1 }; p.height = p.sex === 'f' ? 165 : p.sex === 'c' ? 120 : 180; const src = imgs[Math.min(imgs.length - 1, Math.max(0, p.img | 0))]; p._src = src; if (Array.isArray(p.face_box) && p.face_box.length === 4) { try { p.face = await cropFace(src, p.face_box, p._adj); p.skin = await sampleSkin(p.face); } catch (e) { } } } }
      } catch (err) { toast('⚠ 인식 실패: ' + err.message, 8000, null, { type: 'err', sys: true }); }
      if (result) toast(mode === 'furniture' ? `✅ 인식 완료 — 가구·소품 ${(result.items || []).length}개` : mode === 'people' ? `✅ 인식 완료 — 사람 ${(result.people || []).length}명` : `✅ 공간 인식 완료 — ${(result.space || {}).name || ''}`, 5000, null, { type: 'ok', sys: true });
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
            h('div', { class: 'r' }, BTN('배치에 추가', () => addFurn([it]), 'c'), BTN('💾 내 가구로 저장…', () => addFurn([it], true), 'c')));
        }), h('div', { class: 'r' }, BTN('선택 항목 모두 배치에 추가', () => addFurn(list.filter(x => x._on)), 'b'), BTN('💾 선택 항목 내 가구로 저장…', () => addFurn(list.filter(x => x._on), true))));
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
            h('div', { class: 'r' }, BTN('배치에 추가', () => addPeople([p]), 'c'), BTN('💾 내 가구로 저장…', () => addPeople([p], true), 'c')))),
          h('div', { class: 'r' }, BTN('선택한 사람 모두 배치에 추가', () => addPeople(list.filter(x => x._on)), 'b'), BTN('💾 선택한 사람 내 가구로 저장…', () => addPeople(list.filter(x => x._on), true))));
      }
      const r = result.room || {}, sp = result.space || {}, out = sp.kind === 'outdoor', its = result.items || [], ops = out ? [] : (result.openings || []);
      const opt = result._opt || (result._opt = { items: true, refs: true, ops: true });
      const apply = async asNew => {
        if (asNew) A.newSpace({ kind: out ? 'outdoor' : 'room', env: sp.env, W: r.W, D: r.D, H: r.H, name: sp.name });
        A.applyRoomSpec({ ...r, ...(out ? { env: sp.env, gk: sp.gk, gc: sp.gc, vtime: sp.vtime, H: undefined } : {}), desc: result.desc, openings: !out && opt.ops ? ops : undefined });
        if (opt.items && its.length) A.runActions(its.map(it => ({ op: 'add', item: it })));
        if (opt.refs) { const R = A.R; R.refs = [...(R.refs || [])]; for (const im of imgs.slice(0, 4)) R.refs.push({ id: await putRef(await shrinkImg(im, 900)), kind: /도면|plan/i.test(result.note || '') ? 'layout' : 'style' }); A.commit(); A.renderRoom && A.renderRoom(); }
        toast(asNew ? `＋ '${sp.name || '새 공간'}' 공간을 만들었습니다` : '지금 공간에 적용했습니다', 4000); m.close && m.close();
      };
      return h('div', {}, h('h3', {}, out ? `🌳 인식된 야외 공간 — ${sp.name || ''}` : `🏠 인식된 방 — ${sp.name || ''}`),
        h('p', {}, out ? `환경 ${sp.env || '-'} · 지면 ${sp.gk || '-'} · 영역 ${r.W || '-'} × ${r.D || '-'} cm` : `가로 ${r.W} · 깊이 ${r.D} · 높이 ${r.H || '-'} cm · ${Array.isArray(r.pts) && r.pts.length > 2 ? `다각형 ${r.pts.length}꼭짓점` : '모양 ' + (r.shape || 'rect')}`),
        h('p', { class: 'sm' }, `${out ? '' : `창호 ${ops.length}개 · `}가구·객체 ${its.length}개${result.desc ? ' · 분위기: ' + result.desc : ''}`), result.note ? h('p', { class: 'mu sm' }, result.note) : null,
        h('div', { class: 'cg' }, h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: opt.items, onchange: e => { opt.items = e.target.checked; } }), `가구·객체 ${its.length}개도 배치`), !out ? h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: opt.ops, onchange: e => { opt.ops = e.target.checked; } }), `창문·문 ${ops.length}개 적용`) : null, h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: opt.refs, onchange: e => { opt.refs = e.target.checked; } }), '이 사진을 공간 참고 사진으로 저장 (실사 렌더에 반영)')),
        h('div', { class: 'r' }, BTN('＋ 새 공간으로 만들기', () => apply(true), 'b'), BTN('지금 공간에 적용', () => { if (confirm('지금 공간의 모양·치수를 바꿉니다. 계속할까요?')) apply(false); }, 'o')));
    };
    draw(); const m = modal('📷 사진으로 인식', body, { wide: true }); return m;
  }
  function addFurn(list, save) {
    if (!list.length) return toast('선택된 항목이 없습니다');
    const ent = [];
    list.forEach(it => { const spec = { ...it }; ['_on', '_v', 'variants', 'note', 'dims_source'].forEach(k => delete spec[k]); if (save) { const { it: obj } = A.specToItem(spec); ent.push({ it: obj, name: spec.name || obj.name }); } else A.runActions([{ op: 'add', item: spec }]); });
    if (save) A.saveLibDialog(ent); else toast(`${list.length}개를 배치했습니다`);
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
    if (!n) return toast('선택된 사람이 없습니다');
    const ent = [];
    list.forEach((p, i) => { const s = personSpec(p); if (save) { const { it } = A.specToItem(s); ent.push({ it, name: s.name }); } else A.runActions([{ op: 'add', item: { ...s, x: R.W * (i + 1) / (n + 1), z: R.D * 0.55, rot: 0 } }]); });
    if (save) A.saveLibDialog(ent, 'b:사람'); else toast(`${n}명을 배치했습니다`);
  }

  // ---------- 실사 렌더 ----------
  function sceneText(viewKey) {
    const d = A.describe(), r = d.room, L = [], sp = d.space || {};
    if (sp.kind === 'outdoor') {
      if ((d.houses || []).length) L.push(`Buildings on the site (keep them exactly, same footprint, height, windows and doors as in image #1): ${d.houses.map(x => `a single-storey house containing the room "${x.room}" ${x.w}x${x.d}cm, ${x.h}cm wall height, ${x.roof === 'gable' ? 'gable roof' : x.roof === 'none' ? 'no roof (cut-away view showing the interior)' : 'flat roof'}`).join('; ')}.`);
      L.push(`OUTDOOR scene (no walls, no ceiling): ${sp.envName || sp.env} environment. Usable site ${r.W}cm x ${r.D}cm (dashed boundary is only a guide — do NOT draw it). Ground: ${sp.ground || ''} (${sp.groundColor || ''}). Time/weather: ${sp.time}. Keep the surrounding scenery type (mountains/sea/forest/city etc.) as in the input.${sp.desc ? ' Look & feel: ' + sp.desc : ''}`);
    } else {
    L.push(`Room: ${r.W}cm wide x ${r.D}cm deep, ceiling ${r.H}cm, ${r.shape === 'rect' ? 'rectangular' : 'custom-shaped (' + r.walls.length + ' walls' + (r.walls.some(w => w.curved) ? ', with curved wall' : '') + ')'}.`);
    L.push(`Floor: ${A.floorName(r.floor.type) || r.floor.type} (${r.floor.color}), plank/tile direction ${r.floor.dir}°. Walls: ${r.wallColor}${r.walls.some(w => w.color !== r.wallColor) ? ', accent walls ' + r.walls.filter(w => w.color !== r.wallColor).map(w => w.label + ' ' + w.color).join(', ') : ''}.`);
    }
    if (sp.kind !== 'outdoor') L.push(`Windows/doors: ${d.openings.map(o => `${o.label} ${o.stName} ${o.w}x${o.h}cm on ${o.wall}${o.kind === 'win' && o.curtain && o.curtain !== 'none' ? ' with ' + o.curtain : ''}${o.open ? ' (open ' + o.open + ')' : ''}`).join('; ') || 'none'}. View outside windows: ${r.outsideView}, ${r.viewTime === 'auto' ? (r.night ? 'night' : 'daytime') : r.viewTime}.`);
    L.push('Furniture & objects (exact sizes, keep them): ' + d.items.map(i => `${i.desc ? '(' + i.desc + ') ' : ''}${i.name} [${A.TYPES[i.type] || i.type}] ${i.w}x${i.d}x${i.h}cm, color ${i.color}${i.c2 ? '/' + i.c2 : ''}${i.mat ? ', material ' + A.matName(i.mat) : ''}${i.mat2 ? '/' + A.matName(i.mat2) : ''}${i.type === 'person' ? `, ${personEN(i)}` : ''}${i.flip ? `, ${i.flip}` : ''}${i.on === false ? ', lamp OFF' : i.on ? `, lamp ON ${Math.round((i.lum ?? 0.8) * 100)}%` : ''}`).join('; ') + '.');
    L.push('Lighting fixtures: ' + (d.lights.map(l => `${l.kindName} ${l.on && l.lum > 0 ? `ON at ${Math.round(l.lum * 100)}% brightness, ${l.temp}K` : 'OFF (dark)'}`).join('; ') || 'none') + `. Overall: ${r.night ? 'NIGHT — room lit only by the listed lights that are ON; lights that are OFF must stay dark' : 'DAYTIME — natural light through windows plus listed lights'}.`);
    L.push(`Camera: ${{ cur: 'same as the input image', door: 'from the entrance looking in', iso: 'elevated three-quarter view', isoL: 'elevated three-quarter view from the left', top: 'top-down view', sel: 'close-up' }[viewKey] || 'eye-level from a corner of the room (150cm high)'}.`);
    return L.join('\n');
  }
  const OUTFIT_EN = { suit: 'a business suit', suit3: 'a three-piece suit', tux: 'a tuxedo', casual: 'a shirt and trousers', tshirt: 'a t-shirt and shorts', hoodie: 'a hoodie and trousers', knit: 'a knit sweater and trousers', sport: 'a tracksuit', coat: 'a long coat', blouse: 'a blouse and skirt', dress: 'a dress', longdress: 'a long dress', gown: 'a white wedding gown', mermaid: 'a long fitted evening gown', hanbok: 'a traditional Korean hanbok', hanbokM: 'a traditional Korean hanbok', beachM: 'a Hawaiian shirt and shorts', tank: 'a casual top and shorts', rash: 'a long-sleeve rash guard and board shorts', swimF: 'a one-piece swimsuit with a beach cover-up', apron: 'work clothes with an apron', blazer: 'a blazer and slacks', jeans: 'a t-shirt and jeans' };
  const BUILD_EN = { slim: 'slim build', muscle: 'athletic build', curvy: 'medium build', plump: 'sturdy build', petite: 'petite build' };
  let REFCTX = null; // 렌더 중: 객체 id → [{n: 참고 이미지 번호, kind}]
  const sexEN = i => i.sex === 'f' ? 'woman' : i.sex === 'c' ? 'child' : 'man';
  const personEN = (i, plain) => {
    const rf = (!plain && REFCTX && REFCTX.get(i.id)) || [], nOf = ks => rf.filter(r => ks.includes(r.kind)).map(r => '#' + r.n), cl = nOf(['outfit', 'look']), fc = nOf(['face', 'facehair', 'look', 'hair']);
    const wear = cl.length ? `wearing EXACTLY the outfit from reference image ${cl.join('/')} (ignore the 3D clothing colors)` : `wearing ${OUTFIT_EN[i.outfit] || 'everyday clothes'} (clothing colors ${[i.color, i.c2].filter(Boolean).join(' and ')}, with shoes)`;
    return `a ${sexEN(i)} about ${i.h}cm tall ${wear}${fc.length ? `, with exactly the face and hairstyle of the person in reference image ${fc.join('/')}` : ''}${!plain && BUILD_EN[i.body] ? ', ' + BUILD_EN[i.body] : ''}${(POSE_EN[i.pose] ? ', ' + POSE_EN[i.pose] : '')}${Math.abs(i.pitch || 0) >= 8 ? `, head tilted ${i.pitch > 0 ? 'up' : 'down'} about ${Math.abs(Math.round(i.pitch))}°` : ''}${Math.abs(i.yaw || 0) >= 10 ? `, head turned to their ${i.yaw > 0 ? 'left' : 'right'} about ${Math.abs(Math.round(i.yaw))}°` : ''}`;
  };
  const POSE_EN = { sit: 'seated', sitW: 'seated, waving', walk: 'walking', wave: 'waving', cross: 'arms crossed', hips: 'hands on hips', point: 'pointing', cheer: 'arms raised', hold: 'hands together' };
  function renderPrompt(viewKey, o) {
    const out = (A.describe().space || {}).kind === 'outdoor';
    return `Transform this 3D ${out ? 'outdoor scene layout' : 'interior layout'} render into a single photorealistic ${out ? 'outdoor' : 'interior'} photograph.
STRICT RULES: keep the EXACT same camera angle, framing, perspective and room geometry; windows and doors keep their exact wall, position, width, height and sill height (do not enlarge windows, do not turn walls into windows); foreground elements (e.g. a glass sliding door frame the camera looks through) stay in the foreground; keep every piece of furniture, object, person, window and door in exactly the same position, size, proportion, shape, color and material as in the input; do not move, add or remove furniture${o.decor ? ' (you MAY add a few small decorative accessories like books, cushions, a throw, small vases)' : ' and do not add new objects'}. Replace simplified geometry with realistic real-world equivalents of the same design (e.g. a box labeled bookshelf becomes a real bookshelf of the same size). Respect the lighting state exactly: fixtures that are OFF stay dark, dimmed lights stay dim. Realistic global illumination, soft shadows, accurate materials, natural textures, 35mm lens look, high dynamic range, no text, no watermark, no people unless people are present in the input.
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
  // ---------- 참고 사진: 객체별 목록 · 보낼 사진 계획 · 대상 잘라내기 ----------
  const MAXI = 10; // 한 번에 AI에 보내는 이미지 상한 (3D 화면·구조 가이드 포함)
  const PER_OBJ = 3; // 객체 하나당 보내는 붙여 둔 사진 수
  const refOwners = () => { const L = []; for (const it of A.items.filter(x => x.type === 'person')) if ((it.refs || []).length) L.push({ o: it, refs: it.refs }); for (const it of A.items.filter(x => x.type !== 'person')) if ((it.refs || []).length) L.push({ o: it, refs: it.refs }); if ((A.R.refs || []).length) L.push({ o: 'space', refs: A.R.refs }); return L; };
  // 사람 → 가구·소품 → 공간 순서로, 객체당 PER_OBJ장 · 전체 max장까지
  // 이번 렌더용 사진이 같은 사람의 같은 항목을 지정했으면, 붙여 둔 사진(다른 얼굴·옷일 수 있음)은 빼서 충돌 방지
  const OVER = { look: ['face', 'hair', 'outfit', 'look'], facehair: ['face', 'hair', 'look'], face: ['face', 'look'], outfit: ['outfit', 'look'] };
  const skipBy = xs => (it, r) => it !== 'space' && it.type === 'person' && xs.some(x => x.tgt === it && (OVER[x.aspect] || []).includes(r.kind));
  function planRefs(max, skip) {
    let left = max; const out = [];
    for (const g of refOwners()) { let k = 0; const off = g.o !== 'space' && g.o.refUse === 0;
      for (const r of g.refs) { let send = false, why = '';
        if (off) why = '객체 꺼짐'; else if (r.use === 0) why = '끔'; else if (skip && skip(g.o, r)) why = '이번 렌더용 사진이 대신함'; else if (['pose', 'dims', 'layout'].includes(r.kind)) why = '자세·치수는 3D 값 사용'; else if (g.o !== 'space' && k >= PER_OBJ) why = `객체당 ${PER_OBJ}장까지`; else if (left <= 0) why = '전체 한도 초과'; else { send = true; k++; left--; }
        out.push({ o: g.o, r, send, why }); } }
    return out;
  }
  const loadImgEl = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽지 못했습니다')); i.src = src; });
  // box: [ymin,xmin,ymax,xmax] 0~1000
  async function cropBox(src, box, pad = 0.05) {
    const im = await loadImgEl(src), W = im.naturalWidth, H = im.naturalHeight;
    let [y0, x0, y1, x1] = box.map(v => Math.max(0, Math.min(1000, +v)) / 1000); if (y1 < y0) [y0, y1] = [y1, y0]; if (x1 < x0) [x0, x1] = [x1, x0];
    const pw = (x1 - x0) * pad, ph = (y1 - y0) * pad; x0 = Math.max(0, x0 - pw); x1 = Math.min(1, x1 + pw); y0 = Math.max(0, y0 - ph); y1 = Math.min(1, y1 + ph);
    const sw = Math.max(8, (x1 - x0) * W), sh = Math.max(8, (y1 - y0) * H), k = Math.min(1, 1400 / Math.max(sw, sh)), c = document.createElement('canvas');
    c.width = Math.round(sw * k); c.height = Math.round(sh * k); c.getContext('2d').drawImage(im, x0 * W, y0 * H, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.92);
  }
  async function findBox(src, note, isP) {
    const v = modelFor('vision'); if (!v.key) throw new Error('사진 분석용 AI 키가 없습니다 (⚙ AI 설정)');
    const j = parseJSON(await aiText({ ...v, json: true, images: [src],
      system: `You locate ONE subject in a photo for cropping. Reply with JSON only: {"box":[ymin,xmin,ymax,xmax]} using integers 0-1000 relative to the image, or {"box":null} if not found. ${isP ? 'The subject is a person: the box must include the whole visible person from the top of the hair down to the lowest visible part (feet if visible), with all of their clothing, and as little of other people as possible. Do not identify who the person is.' : 'The subject is an object or piece of furniture: the box must include the whole object.'} Count positions from the viewer's left when the description says left/right or gives an order.`,
      prompt: `찾을 대상: ${note}` }));
    if (!j || !Array.isArray(j.box) || j.box.length !== 4) throw new Error(`사진에서 「${note}」을(를) 찾지 못했습니다 — 「✂ 대상만 잘라내기」로 직접 지정해 주세요`);
    return j.box;
  }
  async function findInPhoto(src, note, isP) { return cropBox(src, await findBox(src, note, isP), 0.04); }
  // 직접 드래그해서 잘라내기
  function cropDialog(src, done, note, isP) {
    const img = h('img', { src, draggable: 'false' }), rect = h('div', { class: 'crr', hidden: true }), wrap = h('div', { class: 'crw' }, img, rect);
    let box = null, st0 = null; // box: 0~1 [x0,y0,x1,y1]
    const show = () => { if (!box) { rect.hidden = true; return; } rect.hidden = false; const [a, b, c, d] = box; Object.assign(rect.style, { left: a * 100 + '%', top: b * 100 + '%', width: (c - a) * 100 + '%', height: (d - b) * 100 + '%' }); okB.disabled = false; };
    const pt = e => { const r = img.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    wrap.addEventListener('pointerdown', e => { e.preventDefault(); wrap.setPointerCapture(e.pointerId); st0 = pt(e); box = [...st0, ...st0]; show(); });
    wrap.addEventListener('pointermove', e => { if (!st0) return; const p2 = pt(e); box = [Math.min(st0[0], p2[0]), Math.min(st0[1], p2[1]), Math.max(st0[0], p2[0]), Math.max(st0[1], p2[1])]; show(); });
    wrap.addEventListener('pointerup', () => { st0 = null; if (box && (box[2] - box[0] < 0.02 || box[3] - box[1] < 0.02)) { box = null; show(); okB.disabled = true; } });
    const okB = BTN('✂ 이 영역만 보내기', async () => { if (!box) return; done(await cropBox(src, [box[1] * 1000, box[0] * 1000, box[3] * 1000, box[2] * 1000], 0)); m.close(); }, 'b'); okB.disabled = true;
    const aiB = note ? BTN(`🤖 「${note}」 자동 찾기`, async () => { aiB.disabled = true; aiB.textContent = '찾는 중…'; try { const b = await findBox(src, note, isP); const n = b.map(v => Math.max(0, Math.min(1000, +v)) / 1000); box = [Math.min(n[1], n[3]), Math.min(n[0], n[2]), Math.max(n[1], n[3]), Math.max(n[0], n[2])]; show(); toast('찾은 영역을 표시했습니다 — 맞으면 「이 영역만 보내기」, 아니면 직접 드래그하세요', 5000); } catch (e) { toast('⚠ ' + e.message, 6000); } aiB.disabled = false; aiB.textContent = `🤖 「${note}」 다시 찾기`; }, 'c') : null;
    const m = modal('✂ 참고 사진에서 대상만 잘라내기', h('div', {}, h('p', { class: 'mu sm' }, isP ? '적용할 사람을 머리부터 발끝(보이는 곳까지)까지 드래그로 감싸세요. 다른 사람이 적게 들어갈수록 얼굴·옷이 정확하게 반영됩니다.' : '적용할 물건을 드래그로 감싸세요.'), wrap, h('div', { class: 'r' }, okB, aiB, BTN('취소', () => m.close(), 'c'))), { wide: true });
  }
  function openRender(pre = {}) {
    const R = A.R, nCorner = Math.min(6, R.pts.length);
    const VIEWS = [['cur', '현재 화면'], ['door', '입구 시점'], ['iso', '대각선 (오른쪽)'], ['isoL', '대각선 (왼쪽)'], ['top', '위에서'], ...Array.from({ length: nCorner }, (_, i) => [`eye${i}`, `눈높이 · 모서리 ${i + 1}`]), ['sel', '선택 대상 클로즈업']];
    const st = { size: pre.size || 'yt', cw: 1920, ch: 1080, views: new Set(pre.views || ['cur']), style: pre.style || 'real', extra: pre.extra || '', decor: false, ai: true, quality: 'high', useRefs: true, extraRefs: [], guide: true, faces: true, noPeople: false };
    const tgtOf = x => x.use && x.use !== 'style' ? A.items.find(q => 'i:' + q.id === x.use || 'p:' + q.id === x.use) || null : null;
    const nRefs = () => refOwners().reduce((n, g) => n + g.refs.length, 0);
    const curSkip = () => skipBy(st.extraRefs.map(x => ({ tgt: tgtOf(x), aspect: x.aspect })).filter(x => x.tgt));
    const budget = () => Math.max(0, MAXI - 1 - (st.guide ? 1 : 0) - Math.min(4, st.extraRefs.length));
    const defUse = () => { const s0 = A.sel, so = s0 && s0.k === 'item' ? s0.o : null, ppl = A.items.filter(x => x.type === 'person'); if (so && so.type === 'person') return 'i:' + so.id; if (ppl.length === 1) return 'i:' + ppl[0].id; if (so) return 'i:' + so.id; return ppl.length ? 'i:' + ppl[0].id : 'style'; };
    const xfi = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true }); xfi.onchange = async () => { for (const f of xfi.files) st.extraRefs.push({ src: await fileToDataURL(f, 1600, 0.88), crop: null, use: defUse(), aspect: 'look', note: '' }); xfi.value = ''; draw(); };
    const P_ASP = [['look', '얼굴+헤어+옷 전체'], ['facehair', '얼굴+헤어'], ['face', '얼굴만'], ['outfit', '옷차림만']], I_ASP = [['look', '전체 모양·재질'], ['shape', '모양·형태'], ['material', '재질·색감'], ['detail', '디테일']];
    const ITEM_ASP_EN = { look: 'same overall design, shape, materials and colors', shape: 'same shape and form', material: 'same materials, textures and colors', detail: 'same details (hardware, stitching, edges)' };
    const identLine = (x, n, vk, w, hh) => {
      const t = x.tgt, bx = A.itemBox(vk, w, hh, t), where = bx ? ` (in image #1 at x ${bx.l}–${bx.r}%, y ${bx.t}–${bx.b}% of the frame)` : '', who = x.note ? ` — the one described as "${x.note}"` : '';
      if (t.type === 'person') {
        const a = x.aspect, face = a !== 'outfit', hair = a === 'look' || a === 'facehair', cloth = a === 'look' || a === 'outfit';
        return `- ${A.itemLabel(t)}, the ${sexEN(t)}${where}, must be the SAME person as in reference image #${n}${who}: ${[face && 'identical face (eye shape, eyebrows, nose, mouth, jawline, face shape, skin tone, apparent age, facial hair, glasses)', hair && 'identical hairstyle, hair length and hair color', cloth && 'identical outfit (same garments, cut, colors, patterns, layering, shoes and accessories)'].filter(Boolean).join('; ')}. Ignore the simplified 3D ${[face && 'face', hair && 'hair', cloth && 'clothing'].filter(Boolean).join('/')} of this person in image #1; take ONLY body position, size, orientation and pose from image #1. Do not copy the reference photo's pose, background or any other person in it.`;
      }
      return `- ${A.itemLabel(t)} "${t.name}"${where}: make it look like the object in reference image #${n}${who} — ${ITEM_ASP_EN[x.aspect] || ITEM_ASP_EN.look} — while keeping its exact position, footprint, size and orientation from image #1.`;
    };
    const xrRow = (x, i) => {
      const ppl = A.items.filter(q => q.type === 'person'), oth = A.items.filter(q => q.type !== 'person'), tgt = tgtOf(x), isP = !!tgt && tgt.type === 'person';
      const us = h('select', {}, h('option', { value: 'style' }, '공간 분위기·스타일 참고'),
        ppl.length ? h('optgroup', { label: '사람' }, ppl.map(q => h('option', { value: 'i:' + q.id }, `→ ${A.itemLabel(q)} ${q.name}`))) : null,
        oth.length ? h('optgroup', { label: '가구·소품' }, oth.map(q => h('option', { value: 'i:' + q.id }, `→ ${A.itemLabel(q)} ${q.name}`))) : null);
      us.value = tgt ? 'i:' + tgt.id : 'style';
      us.onchange = () => { x.use = us.value; const t2 = tgtOf(x), al = t2 && t2.type === 'person' ? P_ASP : I_ASP; if (!al.some(z => z[0] === x.aspect)) x.aspect = 'look'; draw(); };
      const as = h('select', {}, (isP ? P_ASP : I_ASP).map(([k, n]) => h('option', { value: k }, n))); as.value = x.aspect; as.onchange = () => { x.aspect = as.value; draw(); };
      const nt = h('input', { type: 'text', value: x.note, placeholder: isP ? '사진 속 어느 사람? 예: 왼쪽에서 3번째 서 있는 남자' : '사진 속 어느 물건? 예: 가운데 원목 책장' }); nt.oninput = () => { x.note = nt.value; };
      const im = h('img', { src: x.crop || x.src, title: '크게 보기', onclick: () => viewImg(x.crop || x.src, x.crop ? '잘라낸 부분 (이 부분만 보냄)' : '참고 사진') });
      const kindOf = () => isP ? ({ outfit: 'outfit', look: 'look', facehair: 'face', face: 'face' })[x.aspect] || 'look' : x.aspect;
      return h('div', { class: 'xrr' }, h('div', { class: 'xri' }, im, x.crop ? h('small', { class: 'xrc' }, '✂ 이 부분만 보냄') : null),
        h('div', { class: 'xrf' }, us, tgt ? as : null, tgt ? nt : null,
          tgt ? h('div', { class: 'r' },
            BTN(x.crop ? '✂ 다시 자르기' : '✂ 대상만 잘라내기', () => cropDialog(x.src, c => { x.crop = c; draw(); }, x.note, isP), 'c'),
            BTN('🤖 메모로 자동 찾기', async e => { if (!x.note) return toast('메모 칸에 사진 속 대상(예: 왼쪽에서 3번째 서 있는 남자)을 적어 주세요'); e.target.disabled = true; e.target.textContent = '찾는 중…'; try { x.crop = await findInPhoto(x.src, x.note, isP); toast('✂ 사진에서 대상을 찾아 잘라냈습니다 — 썸네일을 눌러 맞는지 확인하세요', 5000, null, { type: 'ok' }); } catch (err) { toast('⚠ ' + err.message, 6000); } draw(); }, 'c'),
            x.crop ? BTN('전체 사진 쓰기', () => { x.crop = null; draw(); }, 'c') : null) : null,
          h('div', { class: 'r' }, tgt ? BTN(`📌 ${A.itemLabel(tgt)}에 계속 붙여 두기`, async () => { const id = await putRef(x.crop || x.src); tgt.refs = [...(tgt.refs || []), { id, kind: kindOf(), note: x.note || undefined }]; A.commit(); st.extraRefs.splice(i, 1); toast(`📎 ${A.itemLabel(tgt)}에 참고 사진을 붙였습니다 — 다음 렌더부터 자동으로 반영됩니다`, 5000, null, { type: 'ok' }); draw(); }, 'c') : null, BTN('빼기', () => { st.extraRefs.splice(i, 1); draw(); }, 'c'))));
    };
    // 붙여 둔 참고 사진 목록 (객체별 · 보냄/제외 표시)
    const refList = () => {
      const plan = planRefs(budget(), curSkip());
      if (!plan.length) return h('p', { class: 'mu sm' }, '붙여 둔 참고 사진이 없습니다. 3D에서 객체를 선택 → 선택 탭의 「📎 참고 사진」에서 객체마다 붙이거나, 아래 「이번 렌더용 참고 사진 추가」에서 대상을 지정하세요.');
      const groups = []; plan.forEach(p => { let g = groups.find(z => z.o === p.o); if (!g) groups.push(g = { o: p.o, list: [] }); g.list.push(p); });
      return h('div', { class: 'arl' }, groups.map(g => {
        const sp = g.o === 'space', it = sp ? null : g.o, kinds = REF_KINDS[sp ? 'space' : it.type === 'person' ? 'person' : 'item'];
        return h('div', { class: 'arb' },
          h('div', { class: 'arh' }, sp ? h('b', {}, '🏠 공간 전체') : h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: it.refUse !== 0, onchange: e => { it.refUse = e.target.checked ? undefined : 0; A.commit(); draw(); } }), h('b', {}, A.itemLabel(it)), ' ' + it.name),
            h('small', { class: 'mu' }, `${g.list.filter(p => p.send).length}/${g.list.length}장 보냄`), !sp && A.selectItem ? BTN('선택', () => A.selectItem(it), 'c') : null),
          h('div', { class: 'arg' }, g.list.map(p => {
            const img = h('img', { alt: '' }); getRef(p.r.id).then(src => { if (src) img.src = src; else img.alt = '(이 기기에 없음)'; });
            img.onclick = () => img.src && viewImg(img.src, `${sp ? '공간' : A.itemLabel(it)} · ${(kinds.find(k => k[0] === p.r.kind) || [])[1] || p.r.kind}${p.r.note ? ' · ' + p.r.note : ''}`);
            const ks = h('select', {}, kinds.map(([k, n]) => h('option', { value: k }, n))); ks.value = p.r.kind; ks.onchange = () => { p.r.kind = ks.value; A.commit(); };
            return h('div', { class: 'arc' + (p.send ? '' : ' off') }, img, ks,
              h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: p.r.use !== 0, onchange: e => { p.r.use = e.target.checked ? undefined : 0; A.commit(); draw(); } }), p.send ? '보냄' : p.why));
          })));
      }));
    };
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
          h('div', { class: 'cg' }, h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.decor, onchange: e => { st.decor = e.target.checked; } }), '작은 소품(쿠션·책 등) 추가 허용'),
            A.items.some(x => x.type === 'person') ? h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.faces, onchange: e => { st.faces = e.target.checked; } }), '👤 사람 얼굴 사진도 실사에 반영 (안전 필터에 자주 걸리면 끄세요)') : null,
            A.items.some(x => x.type === 'person') ? h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.noPeople, onchange: e => { st.noPeople = e.target.checked; } }), '사람 빼고 공간만 실사로') : null,
            h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.guide, onchange: e => { st.guide = e.target.checked; } }), '🧭 구조 고정 (창·문·가구 위치·크기 가이드를 함께 보내 왜곡 방지 — 권장)'),
            h('label', { class: 'ck' }, h('input', { type: 'checkbox', checked: st.useRefs, onchange: e => { st.useRefs = e.target.checked; draw(); } }), `📎 선택 탭에서 가구·사람·공간에 붙여 둔 참고 사진 반영 (${nRefs()}장 중 ${planRefs(budget(), curSkip()).filter(p => p.send).length}장 보냄)`)),
          st.useRefs ? h('details', { class: 'arw', ontoggle: e => { st.refOpen = e.target.open; }, open: !!st.refOpen }, h('summary', {}, `📋 붙여 둔 참고 사진 목록 (객체별 ${nRefs()}장) — 눌러서 보기·끄기`), refList()) : null,
          h('div', { class: 'r' }, BTN('📎 이번 렌더용 참고 사진 추가', () => xfi.click(), 'c'), xfi, st.extraRefs.length ? BTN(`참고 ${st.extraRefs.length}장 지우기`, () => { st.extraRefs = []; draw(); }, 'c') : null),
          st.extraRefs.length ? h('div', { class: 'xrl' }, h('p', { class: 'mu sm' }, '이번 렌더용 사진마다 적용할 대상(사람·가구·소품)과 항목을 고르세요. 단체 사진이면 「✂ 대상만 잘라내기」나 메모 + 「🤖 메모로 자동 찾기」로 그 사람만 잘라 보내야 정확합니다.'), st.extraRefs.map(xrRow)) : null,
          st.extraRefs.some(x => { const t = tgtOf(x); return t && t.type === 'person'; }) && im.provider !== 'gemini' ? h('p', { class: 'warn sm' }, '💡 사람 얼굴·옷을 사진과 똑같이 맞추는 건 Gemini 이미지 모델(Nano Banana Pro)이 더 잘 따릅니다.') : null,
          h('p', { class: 'mu sm' }, '참고 사진: 얼굴·옷·체형·자세(사람), 재질·모양(가구), 분위기(공간)를 실사 이미지에 맞춰 반영합니다. 선택 탭의 「📎 참고 사진」에서 객체마다 붙일 수 있습니다.'),
          F('이미지 모델', modelPicker('image', draw)),
          h('p', { class: 'mu sm' }, `${PROVIDERS[im.provider]?.name} · ${im.model}${im.key ? '' : ' — ⚠ 키 없음 (⚙ AI 설정)'} · 배치·크기·재질·조명 설정이 프롬프트에 그대로 들어갑니다.`)) : null,
        h('div', { class: 'r' }, BTN(st.ai ? '🎨 생성 시작' : '📷 캡처', go, 'b'), BTN('프롬프트 보기', () => { const vk = [...st.views][0] || 'cur'; modal('프롬프트', h('div', {}, h('pre', { class: 'pre' }, renderPrompt(vk, st) + (st.guide ? '\n\nEXACT OPENINGS & OBJECTS:\n' + A.layoutText(vk, 1280, 720) : '')), st.guide ? h('div', {}, h('p', { class: 'mu sm' }, '함께 보내는 구조 가이드 이미지'), h('img', { src: A.captureGuide(vk, 640, 360), class: 'full' })) : null)); }, 'c')),
        res);
    };
    const go = async () => {
      const sz = SIZES.find(s => s[0] === st.size), W = st.size === 'custom' ? st.cw : sz[2], H = st.size === 'custom' ? st.ch : sz[3];
      if (!(W > 100 && H > 100)) return toast('크기를 확인하세요'); if (!st.views.size) return toast('각도를 하나 이상 선택하세요');
      const im = modelFor('image'); if (st.ai && !im.key) { toast('이미지 모델 키가 없습니다'); return openSettings(); }
      const asp = nearestAspect(W / H), sc = Math.min(1, 1536 / Math.max(W, H)); A.askNotifyPerm && A.askNotifyPerm(); toast(`ℹ ${st.views.size}장 ${st.ai ? '실사 이미지 생성' : '캡처'}을 시작했습니다 — 끝나면 알려 드릴게요`, 3500);
      for (const vk of st.views) {
        const name = VIEWS.find(v => v[0] === vk)?.[1] || vk;
        const card = h('div', { class: 'rcard' }, h('div', { class: 'ph' }, h('span', { class: 'spin' }), h('small', {}, `${name} · 준비 중…`)));
        res.prepend(card);
        try {
          const cap = A.captureView(vk, Math.round(W * (st.ai ? sc : 1)), Math.round(H * (st.ai ? sc : 1)));
          let out = cap, info = '';
          if (st.ai) {
            card.querySelector('small').textContent = `${name} · AI 생성 중… (20~90초)`;
            const cw = Math.round(W * sc), ch = Math.round(H * sc), guide = st.guide ? A.captureGuide(vk, cw, ch) : null, lay = st.guide ? A.layoutText(vk, cw, ch) : '';
            const small = card.querySelector('small'), people = A.items.filter(x => x.type === 'person');
            const xo = st.extraRefs.slice(0, 4).map(x => ({ ...x, tgt: tgtOf(x), orig: x }));
            // 메모만 적고 자르지 않은 사진 → 사진 속 대상을 자동으로 찾아 그 부분만 보냄 (실패하면 전체 사진)
            for (const x of xo) if (x.tgt && x.note && !x.crop && modelFor('vision').key) { try { small.textContent = `${name} · 참고 사진에서 「${x.note}」 찾는 중…`; x.crop = x.orig.crop = await findInPhoto(x.src, x.note, x.tgt.type === 'person'); } catch (e) { console.warn('find', e); } }
            const xid = xo.filter(x => x.tgt), xsty = xo.filter(x => !x.tgt), xidImgs = xid.map(x => x.crop || x.src);
            const start = guide ? 3 : 2, rr = st.useRefs ? await collectRenderRefs(Math.max(0, MAXI - (start - 1) - xo.length), start + xid.length, skipBy(xid)) : { imgs: [], text: '', map: new Map() };
            const sty0 = start + xid.length + rr.imgs.length;
            const RM = new Map(), RM0 = new Map(), addRM = (m, id, n, kind) => { if (!m.has(id)) m.set(id, []); m.get(id).push({ n, kind }); };
            xid.forEach((x, k) => { addRM(RM, x.tgt.id, start + k, x.aspect); addRM(RM0, x.tgt.id, start + k, x.aspect); });
            rr.map.forEach((arr, id) => arr.forEach(z => addRM(RM, id, z.n, z.kind)));
            const identTxt = xid.length ? '\nREFERENCE TARGETS (highest priority after geometry — follow exactly):\n' + xid.map((x, k) => identLine(x, start + k, vk, cw, ch)).join('\n') : '';
            const xt = xsty.length ? `\nStyle reference image${xsty.length > 1 ? 's' : ''} #${sty0}${xsty.length > 1 ? '–#' + (sty0 + xsty.length - 1) : ''}: match overall style, lighting and materials only (never layout or people).` : '';
            const xrSafe = xsty.map(x => x.src);
            const gt = guide ? `\nSTRUCTURE GUIDE: image #2 is a flat-color map rendered from EXACTLY the same camera as image #1 (it is not a style reference): gray = walls/floor/ceiling, BLUE = window frames, light blue = window glass, ORANGE = door frames/panels, light orange = door glass, yellow = light fixtures, each furniture piece = its own flat color listed below. Use it only to lock geometry: every window, door, wall edge and object in your photo must cover the same pixel region as in the guide. Never enlarge, shrink or move a window; never move a door to a different wall; never mirror the scene; whatever is nearest to the camera in image #1 stays nearest.\nEXACT OPENINGS & OBJECTS FROM THE 3D MODEL:\n${lay}` : '';
            REFCTX = RM; const prompt = renderPrompt(vk, st) + identTxt + gt + rr.text + xt; REFCTX = RM0; const idPrompt = renderPrompt(vk, st) + identTxt + gt; REFCTX = null;
            card._prompt = prompt;
            // 참고 사진으로 바꿀 사람은 3D의 단순 얼굴 텍스처를 숨긴 화면을 보냄 (서로 다른 얼굴 정보가 섞이지 않게)
            const idPeople = [...new Set(xid.filter(x => x.tgt.type === 'person' && x.aspect !== 'outfit').map(x => x.tgt))];
            const hideFacesOf = (list, fn) => { const hid = []; list.forEach(x => x.g && x.g.traverse(o => { if (o.userData.faceTex && o.visible) { o.visible = false; hid.push(o); } })); try { return fn(); } finally { hid.forEach(o => { o.visible = true; }); } };
            const capId = idPeople.length ? hideFacesOf(idPeople, () => A.captureView(vk, cw, ch)) : cap;
            const hideFaces = fn => hideFacesOf(people, fn);
            const hasFace = people.some(x => x.face) || idPeople.length > 0;
            const styleTxt = xrSafe.length ? ` Style reference image${xrSafe.length > 1 ? 's' : ''} #${start}${xrSafe.length > 1 ? '–#' + (start + xrSafe.length - 1) : ''}: match overall style, lighting and materials only (never layout or people).` : '';
            const plainPrompt = renderPrompt(vk, st) + gt + styleTxt + `\nPeople in the scene are ordinary, generic, non-identifiable adults in everyday clothes (${people.map(x => personEN(x, true)).join('; ')}). Do not depict any real or identifiable person.`;
            let tries = [{ n: '기본', im, prompt, image: capId, refs: [...(guide ? [guide] : []), ...xidImgs, ...rr.imgs, ...xrSafe], keepId: true }];
            if (xid.length && (rr.imgs.length || xrSafe.length)) tries.push({ n: '지정한 참고 사진만', im, prompt: idPrompt, image: capId, refs: [...(guide ? [guide] : []), ...xidImgs], keepId: true });
            if (people.length) tries.push({ n: hasFace ? '얼굴 사진 빼고' : '사람 묘사 단순화', im, prompt: plainPrompt, recap: 'faces', refs0: [...xrSafe] });
            if (people.length) tries.push({ n: '사람 제외', im, noPeople: true });
            const other = ['gemini', 'openai'].filter(p => p !== im.provider).map(p => ({ provider: p, model: (PROVIDERS[p].image[0] || [])[0], key: keyOf(p) })).find(x => x.key && x.model);
            if (other) tries.push({ n: (PROVIDERS[other.provider] || {}).name + '로', im: other, prompt: people.length ? plainPrompt : prompt, recap: people.length ? 'faces' : null, refs0: people.length ? [...xrSafe] : [...xidImgs, ...rr.imgs, ...xrSafe], keepId: !people.length, soft: true });
            if (people.length && st.noPeople) tries = tries.filter(t => t.noPeople || t.soft); else if (people.length && !st.faces) tries = tries.filter(t => !t.keepId);
            let gen = null, lastErr = null, used = null; const notes = [];
            for (let ti = 0; ti < tries.length; ti++) {
              const t = tries[ti];
              try {
                if (t.recap === 'faces') { t.image = hideFaces(() => A.captureView(vk, cw, ch)); t.refs = [...(guide ? [guide] : []), ...t.refs0]; }
                if (t.noPeople) { const hid = people.filter(x => x.g && x.g.visible); hid.forEach(x => { x.g.visible = false; }); try { t.image = A.captureView(vk, cw, ch); t.refs = guide ? [A.captureGuide(vk, cw, ch)] : []; } finally { hid.forEach(x => { x.g.visible = true; }); } t.prompt = renderPrompt(vk, st).replace(/, a (man|woman|child) about[^;]*/g, '') + (guide ? gt.replace(/- [^\n]*사람[^\n]*\n?/g, '') : '') + '\nDo not add any people.'; }
                small.textContent = ti ? `${name} · 안전 필터에 거절되어 다른 방법으로 다시 시도 (${ti + 1}/${tries.length}: ${t.n}) — 1분 정도 걸릴 수 있어요` : `${name} · AI 생성 중… (20~90초)`;
                const t0 = Date.now();
                try { gen = await aiImage({ ...t.im, prompt: t.prompt, image: t.image, refs: t.refs, aspect: asp, quality: st.quality }); }
                catch (e) { if (!e.safety || people.length || Date.now() - t0 < 20000) throw e; small.textContent = `${name} · 결과 이미지 검사에서 거절 — 같은 내용으로 한 번만 더 시도…`; gen = await aiImage({ ...t.im, prompt: t.prompt, image: t.image, refs: t.refs, aspect: asp, quality: st.quality }); }
                used = t; break;
              } catch (e) { lastErr = e; notes.push(`${t.n}: ${e.safety ? '안전 필터 거절' : (e.message || '').slice(0, 60)}`); if (!e.safety && !(t.soft && e.keyIssue)) throw e; }
            }
            if (!gen) throw new Error(`이미지 AI 안전 필터가 계속 거절했습니다 (${notes.join(' → ')}). ${people.length ? '사람 객체의 얼굴 사진·참고 사진을 빼거나, 렌더 창에서 사람이 안 보이는 각도를 골라 보세요. ' : ''}Gemini 키(크레딧이 남은)를 추가하면 자동으로 함께 시도합니다.`);
            if (used !== tries[0]) toast(`ℹ 안전 필터 거절을 피해 「${used.n}」 방식으로 생성했습니다${used.noPeople ? ' — 사람은 빠진 이미지입니다' : used.recap === 'faces' && hasFace ? ' — 얼굴 사진은 반영되지 않았습니다' : ''}`, 7000);
            out = await coverResize(gen, W, H);
            if (xid.length || rr.imgs.length) info = used.keepId ? `✓ 참고 사진 반영: ${[xid.length && `이번 렌더용 ${xid.length}장`, used === tries[0] && rr.imgs.length && `붙여 둔 ${rr.imgs.length}장`].filter(Boolean).join(' + ')}` : `⚠ 안전 필터 때문에 「${used.n}」 방식으로 생성 — 인물 참고 사진이 빠져서 다른 사람·옷으로 보일 수 있어요`;
            card._sent = { prompt: used.prompt, imgs: [used.image, ...(used.refs || [])] };
          }
          showResult(card, out, cap, name, W, H, info);
          toast(st.ai ? `🎨 실사 이미지 완성 — ${name} (${W}×${H})` : `📷 캡처 완료 — ${name}`, 6000, ['보기', () => { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const im2 = card.querySelector('img'); if (im2) im2.click(); }], { type: 'ok', sys: true, title: '실사 이미지 완성' });
        } catch (e) { card.innerHTML = ''; card.append(h('p', { class: 'warn' }, `${name}: ${e.message}`)); toast(`⚠ ${name} 생성 실패: ${e.message}`, 9000, null, { type: 'err', sys: true }); }
      }
    };
    const showResult = (card, url, cap, name, W, H, info) => {
      const sent = card._sent; card.innerHTML = '';
      const gp = autoGallery(url, { name, project: A.projName, size: `${W}x${H}`, style: st.ai ? st.style : 'capture' });
      const img = h('img', { src: url, alt: name, onclick: () => viewImg(img.src, name) });
      const file = A.fname(`${name}_${W}x${H}.png`.replace(/\s|·/g, ''));
      app(card, img, h('small', {}, `${name} · ${W}×${H}`), info ? h('small', { class: info.startsWith('⚠') ? 'warn' : 'okc' }, info) : null,
        h('div', { class: 'r' }, BTN('저장·공유', () => A.saveFile(file, url, 'image/png', { preview: A.isMobile() }), 'c'),
          sent ? BTN('보낸 사진·지시문', () => modal('AI에 보낸 내용', h('div', {}, h('p', { class: 'mu sm' }, '번호는 지시문의 image #번호와 같습니다. #1 = 3D 화면, 구조 고정이 켜져 있으면 #2 = 구조 가이드.'), h('div', { class: 'sentg' }, sent.imgs.map((u, k) => h('figure', {}, h('img', { src: u, onclick: () => viewImg(u, '#' + (k + 1)) }), h('figcaption', {}, '#' + (k + 1))))), h('pre', { class: 'pre' }, sent.prompt || '')), { wide: true }), 'c') : null,
          st.ai ? BTN('3D 원본', () => { img.src = img.src === url ? cap : url; }, 'c') : null,
          BTN('🖼 갤러리', e => { gp.then(d => { e.target.textContent = d ? (d.cloud ? '🖼 갤러리 (☁ 저장됨)' : '🖼 갤러리 (이 기기)') : '🖼 갤러리'; }); openGallery(); }, 'c')));
    };
    draw(); modal('🎨 실사 이미지 · 고화질 캡처', body, { wide: true });
    if (pre.views && pre.auto !== false && pre.op === 'render') setTimeout(go, 300);
  }
  // 갤러리: 이 기기에 자동 보관된 이미지 + 클라우드 갤러리 (같은 id는 하나로)
  async function autoGallery(url, meta) {
    try {
      const id = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), d = { id, ...(await toGalleryDoc(url, meta)) };
      await putLocal(d);
      if (Cloud.user) { try { const { id: _i, cloud: _c, ...doc } = d; await Cloud.saveGallery(id, doc); await markLocal(id, { cloud: 1 }); d.cloud = 1; } catch (e) { console.warn('cloud gallery', e); } }
      return d;
    } catch (e) { console.warn('gallery', e); return null; }
  }
  async function openGallery() {
    const body = h('div', {}), grid = h('div', { class: 'rgrid' }, h('p', { class: 'mu' }, '불러오는 중…'));
    let filter = 'all';
    const m = modal('🖼 갤러리', app(body, h('div', { class: 'r galbar' },
      h('div', { class: 'seg' }, ...[['all', '전체'], ['proj', '이 프로젝트']].map(([k, n]) => h('button', { class: k === filter ? 'on' : '', onclick: e => { filter = k; e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.target)); paint(); } }, n))),
      BTN('🎨 새 실사 이미지', () => { m.close(); openRender(); }, 'c')),
      h('p', { class: 'mu sm' }, Cloud.user ? '실사 이미지·캡처를 만들 때마다 이 기기와 클라우드에 자동 보관됩니다. 다른 기기에서도 같은 계정으로 보입니다.' : '실사 이미지·캡처를 만들 때마다 이 기기에 자동 보관됩니다. 로그인하면 클라우드에도 저장돼 다른 기기에서 볼 수 있습니다.'), grid) || body, { wide: true });
    let all = [];
    const paint = () => {
      grid.innerHTML = ''; const ls = filter === 'proj' ? all.filter(g => (g.project || '') === (A.projName || '')) : all;
      if (!ls.length) return grid.append(h('p', { class: 'mu' }, all.length ? '이 프로젝트에서 만든 이미지가 없습니다.' : '아직 이미지가 없습니다. 「🎨 새 실사 이미지」나 📷 캡처로 만들어 보세요.'));
      ls.forEach(g => grid.append(h('div', { class: 'rcard' }, h('img', { src: g.img, loading: 'lazy', onclick: () => viewImg(g.img, `${g.project || ''} · ${g.name || ''}`) }),
        h('small', {}, `${g.project || ''} · ${g.name || ''} · ${new Date(g.t).toLocaleString('ko-KR')}`), h('small', { class: 'mu' }, [g.local && '📱 이 기기', g.cloud && '☁ 클라우드'].filter(Boolean).join(' · ')),
        h('div', { class: 'r' }, BTN('저장·공유', () => A.saveFile(`${g.project || 'room'}_${g.name || 'render'}.jpg`.replace(/\s|·/g, ''), g.img, 'image/jpeg', { preview: A.isMobile() }), 'c'),
          !g.cloud && Cloud.user ? BTN('☁ 올리기', async e => { e.target.disabled = true; try { const { id, local, cloud, ...doc } = g; await Cloud.saveGallery(g.id, doc); await markLocal(g.id, { cloud: 1 }); g.cloud = 1; toast('☁ 클라우드 갤러리에 올렸습니다', 3000, null, { type: 'ok' }); paint(); } catch (err) { toast('⚠ ' + err.message); e.target.disabled = false; } }, 'c') : null,
          BTN('삭제', async e => { if (!confirm('이 이미지를 갤러리에서 삭제할까요?' + (g.cloud ? ' (클라우드에서도 삭제)' : ''))) return; if (g.local) await delLocal(g.id); if (g.cloud && Cloud.user) { try { await Cloud.delGallery(g.id); } catch (err) { toast('⚠ ' + err.message); } } all = all.filter(x => x !== g); paint(); }, 'c')))));
    };
    const loc = (await listLocal()).map(g => ({ ...g, local: 1 }));
    let cl = []; if (Cloud.user) { try { cl = (await Cloud.listGallery()).map(g => ({ ...g, cloud: 1 })); } catch (e) { toast('⚠ 클라우드 갤러리를 불러오지 못했습니다: ' + e.message, 5000); } }
    const map = new Map(); [...loc, ...cl].forEach(g => { const o = map.get(g.id); map.set(g.id, o ? { ...o, ...g, local: o.local || g.local, cloud: o.cloud || g.cloud } : g); });
    all = [...map.values()].sort((a, b) => b.t - a.t); paint();
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
  const shrinkImg = (src, max) => new Promise(res => { const i = new Image(); i.onload = () => { const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); }; i.onerror = () => res(src); i.src = src; });
  // ---------- 참고 사진 → 3D 적용 ----------
  const PERSON_KEYS = `sex m|f|c, outfit ${A.OUTFITS.map(o => o[0]).join('|')}, body(체형) std|slim|muscle|curvy|plump|petite, hs(머리) ${A.HAIRS.map(o => o[0]).join('|')}, bangs 1/0, hair/skin/shoe/tie/c3 #hex, color=상의 #hex, c2=하의 #hex, sleeve long|short|none, tieT none|tie|bow, skirtL 0.3~1, glasses/flower/bouquet/veil 1/0, pose ${Object.keys(A.POSES).join('|')} 또는 aL/aR(팔 들기 -60~180°) zL/zR(0앞~90옆) eL/eR(팔꿈치 0~150) leg(-1~1) yaw(고개 좌우 -70~70) pitch(고개 상하: +들기 -숙이기, -45~45) sit 1/0, shw/build(0.8~1.4)`;
  const REFSYS = (kind, cur) => kind === 'person'
    ? `참고 사진(첨부 순서대로 용도가 적혀 있음)을 보고 3D 인물 모델 값을 정합니다. 사진 속 인물의 신원·이름은 절대 추정하지 않고 외형만 봅니다. 노출이 심한 옷차림은 가장 가까운 일상복·수영복 값으로 대신합니다. 지정된 용도의 사진에서만 그 항목을 가져오세요(예: '옷차림' 사진 → 옷·색, '자세' 사진 → 팔·다리 각도, '체형' 사진 → body/shw/build, '얼굴' 사진 → face_box·skin·glasses).
JSON 하나만: {"set":{바꿀 값만 — ${PERSON_KEYS}},"face":{"img":얼굴 사진 번호(0부터),"face_box":[ymin,xmin,ymax,xmax](0~1000)} (얼굴 사진이 있을 때만),"desc":"실사 렌더용 영어 외형 설명 (옷 소재·색·스타일, 헤어, 체형, 자세 느낌; 신원 언급 금지, 60단어 이내)","note":"무엇을 반영했는지 한국어 한두 문장"}
현재 값: ${JSON.stringify(cur)}`
    : kind === 'space'
      ? `참고 사진(인테리어·야외 풍경·도면)을 보고 이 공간의 마감·분위기를 정합니다. JSON 하나만:
{"set":{실내면 "fl":"${A.FLOORS.map(f => f[0]).join('|')}","flc":"#hex 바닥색","wc":"#hex 벽색","bb":"#hex 걸레받이","view":"창밖 풍경 ${A.VIEWS.map(v => v[0]).join('|')}","vtime":"day|sunset|night" / 야외면 "env":"field|mountain|forest|gravel|beach|lake|valley|sand|snow|garden|plaza|rooftop|deckyard|farm","gk":"grass|moss|gravel|sand|dune|snow|pavers|stone|concrete|deck|farm|soil","gc":"#hex 지면색","vtime":"day|cloudy|dawn|sunset|night"},"desc":"실사 렌더용 영어 분위기 설명 (조명, 재질, 스타일, 색감; 60단어 이내)","note":"한국어 요약"}
현재: ${JSON.stringify(cur)}`
      : `참고 사진을 보고 3D 가구·소품 값을 정합니다. 치수는 사진·도면에 숫자가 보이거나 '치수·도면' 사진이 있을 때만 바꿉니다(mm→cm). JSON 하나만:
{"set":{"type":"모델키 (모양이 확실히 다를 때만)","color":"#hex 주색","c2":"#hex 보조색","mat":"재질키","mat2":"보조 재질키","n":단수,"cpat":"열 패턴","pv":"식물·나무 종류","w":,"d":,"h":},"desc":"실사 렌더용 영어 외형 설명 (형태, 소재, 마감, 디테일; 60단어 이내)","note":"한국어 요약"}
모델키: ${typeList()}
재질키: ${A.MATS.map(m => m[0]).filter(Boolean).join(', ')}
현재 값: ${JSON.stringify(cur)}`;
  async function analyzeRefs(target, done) {
    const isSpace = target === 'space', it = isSpace ? null : target, refs = (isSpace ? A.R.refs : it.refs) || [];
    if (!refs.length) return toast('먼저 참고 사진을 추가하세요');
    const v = modelFor('vision'); if (!v.key) { toast('AI 키가 없습니다 (⚙ AI 설정)'); return openSettings(); }
    const imgs = [], labels = [];
    for (const r of refs.slice(0, 8)) { const src = await getRef(r.id); if (!src) continue; labels.push(`사진${imgs.length}: ${(REF_KINDS[isSpace ? 'space' : it.type === 'person' ? 'person' : 'item'].find(k => k[0] === r.kind) || [])[1] || r.kind}${r.note ? ' — ' + r.note : ''}`); imgs.push(src); }
    if (!imgs.length) return toast('참고 사진을 불러오지 못했습니다');
    const kind = isSpace ? 'space' : it.type === 'person' ? 'person' : 'item';
    const cur = isSpace ? A.describe().space && { ...A.describe().room, space: A.describe().space } : Object.fromEntries(Object.entries(it).filter(([k, val]) => !['g', 'refs', 'face', '_rt'].includes(k) && typeof val !== 'object'));
    toast('🤖 참고 사진 분석 중… (10~40초)', 40000);
    try {
      const j = parseJSON(await aiText({ ...v, system: REFSYS(kind, cur), prompt: `첨부 사진 용도:\n${labels.join('\n')}\n${isSpace ? '' : it.type === 'person' ? '이 사람 모델에 반영할 값을 주세요.' : '이 가구에 반영할 값을 주세요.'}`, images: imgs, json: true }));
      const set = { ...(j.set || {}) }; Object.keys(set).forEach(k => { if (set[k] === '' || set[k] == null) delete set[k]; });
      if (kind === 'person' && j.face && Array.isArray(j.face.face_box)) { const src = imgs[Math.min(imgs.length - 1, Math.max(0, j.face.img | 0))]; try { set.face = await cropFace(src, j.face.face_box, { dx: 0, dy: 0, s: 1 }); set.skin = set.skin || await sampleSkin(set.face); } catch (e) { } }
      if (j.desc) set.desc = String(j.desc).slice(0, 600);
      const log = isSpace ? A.runActions([{ op: 'room', set }]) : A.runActions([{ op: 'update', target: A.itemLabel(it), set }]);
      toast('✅ ' + (j.note || '참고 사진 내용을 반영했습니다') + ' (Ctrl+Z 되돌리기)', 6000); done && done(j, log);
    } catch (e) { toast('⚠ ' + e.message, 7000); }
  }
  // 실사 렌더에 넣을 참고 사진 모으기 (사람 얼굴·옷 / 가구 느낌 / 공간 분위기) — planRefs와 같은 규칙
  async function collectRenderRefs(max = 10, start = 2, skip) {
    const out = [], lines = [], map = new Map();
    for (const p of planRefs(max, skip)) {
      if (!p.send) continue; const src = await getRef(p.r.id); if (!src) continue;
      out.push(src); const n = start + out.length - 1, it = p.o === 'space' ? null : p.o;
      if (it) { if (!map.has(it.id)) map.set(it.id, []); map.get(it.id).push({ n, kind: p.r.kind }); }
      const who = !it ? 'the whole space' : `${A.itemLabel(it)} "${it.name}"${it.type === 'person' ? ` (the ${sexEN(it)} ${it.h}cm tall)` : ` (${A.TYPES[it.type] || it.type}, ${it.w}x${it.d}x${it.h}cm)`}`;
      lines.push(`Reference image #${n} → ${who}: match its ${REF_EN[p.r.kind] || 'look'}${p.r.note ? ' (' + p.r.note + ')' : ''}${it && it.type === 'person' && ['face', 'look', 'hair'].includes(p.r.kind) ? ' — same person, same face and hairstyle' : ''}.`);
    }
    return { imgs: out, map, text: lines.length ? `\nATTACHED REFERENCE IMAGES (from #${start}): ${lines.join(' ')} Apply each reference ONLY to its object and only for the named aspect; keep positions, sizes, poses and camera from image #1.` : '' };
  }
  return { render, openPhoto, openRender, openSettings, openGallery, autoGallery, saveFirebase, copyRules, onLogin, modelFor, openFace, openLink, copyCfgFile, analyzeRefs, collectRenderRefs };
}
