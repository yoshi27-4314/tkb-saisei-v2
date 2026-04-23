/**
 * テイクバック再生 v2 - 認証（スタッフ選択）
 */
import { CONFIG } from './config.js';
import { escapeHtml } from './ui.js';

const STORAGE_KEY = 'tkbs_current_staff';
let currentStaff = null;

export function getCurrentStaff() {
  if (currentStaff) return currentStaff;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { currentStaff = JSON.parse(saved); return currentStaff; } catch {}
  }
  return null;
}

export function setCurrentStaff(staff) {
  currentStaff = staff;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
}

export function logout() {
  currentStaff = null;
  localStorage.removeItem(STORAGE_KEY);
}

export function isAdmin() {
  return getCurrentStaff()?.role === 'admin';
}

export function isWorker() {
  const s = getCurrentStaff();
  return s?.role === 'admin' || s?.role === 'worker';
}

export function getStaffById(id) {
  return CONFIG.STAFF.find(s => s.id === id) || null;
}

export function getLoginableStaff() {
  return CONFIG.STAFF.filter(s => s.canLogin);
}

export function getAllStaff() {
  return CONFIG.STAFF;
}

// ログイン画面を表示
export function showLoginScreen(container, onLogin) {
  const loginStaff = getLoginableStaff();

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;padding:20px;">
      <div style="text-align:center;margin-bottom:40px;">
        <div style="width:72px;height:72px;background:linear-gradient(135deg,#e67e22,#f39c12);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 4px 16px rgba(230,126,34,0.3);">
          <span style="color:#fff;font-size:22px;font-weight:bold;">再生</span>
        </div>
        <h1 style="color:#fff;font-size:22px;margin-bottom:4px;">テイクバック再生</h1>
        <p style="color:#8892a4;font-size:13px;">スタッフを選択してください</p>
      </div>
      <div id="staffGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:320px;width:100%;"></div>
    </div>
  `;

  const grid = container.querySelector('#staffGrid');
  for (const staff of loginStaff) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:#16213e;border:1px solid #2a3a5c;border-radius:12px;padding:16px 8px;text-align:center;color:#fff;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    btn.innerHTML = `
      <div style="font-size:28px;margin-bottom:4px;">${staff.avatar}</div>
      <div style="font-size:14px;font-weight:bold;">${escapeHtml(staff.name)}</div>
      <div style="font-size:10px;color:#8892a4;">${staff.role === 'admin' ? '管理者' : '作業員'}</div>
    `;
    btn.addEventListener('click', () => {
      setCurrentStaff(staff);
      onLogin(staff);
    });
    btn.addEventListener('touchstart', () => { btn.style.transform = 'scale(0.95)'; });
    btn.addEventListener('touchend', () => { btn.style.transform = ''; });
    grid.appendChild(btn);
  }
}
