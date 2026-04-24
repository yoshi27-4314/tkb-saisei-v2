/**
 * テイクバック再生 v2 - 共通UIコンポーネント
 * Old Gucci Light Theme - 流通v2と統一
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
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#ffffff;color:#1C2541;padding:10px 20px;border-radius:8px;font-size:14px;z-index:9999;opacity:0;transition:opacity 0.3s;max-width:90%;text-align:center;pointer-events:none;box-shadow:0 4px 16px rgba(28,37,65,0.15);border:1px solid #dde0e6;';
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
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;color:#5a6272;">
      <div class="spinner"></div>
      <p style="margin-top:12px;font-size:13px;">${text}</p>
    </div>
  `;
}

// --- 確認ダイアログ ---
export function showConfirm(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(28,37,65,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:#ffffff;border-radius:16px;padding:24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(28,37,65,0.2);">
      <p style="color:#1C2541;font-size:15px;margin-bottom:20px;line-height:1.5;">${message}</p>
      <div style="display:flex;gap:12px;">
        <button id="confirmCancel" style="flex:1;padding:12px;border-radius:8px;background:#f0ede5;color:#5a6272;border:none;font-size:14px;cursor:pointer;">キャンセル</button>
        <button id="confirmOk" style="flex:1;padding:12px;border-radius:8px;background:#006B3F;color:#fff;border:none;font-size:14px;font-weight:bold;cursor:pointer;">OK</button>
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(28,37,65,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div class="slide-up" style="background:#ffffff;border-radius:16px 16px 0 0;padding:20px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 -4px 32px rgba(28,37,65,0.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-size:16px;font-weight:700;color:#1C2541;">${title}</div>
        <button class="modal-close" style="background:none;border:none;color:#8a8a8a;font-size:20px;cursor:pointer;padding:4px;">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${buttons.length > 0 ? `
        <div style="display:flex;gap:8px;margin-top:16px;">
          ${buttons.map(b => `<button class="modal-btn" data-action="${b.action}" style="flex:1;padding:12px;border-radius:8px;background:${b.color || '#006B3F'};color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">${b.label}</button>`).join('')}
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
    '案件受取': '#1C2541',
    '作業計画': '#7B2D8E',
    '見積提出': '#C5A258',
    '受注確定': '#006B3F',
    '現場作業中': '#C5A258',
    '完了報告済': '#006B3F',
    '請求・精算': '#006B3F',
    '保留': '#8a8a8a',
    '追加作業発生': '#CE2029',
    'キャンセル': '#8a8a8a',
  };
  const color = colors[status] || '#5a6272';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;background:${color}18;color:${color};">${status}</span>`;
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
    <div style="text-align:center;padding:60px 20px;color:#8a8a8a;">
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

// --- カメラ撮影 ---
export function capturePhoto() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.addEventListener('change', () => {
      if (input.files[0]) {
        resolve(input.files[0]);
      } else {
        resolve(null);
      }
    });
    input.click();
  });
}

// --- ファイルをBase64に変換 ---
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- 画像リサイズ ---
export function resizeImage(base64, maxWidth = 1200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) { resolve(base64); return; }
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = base64;
  });
}

// --- スワイプで戻るジェスチャー ---
export function enableSwipeBack(element, onSwipeRight) {
  let startX = 0;
  let startY = 0;
  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });
  element.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = Math.abs(e.changedTouches[0].clientY - startY);
    if (dx > 80 && dy < 50 && startX < 30) {
      onSwipeRight();
    }
  }, { passive: true });
}
