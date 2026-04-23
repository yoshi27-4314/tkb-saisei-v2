/**
 * テイクバック再生 v2 - 共通UIコンポーネント
 */

// --- HTMLエスケープ ---
export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- トースト通知 ---
let toastTimeout = null;
export function showToast(message, duration = 3000) {
  let toast = document.getElementById('tkbsToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tkbsToast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#16213e;color:#fff;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;max-width:90%;text-align:center;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.3);border:1px solid #2a3a5c;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

// --- ローディング ---
export function showLoading(container, text = '読み込み中...') {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#8892a4;">
      <div style="width:32px;height:32px;border:3px solid #2a3a5c;border-top-color:#e67e22;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <p style="margin-top:12px;font-size:13px;">${text}</p>
    </div>
  `;
}

// --- 確認ダイアログ ---
export function showConfirm(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:#16213e;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4);border:1px solid #2a3a5c;">
      <p style="color:#e0e0e0;font-size:15px;margin-bottom:20px;line-height:1.5;">${message}</p>
      <div style="display:flex;gap:12px;">
        <button id="confirmCancel" style="flex:1;padding:12px;border-radius:8px;background:#2a3a5c;color:#8892a4;border:none;font-size:14px;cursor:pointer;">キャンセル</button>
        <button id="confirmOk" style="flex:1;padding:12px;border-radius:8px;background:#e67e22;color:#fff;border:none;font-size:14px;font-weight:bold;cursor:pointer;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#confirmOk').addEventListener('click', () => { overlay.remove(); onConfirm?.(); });
  overlay.querySelector('#confirmCancel').addEventListener('click', () => { overlay.remove(); onCancel?.(); });
}

// --- モーダル ---
export function showModal(title, bodyHtml, buttons = []) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#16213e;border-radius:16px 16px 0 0;padding:20px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 -4px 32px rgba(0,0,0,0.4);border:1px solid #2a3a5c;border-bottom:none;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:700;color:#fff;">${title}</div>
        <button class="modal-close" style="background:none;border:none;color:#8892a4;font-size:20px;cursor:pointer;padding:4px;">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${buttons.length > 0 ? `
        <div style="display:flex;gap:8px;margin-top:16px;">
          ${buttons.map(b => `<button class="modal-btn" data-action="${b.action}" style="flex:1;padding:12px;border-radius:8px;background:${b.color || '#e67e22'};color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">${b.label}</button>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}

// --- ステータスバッジ ---
export function statusBadge(status) {
  const colors = {
    '案件受取': '#3498db',
    '作業計画': '#9b59b6',
    '見積提出': '#f39c12',
    '受注確定': '#27ae60',
    '現場作業中': '#e67e22',
    '完了報告済': '#2ecc71',
    '請求・精算': '#1abc9c',
    '保留': '#7f8c8d',
    '追加作業発生': '#e74c3c',
    'キャンセル': '#95a5a6',
  };
  const color = colors[status] || '#8892a4';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;background:${color}22;color:${color};border:1px solid ${color}40;">${status}</span>`;
}

// --- 日付フォーマット ---
export function formatDate(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateFull(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`;
}

export function formatTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- 金額フォーマット ---
export function formatPrice(num) {
  if (num == null || isNaN(num)) return '--';
  return '\u00A5' + Number(num).toLocaleString();
}

// --- 空状態表示 ---
export function emptyState(icon, message) {
  return `
    <div style="text-align:center;padding:60px 20px;color:#8892a4;">
      <div style="font-size:48px;margin-bottom:12px;">${icon}</div>
      <p style="font-size:14px;">${message}</p>
    </div>
  `;
}

// --- 時間差分 ---
export function formatDuration(minutes) {
  if (!minutes || minutes < 1) return '0分';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
