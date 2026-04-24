/**
 * テイクバック再生 v2 - マイページ
 * 出退勤・経費登録・メンバー情報・設定
 */
import { CONFIG } from '../core/config.js';
import { getAttendance, getAttendanceByDate, upsertAttendance, getExpenses, createExpense } from '../core/db.js';
import { showToast, showLoading, showConfirm, showModal, emptyState, escapeHtml, formatDate, formatTime, formatDuration, formatPrice } from '../core/ui.js';
import { getCurrentStaff, isAdmin, getAllStaff, getStaffById, logout } from '../core/auth.js';

// --- ユーティリティ ---

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function nowISO() {
  return new Date().toISOString();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function timeFromISO(isoStr) {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function calcWorkMinutes(clockIn, clockOut, breakMin = 0) {
  if (!clockIn || !clockOut) return 0;
  const diff = (new Date(clockOut) - new Date(clockIn)) / 60000;
  return Math.max(0, Math.round(diff - (breakMin || 0)));
}

function getRecentDates(days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// --- メインレンダー ---

export function renderMyPage(container, params = {}) {
  const staff = getCurrentStaff();
  if (!staff) {
    container.innerHTML = emptyState('🔒', 'ログインしてください');
    return;
  }

  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div style="margin-bottom:20px;">
        <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 4px;">マイページ</h1>
        <p style="color:#5a6272;font-size:13px;margin:0;">${escapeHtml(staff.name)}さん</p>
      </div>
      <div id="mypageSections"></div>
    </div>
  `;

  const sections = container.querySelector('#mypageSections');
  renderSectionCards(sections, staff);
}

// --- セクションカード一覧 ---

function renderSectionCards(container, staff) {
  const cards = [
    { id: 'attendance', icon: '🕐', title: '出退勤', desc: '出勤・退勤の打刻' },
    { id: 'expenses', icon: '💰', title: '経費登録', desc: '経費の記録・管理' },
    { id: 'members', icon: '👥', title: 'メンバー情報', desc: 'スタッフ一覧' },
    { id: 'settings', icon: '⚙️', title: '設定', desc: 'アカウント・ログアウト' },
  ];

  container.innerHTML = cards.map(c => `
    <div class="mypage-card" data-section="${c.id}" style="background:#ffffff;border-radius:12px;padding:16px;margin-bottom:12px;cursor:pointer;border:1px solid #dde0e6;transition:all 0.2s;display:flex;align-items:center;gap:14px;">
      <div style="font-size:28px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:#F8F5EE;border-radius:10px;flex-shrink:0;">${c.icon}</div>
      <div style="flex:1;min-width:0;">
        <div style="color:#fff;font-size:15px;font-weight:600;">${c.title}</div>
        <div style="color:#5a6272;font-size:12px;margin-top:2px;">${c.desc}</div>
      </div>
      <div style="color:#5a6272;font-size:18px;">›</div>
    </div>
  `).join('');

  container.querySelectorAll('.mypage-card').forEach(card => {
    card.addEventListener('click', () => {
      const section = card.dataset.section;
      openSection(container, staff, section);
    });
  });
}

// --- セクション展開 ---

function openSection(container, staff, sectionId) {
  const backBar = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <button class="mypage-back" style="background:none;border:none;color:#C5A258;font-size:14px;cursor:pointer;padding:4px 0;display:flex;align-items:center;gap:4px;">
        ← 戻る
      </button>
    </div>
  `;

  switch (sectionId) {
    case 'attendance': renderAttendanceSection(container, staff, backBar); break;
    case 'expenses': renderExpensesSection(container, staff, backBar); break;
    case 'members': renderMembersSection(container, staff, backBar); break;
    case 'settings': renderSettingsSection(container, staff, backBar); break;
  }
}

function attachBack(container, staff) {
  const btn = container.querySelector('.mypage-back');
  if (btn) {
    btn.addEventListener('click', () => renderSectionCards(container, staff));
  }
}

// =============================================
// 1. 出退勤セクション
// =============================================

async function renderAttendanceSection(container, staff, backBar) {
  container.innerHTML = backBar + '<div id="attendanceContent"></div>';
  attachBack(container, staff);

  const content = container.querySelector('#attendanceContent');
  showLoading(content, '勤怠データを読み込み中...');

  const today = todayStr();
  const attendance = await getAttendance(staff.id, today);
  const isClockedIn = attendance?.clock_in && !attendance?.clock_out;
  const isDone = attendance?.clock_in && attendance?.clock_out;

  let html = '';

  // --- 出勤/退勤ボタン ---
  html += `<div style="margin-bottom:20px;">`;

  if (!attendance?.clock_in) {
    // 未出勤
    html += `
      <div style="text-align:center;margin-bottom:12px;color:#5a6272;font-size:13px;">未出勤</div>
      <button id="btnClockIn" style="width:100%;padding:20px;border-radius:16px;border:none;font-size:20px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#C5A258,#f39c12);box-shadow:0 4px 20px rgba(230,126,34,0.4);transition:all 0.2s;">
        出勤
      </button>
    `;
  } else if (isClockedIn) {
    // 出勤中
    html += `
      <div style="text-align:center;margin-bottom:8px;">
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;background:#27ae6030;color:#2ecc71;font-size:13px;font-weight:600;">出勤中</span>
      </div>
      <div style="text-align:center;margin-bottom:12px;color:#5a6272;font-size:13px;">
        ${timeFromISO(attendance.clock_in)} から勤務中
      </div>
      <button id="btnClockOut" style="width:100%;padding:20px;border-radius:16px;border:none;font-size:20px;font-weight:700;color:#fff;cursor:pointer;background:linear-gradient(135deg,#27ae60,#2ecc71);box-shadow:0 4px 20px rgba(39,174,96,0.4);transition:all 0.2s;">
        退勤
      </button>
    `;
  } else {
    // 完了
    html += `
      <div style="text-align:center;padding:16px;background:#ffffff;border-radius:12px;border:1px solid #dde0e6;">
        <div style="color:#2ecc71;font-size:14px;font-weight:600;margin-bottom:8px;">本日の勤務完了</div>
        <div style="color:#1C2541;font-size:13px;">
          ${timeFromISO(attendance.clock_in)} 〜 ${timeFromISO(attendance.clock_out)}
        </div>
        <div style="color:#5a6272;font-size:12px;margin-top:4px;">
          勤務時間: ${formatDuration(attendance.work_minutes || 0)}
          ${attendance.break_minutes ? `（休憩: ${attendance.break_minutes}分）` : ''}
        </div>
      </div>
    `;
  }
  html += `</div>`;

  // --- 休憩時間入力 (出勤中のみ) ---
  if (isClockedIn) {
    html += `
      <div style="background:#ffffff;border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid #dde0e6;">
        <label style="color:#5a6272;font-size:12px;display:block;margin-bottom:6px;">休憩時間（分）</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="breakMinutes" type="number" value="${attendance.break_minutes || 0}" min="0" step="15" style="flex:1;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;padding:10px;color:#1C2541;font-size:15px;" />
          <button id="btnSaveBreak" style="background:#dde0e6;border:none;border-radius:8px;padding:10px 16px;color:#1C2541;font-size:13px;cursor:pointer;">保存</button>
        </div>
      </div>
    `;
  }

  // --- 北瀬代理入力 (admin only) ---
  if (isAdmin()) {
    html += await renderKitaseProxy(today);
  }

  // --- 履歴 ---
  html += `<div style="margin-top:20px;">
    <div style="color:#fff;font-size:15px;font-weight:600;margin-bottom:12px;">直近7日の勤怠</div>
    <div id="attendanceHistory"></div>
  </div>`;

  content.innerHTML = html;

  // イベント: 出勤
  const btnIn = content.querySelector('#btnClockIn');
  if (btnIn) {
    btnIn.addEventListener('click', async () => {
      btnIn.disabled = true;
      btnIn.textContent = '処理中...';
      const result = await upsertAttendance({
        staff_id: staff.id,
        date: today,
        clock_in: nowISO(),
      });
      if (result) {
        showToast('出勤しました');
        renderAttendanceSection(container, staff, backBar);
      } else {
        showToast('エラーが発生しました');
        btnIn.disabled = false;
        btnIn.textContent = '出勤';
      }
    });
  }

  // イベント: 退勤
  const btnOut = content.querySelector('#btnClockOut');
  if (btnOut) {
    btnOut.addEventListener('click', () => {
      showConfirm('退勤しますか？', async () => {
        const breakMin = parseInt(content.querySelector('#breakMinutes')?.value) || 0;
        const workMin = calcWorkMinutes(attendance.clock_in, nowISO(), breakMin);
        const result = await upsertAttendance({
          staff_id: staff.id,
          date: today,
          clock_in: attendance.clock_in,
          clock_out: nowISO(),
          break_minutes: breakMin,
          work_minutes: workMin,
        });
        if (result) {
          showToast('退勤しました');
          renderAttendanceSection(container, staff, backBar);
        } else {
          showToast('エラーが発生しました');
        }
      });
    });
  }

  // イベント: 休憩保存
  const btnBreak = content.querySelector('#btnSaveBreak');
  if (btnBreak) {
    btnBreak.addEventListener('click', async () => {
      const breakMin = parseInt(content.querySelector('#breakMinutes')?.value) || 0;
      const result = await upsertAttendance({
        staff_id: staff.id,
        date: today,
        clock_in: attendance.clock_in,
        break_minutes: breakMin,
      });
      if (result) {
        showToast('休憩時間を保存しました');
      } else {
        showToast('エラーが発生しました');
      }
    });
  }

  // 北瀬代理入力イベント
  if (isAdmin()) {
    attachKitaseProxyEvents(content, container, staff, backBar, today);
  }

  // 履歴読み込み
  await loadAttendanceHistory(content.querySelector('#attendanceHistory'), staff.id);
}

// --- 北瀬の代理入力 ---

async function renderKitaseProxy(today) {
  const kitaseAttendance = await getAttendance('kitase', today);
  const kitaseIn = kitaseAttendance?.clock_in && !kitaseAttendance?.clock_out;
  const kitaseDone = kitaseAttendance?.clock_in && kitaseAttendance?.clock_out;
  const currentStaffName = getCurrentStaff()?.name || '';

  let inner = '';

  if (!kitaseAttendance?.clock_in) {
    inner = `
      <button id="btnKitaseIn" style="width:100%;padding:14px;border-radius:12px;border:none;font-size:16px;font-weight:600;color:#fff;cursor:pointer;background:linear-gradient(135deg,#C5A258,#f39c12);box-shadow:0 2px 12px rgba(230,126,34,0.3);">
        北瀬さん 出勤（代理）
      </button>
    `;
  } else if (kitaseIn) {
    inner = `
      <div style="color:#2ecc71;font-size:13px;margin-bottom:8px;">出勤中: ${timeFromISO(kitaseAttendance.clock_in)}〜</div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
        <label style="color:#5a6272;font-size:12px;white-space:nowrap;">休憩（分）:</label>
        <input id="kitaseBreak" type="number" value="${kitaseAttendance.break_minutes || 0}" min="0" step="15" style="flex:1;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;padding:8px;color:#1C2541;font-size:14px;" />
      </div>
      <button id="btnKitaseOut" style="width:100%;padding:14px;border-radius:12px;border:none;font-size:16px;font-weight:600;color:#fff;cursor:pointer;background:linear-gradient(135deg,#27ae60,#2ecc71);">
        北瀬さん 退勤（代理）
      </button>
    `;
  } else {
    inner = `
      <div style="color:#5a6272;font-size:13px;">
        ${timeFromISO(kitaseAttendance.clock_in)} 〜 ${timeFromISO(kitaseAttendance.clock_out)}
        ／ ${formatDuration(kitaseAttendance.work_minutes || 0)}
      </div>
    `;
  }

  return `
    <div style="background:#1a1a2e;border-radius:12px;padding:14px;margin-bottom:16px;border:1px solid #C5A25840;">
      <div style="color:#C5A258;font-size:13px;font-weight:600;margin-bottom:10px;">北瀬さんの代理入力</div>
      ${inner}
    </div>
  `;
}

function attachKitaseProxyEvents(content, container, staff, backBar, today) {
  const currentStaffName = getCurrentStaff()?.name || '';

  const btnKitaseIn = content.querySelector('#btnKitaseIn');
  if (btnKitaseIn) {
    btnKitaseIn.addEventListener('click', async () => {
      btnKitaseIn.disabled = true;
      btnKitaseIn.textContent = '処理中...';
      const result = await upsertAttendance({
        staff_id: 'kitase',
        date: today,
        clock_in: nowISO(),
        is_proxy: true,
        proxy_by: currentStaffName,
      });
      if (result) {
        showToast('北瀬さんの出勤を記録しました');
        renderAttendanceSection(container, staff, backBar);
      } else {
        showToast('エラーが発生しました');
        btnKitaseIn.disabled = false;
        btnKitaseIn.textContent = '北瀬さん 出勤（代理）';
      }
    });
  }

  const btnKitaseOut = content.querySelector('#btnKitaseOut');
  if (btnKitaseOut) {
    btnKitaseOut.addEventListener('click', async () => {
      const kitaseAttendance = await getAttendance('kitase', today);
      const breakMin = parseInt(content.querySelector('#kitaseBreak')?.value) || 0;
      const workMin = calcWorkMinutes(kitaseAttendance.clock_in, nowISO(), breakMin);
      const result = await upsertAttendance({
        staff_id: 'kitase',
        date: today,
        clock_in: kitaseAttendance.clock_in,
        clock_out: nowISO(),
        break_minutes: breakMin,
        work_minutes: workMin,
        is_proxy: true,
        proxy_by: currentStaffName,
      });
      if (result) {
        showToast('北瀬さんの退勤を記録しました');
        renderAttendanceSection(container, staff, backBar);
      } else {
        showToast('エラーが発生しました');
      }
    });
  }
}

// --- 勤怠履歴 ---

async function loadAttendanceHistory(historyContainer, staffId) {
  if (!historyContainer) return;
  const dates = getRecentDates(7);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  let rows = '';

  for (const dateStr of dates) {
    const att = await getAttendance(staffId, dateStr);
    const d = new Date(dateStr + 'T00:00:00');
    const dayLabel = `${d.getMonth() + 1}/${d.getDate()}（${dayNames[d.getDay()]}）`;
    const clockIn = att?.clock_in ? timeFromISO(att.clock_in) : '--:--';
    const clockOut = att?.clock_out ? timeFromISO(att.clock_out) : '--:--';
    const duration = att?.work_minutes ? formatDuration(att.work_minutes) : '--';
    const isToday = dateStr === todayStr();

    rows += `
      <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid #dde0e620;gap:8px;">
        <div style="width:80px;color:${isToday ? '#C5A258' : '#1C2541'};font-size:13px;font-weight:${isToday ? '600' : '400'};">${dayLabel}</div>
        <div style="flex:1;color:#5a6272;font-size:13px;">${clockIn} 〜 ${clockOut}</div>
        <div style="color:#1C2541;font-size:13px;font-weight:500;min-width:60px;text-align:right;">${duration}</div>
      </div>
    `;
  }

  historyContainer.innerHTML = rows || `<div style="color:#5a6272;font-size:13px;text-align:center;padding:16px;">データなし</div>`;
}

// =============================================
// 2. 経費セクション
// =============================================

async function renderExpensesSection(container, staff, backBar) {
  container.innerHTML = backBar + '<div id="expenseContent"></div>';
  attachBack(container, staff);

  const content = container.querySelector('#expenseContent');
  showLoading(content, '経費データを読み込み中...');

  const expenses = await getExpenses({ recorded_by: staff.id, limit: 20 });

  let html = `
    <button id="btnAddExpense" style="width:100%;padding:14px;border-radius:12px;border:2px dashed #dde0e6;background:transparent;color:#C5A258;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:16px;transition:all 0.2s;">
      + 経費を追加
    </button>
    <div style="color:#fff;font-size:15px;font-weight:600;margin-bottom:12px;">最近の経費</div>
    <div id="expenseList"></div>
  `;

  content.innerHTML = html;

  // 経費リスト
  const listEl = content.querySelector('#expenseList');
  if (expenses.length === 0) {
    listEl.innerHTML = emptyState('💰', '経費の記録はありません');
  } else {
    listEl.innerHTML = expenses.map(exp => {
      const catColors = {
        '材料費': '#3498db', '交通費': '#27ae60', '廃棄費': '#CE2029',
        '食費': '#f39c12', '道具': '#9b59b6', 'その他': '#5a6272',
      };
      const catColor = catColors[exp.category] || '#5a6272';
      return `
        <div style="background:#ffffff;border-radius:10px;padding:12px;margin-bottom:8px;border:1px solid #dde0e6;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:12px;font-weight:600;background:${catColor}20;color:${catColor};border:1px solid ${catColor}40;">${escapeHtml(exp.category)}</span>
              <span style="color:#1C2541;font-size:15px;font-weight:600;">${formatPrice(exp.amount)}</span>
            </div>
            <span style="color:#5a6272;font-size:12px;">${formatDate(exp.expense_date || exp.created_at)}</span>
          </div>
          ${exp.description ? `<div style="color:#5a6272;font-size:12px;">${escapeHtml(exp.description)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  // 追加ボタン
  content.querySelector('#btnAddExpense').addEventListener('click', () => {
    openExpenseForm(container, staff, backBar);
  });
}

// --- 経費入力フォーム ---

async function openExpenseForm(container, staff, backBar) {
  const content = container.querySelector('#expenseContent');
  if (!content) return;

  // 案件リスト取得は省略（オプション）
  const categories = CONFIG.EXPENSE_CATEGORIES;

  const formHtml = `
    <div style="background:#ffffff;border-radius:12px;padding:16px;border:1px solid #dde0e6;">
      <div style="color:#fff;font-size:15px;font-weight:600;margin-bottom:14px;">経費を追加</div>

      <div style="margin-bottom:12px;">
        <label style="color:#5a6272;font-size:12px;display:block;margin-bottom:4px;">金額 *</label>
        <input id="expAmount" type="number" placeholder="0" min="0" style="width:100%;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;padding:12px;color:#1C2541;font-size:18px;font-weight:600;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:12px;">
        <label style="color:#5a6272;font-size:12px;display:block;margin-bottom:4px;">カテゴリ *</label>
        <select id="expCategory" style="width:100%;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;padding:12px;color:#1C2541;font-size:14px;box-sizing:border-box;">
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom:12px;">
        <label style="color:#5a6272;font-size:12px;display:block;margin-bottom:4px;">内容</label>
        <input id="expDescription" type="text" placeholder="メモ（任意）" style="width:100%;background:#F8F5EE;border:1px solid #dde0e6;border-radius:8px;padding:12px;color:#1C2541;font-size:14px;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:14px;">
        <label style="color:#5a6272;font-size:12px;display:block;margin-bottom:4px;">レシート写真（OCR対応）</label>
        <div style="display:flex;gap:8px;">
          <label id="receiptLabel" style="flex:1;padding:12px;border-radius:8px;border:2px dashed #dde0e6;text-align:center;cursor:pointer;color:#5a6272;font-size:13px;transition:all 0.2s;">
            📷 写真を選択
            <input id="expReceipt" type="file" accept="image/*" capture="environment" style="display:none;" />
          </label>
        </div>
        <div id="ocrStatus" style="margin-top:6px;font-size:12px;color:#5a6272;display:none;"></div>
        <div id="receiptPreview" style="margin-top:8px;display:none;">
          <img id="receiptImg" style="max-width:100%;border-radius:8px;border:1px solid #dde0e6;" />
        </div>
      </div>

      <div style="display:flex;gap:8px;">
        <button id="btnExpCancel" style="flex:1;padding:12px;border-radius:8px;background:#dde0e6;color:#5a6272;border:none;font-size:14px;cursor:pointer;">キャンセル</button>
        <button id="btnExpSave" style="flex:1;padding:12px;border-radius:8px;background:#C5A258;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">保存</button>
      </div>
    </div>
  `;

  content.innerHTML = formHtml;

  // レシート写真 + OCR
  const receiptInput = content.querySelector('#expReceipt');
  const ocrStatus = content.querySelector('#ocrStatus');
  const receiptPreview = content.querySelector('#receiptPreview');
  const receiptImg = content.querySelector('#receiptImg');
  const receiptLabel = content.querySelector('#receiptLabel');

  receiptInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // プレビュー表示
    const previewUrl = URL.createObjectURL(file);
    receiptImg.src = previewUrl;
    receiptPreview.style.display = 'block';
    receiptLabel.innerHTML = '📷 写真を変更' + '<input id="expReceipt" type="file" accept="image/*" capture="environment" style="display:none;" />';
    // 新しいinputにも同じイベントを付与
    content.querySelector('#expReceipt').addEventListener('change', arguments.callee);

    // OCR実行
    ocrStatus.style.display = 'block';
    ocrStatus.textContent = 'OCR処理中...';
    ocrStatus.style.color = '#C5A258';

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(CONFIG.AWAI_URL + '/functions/v1/ocr', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + CONFIG.AWAI_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64, type: 'receipt' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.amount) {
          content.querySelector('#expAmount').value = data.amount;
        }
        if (data.description) {
          content.querySelector('#expDescription').value = data.description;
        }
        ocrStatus.textContent = 'OCR完了 - 金額と内容を自動入力しました';
        ocrStatus.style.color = '#2ecc71';
      } else {
        ocrStatus.textContent = 'OCR失敗 - 手動で入力してください';
        ocrStatus.style.color = '#CE2029';
      }
    } catch (err) {
      console.error('OCR error:', err);
      ocrStatus.textContent = 'OCR接続エラー - 手動で入力してください';
      ocrStatus.style.color = '#CE2029';
    }
  });

  // キャンセル
  content.querySelector('#btnExpCancel').addEventListener('click', () => {
    renderExpensesSection(container, staff, backBar);
  });

  // 保存
  content.querySelector('#btnExpSave').addEventListener('click', async () => {
    const amount = parseInt(content.querySelector('#expAmount').value);
    const category = content.querySelector('#expCategory').value;
    const description = content.querySelector('#expDescription').value.trim();

    if (!amount || amount <= 0) {
      showToast('金額を入力してください');
      return;
    }

    const saveBtn = content.querySelector('#btnExpSave');
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';

    const result = await createExpense({
      amount,
      category,
      description: description || null,
      expense_date: todayStr(),
      recorded_by: staff.id,
    });

    if (result) {
      showToast('経費を登録しました');
      renderExpensesSection(container, staff, backBar);
    } else {
      showToast('エラーが発生しました');
      saveBtn.disabled = false;
      saveBtn.textContent = '保存';
    }
  });
}

// =============================================
// 3. メンバー情報セクション
// =============================================

function renderMembersSection(container, staff, backBar) {
  container.innerHTML = backBar + '<div id="membersContent"></div>';
  attachBack(container, staff);

  const content = container.querySelector('#membersContent');
  const members = getAllStaff();

  content.innerHTML = members.map(m => {
    const roleLabel = m.role === 'admin' ? '管理者' : m.role === 'display_only' ? '表示のみ' : '作業員';
    const roleColor = m.role === 'admin' ? '#C5A258' : m.role === 'display_only' ? '#5a6272' : '#3498db';
    const isKitase = m.id === 'kitase';

    return `
      <div style="background:#ffffff;border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid #dde0e6;display:flex;align-items:center;gap:14px;">
        <div style="width:48px;height:48px;background:#f0ede5;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${m.avatar}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="color:#fff;font-size:15px;font-weight:600;">${escapeHtml(m.name)}</span>
            <span style="display:inline-block;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:600;background:${roleColor}20;color:${roleColor};border:1px solid ${roleColor}40;">${roleLabel}</span>
          </div>
          ${isKitase ? '<div style="color:#f39c12;font-size:12px;margin-top:4px;">ガラケーのみ・操作しない</div>' : ''}
          <div style="color:#5a6272;font-size:12px;margin-top:4px;">連絡先: 今後追加予定</div>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================
// 4. 設定セクション
// =============================================

function renderSettingsSection(container, staff, backBar) {
  container.innerHTML = backBar + '<div id="settingsContent"></div>';
  attachBack(container, staff);

  const content = container.querySelector('#settingsContent');
  const roleLabel = staff.role === 'admin' ? '管理者' : '作業員';

  content.innerHTML = `
    <div style="background:#ffffff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #dde0e6;">
      <div style="color:#5a6272;font-size:12px;margin-bottom:8px;">ログイン中のユーザー</div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:48px;height:48px;background:#f0ede5;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;">${staff.avatar}</div>
        <div>
          <div style="color:#fff;font-size:16px;font-weight:600;">${escapeHtml(staff.name)}</div>
          <div style="color:#5a6272;font-size:12px;">${roleLabel}</div>
        </div>
      </div>
    </div>

    <div style="background:#ffffff;border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid #dde0e6;">
      <div style="color:#5a6272;font-size:12px;margin-bottom:4px;">アプリ情報</div>
      <div style="color:#1C2541;font-size:14px;">${escapeHtml(CONFIG.APP_NAME)}</div>
      <div style="color:#5a6272;font-size:12px;margin-top:2px;">バージョン: ${escapeHtml(CONFIG.APP_VERSION)}</div>
    </div>

    <button id="btnLogout" style="width:100%;padding:14px;border-radius:12px;border:1px solid #CE202940;background:#CE202920;color:#CE2029;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;">
      ログアウト
    </button>
  `;

  content.querySelector('#btnLogout').addEventListener('click', () => {
    showConfirm('ログアウトしますか？', () => {
      logout();
      location.reload();
    });
  });
}
