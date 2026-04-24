/**
 * テイクバック再生 v2 - 認証（スタッフ選択）
 * Old Gucci Light Theme
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
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#F8F5EE;padding:20px;">
      <div style="text-align:center;margin-bottom:40px;">
        <div style="width:72px;height:72px;background:#1C2541;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:0 4px 16px rgba(28,37,65,0.2);">
          <span style="color:#C5A258;font-size:18px;font-weight:bold;letter-spacing:1px;">再生</span>
        </div>
        <h1 style="color:#1C2541;font-size:22px;margin-bottom:4px;">テイクバック再生</h1>
        <p style="color:#5a6272;font-size:13px;">スタッフを選択してください</p>
      </div>
      <div id="staffGrid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:320px;width:100%;"></div>
    </div>
  `;

  const grid = container.querySelector('#staffGrid');
  for (const staff of loginStaff) {
    const btn = document.createElement('button');
    btn.style.cssText = 'background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:16px 8px;text-align:center;color:#1C2541;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(28,37,65,0.08);';
    btn.innerHTML = `
      <div style="font-size:28px;margin-bottom:4px;">${staff.avatar}</div>
      <div style="font-size:14px;font-weight:bold;">${escapeHtml(staff.name)}</div>
      <div style="font-size:10px;color:#5a6272;">${staff.role === 'admin' ? '管理者' : '作業員'}</div>
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
