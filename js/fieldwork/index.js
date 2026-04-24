/**
 * テイクバック再生 v2 - 現場作業（Fieldwork）モジュール
 * 9つの現場作業機能を提供するコアモジュール
 */
import { CONFIG } from '../core/config.js';
import { getWorkOrder, updateWorkOrder, getWorkPhotos, createWorkPhoto, uploadPhoto, getChecklist, upsertChecklist, getWorkLogs, createWorkLog, updateWorkLog, getFoundItems, createFoundItem, getMemos, createMemo, getCompletionReport, createCompletionReport, getAskCase, getTodayWorkOrders } from '../core/db.js';
import { showToast, showLoading, showConfirm, showModal, statusBadge, emptyState, escapeHtml, formatDate, formatTime, formatDuration, formatDateFull } from '../core/ui.js';
import { getCurrentStaff, isAdmin, isWorker, getAllStaff, getStaffById } from '../core/auth.js';
import { navigate } from '../core/router.js';

// =============================================
// タイマー状態管理 (localStorage永続化)
// =============================================
const TIMER_STORAGE_KEY = 'tkbs_timer_state';
let timerInterval = null;

function getTimerState(workOrderId) {
  try {
    const all = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || '{}');
    return all[workOrderId] || null;
  } catch { return null; }
}

function setTimerState(workOrderId, state) {
  try {
    const all = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || '{}');
    if (state) {
      all[workOrderId] = state;
    } else {
      delete all[workOrderId];
    }
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

// =============================================
// 道具チェック状態管理 (localStorage)
// =============================================
function getToolChecks(workOrderId) {
  try {
    const all = JSON.parse(localStorage.getItem('tkbs_tool_checks') || '{}');
    return all[workOrderId] || {};
  } catch { return {}; }
}

function setToolChecks(workOrderId, checks) {
  try {
    const all = JSON.parse(localStorage.getItem('tkbs_tool_checks') || '{}');
    all[workOrderId] = checks;
    localStorage.setItem('tkbs_tool_checks', JSON.stringify(all));
  } catch {}
}

// =============================================
// 共通スタイル
// =============================================
const STYLES = {
  card: 'background:#ffffff;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #dde0e6;',
  btn: 'padding:14px 20px;border-radius:10px;border:none;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;',
  btnPrimary: 'background:#C5A258;color:#fff;',
  btnSecondary: 'background:#dde0e6;color:#5a6272;',
  btnDanger: 'background:#CE2029;color:#fff;',
  btnSuccess: 'background:#006B3F;color:#fff;',
  input: 'width:100%;padding:12px 14px;border-radius:10px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:15px;box-sizing:border-box;outline:none;',
  textarea: 'width:100%;padding:12px 14px;border-radius:10px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:15px;box-sizing:border-box;outline:none;resize:vertical;min-height:80px;',
  label: 'display:block;color:#5a6272;font-size:13px;margin-bottom:4px;',
  sectionTitle: 'color:#1C2541;font-size:17px;font-weight:700;margin-bottom:12px;',
};

// =============================================
// タブ定義
// =============================================
const TABS = [
  { key: 'photos', icon: '📷', label: '写真撮影' },
  { key: 'checklist', icon: '✅', label: 'チェックリスト' },
  { key: 'timer', icon: '⏱️', label: 'タイマー' },
  { key: 'found_items', icon: '📦', label: '動産記録' },
  { key: 'memos', icon: '📝', label: 'メモ' },
  { key: 'tools', icon: '🔧', label: '道具リスト' },
  { key: 'roles', icon: '👥', label: '役割分担' },
  { key: 'map', icon: '🗺️', label: 'マップ' },
  { key: 'completion', icon: '📋', label: '完了報告' },
];

// =============================================
// メインエントリ
// =============================================
export function renderFieldwork(container, params = {}) {
  if (params.action === 'work' && params.id) {
    renderFieldworkDashboard(container, params.id, params.tab || 'photos');
  } else {
    renderTodayField(container);
  }
}

// =============================================
// 今日の現場一覧
// =============================================
async function renderTodayField(container) {
  showLoading(container, '今日の現場を読み込み中...');

  const staff = getCurrentStaff();
  const staffId = isAdmin() ? null : staff?.id;
  const orders = await getTodayWorkOrders(staffId);

  // 各作業指示に紐づくask_caseの情報を取得
  const caseMap = {};
  for (const order of orders) {
    if (order.case_id && !caseMap[order.case_id]) {
      caseMap[order.case_id] = await getAskCase(order.case_id);
    }
  }

  const today = new Date();
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日（${dayNames[today.getDay()]}）`;

  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <div style="margin-bottom:20px;">
        <h2 style="color:#1C2541;font-size:22px;font-weight:700;margin:0 0 4px;">今日の現場</h2>
        <p style="color:#5a6272;font-size:13px;margin:0;">${dateStr}</p>
      </div>
      <div id="todayOrdersList"></div>
    </div>
  `;

  const listEl = container.querySelector('#todayOrdersList');

  if (orders.length === 0) {
    listEl.innerHTML = emptyState('🏗️', '今日の現場予定はありません');
    return;
  }

  listEl.innerHTML = orders.map(order => {
    const askCase = caseMap[order.case_id];
    const title = askCase?.title || order.title || '案件名なし';
    const address = askCase?.site_address || order.site_address || '';
    const staffNames = (order.staff_ids || []).map(id => {
      const s = getStaffById(id);
      return s ? s.name : id;
    }).join('、');
    const timeStr = order.start_time ? order.start_time.slice(0, 5) : '';
    const isActive = order.status === '現場作業中';

    return `
      <div style="${STYLES.card}" data-order-id="${order.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="flex:1;min-width:0;">
            <div style="color:#1C2541;font-size:15px;font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</div>
            ${address ? `<div style="color:#5a6272;font-size:12px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${escapeHtml(address)}</div>` : ''}
            ${timeStr ? `<div style="color:#5a6272;font-size:12px;">🕐 ${timeStr}〜</div>` : ''}
          </div>
          <div style="margin-left:8px;flex-shrink:0;">
            ${statusBadge(order.status)}
          </div>
        </div>
        ${staffNames ? `<div style="color:#5a6272;font-size:12px;margin-bottom:12px;">👷 ${escapeHtml(staffNames)}</div>` : ''}
        <div style="display:flex;gap:8px;">
          ${address ? `<button class="nav-btn" data-address="${escapeHtml(address)}" style="${STYLES.btn}${STYLES.btnSecondary}flex:1;">🗺️ ナビ</button>` : ''}
          <button class="start-work-btn" data-order-id="${order.id}" style="${STYLES.btn}${isActive ? STYLES.btnSuccess : STYLES.btnPrimary}flex:1;">
            ${isActive ? '🏗️ 作業を続ける' : '▶️ 作業開始'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  // ナビボタン
  listEl.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const address = btn.dataset.address;
      if (address) {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
      }
    });
  });

  // 作業開始ボタン
  listEl.querySelectorAll('.start-work-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const orderId = btn.dataset.orderId;
      const order = orders.find(o => o.id === orderId);

      if (order && order.status !== '現場作業中') {
        btn.disabled = true;
        btn.textContent = '開始中...';
        await updateWorkOrder(orderId, { status: '現場作業中' });
        showToast('作業を開始しました');
      }

      navigate('fieldwork', { action: 'work', id: orderId });
    });
  });
}

// =============================================
// 現場作業ダッシュボード
// =============================================
async function renderFieldworkDashboard(container, workOrderId, activeTab = 'photos') {
  showLoading(container, '作業情報を読み込み中...');

  const workOrder = await getWorkOrder(workOrderId);
  if (!workOrder) {
    container.innerHTML = emptyState('❌', '作業指示が見つかりません');
    return;
  }

  let askCase = null;
  if (workOrder.case_id) {
    askCase = await getAskCase(workOrder.case_id);
  }

  const title = askCase?.title || workOrder.title || '案件名なし';

  container.innerHTML = `
    <div style="padding:0 0 100px;">
      <!-- ヘッダー -->
      <div style="padding:12px 16px;background:#ffffff;border-bottom:1px solid #dde0e6;">
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="fwBackBtn" style="background:none;border:none;color:#C5A258;font-size:24px;cursor:pointer;padding:12px;min-width:48px;min-height:48px;">←</button>
          <div style="flex:1;min-width:0;">
            <div style="color:#1C2541;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(title)}</div>
            <div style="color:#5a6272;font-size:11px;">${statusBadge(workOrder.status)}</div>
          </div>
        </div>
      </div>

      <!-- タブバー -->
      <div id="fwTabBar" style="display:flex;overflow-x:auto;background:#F8F5EE;border-bottom:1px solid #dde0e6;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
        ${TABS.map(tab => `
          <button class="fw-tab" data-tab="${tab.key}" style="flex-shrink:0;padding:10px 14px;background:none;border:none;border-bottom:3px solid ${tab.key === activeTab ? '#C5A258' : 'transparent'};color:${tab.key === activeTab ? '#C5A258' : '#5a6272'};font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all 0.2s;min-width:68px;padding:12px 14px;">
            <span style="font-size:22px;">${tab.icon}</span>
            <span>${tab.label}</span>
          </button>
        `).join('')}
      </div>

      <!-- タブコンテンツ -->
      <div id="fwContent" style="padding:16px;"></div>
    </div>
  `;

  // スクロールバー非表示CSS
  const tabBar = container.querySelector('#fwTabBar');
  tabBar.style.msOverflowStyle = 'none';

  // 戻るボタン
  container.querySelector('#fwBackBtn').addEventListener('click', () => {
    stopTimerInterval();
    navigate('fieldwork');
  });

  // タブ切り替え
  container.querySelectorAll('.fw-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      // アクティブ表示切り替え
      container.querySelectorAll('.fw-tab').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.style.borderBottomColor = isActive ? '#C5A258' : 'transparent';
        b.style.color = isActive ? '#C5A258' : '#5a6272';
      });
      // コンテンツ描画
      renderTabContent(container.querySelector('#fwContent'), tab, workOrder, askCase);
    });
  });

  // 初期タブ描画
  renderTabContent(container.querySelector('#fwContent'), activeTab, workOrder, askCase);

  // アクティブタブにスクロール
  const activeTabBtn = tabBar.querySelector(`[data-tab="${activeTab}"]`);
  if (activeTabBtn) {
    activeTabBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

// =============================================
// タブコンテンツ分岐
// =============================================
function renderTabContent(contentEl, tab, workOrder, askCase) {
  stopTimerInterval();

  switch (tab) {
    case 'photos': renderPhotos(contentEl, workOrder); break;
    case 'checklist': renderChecklist(contentEl, workOrder, askCase); break;
    case 'timer': renderTimer(contentEl, workOrder); break;
    case 'found_items': renderFoundItems(contentEl, workOrder); break;
    case 'memos': renderMemos(contentEl, workOrder); break;
    case 'tools': renderTools(contentEl, workOrder); break;
    case 'roles': renderRoles(contentEl, workOrder); break;
    case 'map': renderMap(contentEl, workOrder, askCase); break;
    case 'completion': renderCompletion(contentEl, workOrder, askCase); break;
    default: contentEl.innerHTML = emptyState('❓', '不明なタブです');
  }
}

// =============================================
// 1. 写真撮影
// =============================================
async function renderPhotos(contentEl, workOrder) {
  const steps = [
    { key: 'before', label: '作業前' },
    { key: 'during', label: '作業中' },
    { key: 'after', label: '作業後' },
  ];
  let activeStep = 'before';

  async function render() {
    const photos = await getWorkPhotos(workOrder.id, activeStep);

    contentEl.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="${STYLES.sectionTitle}">写真撮影</div>
        <!-- ステップタブ -->
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          ${steps.map(s => `
            <button class="photo-step-btn" data-step="${s.key}" style="${STYLES.btn}${s.key === activeStep ? STYLES.btnPrimary : STYLES.btnSecondary}flex:1;font-size:13px;">
              ${s.label}
            </button>
          `).join('')}
        </div>

        <!-- 撮影ボタン -->
        <div style="margin-bottom:16px;">
          <label style="display:flex;align-items:center;justify-content:center;gap:8px;${STYLES.btn}${STYLES.btnPrimary}width:100%;box-sizing:border-box;text-align:center;cursor:pointer;">
            📷 写真を撮影
            <input type="file" accept="image/*" capture="environment" id="photoCameraInput" style="display:none;">
          </label>
        </div>

        <!-- キャプション入力 -->
        <div style="margin-bottom:16px;display:none;" id="photoCaptionArea">
          <input type="text" id="photoCaptionInput" placeholder="キャプション（任意）" style="${STYLES.input}margin-bottom:8px;">
          <div style="display:flex;gap:8px;">
            <button id="photoCancelBtn" style="${STYLES.btn}${STYLES.btnSecondary}flex:1;">キャンセル</button>
            <button id="photoUploadBtn" style="${STYLES.btn}${STYLES.btnPrimary}flex:1;">アップロード</button>
          </div>
        </div>

        <!-- 写真グリッド -->
        <div id="photoGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
          ${photos.length === 0
            ? `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#5a6272;font-size:13px;">まだ写真がありません</div>`
            : photos.map(p => `
              <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;background:#f0ede5;">
                <img src="${escapeHtml(p.photo_url)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
                ${p.caption ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);color:#1C2541;font-size:10px;padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.caption)}</div>` : ''}
              </div>
            `).join('')}
        </div>
      </div>
    `;

    // ステップ切り替え
    contentEl.querySelectorAll('.photo-step-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeStep = btn.dataset.step;
        render();
      });
    });

    // カメラ入力
    let selectedFile = null;
    const cameraInput = contentEl.querySelector('#photoCameraInput');
    const captionArea = contentEl.querySelector('#photoCaptionArea');

    cameraInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedFile = e.target.files[0];
        captionArea.style.display = 'block';
      }
    });

    // キャンセル
    contentEl.querySelector('#photoCancelBtn')?.addEventListener('click', () => {
      selectedFile = null;
      captionArea.style.display = 'none';
      cameraInput.value = '';
    });

    // アップロード
    contentEl.querySelector('#photoUploadBtn')?.addEventListener('click', async () => {
      if (!selectedFile) return;
      const uploadBtn = contentEl.querySelector('#photoUploadBtn');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'アップロード中...';

      try {
        const staff = getCurrentStaff();
        const timestamp = Date.now();
        const ext = selectedFile.name.split('.').pop() || 'jpg';
        const path = `work/${workOrder.id}/${activeStep}/${timestamp}.${ext}`;

        const photoUrl = await uploadPhoto(selectedFile, path);
        if (!photoUrl) {
          showToast('アップロードに失敗しました');
          uploadBtn.disabled = false;
          uploadBtn.textContent = 'アップロード';
          return;
        }

        const caption = contentEl.querySelector('#photoCaptionInput')?.value?.trim() || null;
        await createWorkPhoto({
          work_order_id: workOrder.id,
          step: activeStep,
          photo_url: photoUrl,
          caption,
          taken_by: staff?.id,
          taken_at: new Date().toISOString(),
        });

        showToast('写真を保存しました');
        selectedFile = null;
        render();
      } catch (err) {
        console.error('Photo upload error:', err);
        showToast('エラーが発生しました');
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'アップロード';
      }
    });
  }

  await render();
}

// =============================================
// 2. チェックリスト
// =============================================
async function renderChecklist(contentEl, workOrder, askCase) {
  showLoading(contentEl, 'チェックリストを読み込み中...');

  let checklist = await getChecklist(workOrder.id);
  let items;

  if (checklist && checklist.items) {
    items = checklist.items;
  } else {
    // テンプレートから初期化
    const category = askCase?.category || 'デフォルト';
    const template = CONFIG.CHECKLIST_TEMPLATES[category] || CONFIG.CHECKLIST_TEMPLATES['デフォルト'];
    items = template.map(label => ({ label, checked: false }));
  }

  function render() {
    const checkedCount = items.filter(i => i.checked).length;
    const total = items.length;
    const percent = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">チェックリスト</div>

        <!-- プログレスバー -->
        <div style="${STYLES.card}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:#5a6272;font-size:12px;">進捗</span>
            <span style="color:#C5A258;font-size:14px;font-weight:700;">${checkedCount}/${total}（${percent}%）</span>
          </div>
          <div style="height:8px;background:#F8F5EE;border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${percent}%;background:linear-gradient(90deg,#C5A258,#C5A258);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>

        <!-- チェックリストアイテム -->
        <div id="checklistItems">
          ${items.map((item, idx) => `
            <div class="checklist-item" data-idx="${idx}" style="${STYLES.card}display:flex;align-items:center;gap:12px;cursor:pointer;padding:14px 16px;${item.checked ? 'opacity:0.6;' : ''}">
              <div style="width:24px;height:24px;border-radius:6px;border:2px solid ${item.checked ? '#006B3F' : '#dde0e6'};background:${item.checked ? '#006B3F' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">
                ${item.checked ? '<span style="color:#1C2541;font-size:14px;">✓</span>' : ''}
              </div>
              <span style="color:${item.checked ? '#5a6272' : '#fff'};font-size:14px;${item.checked ? 'text-decoration:line-through;' : ''}">${escapeHtml(item.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    contentEl.querySelectorAll('.checklist-item').forEach(el => {
      el.addEventListener('click', async () => {
        const idx = parseInt(el.dataset.idx);
        items[idx].checked = !items[idx].checked;
        render();

        // 自動保存
        const staff = getCurrentStaff();
        await upsertChecklist(workOrder.id, items, staff?.id);
      });
    });
  }

  render();
}

// =============================================
// 3. タイマー
// =============================================
async function renderTimer(contentEl, workOrder) {
  const staff = getCurrentStaff();
  let timerState = getTimerState(workOrder.id);
  let currentLogId = timerState?.logId || null;

  function getElapsed() {
    if (!timerState) return 0;
    if (timerState.status === 'running') {
      return timerState.elapsed + (Date.now() - timerState.lastTick);
    }
    return timerState.elapsed || 0;
  }

  function formatTimer(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function render() {
    const logs = await getWorkLogs(workOrder.id);
    const isRunning = timerState?.status === 'running';
    const isPaused = timerState?.status === 'paused';

    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">タイマー</div>

        <!-- デジタル時計 -->
        <div style="${STYLES.card}text-align:center;padding:32px 16px;">
          <div id="timerDisplay" style="font-size:56px;font-weight:700;color:${isRunning ? '#C5A258' : '#fff'};font-family:'Courier New',monospace;letter-spacing:4px;">
            ${formatTimer(getElapsed())}
          </div>
          <div style="color:#5a6272;font-size:12px;margin-top:8px;">
            ${isRunning ? '計測中...' : isPaused ? '一時停止中' : '停止中'}
          </div>
        </div>

        <!-- コントロールボタン -->
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          ${!isRunning && !isPaused ? `
            <button id="timerStartBtn" style="${STYLES.btn}${STYLES.btnPrimary}flex:1;font-size:16px;padding:14px;">▶️ 開始</button>
          ` : ''}
          ${isRunning ? `
            <button id="timerPauseBtn" style="${STYLES.btn}${STYLES.btnSecondary}flex:1;font-size:16px;padding:14px;">⏸️ 一時停止</button>
            <button id="timerStopBtn" style="${STYLES.btn}${STYLES.btnDanger}flex:1;font-size:16px;padding:14px;">⏹️ 停止</button>
          ` : ''}
          ${isPaused ? `
            <button id="timerResumeBtn" style="${STYLES.btn}${STYLES.btnPrimary}flex:1;font-size:16px;padding:14px;">▶️ 再開</button>
            <button id="timerStopBtn" style="${STYLES.btn}${STYLES.btnDanger}flex:1;font-size:16px;padding:14px;">⏹️ 停止</button>
          ` : ''}
        </div>

        <!-- 作業ログ履歴 -->
        <div style="${STYLES.sectionTitle}">作業ログ</div>
        ${logs.length === 0
          ? '<div style="text-align:center;padding:20px;color:#5a6272;font-size:13px;">まだ作業ログがありません</div>'
          : logs.map(log => `
            <div style="${STYLES.card}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <div style="color:#5a6272;font-size:11px;">${escapeHtml(getStaffById(log.staff_id)?.name || log.staff_id || '--')}</div>
                  <div style="color:#1C2541;font-size:13px;">${formatTime(log.start_time)} 〜 ${log.end_time ? formatTime(log.end_time) : '計測中'}</div>
                </div>
                <div style="color:#C5A258;font-size:14px;font-weight:700;">${log.duration_minutes ? formatDuration(log.duration_minutes) : '--'}</div>
              </div>
            </div>
          `).join('')}
      </div>
    `;

    // 開始ボタン
    contentEl.querySelector('#timerStartBtn')?.addEventListener('click', async () => {
      const now = Date.now();
      timerState = { status: 'running', startedAt: now, elapsed: 0, lastTick: now, logId: null };

      // DB作業ログ作成
      const log = await createWorkLog({
        work_order_id: workOrder.id,
        staff_id: staff?.id,
        start_time: new Date().toISOString(),
      });
      if (log) {
        timerState.logId = log.id;
        currentLogId = log.id;
      }

      setTimerState(workOrder.id, timerState);
      startTimerInterval(contentEl, workOrder);
      render();
    });

    // 一時停止ボタン
    contentEl.querySelector('#timerPauseBtn')?.addEventListener('click', () => {
      if (timerState) {
        timerState.elapsed += (Date.now() - timerState.lastTick);
        timerState.status = 'paused';
        setTimerState(workOrder.id, timerState);
      }
      stopTimerInterval();
      render();
    });

    // 再開ボタン
    contentEl.querySelector('#timerResumeBtn')?.addEventListener('click', () => {
      if (timerState) {
        timerState.status = 'running';
        timerState.lastTick = Date.now();
        setTimerState(workOrder.id, timerState);
      }
      startTimerInterval(contentEl, workOrder);
      render();
    });

    // 停止ボタン
    contentEl.querySelector('#timerStopBtn')?.addEventListener('click', () => {
      showConfirm('タイマーを停止して作業ログを保存しますか？', async () => {
        const elapsed = getElapsed();
        const durationMin = Math.round(elapsed / 60000);
        stopTimerInterval();

        // DB更新
        if (timerState?.logId) {
          await updateWorkLog(timerState.logId, {
            end_time: new Date().toISOString(),
            duration_minutes: durationMin,
          });
        }

        setTimerState(workOrder.id, null);
        timerState = null;
        currentLogId = null;
        showToast(`作業ログを保存しました（${formatDuration(durationMin)}）`);
        render();
      });
    });

    // タイマー動作中ならインターバル開始
    if (isRunning) {
      startTimerInterval(contentEl, workOrder);
    }
  }

  await render();
}

function startTimerInterval(contentEl, workOrder) {
  stopTimerInterval();
  timerInterval = setInterval(() => {
    const state = getTimerState(workOrder.id);
    if (!state || state.status !== 'running') {
      stopTimerInterval();
      return;
    }
    const elapsed = state.elapsed + (Date.now() - state.lastTick);
    const totalSec = Math.floor(elapsed / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const display = contentEl.querySelector('#timerDisplay');
    if (display) {
      display.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }, 1000);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// =============================================
// 4. 動産記録
// =============================================
async function renderFoundItems(contentEl, workOrder) {
  const CATEGORIES = ['家具', '家電', 'ブランド品', '貴金属', '食器', '衣類', '書籍', 'その他'];

  async function render() {
    const items = await getFoundItems(workOrder.id);

    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">動産記録</div>

        <!-- 登録フォーム -->
        <div style="${STYLES.card}" id="foundItemForm">
          <div style="margin-bottom:12px;">
            <label style="${STYLES.label}">品名 *</label>
            <input type="text" id="fiName" placeholder="例: ブランドバッグ" style="${STYLES.input}">
          </div>
          <div style="margin-bottom:12px;">
            <label style="${STYLES.label}">カテゴリ</label>
            <select id="fiCategory" style="${STYLES.input}">
              ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div style="display:flex;gap:8px;margin-bottom:12px;">
            <div style="flex:1;">
              <label style="${STYLES.label}">推定価値（円）</label>
              <input type="number" id="fiValue" placeholder="0" style="${STYLES.input}">
            </div>
            <div style="flex:1;">
              <label style="${STYLES.label}">写真</label>
              <label style="display:flex;align-items:center;justify-content:center;${STYLES.btn}${STYLES.btnSecondary}cursor:pointer;height:38px;">
                📷 撮影
                <input type="file" accept="image/*" capture="environment" id="fiPhoto" style="display:none;">
              </label>
            </div>
          </div>
          <div id="fiPhotoPreview" style="margin-bottom:12px;display:none;">
            <img id="fiPhotoImg" style="max-width:100%;border-radius:8px;max-height:150px;object-fit:cover;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="${STYLES.label}">備考</label>
            <input type="text" id="fiNote" placeholder="状態や特記事項" style="${STYLES.input}">
          </div>
          <button id="fiSubmitBtn" style="${STYLES.btn}${STYLES.btnPrimary}width:100%;">登録する</button>
        </div>

        <!-- 登録済みリスト -->
        <div style="margin-top:16px;">
          <div style="${STYLES.sectionTitle}">登録済み（${items.length}件）</div>
          ${items.length === 0
            ? '<div style="text-align:center;padding:20px;color:#5a6272;font-size:13px;">まだ動産が登録されていません</div>'
            : items.map(item => `
              <div style="${STYLES.card}display:flex;gap:12px;align-items:flex-start;">
                ${item.photo_url
                  ? `<img src="${escapeHtml(item.photo_url)}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;flex-shrink:0;">`
                  : `<div style="width:64px;height:64px;border-radius:8px;background:#f0ede5;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#5a6272;font-size:24px;">📦</div>`}
                <div style="flex:1;min-width:0;">
                  <div style="color:#1C2541;font-size:14px;font-weight:600;margin-bottom:2px;">${escapeHtml(item.item_name)}</div>
                  <div style="color:#5a6272;font-size:12px;">${escapeHtml(item.category || '--')}</div>
                  ${item.estimated_value ? `<div style="color:#C5A258;font-size:13px;font-weight:600;">¥${Number(item.estimated_value).toLocaleString()}</div>` : ''}
                  ${item.note ? `<div style="color:#5a6272;font-size:11px;margin-top:2px;">${escapeHtml(item.note)}</div>` : ''}
                  <div style="margin-top:4px;">
                    ${item.sent_to_ryutsu
                      ? '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;background:#006B3F22;color:#006B3F;border:1px solid #006B3F40;">流通に送信済み</span>'
                      : '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;background:#C5A25822;color:#C5A258;border:1px solid #C5A25840;">未送信</span>'}
                  </div>
                </div>
              </div>
            `).join('')}
        </div>
      </div>
    `;

    // 写真プレビュー
    let selectedFile = null;
    contentEl.querySelector('#fiPhoto').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = contentEl.querySelector('#fiPhotoPreview');
          const img = contentEl.querySelector('#fiPhotoImg');
          img.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(selectedFile);
      }
    });

    // 登録ボタン
    contentEl.querySelector('#fiSubmitBtn').addEventListener('click', async () => {
      const name = contentEl.querySelector('#fiName').value.trim();
      if (!name) {
        showToast('品名を入力してください');
        return;
      }

      const btn = contentEl.querySelector('#fiSubmitBtn');
      btn.disabled = true;
      btn.textContent = '登録中...';

      try {
        let photoUrl = null;
        if (selectedFile) {
          const timestamp = Date.now();
          const ext = selectedFile.name.split('.').pop() || 'jpg';
          const path = `found/${workOrder.id}/${timestamp}.${ext}`;
          photoUrl = await uploadPhoto(selectedFile, path);
        }

        const staff = getCurrentStaff();
        await createFoundItem({
          work_order_id: workOrder.id,
          item_name: name,
          category: contentEl.querySelector('#fiCategory').value,
          estimated_value: parseInt(contentEl.querySelector('#fiValue').value) || null,
          photo_url: photoUrl,
          note: contentEl.querySelector('#fiNote').value.trim() || null,
          recorded_by: staff?.id,
          sent_to_ryutsu: false,
        });

        showToast('動産を登録しました');
        selectedFile = null;
        render();
      } catch (err) {
        console.error('Found item error:', err);
        showToast('登録に失敗しました');
        btn.disabled = false;
        btn.textContent = '登録する';
      }
    });
  }

  await render();
}

// =============================================
// 5. メモ
// =============================================
async function renderMemos(contentEl, workOrder) {
  async function render() {
    const memos = await getMemos(workOrder.id);

    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">メモ</div>

        <!-- メモ入力 -->
        <div style="${STYLES.card}">
          <textarea id="memoText" placeholder="メモを入力..." style="${STYLES.textarea}"></textarea>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;">
            <label style="display:flex;align-items:center;gap:4px;${STYLES.btn}${STYLES.btnSecondary}cursor:pointer;flex-shrink:0;">
              📷
              <input type="file" accept="image/*" capture="environment" id="memoPhoto" style="display:none;">
            </label>
            <div id="memoPhotoName" style="flex:1;color:#5a6272;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
            <button id="memoSubmitBtn" style="${STYLES.btn}${STYLES.btnPrimary}flex-shrink:0;">保存</button>
          </div>
        </div>

        <!-- メモ一覧 -->
        <div style="margin-top:16px;">
          ${memos.length === 0
            ? '<div style="text-align:center;padding:20px;color:#5a6272;font-size:13px;">まだメモがありません</div>'
            : memos.map(memo => `
              <div style="${STYLES.card}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                  <span style="color:#5a6272;font-size:11px;">${escapeHtml(getStaffById(memo.created_by)?.name || memo.created_by || '--')}</span>
                  <span style="color:#5a6272;font-size:11px;">${formatTime(memo.created_at)}</span>
                </div>
                <div style="color:#1C2541;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(memo.content)}</div>
                ${memo.photo_url ? `<img src="${escapeHtml(memo.photo_url)}" style="max-width:100%;border-radius:8px;margin-top:8px;max-height:200px;object-fit:cover;">` : ''}
              </div>
            `).join('')}
        </div>
      </div>
    `;

    // 写真添付
    let selectedFile = null;
    contentEl.querySelector('#memoPhoto').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedFile = e.target.files[0];
        contentEl.querySelector('#memoPhotoName').textContent = selectedFile.name;
      }
    });

    // メモ保存
    contentEl.querySelector('#memoSubmitBtn').addEventListener('click', async () => {
      const text = contentEl.querySelector('#memoText').value.trim();
      if (!text) {
        showToast('メモを入力してください');
        return;
      }

      const btn = contentEl.querySelector('#memoSubmitBtn');
      btn.disabled = true;
      btn.textContent = '保存中...';

      try {
        let photoUrl = null;
        if (selectedFile) {
          const timestamp = Date.now();
          const ext = selectedFile.name.split('.').pop() || 'jpg';
          const path = `memo/${workOrder.id}/${timestamp}.${ext}`;
          photoUrl = await uploadPhoto(selectedFile, path);
        }

        const staff = getCurrentStaff();
        await createMemo({
          work_order_id: workOrder.id,
          content: text,
          photo_url: photoUrl,
          created_by: staff?.id,
        });

        showToast('メモを保存しました');
        selectedFile = null;
        render();
      } catch (err) {
        console.error('Memo error:', err);
        showToast('保存に失敗しました');
        btn.disabled = false;
        btn.textContent = '保存';
      }
    });
  }

  await render();
}

// =============================================
// 6. 道具リスト
// =============================================
function renderTools(contentEl, workOrder) {
  const tools = workOrder.tools || CONFIG.DEFAULT_TOOLS;
  let checks = getToolChecks(workOrder.id);

  function render() {
    const checkedCount = Object.values(checks).filter(Boolean).length;
    const total = tools.length;

    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">道具リスト</div>
        <div style="${STYLES.card}margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#5a6272;font-size:12px;">確認済み</span>
            <span style="color:#C5A258;font-size:14px;font-weight:700;">${checkedCount}/${total}</span>
          </div>
        </div>

        <div id="toolsList">
          ${tools.map((tool, idx) => {
            const isChecked = checks[idx] === true;
            return `
              <div class="tool-item" data-idx="${idx}" style="${STYLES.card}display:flex;align-items:center;gap:12px;cursor:pointer;padding:14px 16px;${isChecked ? 'opacity:0.7;' : ''}">
                <div style="width:28px;height:28px;border-radius:8px;border:2px solid ${isChecked ? '#006B3F' : '#dde0e6'};background:${isChecked ? '#006B3F' : 'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">
                  ${isChecked ? '<span style="color:#1C2541;font-size:16px;">✓</span>' : ''}
                </div>
                <span style="color:${isChecked ? '#5a6272' : '#fff'};font-size:14px;">${escapeHtml(tool)}</span>
                ${isChecked ? '<span style="color:#006B3F;font-size:11px;margin-left:auto;">持った</span>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    contentEl.querySelectorAll('.tool-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        checks[idx] = !checks[idx];
        setToolChecks(workOrder.id, checks);
        render();
      });
    });
  }

  render();
}

// =============================================
// 7. 役割分担
// =============================================
function renderRoles(contentEl, workOrder) {
  const staffIds = workOrder.staff_ids || [];
  const instructions = workOrder.instructions || null;
  const admin = isAdmin();

  contentEl.innerHTML = `
    <div>
      <div style="${STYLES.sectionTitle}">役割分担</div>

      ${instructions ? `
        <div style="${STYLES.card}margin-bottom:16px;">
          <div style="color:#5a6272;font-size:11px;margin-bottom:4px;">作業指示</div>
          <div style="color:#1C2541;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(instructions)}</div>
        </div>
      ` : ''}

      <div>
        ${staffIds.length === 0
          ? '<div style="text-align:center;padding:20px;color:#5a6272;font-size:13px;">担当スタッフが未割り当てです</div>'
          : staffIds.map(id => {
            const s = getStaffById(id);
            if (!s) return '';
            return `
              <div style="${STYLES.card}display:flex;align-items:center;gap:12px;">
                <div style="width:44px;height:44px;border-radius:50%;background:#f0ede5;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${s.avatar}</div>
                <div style="flex:1;">
                  <div style="color:#1C2541;font-size:14px;font-weight:600;">${escapeHtml(s.name)}</div>
                  <div style="color:#5a6272;font-size:12px;">${s.role === 'admin' ? '管理者' : s.role === 'display_only' ? '表示のみ' : '作業員'}</div>
                </div>
              </div>
            `;
          }).join('')}
      </div>

      ${admin && !instructions ? `
        <div style="margin-top:16px;">
          <div style="color:#5a6272;font-size:12px;margin-bottom:8px;">作業指示を追加（管理者のみ）</div>
          <textarea id="roleInstructionsInput" placeholder="作業指示を入力..." style="${STYLES.textarea}">${escapeHtml(workOrder.instructions || '')}</textarea>
          <button id="roleInstructionsSaveBtn" style="${STYLES.btn}${STYLES.btnPrimary}width:100%;margin-top:8px;">保存</button>
        </div>
      ` : ''}
      ${admin && instructions ? `
        <div style="margin-top:16px;">
          <button id="roleInstructionsEditBtn" style="${STYLES.btn}${STYLES.btnSecondary}width:100%;">作業指示を編集</button>
        </div>
      ` : ''}
    </div>
  `;

  // 作業指示保存
  contentEl.querySelector('#roleInstructionsSaveBtn')?.addEventListener('click', async () => {
    const text = contentEl.querySelector('#roleInstructionsInput').value.trim();
    const btn = contentEl.querySelector('#roleInstructionsSaveBtn');
    btn.disabled = true;
    btn.textContent = '保存中...';
    await updateWorkOrder(workOrder.id, { instructions: text });
    workOrder.instructions = text;
    showToast('作業指示を保存しました');
    renderRoles(contentEl, workOrder);
  });

  // 編集ボタン
  contentEl.querySelector('#roleInstructionsEditBtn')?.addEventListener('click', () => {
    workOrder._editingInstructions = true;
    const editArea = document.createElement('div');
    editArea.style.cssText = 'margin-top:12px;';
    editArea.innerHTML = `
      <textarea id="roleInstructionsInput" style="${STYLES.textarea}">${escapeHtml(workOrder.instructions || '')}</textarea>
      <button id="roleInstructionsSaveBtn" style="${STYLES.btn}${STYLES.btnPrimary}width:100%;margin-top:8px;">保存</button>
    `;
    const editBtn = contentEl.querySelector('#roleInstructionsEditBtn');
    editBtn.replaceWith(editArea);

    editArea.querySelector('#roleInstructionsSaveBtn').addEventListener('click', async () => {
      const text = editArea.querySelector('#roleInstructionsInput').value.trim();
      const saveBtn = editArea.querySelector('#roleInstructionsSaveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';
      await updateWorkOrder(workOrder.id, { instructions: text });
      workOrder.instructions = text;
      showToast('作業指示を保存しました');
      renderRoles(contentEl, workOrder);
    });
  });
}

// =============================================
// 8. マップ
// =============================================
function renderMap(contentEl, workOrder, askCase) {
  const address = askCase?.site_address || workOrder.site_address || '';

  contentEl.innerHTML = `
    <div>
      <div style="${STYLES.sectionTitle}">マップ</div>

      <div style="${STYLES.card}">
        <div style="color:#5a6272;font-size:11px;margin-bottom:4px;">現場住所</div>
        <div style="color:#1C2541;font-size:15px;font-weight:600;margin-bottom:16px;">
          ${address ? escapeHtml(address) : '<span style="color:#5a6272;">住所が未設定です</span>'}
        </div>

        ${address ? `
          <div style="display:flex;gap:8px;">
            <button id="mapOpenBtn" style="${STYLES.btn}${STYLES.btnSecondary}flex:1;font-size:14px;">
              🗺️ Google Mapsで開く
            </button>
            <button id="mapNavBtn" style="${STYLES.btn}${STYLES.btnPrimary}flex:1;font-size:14px;">
              🧭 ナビ開始
            </button>
          </div>
        ` : ''}
      </div>

      ${address ? `
        <div style="${STYLES.card}">
          <div style="color:#5a6272;font-size:12px;text-align:center;">
            Google Mapsが外部ブラウザで開きます
          </div>
        </div>
      ` : ''}
    </div>
  `;

  if (address) {
    contentEl.querySelector('#mapOpenBtn')?.addEventListener('click', () => {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    });

    contentEl.querySelector('#mapNavBtn')?.addEventListener('click', () => {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
    });
  }
}

// =============================================
// 9. 完了報告
// =============================================
async function renderCompletion(contentEl, workOrder, askCase) {
  showLoading(contentEl, '完了報告を読み込み中...');

  const existingReport = await getCompletionReport(workOrder.id);

  if (existingReport) {
    // 既に報告済み
    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">完了報告</div>

        <div style="${STYLES.card}text-align:center;padding:24px;">
          <div style="font-size:48px;margin-bottom:8px;">✅</div>
          <div style="color:#006B3F;font-size:16px;font-weight:700;margin-bottom:4px;">完了報告済み</div>
          <span style="display:inline-block;padding:4px 12px;border-radius:10px;font-size:11px;background:#006B3F22;color:#006B3F;border:1px solid #006B3F40;margin-top:8px;">アスカラに通知済み</span>
        </div>

        <div style="${STYLES.card}">
          <div style="color:#5a6272;font-size:11px;margin-bottom:4px;">報告日時</div>
          <div style="color:#1C2541;font-size:14px;margin-bottom:12px;">${formatDateFull(existingReport.created_at)} ${formatTime(existingReport.created_at)}</div>

          ${existingReport.comment ? `
            <div style="color:#5a6272;font-size:11px;margin-bottom:4px;">コメント</div>
            <div style="color:#1C2541;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(existingReport.comment)}</div>
          ` : ''}

          ${existingReport.photo_urls && existingReport.photo_urls.length > 0 ? `
            <div style="color:#5a6272;font-size:11px;margin-top:12px;margin-bottom:8px;">完了写真</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
              ${existingReport.photo_urls.map(url => `
                <div style="aspect-ratio:1;border-radius:8px;overflow:hidden;">
                  <img src="${escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    return;
  }

  // 新規報告フォーム
  let completionPhotos = [];

  function render() {
    contentEl.innerHTML = `
      <div>
        <div style="${STYLES.sectionTitle}">完了報告</div>

        <!-- 完了写真 -->
        <div style="${STYLES.card}">
          <div style="color:#5a6272;font-size:12px;margin-bottom:8px;">完了写真</div>
          <label style="display:flex;align-items:center;justify-content:center;gap:8px;${STYLES.btn}${STYLES.btnSecondary}cursor:pointer;margin-bottom:12px;">
            📷 写真を追加
            <input type="file" accept="image/*" capture="environment" id="completionPhotoInput" style="display:none;" multiple>
          </label>
          <div id="completionPhotoGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${completionPhotos.map((p, idx) => `
              <div style="position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;">
                <img src="${p.preview}" style="width:100%;height:100%;object-fit:cover;">
                <button class="remove-photo-btn" data-idx="${idx}" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.7);color:#1C2541;border:none;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- コメント -->
        <div style="${STYLES.card}">
          <div style="color:#5a6272;font-size:12px;margin-bottom:8px;">コメント</div>
          <textarea id="completionComment" placeholder="作業完了報告のコメント..." style="${STYLES.textarea}">${escapeHtml(contentEl._savedComment || '')}</textarea>
        </div>

        <!-- 送信ボタン -->
        <button id="completionSubmitBtn" style="${STYLES.btn}${STYLES.btnPrimary}width:100%;font-size:16px;padding:16px;margin-top:8px;">
          完了報告を送信
        </button>
      </div>
    `;

    // 写真追加
    contentEl.querySelector('#completionPhotoInput').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          completionPhotos.push({ file, preview: ev.target.result });
          contentEl._savedComment = contentEl.querySelector('#completionComment')?.value || '';
          render();
        };
        reader.readAsDataURL(file);
      }
    });

    // 写真削除
    contentEl.querySelectorAll('.remove-photo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx);
        completionPhotos.splice(idx, 1);
        contentEl._savedComment = contentEl.querySelector('#completionComment')?.value || '';
        render();
      });
    });

    // 送信ボタン
    contentEl.querySelector('#completionSubmitBtn').addEventListener('click', () => {
      const comment = contentEl.querySelector('#completionComment').value.trim();

      showConfirm('完了報告を送信しますか？<br>送信後はアスカラに通知されます。', async () => {
        const btn = contentEl.querySelector('#completionSubmitBtn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '送信中...';
        }

        try {
          // 写真アップロード
          const photoUrls = [];
          for (const p of completionPhotos) {
            const timestamp = Date.now();
            const ext = p.file.name.split('.').pop() || 'jpg';
            const path = `completion/${workOrder.id}/${timestamp}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
            const url = await uploadPhoto(p.file, path);
            if (url) photoUrls.push(url);
          }

          const staff = getCurrentStaff();
          await createCompletionReport({
            work_order_id: workOrder.id,
            photo_urls: photoUrls,
            comment: comment || null,
            reported_by: staff?.id,
          });

          // ステータス更新
          await updateWorkOrder(workOrder.id, { status: '完了報告済' });
          workOrder.status = '完了報告済';

          showToast('完了報告を送信しました');

          // 報告済み表示に切り替え
          renderCompletion(contentEl, workOrder, askCase);
        } catch (err) {
          console.error('Completion report error:', err);
          showToast('送信に失敗しました');
          if (btn) {
            btn.disabled = false;
            btn.textContent = '完了報告を送信';
          }
        }
      });
    });
  }

  render();
}
