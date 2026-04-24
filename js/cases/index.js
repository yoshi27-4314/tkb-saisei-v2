/**
 * テイクバック再生 v2 - 案件モジュール
 * 案件一覧 / 案件受取 / 作業指示作成 / 案件詳細 / 案件・顧客追加
 */
import { CONFIG } from '../core/config.js';
import { getAskCases, getAskCase, getAskContact, createAskCase, createAskContact, getWorkOrders, getWorkOrder, createWorkOrder, updateWorkOrder } from '../core/db.js';
import { showToast, showLoading, showConfirm, showModal, statusBadge, emptyState, escapeHtml, formatDate, formatDateFull } from '../core/ui.js';
import { getCurrentStaff, isAdmin, getAllStaff } from '../core/auth.js';
import { navigate } from '../core/router.js';

// ステータスフィルタータブ定義
const STATUS_TABS = [
  { key: 'all', label: '全て' },
  { key: 'active', label: '進行中', statuses: ['案件受取', '作業計画', '見積提出', '受注確定', '現場作業中'] },
  { key: 'done', label: '完了', statuses: ['完了報告済', '請求・精算'] },
  { key: 'hold', label: '保留等', statuses: ['保留', '追加作業発生', 'キャンセル'] },
];

// 動産サブカテゴリ
const DOUSAN_SUBCATEGORIES = ['片付け', '遺品整理', '残置物撤去', '買取'];

// 連絡先タイプ
const CONTACT_TYPES = ['個人', '法人', '不動産会社', '弁護士', '行政', 'その他'];

// =============================================
// メインエントリ
// =============================================

export function renderCases(container, params = {}) {
  const action = params.action || 'list';

  switch (action) {
    case 'new_order':
      renderNewWorkOrder(container, params);
      break;
    case 'detail':
      renderCaseDetail(container, params);
      break;
    case 'add_case':
      renderAddCase(container, params);
      break;
    case 'add_contact':
      renderAddContact(container, params);
      break;
    default:
      renderCaseList(container, params);
      break;
  }
}

// =============================================
// 案件一覧
// =============================================

async function renderCaseList(container, params = {}) {
  showLoading(container, '案件を読み込み中...');

  const activeTab = params.tab || 'all';

  // ask_casesから動産カテゴリのみ取得
  const allCases = await getAskCases({ category: '動産（モノ）' });

  // 全案件の作業指示を取得してステータスをマッピング
  const allOrders = await getWorkOrders({});
  const ordersByCase = {};
  for (const o of allOrders) {
    if (!ordersByCase[o.case_id]) ordersByCase[o.case_id] = [];
    ordersByCase[o.case_id].push(o);
  }

  // 案件にtkbsステータスを付与（最新の作業指示のステータス、なければ案件受取）
  const casesWithStatus = allCases.map(c => {
    const orders = ordersByCase[c.id] || [];
    const latestOrder = orders.length > 0
      ? orders.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0]
      : null;
    return {
      ...c,
      tkbs_status: latestOrder ? latestOrder.status : '案件受取',
      work_orders: orders,
      latest_order: latestOrder,
    };
  });

  // フィルタ適用
  const tabDef = STATUS_TABS.find(t => t.key === activeTab);
  const filtered = (activeTab === 'all')
    ? casesWithStatus
    : casesWithStatus.filter(c => tabDef?.statuses?.includes(c.tkbs_status));

  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <!-- ヘッダー -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="color:#ffffff;font-size:18px;font-weight:700;margin:0;">案件一覧</h2>
        <div style="display:flex;gap:8px;">
          ${isAdmin() ? `<button id="btnAcceptCase" style="background:#3498db;color:#ffffff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;">案件受取</button>` : ''}
          <button id="btnAddCase" style="background:#006B3F;color:#ffffff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;">+ 案件追加</button>
        </div>
      </div>

      <!-- ステータスタブ -->
      <div id="statusTabs" style="display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
        ${STATUS_TABS.map(t => `
          <button class="status-tab" data-tab="${t.key}"
            style="flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid ${activeTab === t.key ? '#006B3F' : '#dde0e6'};background:${activeTab === t.key ? '#006B3F33' : 'transparent'};color:${activeTab === t.key ? '#006B3F' : '#5a6272'};cursor:pointer;white-space:nowrap;">
            ${t.label}
            <span style="font-size:10px;opacity:0.7;margin-left:2px;">
              ${t.key === 'all' ? casesWithStatus.length : casesWithStatus.filter(c => t.statuses?.includes(c.tkbs_status)).length}
            </span>
          </button>
        `).join('')}
      </div>

      <!-- 検索 -->
      <div style="margin-bottom:16px;">
        <input id="searchInput" type="text" placeholder="案件名・住所で検索..."
          style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;"
          value="${escapeHtml(params.search || '')}">
      </div>

      <!-- 案件リスト -->
      <div id="caseList">
        ${filtered.length === 0
          ? emptyState('📋', '該当する案件がありません')
          : filtered.map(c => renderCaseCard(c)).join('')
        }
      </div>
    </div>
  `;

  // イベント: タブ切り替え
  container.querySelectorAll('.status-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate('cases', { tab: btn.dataset.tab, search: container.querySelector('#searchInput')?.value || '' });
    });
  });

  // イベント: 検索
  let searchTimer = null;
  const searchInput = container.querySelector('#searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const query = searchInput.value.trim().toLowerCase();
        const listEl = container.querySelector('#caseList');
        if (!query) {
          listEl.innerHTML = filtered.length === 0
            ? emptyState('📋', '該当する案件がありません')
            : filtered.map(c => renderCaseCard(c)).join('');
        } else {
          const searched = filtered.filter(c =>
            (c.title || '').toLowerCase().includes(query) ||
            (c.site_address || '').toLowerCase().includes(query) ||
            (c.description || '').toLowerCase().includes(query)
          );
          listEl.innerHTML = searched.length === 0
            ? emptyState('🔍', '検索結果がありません')
            : searched.map(c => renderCaseCard(c)).join('');
        }
        bindCaseCardEvents(container);
      }, 300);
    });
  }

  // イベント: 案件追加
  container.querySelector('#btnAddCase')?.addEventListener('click', () => {
    navigate('cases', { action: 'add_case' });
  });

  // イベント: 案件受取（管理者のみ）
  container.querySelector('#btnAcceptCase')?.addEventListener('click', () => {
    showAcceptCaseModal();
  });

  bindCaseCardEvents(container);
}

function renderCaseCard(c) {
  const staffNames = getAssignedStaffNames(c.latest_order);
  const icon = CONFIG.STATUS_ICONS[c.tkbs_status] || '📋';

  return `
    <div class="case-card" data-case-id="${c.id}"
      style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;transition:border-color 0.2s;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${icon} ${escapeHtml(c.title || '無題')}
          </div>
          ${c.site_address ? `<div style="font-size:12px;color:#5a6272;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📍 ${escapeHtml(c.site_address)}</div>` : ''}
        </div>
        <div style="margin-left:8px;flex-shrink:0;">
          ${statusBadge(c.tkbs_status)}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:#5a6272;">
          ${staffNames ? `👷 ${escapeHtml(staffNames)}` : '担当未定'}
        </div>
        <div style="font-size:11px;color:#5a6272;">
          ${c.work_orders.length > 0 ? `作業指示: ${c.work_orders.length}件` : ''}
        </div>
      </div>
    </div>
  `;
}

function bindCaseCardEvents(container) {
  container.querySelectorAll('.case-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate('cases', { action: 'detail', id: card.dataset.caseId });
    });
  });
}

function getAssignedStaffNames(order) {
  if (!order?.staff_ids || order.staff_ids.length === 0) return '';
  return order.staff_ids.map(id => {
    const s = getAllStaff().find(st => st.id === id);
    return s ? s.name : id;
  }).join('、');
}

// =============================================
// 案件受取モーダル（管理者のみ）
// =============================================

async function showAcceptCaseModal() {
  if (!isAdmin()) {
    showToast('管理者のみ実行できます');
    return;
  }

  // アスカラから受付状態の動産案件を取得
  const pendingCases = await getAskCases({ category: '動産（モノ）', status: '受付' });

  if (pendingCases.length === 0) {
    showToast('受取可能な案件はありません');
    return;
  }

  const bodyHtml = `
    <div style="max-height:400px;overflow-y:auto;">
      <p style="color:#5a6272;font-size:12px;margin-bottom:12px;">アスカラから受け取る案件を選択してください</p>
      ${pendingCases.map(c => `
        <label class="accept-item" data-id="${c.id}"
          style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;margin-bottom:8px;cursor:pointer;">
          <input type="checkbox" value="${c.id}" style="margin-top:2px;accent-color:#006B3F;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:#ffffff;margin-bottom:2px;">${escapeHtml(c.title || '無題')}</div>
            ${c.site_address ? `<div style="font-size:11px;color:#5a6272;">📍 ${escapeHtml(c.site_address)}</div>` : ''}
            ${c.description ? `<div style="font-size:11px;color:#5a6272;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.description)}</div>` : ''}
          </div>
        </label>
      `).join('')}
    </div>
  `;

  const modal = showModal('案件受取', bodyHtml, [
    { label: '受け取る', action: 'accept', color: '#3498db' },
  ]);

  modal.querySelector('.modal-btn[data-action="accept"]')?.addEventListener('click', async () => {
    const checked = modal.querySelectorAll('input[type="checkbox"]:checked');
    if (checked.length === 0) {
      showToast('案件を選択してください');
      return;
    }

    const caseIds = Array.from(checked).map(cb => cb.value);

    for (const caseId of caseIds) {
      // 作業指示を「案件受取」ステータスで作成
      await createWorkOrder({
        case_id: caseId,
        status: '案件受取',
        created_by: getCurrentStaff()?.id,
        staff_ids: [],
        tools: [],
        instructions: '',
        checklist_template: [],
      });
    }

    modal.remove();
    showToast(`${caseIds.length}件の案件を受け取りました`);
    navigate('cases', { tab: 'active' });
  });
}

// =============================================
// 案件詳細
// =============================================

async function renderCaseDetail(container, params = {}) {
  const caseId = params.id;
  if (!caseId) {
    container.innerHTML = emptyState('❓', '案件IDが指定されていません');
    return;
  }

  showLoading(container, '案件情報を読み込み中...');

  const [askCase, workOrders] = await Promise.all([
    getAskCase(caseId),
    getWorkOrders({ case_id: caseId }),
  ]);

  if (!askCase) {
    container.innerHTML = emptyState('❓', '案件が見つかりませんでした');
    return;
  }

  // 連絡先取得
  let contact = null;
  if (askCase.contact_id) {
    contact = await getAskContact(askCase.contact_id);
  }

  const sortedOrders = workOrders.sort((a, b) =>
    new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );

  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="btnBack" style="background:none;border:none;color:#5a6272;font-size:18px;cursor:pointer;padding:4px;">←</button>
        <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(askCase.title || '無題')}</h2>
        ${isAdmin() ? `<button id="btnNewOrder" style="background:#006B3F;color:#ffffff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;">+ 作業指示</button>` : ''}
      </div>

      <!-- 案件情報 -->
      <div style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:16px;margin-bottom:16px;">
        <div style="font-size:13px;font-weight:700;color:#006B3F;margin-bottom:12px;">案件情報</div>
        ${renderDetailRow('案件名', askCase.title)}
        ${renderDetailRow('カテゴリ', askCase.category)}
        ${askCase.subcategory ? renderDetailRow('種別', askCase.subcategory) : ''}
        ${askCase.site_address ? renderDetailRow('現場住所', askCase.site_address) : ''}
        ${askCase.description ? renderDetailRow('説明', askCase.description) : ''}
        ${askCase.source ? renderDetailRow('登録元', askCase.source === 'tkb_saisei' ? '現場追加' : 'アスカラ') : ''}
        ${renderDetailRow('登録日', formatDateFull(askCase.created_at))}
      </div>

      <!-- 連絡先 -->
      ${contact ? `
        <div style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:700;color:#006B3F;margin-bottom:12px;">連絡先</div>
          ${renderDetailRow('氏名', contact.name)}
          ${contact.phone ? renderDetailRow('電話番号', contact.phone, true) : ''}
          ${contact.type ? renderDetailRow('種別', contact.type) : ''}
          ${contact.note ? renderDetailRow('備考', contact.note) : ''}
        </div>
      ` : ''}

      <!-- ステータス変更（管理者のみ） -->
      ${isAdmin() && sortedOrders.length > 0 ? renderStatusChangeSection(sortedOrders[0]) : ''}

      <!-- 作業指示一覧 -->
      <div style="margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:10px;">作業指示 (${sortedOrders.length}件)</div>
        ${sortedOrders.length === 0
          ? `<div style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:20px;text-align:center;color:#5a6272;font-size:13px;">作業指示はまだありません</div>`
          : sortedOrders.map(o => renderWorkOrderCard(o)).join('')
        }
      </div>
    </div>
  `;

  // イベント: 戻る
  container.querySelector('#btnBack')?.addEventListener('click', () => {
    navigate('cases');
  });

  // イベント: 作業指示作成
  container.querySelector('#btnNewOrder')?.addEventListener('click', () => {
    navigate('cases', { action: 'new_order', case_id: caseId, case_title: askCase.title, subcategory: askCase.subcategory });
  });

  // イベント: 電話リンク
  container.querySelectorAll('[data-phone]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `tel:${el.dataset.phone}`;
    });
  });

  // イベント: ステータス変更
  bindStatusChangeEvents(container, sortedOrders[0], caseId);

  // イベント: 作業指示カード
  container.querySelectorAll('.work-order-card').forEach(card => {
    card.addEventListener('click', () => {
      navigate('worksite', { action: 'detail', id: card.dataset.orderId });
    });
  });
}

function renderDetailRow(label, value, isPhone = false) {
  if (!value) return '';
  const displayValue = isPhone
    ? `<span data-phone="${escapeHtml(value)}" style="color:#3498db;text-decoration:underline;cursor:pointer;">${escapeHtml(value)}</span>`
    : escapeHtml(value);
  return `
    <div style="display:flex;margin-bottom:8px;font-size:13px;">
      <div style="color:#5a6272;min-width:80px;flex-shrink:0;">${escapeHtml(label)}</div>
      <div style="color:#1C2541;flex:1;word-break:break-all;">${displayValue}</div>
    </div>
  `;
}

function renderStatusChangeSection(latestOrder) {
  if (!latestOrder) return '';

  const adminStatuses = ['見積提出', '受注確定'];
  const allStatuses = [...CONFIG.STATUS_FLOW, '保留', '追加作業発生', 'キャンセル'];
  const currentIdx = CONFIG.STATUS_FLOW.indexOf(latestOrder.status);

  return `
    <div style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:13px;font-weight:700;color:#006B3F;margin-bottom:12px;">ステータス変更</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:12px;color:#5a6272;">現在:</span>
        ${statusBadge(latestOrder.status)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;" id="statusButtons">
        ${allStatuses.filter(s => s !== latestOrder.status).map(s => {
          const isAdminOnly = adminStatuses.includes(s);
          const icon = CONFIG.STATUS_ICONS[s] || '';
          return `
            <button class="status-change-btn" data-status="${s}" data-order-id="${latestOrder.id}"
              style="padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;border:1px solid #dde0e6;background:#F8F5EE;color:#1C2541;cursor:pointer;white-space:nowrap;">
              ${icon} ${s}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function bindStatusChangeEvents(container, latestOrder, caseId) {
  container.querySelectorAll('.status-change-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newStatus = btn.dataset.status;
      const orderId = btn.dataset.orderId;

      // 管理者限定ステータスのチェック
      const adminOnly = ['見積提出', '受注確定'];
      if (adminOnly.includes(newStatus) && !isAdmin()) {
        showToast('このステータスは管理者のみ変更できます');
        return;
      }

      showConfirm(
        `ステータスを「${newStatus}」に変更しますか？`,
        async () => {
          const result = await updateWorkOrder(orderId, {
            status: newStatus,
            updated_at: new Date().toISOString(),
          });
          if (result) {
            showToast(`ステータスを「${newStatus}」に変更しました`);
            navigate('cases', { action: 'detail', id: caseId });
          } else {
            showToast('ステータス変更に失敗しました');
          }
        }
      );
    });
  });
}

function renderWorkOrderCard(order) {
  const staffNames = getAssignedStaffNames(order);
  const icon = CONFIG.STATUS_ICONS[order.status] || '📋';

  return `
    <div class="work-order-card" data-order-id="${order.id}"
      style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:14px;margin-bottom:8px;cursor:pointer;transition:border-color 0.2s;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:13px;font-weight:600;color:#ffffff;">
          ${icon} ${order.work_date ? formatDateFull(order.work_date) : '日程未定'}
          ${order.work_time ? ` ${escapeHtml(order.work_time)}` : ''}
        </div>
        ${statusBadge(order.status)}
      </div>
      <div style="font-size:12px;color:#5a6272;">
        ${staffNames ? `👷 ${escapeHtml(staffNames)}` : '担当未定'}
      </div>
      ${order.instructions ? `
        <div style="font-size:11px;color:#5a6272;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          📝 ${escapeHtml(order.instructions)}
        </div>
      ` : ''}
    </div>
  `;
}

// =============================================
// 作業指示の作成（管理者のみ）
// =============================================

async function renderNewWorkOrder(container, params = {}) {
  if (!isAdmin()) {
    container.innerHTML = emptyState('🔒', '管理者のみ作業指示を作成できます');
    return;
  }

  const caseId = params.case_id;
  const caseTitle = params.case_title || '';
  const subcategory = params.subcategory || '';

  if (!caseId) {
    container.innerHTML = emptyState('❓', '案件IDが指定されていません');
    return;
  }

  // チェックリストテンプレート決定
  const templateKey = CONFIG.CHECKLIST_TEMPLATES[subcategory] ? subcategory : 'デフォルト';
  const templateItems = CONFIG.CHECKLIST_TEMPLATES[templateKey] || CONFIG.CHECKLIST_TEMPLATES['デフォルト'];

  const allStaff = getAllStaff();
  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="btnBack" style="background:none;border:none;color:#5a6272;font-size:18px;cursor:pointer;padding:4px;">←</button>
        <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">作業指示の作成</h2>
      </div>

      <!-- 案件名表示 -->
      <div style="background:#ffffff;border:1px solid #dde0e6;border-radius:12px;padding:12px;margin-bottom:16px;">
        <div style="font-size:11px;color:#5a6272;margin-bottom:4px;">対象案件</div>
        <div style="font-size:14px;color:#ffffff;font-weight:600;">${escapeHtml(caseTitle)}</div>
        ${subcategory ? `<div style="font-size:12px;color:#006B3F;margin-top:2px;">${escapeHtml(subcategory)}</div>` : ''}
      </div>

      <form id="orderForm">
        <!-- 作業日 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">作業日 <span style="color:#e74c3c;">*</span></label>
          <input type="date" id="workDate" value="${today}" required
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#F8F5EE;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- 集合時間 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">集合時間</label>
          <input type="time" id="workTime" value="09:00"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#F8F5EE;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- スタッフ選択 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:8px;">担当スタッフ <span style="color:#e74c3c;">*</span></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${allStaff.map(s => `
              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;cursor:pointer;">
                <input type="checkbox" name="staff" value="${s.id}" ${s.role === 'display_only' ? '' : ''} style="accent-color:#006B3F;">
                <span style="font-size:13px;color:#1C2541;">
                  ${s.avatar} ${escapeHtml(s.name)}
                  ${s.role === 'display_only' ? '<span style="font-size:10px;color:#5a6272;">（外部）</span>' : ''}
                </span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 道具 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:8px;">持ち物・道具</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${CONFIG.DEFAULT_TOOLS.map(tool => `
              <label style="display:flex;align-items:center;gap:4px;padding:6px 10px;background:#F8F5EE;border:1px solid #dde0e6;border-radius:6px;cursor:pointer;font-size:12px;color:#1C2541;">
                <input type="checkbox" name="tool" value="${escapeHtml(tool)}" style="accent-color:#006B3F;">
                ${escapeHtml(tool)}
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 作業指示 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">作業指示・特記事項</label>
          <textarea id="instructions" rows="4" placeholder="作業内容、注意事項、お客様への対応など..."
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#F8F5EE;color:#1C2541;font-size:14px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- チェックリスト -->
        <div style="margin-bottom:24px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:8px;">
            チェックリスト
            <span style="font-size:11px;color:#5a6272;font-weight:400;">（テンプレート: ${escapeHtml(templateKey)}）</span>
          </label>
          <div id="checklistItems">
            ${templateItems.map((item, i) => `
              <div class="checklist-row" style="display:flex;align-items:center;gap:8px;padding:8px;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;margin-bottom:6px;">
                <span style="color:#5a6272;font-size:12px;min-width:20px;text-align:center;">${i + 1}</span>
                <input type="text" class="checklist-input" value="${escapeHtml(item)}"
                  style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid #dde0e6;background:transparent;color:#1C2541;font-size:13px;outline:none;">
                <button type="button" class="remove-checklist" data-index="${i}"
                  style="background:none;border:none;color:#e74c3c;font-size:14px;cursor:pointer;padding:4px;">✕</button>
              </div>
            `).join('')}
          </div>
          <button type="button" id="addChecklistItem"
            style="width:100%;padding:8px;border-radius:8px;border:1px dashed #dde0e6;background:transparent;color:#5a6272;font-size:12px;cursor:pointer;margin-top:4px;">
            + 項目を追加
          </button>
        </div>

        <!-- 送信ボタン -->
        <button type="submit" id="btnSubmit"
          style="width:100%;padding:14px;border-radius:10px;background:#006B3F;color:#ffffff;border:none;font-size:15px;font-weight:700;cursor:pointer;">
          作業指示を作成
        </button>
      </form>
    </div>
  `;

  // イベント: 戻る
  container.querySelector('#btnBack')?.addEventListener('click', () => {
    navigate('cases', { action: 'detail', id: caseId });
  });

  // イベント: チェックリスト項目削除
  container.querySelectorAll('.remove-checklist').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.checklist-row').remove();
      renumberChecklist(container);
    });
  });

  // イベント: チェックリスト項目追加
  container.querySelector('#addChecklistItem')?.addEventListener('click', () => {
    const listEl = container.querySelector('#checklistItems');
    const count = listEl.querySelectorAll('.checklist-row').length;
    const row = document.createElement('div');
    row.className = 'checklist-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;margin-bottom:6px;';
    row.innerHTML = `
      <span style="color:#5a6272;font-size:12px;min-width:20px;text-align:center;">${count + 1}</span>
      <input type="text" class="checklist-input" value="" placeholder="項目名..."
        style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid #dde0e6;background:transparent;color:#1C2541;font-size:13px;outline:none;">
      <button type="button" class="remove-checklist"
        style="background:none;border:none;color:#e74c3c;font-size:14px;cursor:pointer;padding:4px;">✕</button>
    `;
    listEl.appendChild(row);
    row.querySelector('.remove-checklist').addEventListener('click', () => {
      row.remove();
      renumberChecklist(container);
    });
    row.querySelector('.checklist-input').focus();
  });

  // イベント: フォーム送信
  container.querySelector('#orderForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const workDate = container.querySelector('#workDate')?.value;
    const workTime = container.querySelector('#workTime')?.value || '';
    const staffIds = Array.from(container.querySelectorAll('input[name="staff"]:checked')).map(cb => cb.value);
    const tools = Array.from(container.querySelectorAll('input[name="tool"]:checked')).map(cb => cb.value);
    const instructions = container.querySelector('#instructions')?.value?.trim() || '';
    const checklistItems = Array.from(container.querySelectorAll('.checklist-input'))
      .map(inp => inp.value.trim())
      .filter(v => v);

    // バリデーション
    if (!workDate) {
      showToast('作業日を入力してください');
      return;
    }
    if (staffIds.length === 0) {
      showToast('担当スタッフを1人以上選択してください');
      return;
    }

    const submitBtn = container.querySelector('#btnSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '作成中...';

    const checklistTemplate = checklistItems.map(item => ({ label: item, checked: false }));

    const result = await createWorkOrder({
      case_id: caseId,
      status: '作業計画',
      work_date: workDate,
      work_time: workTime,
      staff_ids: staffIds,
      tools: tools,
      instructions: instructions,
      checklist_template: checklistTemplate,
      created_by: getCurrentStaff()?.id,
    });

    if (result) {
      showToast('作業指示を作成しました');
      navigate('cases', { action: 'detail', id: caseId });
    } else {
      showToast('作業指示の作成に失敗しました');
      submitBtn.disabled = false;
      submitBtn.textContent = '作業指示を作成';
    }
  });
}

function renumberChecklist(container) {
  container.querySelectorAll('.checklist-row').forEach((row, i) => {
    const numEl = row.querySelector('span');
    if (numEl) numEl.textContent = i + 1;
  });
}

// =============================================
// 案件追加（現場から）
// =============================================

async function renderAddCase(container, params = {}) {
  showLoading(container, '準備中...');

  // 連絡先リストを取得（選択用）
  const { getAskContacts } = await import('../core/db.js');
  const contacts = await getAskContacts({ limit: 100 });

  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="btnBack" style="background:none;border:none;color:#5a6272;font-size:18px;cursor:pointer;padding:4px;">←</button>
        <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">案件の追加登録</h2>
      </div>

      <div style="background:#F8F5EE;border:1px solid #006B3F66;border-radius:8px;padding:10px 12px;margin-bottom:16px;">
        <div style="font-size:12px;color:#006B3F;">📍 現場からの追加登録です。アスカラにも自動反映されます。</div>
      </div>

      <form id="caseForm">
        <!-- 案件名 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">案件名 <span style="color:#e74c3c;">*</span></label>
          <input type="text" id="caseTitle" required placeholder="例：○○様邸 片付け作業"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- 種別 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">種別 <span style="color:#e74c3c;">*</span></label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${DOUSAN_SUBCATEGORIES.map(sub => `
              <label style="display:flex;align-items:center;gap:8px;padding:10px;background:#ffffff;border:1px solid #dde0e6;border-radius:8px;cursor:pointer;">
                <input type="radio" name="subcategory" value="${escapeHtml(sub)}" required style="accent-color:#006B3F;">
                <span style="font-size:13px;color:#1C2541;">${escapeHtml(sub)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 説明 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">説明・メモ</label>
          <textarea id="caseDescription" rows="3" placeholder="案件の詳細、お客様の要望など..."
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- 現場住所 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">現場住所</label>
          <input type="text" id="siteAddress" placeholder="例：東京都○○区○○町1-2-3"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- 連絡先選択 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">連絡先</label>
          <select id="contactSelect"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;appearance:auto;">
            <option value="">-- 選択してください --</option>
            ${contacts.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.phone ? ` (${escapeHtml(c.phone)})` : ''}</option>`).join('')}
          </select>
          <button type="button" id="btnNewContact"
            style="margin-top:8px;background:none;border:1px dashed #dde0e6;border-radius:8px;padding:8px 12px;color:#5a6272;font-size:12px;cursor:pointer;width:100%;">
            + 新しい連絡先を登録
          </button>
        </div>

        <!-- 送信ボタン -->
        <button type="submit" id="btnSubmitCase"
          style="width:100%;padding:14px;border-radius:10px;background:#006B3F;color:#ffffff;border:none;font-size:15px;font-weight:700;cursor:pointer;">
          案件を登録
        </button>
      </form>
    </div>
  `;

  // イベント: 戻る
  container.querySelector('#btnBack')?.addEventListener('click', () => {
    navigate('cases');
  });

  // イベント: 新しい連絡先
  container.querySelector('#btnNewContact')?.addEventListener('click', () => {
    navigate('cases', { action: 'add_contact', return_to: 'add_case' });
  });

  // イベント: フォーム送信
  container.querySelector('#caseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = container.querySelector('#caseTitle')?.value?.trim();
    const subcategory = container.querySelector('input[name="subcategory"]:checked')?.value;
    const description = container.querySelector('#caseDescription')?.value?.trim() || '';
    const siteAddress = container.querySelector('#siteAddress')?.value?.trim() || '';
    const contactId = container.querySelector('#contactSelect')?.value || null;

    if (!title) {
      showToast('案件名を入力してください');
      return;
    }
    if (!subcategory) {
      showToast('種別を選択してください');
      return;
    }

    const submitBtn = container.querySelector('#btnSubmitCase');
    submitBtn.disabled = true;
    submitBtn.textContent = '登録中...';

    const result = await createAskCase({
      title: title,
      category: '動産（モノ）',
      subcategory: subcategory,
      description: description,
      site_address: siteAddress,
      contact_id: contactId,
      created_by: getCurrentStaff()?.id,
    });

    if (result) {
      showToast('案件を登録しました');
      navigate('cases', { action: 'detail', id: result.id });
    } else {
      showToast('案件の登録に失敗しました');
      submitBtn.disabled = false;
      submitBtn.textContent = '案件を登録';
    }
  });
}

// =============================================
// 連絡先追加（現場から）
// =============================================

async function renderAddContact(container, params = {}) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;">
      <!-- ヘッダー -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <button id="btnBack" style="background:none;border:none;color:#5a6272;font-size:18px;cursor:pointer;padding:4px;">←</button>
        <h2 style="color:#ffffff;font-size:16px;font-weight:700;margin:0;">連絡先の追加登録</h2>
      </div>

      <div style="background:#F8F5EE;border:1px solid #006B3F66;border-radius:8px;padding:10px 12px;margin-bottom:16px;">
        <div style="font-size:12px;color:#006B3F;">📍 現場からの追加登録です。アスカラにも自動反映されます。</div>
      </div>

      <form id="contactForm">
        <!-- 氏名 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">氏名 <span style="color:#e74c3c;">*</span></label>
          <input type="text" id="contactName" required placeholder="例：山田太郎"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- 電話番号 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">電話番号</label>
          <input type="tel" id="contactPhone" placeholder="例：090-1234-5678"
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;box-sizing:border-box;">
        </div>

        <!-- 種別 -->
        <div style="margin-bottom:16px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">種別</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${CONTACT_TYPES.map(type => `
              <label style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#ffffff;border:1px solid #dde0e6;border-radius:8px;cursor:pointer;">
                <input type="radio" name="contactType" value="${escapeHtml(type)}" style="accent-color:#006B3F;">
                <span style="font-size:13px;color:#1C2541;">${escapeHtml(type)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- 備考 -->
        <div style="margin-bottom:24px;">
          <label style="display:block;font-size:13px;font-weight:600;color:#1C2541;margin-bottom:6px;">備考</label>
          <textarea id="contactNote" rows="3" placeholder="紹介元、関係性など..."
            style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid #dde0e6;background:#ffffff;color:#1C2541;font-size:14px;outline:none;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- 送信ボタン -->
        <button type="submit" id="btnSubmitContact"
          style="width:100%;padding:14px;border-radius:10px;background:#006B3F;color:#ffffff;border:none;font-size:15px;font-weight:700;cursor:pointer;">
          連絡先を登録
        </button>
      </form>
    </div>
  `;

  // イベント: 戻る
  container.querySelector('#btnBack')?.addEventListener('click', () => {
    if (params.return_to === 'add_case') {
      navigate('cases', { action: 'add_case' });
    } else {
      navigate('cases');
    }
  });

  // イベント: フォーム送信
  container.querySelector('#contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = container.querySelector('#contactName')?.value?.trim();
    const phone = container.querySelector('#contactPhone')?.value?.trim() || '';
    const type = container.querySelector('input[name="contactType"]:checked')?.value || '';
    const note = container.querySelector('#contactNote')?.value?.trim() || '';

    if (!name) {
      showToast('氏名を入力してください');
      return;
    }

    const submitBtn = container.querySelector('#btnSubmitContact');
    submitBtn.disabled = true;
    submitBtn.textContent = '登録中...';

    const result = await createAskContact({
      name: name,
      phone: phone,
      type: type,
      note: note,
      created_by: getCurrentStaff()?.id,
    });

    if (result) {
      showToast('連絡先を登録しました');
      if (params.return_to === 'add_case') {
        navigate('cases', { action: 'add_case' });
      } else {
        navigate('cases');
      }
    } else {
      showToast('連絡先の登録に失敗しました');
      submitBtn.disabled = false;
      submitBtn.textContent = '連絡先を登録';
    }
  });
}
