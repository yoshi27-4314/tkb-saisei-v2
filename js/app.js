/**
 * テイクバック再生 v2 - メインエントリポイント
 * モジュール構成: 案件(cases) / 現場作業(fieldwork) / ツール(tools) / マイページ(mypage)
 */
import { CONFIG } from './core/config.js';
import { initDB, getTodayWorkOrders, getWorkOrders, getWorkOrderStatusCounts, getNotices, getAttendanceByDate, getAskCase } from './core/db.js';
import { getCurrentStaff, showLoginScreen, logout, isAdmin, getAllStaff } from './core/auth.js';
import { registerRoute, navigate } from './core/router.js';
import { showToast, showLoading, statusBadge, emptyState, escapeHtml, formatDate, formatDateFull, formatTime, formatDuration } from './core/ui.js';
import { renderCases } from './cases/index.js';
import { renderFieldwork } from './fieldwork/index.js';
import { renderTools } from './tools/index.js';
import { renderMyPage } from './mypage/index.js';

const app = document.getElementById('app');

// --- ルート登録 ---
registerRoute('home', renderHome);
registerRoute('cases', (p) => { ensureShell('cases'); renderCases(getContentEl(), p); });
registerRoute('fieldwork', (p) => { ensureShell('fieldwork'); renderFieldwork(getContentEl(), p); });
registerRoute('tools', (p) => { ensureShell('tools'); renderTools(getContentEl(), p); });
registerRoute('mypage', (p) => { ensureShell('mypage'); renderMyPage(getContentEl(), p); });

function getContentEl() {
  return document.getElementById('mainContent') || app;
}

// --- アプリ起動 ---
async function boot() {
  const staff = getCurrentStaff();
  if (!staff) {
    showLoginScreen(app, () => boot());
    return;
  }

  if (!initDB()) {
    app.innerHTML = `<div style="padding:40px;text-align:center;color:#e74c3c;">
      <p>データベースに接続できません</p>
      <p style="font-size:12px;color:#8892a4;margin-top:8px;">ページを再読み込みしてください</p>
    </div>`;
    return;
  }

  renderShell();
  navigate('home');
}

// --- シェル ---
function renderShell() {
  const staff = getCurrentStaff();
  app.innerHTML = `
    <div class="header">
      <div>
        <div class="header-title">テイクバック再生</div>
        <div class="header-subtitle">${escapeHtml(staff.name)} | v${CONFIG.APP_VERSION}</div>
      </div>
      <button class="header-action" id="headerMypage">👤</button>
    </div>
    <div class="main-content" id="mainContent"></div>
    <nav class="bottom-nav">
      <button class="nav-item active" data-route="home">
        <span class="nav-icon">🏠</span>
        <span>ホーム</span>
      </button>
      <button class="nav-item" data-route="cases">
        <span class="nav-icon">📋</span>
        <span>案件</span>
      </button>
      <button class="nav-item" data-route="fieldwork">
        <span class="nav-icon">📷</span>
        <span>現場</span>
      </button>
      <button class="nav-item" data-route="tools">
        <span class="nav-icon">🔧</span>
        <span>ツール</span>
      </button>
      <button class="nav-item" data-route="mypage">
        <span class="nav-icon">👤</span>
        <span>マイページ</span>
      </button>
    </nav>
  `;

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.route));
  });
  document.getElementById('headerMypage')?.addEventListener('click', () => navigate('mypage'));
}

function ensureShell(activeTab) {
  if (!document.getElementById('mainContent')) {
    renderShell();
  }
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === activeTab);
  });
}

// --- ホーム画面 ---
async function renderHome() {
  ensureShell('home');
  const content = getContentEl();
  showLoading(content, 'データを読み込み中...');

  try {
    const staff = getCurrentStaff();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const hour = today.getHours();
    const greeting = hour < 12 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'お疲れさまです';

    const [todayOrders, statusCounts, notices, todayAttendance] = await Promise.all([
      getTodayWorkOrders(staff.role === 'admin' ? null : staff.id),
      getWorkOrderStatusCounts(),
      getNotices(5),
      getAttendanceByDate(todayStr),
    ]);

    // 案件タイトルを取得
    const caseNames = {};
    for (const order of todayOrders) {
      if (order.case_id && !caseNames[order.case_id]) {
        const c = await getAskCase(order.case_id);
        caseNames[order.case_id] = c?.title || '(無題)';
      }
    }

    // 出勤メンバー
    const clockedIn = todayAttendance.filter(a => a.clock_in && !a.clock_out);
    const clockedInNames = clockedIn.map(a => a.staff_name).join('、') || 'なし';

    // KPI
    const activeCount = ['受注確定', '現場作業中'].reduce((s, st) => s + (statusCounts[st] || 0), 0);
    const planningCount = ['案件受取', '作業計画', '見積提出'].reduce((s, st) => s + (statusCounts[st] || 0), 0);
    const completedCount = (statusCounts['完了報告済'] || 0) + (statusCounts['請求・精算'] || 0);

    // 今日の現場カード
    let todayHtml;
    if (todayOrders.length > 0) {
      todayHtml = todayOrders.map(order => {
        const caseName = caseNames[order.case_id] || '(無題)';
        const staffNames = (order.staff_ids || []).map(sid => {
          const s = getAllStaff().find(st => st.id === sid);
          return s ? s.name.split(/[　 ]/)[0] : sid;
        }).join('・');

        return `
          <div class="card" data-order-id="${order.id}" style="border-left:3px solid #e67e22;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;">
                <div style="font-weight:700;font-size:15px;margin-bottom:4px;">${escapeHtml(caseName)}</div>
                <div style="font-size:12px;color:#8892a4;">
                  ${order.start_time ? '🕐 ' + escapeHtml(order.start_time) + '〜' : ''}
                  ${order.site_address ? ' 📍 ' + escapeHtml(order.site_address) : ''}
                </div>
                <div style="font-size:12px;color:#8892a4;margin-top:2px;">👷 ${escapeHtml(staffNames)}</div>
              </div>
              <div>${statusBadge(order.status)}</div>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
              ${order.site_address ? `<button class="btn-nav" data-address="${escapeHtml(order.site_address)}" style="flex:1;padding:8px;border-radius:8px;background:#3498db;color:#fff;border:none;font-size:12px;cursor:pointer;">🗺️ ナビ</button>` : ''}
              <button class="btn-start" data-order-id="${order.id}" style="flex:1;padding:8px;border-radius:8px;background:#e67e22;color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer;">🏗️ 作業開始</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      todayHtml = `<div style="text-align:center;padding:24px;color:#8892a4;font-size:13px;">今日の予定はありません</div>`;
    }

    content.innerHTML = `
      <div class="fade-in">
        <!-- 挨拶 -->
        <div style="padding:4px 0 16px;">
          <div style="font-size:18px;font-weight:700;color:#e67e22;">${greeting}、${escapeHtml(staff.name.split(/[　 ]/)[0])}さん</div>
          <div style="color:#8892a4;font-size:12px;">${today.getMonth()+1}月${today.getDate()}日（${dayNames[today.getDay()]}）</div>
        </div>

        <!-- KPI -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
          <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;border:1px solid #2a3a5c;">
            <div style="font-size:28px;font-weight:700;color:#e67e22;">${todayOrders.length}</div>
            <div style="font-size:11px;color:#8892a4;">今日の現場</div>
          </div>
          <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;border:1px solid #2a3a5c;">
            <div style="font-size:28px;font-weight:700;color:#3498db;">${activeCount + planningCount}</div>
            <div style="font-size:11px;color:#8892a4;">進行中案件</div>
          </div>
          <div style="background:#16213e;border-radius:12px;padding:14px;text-align:center;border:1px solid #2a3a5c;">
            <div style="font-size:28px;font-weight:700;color:#2ecc71;">${completedCount}</div>
            <div style="font-size:11px;color:#8892a4;">完了済</div>
          </div>
        </div>

        <!-- 今日の現場 -->
        <div style="font-size:13px;font-weight:700;color:#8892a4;margin-bottom:8px;">📋 今日の現場</div>
        ${todayHtml}

        <!-- 出勤メンバー -->
        <div style="background:#16213e;border-radius:12px;padding:14px;border:1px solid #2a3a5c;margin-top:16px;">
          <div style="font-size:13px;font-weight:700;color:#8892a4;margin-bottom:8px;">👥 今日の出勤</div>
          <div style="font-size:14px;color:#e0e0e0;">${escapeHtml(clockedInNames)}</div>
        </div>

        <!-- お知らせ -->
        ${notices.length > 0 ? `
          <div style="margin-top:16px;">
            <div style="font-size:13px;font-weight:700;color:#8892a4;margin-bottom:8px;">📢 お知らせ</div>
            ${notices.map(n => `
              <div style="background:#16213e;border-radius:8px;padding:10px 14px;margin-bottom:8px;border:1px solid #2a3a5c;">
                <div style="font-size:13px;color:#e0e0e0;">${escapeHtml(n.title)}</div>
                <div style="font-size:11px;color:#5a6272;margin-top:2px;">${formatDate(n.created_at)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- パイプライン（管理者のみ） -->
        ${staff.role === 'admin' ? `
          <div style="margin-top:16px;">
            <div style="font-size:13px;font-weight:700;color:#8892a4;margin-bottom:8px;">📊 ステータス</div>
            <div style="display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;">
              ${CONFIG.STATUS_FLOW.map(st => {
                const count = statusCounts[st] || 0;
                const icon = CONFIG.STATUS_ICONS[st] || '📋';
                return `
                  <div style="display:flex;flex-direction:column;align-items:center;min-width:56px;padding:8px 4px;border-radius:8px;background:#16213e;border:1px solid #2a3a5c;">
                    <div style="font-size:18px;font-weight:700;color:${count > 0 ? '#e67e22' : '#5a6272'};">${count}</div>
                    <div style="font-size:8px;color:#8892a4;text-align:center;line-height:1.2;">${st}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // イベント
    content.querySelectorAll('.btn-nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const address = btn.dataset.address;
        if (address) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`, '_blank');
        }
      });
    });

    content.querySelectorAll('.btn-start').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigate('fieldwork', { action: 'work', id: btn.dataset.orderId });
      });
    });

    content.querySelectorAll('[data-order-id]').forEach(el => {
      if (!el.classList.contains('btn-start')) {
        el.addEventListener('click', () => {
          navigate('fieldwork', { action: 'work', id: el.dataset.orderId });
        });
      }
    });

  } catch (err) {
    console.error('Home render error:', err);
    content.innerHTML = emptyState('⚠️', 'データの読み込みに失敗しました');
  }
}

// --- 起動 ---
boot();
