// AI 공급자·모델·호출 (브라우저에서 직접 호출)
export const PROVIDERS = {
  gemini: {
    name: 'Google Gemini', key: 'geminiApiKey', hint: 'AIza… 또는 AQ.… (여러 개면 줄바꿈)',
    text: [['gemini-flash-latest', 'Gemini Flash (최신 자동·추천)'], ['gemini-pro-latest', 'Gemini Pro (최신 자동)'], ['gemini-flash-lite-latest', 'Gemini Flash Lite (최신·저렴)'], ['gemini-3.8-flash', 'Gemini 3.8 Flash (빠름·추천)'], ['gemini-4-argon', 'Gemini 4 Argon'], ['gemini-3.6-flash', 'Gemini 3.6 Flash'], ['gemini-3.1-pro-preview', 'Gemini 3.1 Pro (미리보기)'], ['gemini-3-flash-preview', 'Gemini 3 Flash (미리보기)'], ['gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite (저렴)'], ['gemini-2.5-pro', 'Gemini 2.5 Pro'], ['gemini-2.5-flash', 'Gemini 2.5 Flash'], ['gemini-flash-latest', 'Gemini Flash (최신 별칭)']],
    image: [['gemini-3-pro-image', 'Nano Banana Pro (Gemini 3 Pro Image) · 최고 품질'], ['gemini-nano-banana-2.1', 'Nano Banana 2.1'], ['gemini-3.1-flash-image', 'Nano Banana 2 (3.1 Flash Image)'], ['gemini-3.1-flash-lite-image', 'Nano Banana 2 Lite (저렴)'], ['gemini-2.5-flash-image', 'Nano Banana (2.5 Flash Image)']],
  },
  openai: {
    name: 'OpenAI', key: 'openaiApiKey', hint: 'sk-…',
    text: [['gpt-5.6', 'GPT-5.6'], ['gpt-5.5', 'GPT-5.5'], ['gpt-5.4', 'GPT-5.4'], ['gpt-5.4-mini', 'GPT-5.4 mini (빠름)'], ['gpt-5.6-luna', 'GPT-5.6 Luna'], ['gpt-5-mini', 'GPT-5 mini'], ['gpt-4.1', 'GPT-4.1'], ['gpt-4o', 'GPT-4o']],
    image: [['gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst (편집 정밀)'], ['gpt-image-2.5-flare', 'GPT Image 2.5 Flare (빠름)'], ['gpt-image-2', 'GPT Image 2'], ['gpt-image-1.5', 'GPT Image 1.5'], ['gpt-image-1', 'GPT Image 1'], ['gpt-image-1-mini', 'GPT Image 1 mini (저렴)']],
  },
  claude: {
    name: 'Anthropic Claude', key: 'claudeApiKey', hint: 'sk-ant-api…',
    text: [['claude-opus-5-5', 'Claude Opus 5.5'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (추천)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (빠름)'], ['claude-fable-5-1', 'Claude Fable 5.1'], ['claude-sonnet-4-5', 'Claude Sonnet 4.5']],
    image: [],
  },
  groq: {
    name: 'Groq', key: 'groqApiKey', hint: 'gsk_…',
    text: [['meta-llama/llama-4-maverick-17b-128e-instruct', 'Llama 4 Maverick (사진 인식 가능)'], ['meta-llama/llama-4-scout-17b-16e-instruct', 'Llama 4 Scout (사진 인식 가능)'], ['openai/gpt-oss-120b', 'GPT-OSS 120B'], ['llama-3.3-70b-versatile', 'Llama 3.3 70B'], ['moonshotai/kimi-k2-instruct', 'Kimi K2'], ['qwen/qwen3-32b', 'Qwen3 32B']],
    image: [],
  },
};
export const TASKS = [['chat', '대화·명령 (배치 편집)'], ['vision', '사진 인식 (가구·사람·도면)'], ['image', '실사 이미지 생성 (렌더)']];
export const DEFAULT_MODELS = { chat: ['gemini', 'gemini-flash-latest'], vision: ['gemini', 'gemini-flash-latest'], image: ['gemini', 'gemini-3-pro-image'] };

// 붙여넣기 텍스트에서 키 추출 ("geminiApiKey, AIza…" 같은 형식 지원)
export function parseKeys(text) {
  const o = {}, t = String(text || '');
  const pick = (re, k) => { const m = t.match(re); if (m) o[k] = m[0]; };
  const gk = [...t.matchAll(/AIza[0-9A-Za-z_\-]{30,}|AQ\.[0-9A-Za-z_\-]{20,}/g)].map(m => m[0]); if (gk.length) o.geminiApiKey = [...new Set(gk)].join('\n');
  pick(/gsk_[0-9A-Za-z]{20,}/, 'groqApiKey');
  pick(/sk-ant-[0-9A-Za-z_\-]{20,}/, 'claudeApiKey');
  const oa = t.match(/sk-(?!ant-)(proj-)?[0-9A-Za-z_\-]{20,}/); if (oa) o.openaiApiKey = oa[0];
  return o;
}

async function jfetch(url, opt) {
  const r = await fetch(url, opt); const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) { }
  if (!r.ok) { const m = (j && (j.error?.message || j.error?.type || j.message)) || txt.slice(0, 300); const e = new Error(`${r.status} ${m}`); e.status = r.status; if (/safety|moderation|content[_ ]policy|safety_violations|blocked/i.test(m)) e.safety = true; if ([401, 402, 403, 429].includes(r.status) || /credits|quota|billing|RESOURCE_EXHAUSTED|API key not valid|API_KEY_INVALID|PERMISSION_DENIED|insufficient_quota|rate limit/i.test(m)) e.keyIssue = true; throw e; }
  return j;
}
const b64 = d => String(d).split(',')[1];
const mime = d => (String(d).match(/^data:([^;]+);/) || [])[1] || 'image/jpeg';

// 텍스트(+사진) 호출 → 문자열
async function aiText1({ provider, model, key, system, prompt, images = [], json = false, history = [] }) {
  if (!key) throw new Error(`${PROVIDERS[provider]?.name || provider} API 키가 없습니다. ‘AI 설정’에서 입력하세요.`);
  if (provider === 'gemini') {
    const contents = [...history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })), { role: 'user', parts: [...images.map(d => ({ inline_data: { mime_type: mime(d), data: b64(d) } })), { text: prompt }] }];
    const j = await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents, systemInstruction: system ? { parts: [{ text: system }] } : undefined, generationConfig: { temperature: 0.4, ...(json ? { responseMimeType: 'application/json' } : {}) } }) });
    const parts = j.candidates?.[0]?.content?.parts || []; const out = parts.map(p => p.text || '').join('');
    if (!out) throw new Error('응답이 비어 있습니다' + (j.candidates?.[0]?.finishReason ? ` (${j.candidates[0].finishReason})` : ''));
    return out;
  }
  if (provider === 'claude') {
    const msgs = [...history.map(h => ({ role: h.role, content: h.text })), { role: 'user', content: [...images.map(d => ({ type: 'image', source: { type: 'base64', media_type: mime(d), data: b64(d) } })), { type: 'text', text: prompt + (json ? '\n\nJSON 객체 하나만 출력하세요.' : '') }] }];
    const j = await jfetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model, max_tokens: 8192, system, messages: msgs }) });
    return (j.content || []).map(c => c.text || '').join('');
  }
  // openai / groq (OpenAI 호환)
  const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const content = images.length ? [{ type: 'text', text: prompt }, ...images.map(d => ({ type: 'image_url', image_url: { url: d } }))] : prompt;
  const body = { model, messages: [...(system ? [{ role: 'system', content: system }] : []), ...history.map(h => ({ role: h.role, content: h.text })), { role: 'user', content }] };
  if (json) body.response_format = { type: 'json_object' };
  let j;
  try { j = await jfetch(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) }); }
  catch (e) { if (json && /response_format|json/i.test(e.message)) { delete body.response_format; j = await jfetch(base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(body) }); } else throw e; }
  return j.choices?.[0]?.message?.content || '';
}
export function parseJSON(t) {
  if (typeof t !== 'string') return t;
  const s = t.replace(/```json|```/g, '');
  try { return JSON.parse(s); } catch (e) { }
  const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { } }
  throw new Error('AI 응답을 해석하지 못했습니다:\n' + s.slice(0, 300));
}

// 이미지 생성/편집 → dataURL
async function aiImage1({ provider, model, key, prompt, image, refs = [], aspect = '16:9', quality = 'high' }) {
  if (!key) throw new Error(`${PROVIDERS[provider]?.name || provider} API 키가 없습니다.`);
  if (provider === 'gemini') {
    const parts = [...[image, ...refs].filter(Boolean).map(im => ({ inline_data: { mime_type: mime(im), data: b64(im) } })), { text: prompt }];
    const j = await jfetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect } } }) });
    const p = (j.candidates?.[0]?.content?.parts || []).find(x => x.inlineData || x.inline_data);
    if (!p) { const why = (j.candidates?.[0]?.content?.parts || []).map(x => x.text).join(' ').slice(0, 200) || j.candidates?.[0]?.finishReason || j.promptFeedback?.blockReason || ''; const e = new Error('이미지가 생성되지 않았습니다. ' + why); if (/SAFETY|PROHIBITED|BLOCK|IMAGE_SAFETY|policy/i.test(why)) e.safety = true; throw e; }
    const d = p.inlineData || p.inline_data; return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
  }
  if (provider === 'openai') {
    const [aw, ah] = aspect.split(':').map(Number), size = Math.abs(aw / ah - 1) < 0.1 ? '1024x1024' : aw > ah ? '1536x1024' : '1024x1536';
    let j;
    if (image) {
      const fd = new FormData(); fd.append('model', model); fd.append('prompt', prompt); fd.append('size', size); fd.append('quality', quality);
      const all = [image, ...refs].filter(Boolean), key2 = all.length > 1 ? 'image[]' : 'image';
      for (let i = 0; i < all.length; i++) { const blob = await (await fetch(all[i])).blob(); fd.append(key2, new File([blob], i ? `ref${i}.jpg` : 'scene.png', { type: blob.type || 'image/png' })); }
      fd.append('input_fidelity', 'high'); fd.append('moderation', 'low');
      try { j = await jfetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd }); }
      catch (e) { if (!/input_fidelity|moderation|unknown parameter|unrecognized/i.test(e.message)) throw e; fd.delete('input_fidelity'); fd.delete('moderation'); j = await jfetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd }); }
    } else j = await jfetch('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ model, prompt, size, quality }) });
    const d = j.data?.[0]; if (!d) throw new Error('이미지가 생성되지 않았습니다');
    return d.b64_json ? 'data:image/png;base64,' + d.b64_json : d.url;
  }
  throw new Error(`${PROVIDERS[provider]?.name} 는 이미지 생성을 지원하지 않습니다. Gemini 또는 OpenAI 이미지 모델을 선택하세요.`);
}

// API에서 사용 가능한 모델 목록 불러오기
async function listModels1(provider, key) {
  if (!key) throw new Error('API 키가 없습니다');
  if (provider === 'gemini') {
    const j = await jfetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    const ms = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace('models/', ''));
    return { text: ms.filter(m => !/image|tts|embedding|audio|live|robotics|veo|lyria/.test(m)), image: ms.filter(m => /image/.test(m)) };
  }
  if (provider === 'claude') { const j = await jfetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }); return { text: (j.data || []).map(m => m.id), image: [] }; }
  const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const j = await jfetch(base + '/models', { headers: { Authorization: 'Bearer ' + key } });
  const ids = (j.data || []).map(m => m.id).sort();
  if (provider === 'groq') return { text: ids.filter(i => !/whisper|tts|guard|playai/.test(i)), image: [] };
  return { text: ids.filter(i => /^(gpt-|o\d|chatgpt)/.test(i) && !/image|audio|realtime|tts|transcribe|search|embedding/.test(i)), image: ids.filter(i => /image|dall-e/.test(i)) };
}

// 이미지 리사이즈 → JPEG dataURL
export function fileToDataURL(file, max = 1600, q = 0.88) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('이미지를 읽지 못했습니다')); }; img.src = url;
  });
}
// dataURL 이미지를 목표 해상도로 꽉 채워 자르기
export function coverResize(src, W, H, type = 'image/png', q = 0.92) {
  return new Promise((res, rej) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), s = Math.max(W / img.width, H / img.height), w = img.width * s, h = img.height * s; g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h); res(c.toDataURL(type, q)); };
    img.onerror = () => rej(new Error('이미지 처리 실패')); img.src = src;
  });
}

// ---------- 여러 키 자동 전환 ----------
// 한 공급자에 키를 여러 개(줄바꿈·쉼표) 넣으면 크레딧 소진(402)·한도 초과(429)·잘못된 키(401/403)일 때 다음 키로 자동 전환
export const splitKeys = k => String(k || '').split(/[\s,;]+/).map(x => x.trim()).filter(x => x.length > 8);
const GOOD = {};
export function friendlyError(e, provider) {
  const m = String(e && e.message || e), st = e && e.status;
  if (st === 402 || /prepayment credits|credits are depleted/i.test(m)) return `${PROVIDERS[provider]?.name || ''}: 선불 크레딧이 모두 소진되었습니다. Google AI Studio(ai.studio/projects)에서 결제·충전하거나, 크레딧(또는 무료 등급)이 남은 다른 프로젝트의 키를 ⚙ AI 설정에 한 줄 더 추가하세요 — 앞 키가 실패하면 자동으로 다음 키를 씁니다.`;
  if (st === 429 || /quota|RESOURCE_EXHAUSTED|rate limit|insufficient_quota/i.test(m)) return `${PROVIDERS[provider]?.name || ''}: 사용 한도를 넘었습니다(429). 잠시 후 다시 시도하거나 다른 키·모델(예: Flash Lite)을 쓰세요.`;
  if (st === 401 || st === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED|invalid_api_key/i.test(m)) return `${PROVIDERS[provider]?.name || ''}: 키가 올바르지 않거나 이 API 사용 권한이 없습니다. ⚙ AI 설정에서 키를 확인하세요.`;
  if (st === 404 || /not found|is not supported/i.test(m)) return `모델을 찾을 수 없습니다(${m.slice(0, 120)}). ⚙ AI 설정에서 「연결 테스트 · 모델 목록 불러오기」 후 목록의 모델을 고르세요.`;
  return m;
}
async function withKeys(o, fn) {
  const keys = splitKeys(o.key); if (keys.length <= 1) { try { return await fn({ ...o, key: keys[0] || o.key }); } catch (e) { if (!e.safety) { const f = friendlyError(e, o.provider); if (f !== e.message) { const e2 = new Error(f); Object.assign(e2, { status: e.status, keyIssue: e.keyIssue, safety: e.safety, raw: e.message }); throw e2; } } throw e; } }
  const start = Math.max(0, keys.indexOf(GOOD[o.provider])), order = [...keys.slice(start), ...keys.slice(0, start)]; let last = null;
  for (const k of order) {
    try { const r = await fn({ ...o, key: k }); GOOD[o.provider] = k; return r; }
    catch (e) { last = e; if (!e.keyIssue) throw e; console.warn('key failed, trying next', e.status); }
  }
  const e2 = new Error(friendlyError(last, o.provider) + ` (키 ${keys.length}개 모두 실패)`); Object.assign(e2, { status: last.status, keyIssue: true, raw: last.message }); throw e2;
}
export const aiText = o => withKeys(o, aiText1);
export const aiImage = o => withKeys(o, aiImage1);
export const listModels = (provider, key) => withKeys({ provider, key }, x => listModels1(x.provider, x.key));
export async function testKeys(provider, key) { const out = []; for (const k of splitKeys(key)) { try { const r = await listModels1(provider, k); out.push({ k, ok: true, n: (r.text || []).length + (r.image || []).length, r }); } catch (e) { out.push({ k, ok: false, msg: friendlyError(e, provider) }); } } return out; }
