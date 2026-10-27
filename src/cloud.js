// Firebase 클라우드 저장 (Authentication + Cloud Firestore 'room-maker' 데이터베이스)
// 구조: users/{uid}/projects/{id} · users/{uid}/meta/settings · users/{uid}/meta/aikeys · users/{uid}/gallery/{id}
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';

import FILE_CFG from './firebase.config.js';

const env = import.meta.env || {};
const F = FILE_CFG || {};
export const DEFAULT_CFG = {
  apiKey: env.VITE_FIREBASE_API_KEY || F.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || F.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || F.projectId || 'gen-lang-client-0312895786',
  appId: env.VITE_FIREBASE_APP_ID || F.appId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || F.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || F.messagingSenderId || '',
  databaseId: env.VITE_FIREBASE_DATABASE_ID || F.databaseId || 'room-maker',
};
// 앱에 내장된 설정이 있는지 (있으면 어느 기기에서든 바로 로그인 가능)
export const BUILTIN = !!(DEFAULT_CFG.apiKey && DEFAULT_CFG.appId);
const K = 'room3d.v2.firebase';
export function loadCfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { } const m = { ...DEFAULT_CFG }; Object.keys(c).forEach(k => { if (c[k]) m[k] = c[k]; }); if (!m.authDomain && m.projectId) m.authDomain = m.projectId + '.firebaseapp.com'; return m; }
// ── 다른 기기 연결 링크: https://…/#fb=<base64url(JSON)> ──
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const PUB = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'databaseId'];
export function cfgLink(c) { const o = {}; PUB.forEach(k => { if (c[k]) o[k] = c[k]; }); return location.origin + location.pathname + '#fb=' + b64e(JSON.stringify(o)); }
export function takeCfgFromURL() {
  const m = /[#&]fb=([A-Za-z0-9_-]+)/.exec(location.hash); if (!m) return false;
  try { const o = JSON.parse(b64d(m[1])); if (!o.apiKey || !o.appId) return false; const c = {}; PUB.forEach(k => { if (o[k]) c[k] = String(o[k]); }); saveCfg(c); return true; }
  catch (e) { return false; }
  finally { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
}
export function cfgFileCode(c) {
  const q = v => JSON.stringify(v || '').replace(/^"|"$/g, "'");
  return `// Firebase 웹 앱 설정 (공개용 값 · AI 키는 넣지 마세요)\nexport default {\n${PUB.map(k => `  ${k}: ${q(c[k])},`).join('\n')}\n};\n`;
}
export function saveCfg(c) { try { localStorage.setItem(K, JSON.stringify(c)); } catch (e) { } }
// Firebase 콘솔의 "const firebaseConfig = {...}" 코드나 JSON을 그대로 붙여 넣어도 읽어 들임
export function parseCfg(text) {
  const o = {};
  ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId', 'databaseId'].forEach(k => { const m = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`).exec(text); if (m) o[k] = m[1]; });
  return o;
}

let app = null, auth = null, db = null, user = null, ready = false;
const listeners = new Set();
export const Cloud = {
  get user() { return user; }, get ready() { return ready; }, get enabled() { return !!db; },
  cfg: loadCfg(), error: '',
  init() {
    this.cfg = loadCfg();
    if (globalThis.__CLOUD_MOCK) { const M = globalThis.__CLOUD_MOCK; Object.assign(this, M.methods); db = {}; user = M.user; ready = true; setTimeout(emit, 50); return true; } // 자동 테스트 전용
    if (!this.cfg.apiKey || !this.cfg.appId) { this.error = 'Firebase 웹 앱 설정(apiKey, appId)이 없습니다'; ready = true; emit(); return false; }
    try {
      const { databaseId, ...c } = this.cfg;
      app = getApps()[0] || initializeApp(c);
      auth = getAuth(app); db = getFirestore(app, databaseId || '(default)');
      getRedirectResult(auth).catch(e => { this.error = msg(e); emit(); });
      onAuthStateChanged(auth, u => { user = u; ready = true; emit(); });
      this.error = ''; return true;
    } catch (e) { this.error = msg(e); ready = true; emit(); return false; }
  },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async loginGoogle() {
    const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, p); }
    catch (e) { if (/popup-blocked|popup-closed-by-browser|operation-not-supported/.test(e.code || '')) return signInWithRedirect(auth, p); throw new Error(msg(e)); }
  },
  async loginEmail(email, pw, create) { try { if (create) await createUserWithEmailAndPassword(auth, email, pw); else await signInWithEmailAndPassword(auth, email, pw); } catch (e) { throw new Error(msg(e)); } },
  async resetPw(email) { await sendPasswordResetEmail(auth, email); },
  async logout() { await signOut(auth); },
  // 프로젝트
  async listProjects() { const s = await getDocs(collection(db, 'users', user.uid, 'projects')); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
  async saveProject(name, state, t, dev) { await setDoc(doc(db, 'users', user.uid, 'projects', pid(name)), { name, t: t || Date.now(), dev: dev || '', data: JSON.stringify(state) }); },
  async getProject(name) { const d = await getDoc(doc(db, 'users', user.uid, 'projects', pid(name))); return d.exists() ? d.data() : null; },
  // 다른 기기에서 저장하면 실시간으로 알려 줌
  watchMeta(k, cb) { return onSnapshot(doc(db, 'users', user.uid, 'meta', k), d => cb(d.exists() ? d.data() : null), e => console.warn('watchMeta', e)); },
  watchProjects(cb) { return onSnapshot(collection(db, 'users', user.uid, 'projects'), snap => cb(snap.docChanges().map(c => ({ type: c.type, ...c.doc.data() }))), e => console.warn('watch', e)); },
  async deleteProject(name) { await deleteDoc(doc(db, 'users', user.uid, 'projects', pid(name))); },
  // 설정 / AI 키
  async getMeta(k) { const s = await getDoc(doc(db, 'users', user.uid, 'meta', k)); return s.exists() ? s.data() : null; },
  async setMeta(k, v) { await setDoc(doc(db, 'users', user.uid, 'meta', k), { ...v, t: Date.now() }); },
  async delMeta(k) { await deleteDoc(doc(db, 'users', user.uid, 'meta', k)); },
  // 갤러리 (AI 렌더 이미지, 문서당 1MB 제한 → JPEG 압축)
  // 참고 사진 (문서당 1MB 제한 → 900px JPEG)
  async setRef(id, img) { await setDoc(doc(db, 'users', user.uid, 'refs', id), { img, t: Date.now() }); },
  async getRef(id) { const d = await getDoc(doc(db, 'users', user.uid, 'refs', id)); return d.exists() ? d.data().img : null; },
  async delRef(id) { await deleteDoc(doc(db, 'users', user.uid, 'refs', id)); },
  async listGallery() { const s = await getDocs(collection(db, 'users', user.uid, 'gallery')); return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.t - a.t); },
  async saveGallery(id, v) { await setDoc(doc(db, 'users', user.uid, 'gallery', id), v); },
  async delGallery(id) { await deleteDoc(doc(db, 'users', user.uid, 'gallery', id)); },
};
const pid = name => encodeURIComponent(name).replace(/\./g, '%2E').slice(0, 700) || 'untitled';
function emit() { listeners.forEach(f => { try { f(user); } catch (e) { console.error(e); } }); }
function msg(e) {
  const c = (e && e.code) || '';
  const M = {
    'auth/unauthorized-domain': '이 주소(도메인)가 Firebase 인증 허용 도메인에 없습니다. Authentication → 설정 → 승인된 도메인에 추가하세요.',
    'auth/operation-not-allowed': '로그인 방식이 꺼져 있습니다. Authentication → 로그인 방법에서 Google / 이메일을 사용 설정하세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.', 'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하세요.', 'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/invalid-api-key': 'Firebase apiKey 가 올바르지 않습니다.', 'permission-denied': 'Firestore 보안 규칙이 접근을 막고 있습니다. 안내된 규칙을 게시하세요.',
  };
  return M[c] || (e && e.message) || String(e);
}
export const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}`;
