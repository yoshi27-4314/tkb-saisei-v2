/**
 * テイクバック再生 v2 - データベース層
 * Supabase CRUD: tkbs_テーブル + ask_cases/ask_contacts参照
 */
import { CONFIG } from './config.js';

let db = null;
let listeners = new Set();

// ローカル日付（UTC問題回避）
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// --- 初期化 ---
export function initDB() {
  if (!window.supabase) {
    console.error('Supabase JS未読み込み');
    return false;
  }
  db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
  return true;
}

export function getDB() { return db; }

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// =============================================
// アスカラ案件 (ask_cases) 参照
// =============================================

export async function getAskCases(filters = {}) {
  if (!db) return [];
  let query = db.from('ask_cases').select('*');

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  query = query.order('updated_at', { ascending: false, nullsFirst: false });
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) { console.error('getAskCases error:', error); return []; }
  return data || [];
}

export async function getAskCase(id) {
  if (!db) return null;
  const { data, error } = await db.from('ask_cases').select('*').eq('id', id).single();
  if (error) { console.error('getAskCase error:', error); return null; }
  return data;
}

// =============================================
// アスカラ連絡先 (ask_contacts) 参照
// =============================================

export async function getAskContacts(filters = {}) {
  if (!db) return [];
  let query = db.from('ask_contacts').select('*');
  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
  }
  query = query.order('name', { ascending: true });
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) { console.error('getAskContacts error:', error); return []; }
  return data || [];
}

export async function getAskContact(id) {
  if (!db) return null;
  const { data, error } = await db.from('ask_contacts').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

// 現場から案件追加（アスカラに自動通知用フラグ付き）
export async function createAskCase(caseData) {
  if (!db) return null;
  const payload = {
    ...caseData,
    status: caseData.status || '受付',
    source: 'tkb_saisei',
  };
  const { data, error } = await db.from('ask_cases').insert(payload).select().single();
  if (error) { console.error('createAskCase error:', error); return null; }
  return data;
}

export async function createAskContact(contactData) {
  if (!db) return null;
  const payload = {
    ...contactData,
    source: 'tkb_saisei',
  };
  const { data, error } = await db.from('ask_contacts').insert(payload).select().single();
  if (error) { console.error('createAskContact error:', error); return null; }
  return data;
}

// =============================================
// 作業指示 (tkbs_work_orders)
// =============================================

export async function getWorkOrders(filters = {}) {
  if (!db) return [];
  let query = db.from('tkbs_work_orders').select('*');

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters.case_id) query = query.eq('case_id', filters.case_id);
  if (filters.work_date) query = query.eq('work_date', filters.work_date);
  if (filters.staff_id) query = query.contains('staff_ids', [filters.staff_id]);

  query = query.order('work_date', { ascending: true });
  if (filters.limit) query = query.limit(filters.limit);

  const { data, error } = await query;
  if (error) { console.error('getWorkOrders error:', error); return []; }
  return data || [];
}

export async function getWorkOrder(id) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_orders').select('*').eq('id', id).single();
  if (error) { console.error('getWorkOrder error:', error); return null; }
  return data;
}

export async function createWorkOrder(orderData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_orders').insert(orderData).select().single();
  if (error) { console.error('createWorkOrder error:', error); return null; }
  return data;
}

export async function updateWorkOrder(id, updates) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_orders').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateWorkOrder error:', error); return null; }
  return data;
}

// =============================================
// 現場写真 (tkbs_work_photos)
// =============================================

export async function getWorkPhotos(workOrderId, step = null) {
  if (!db) return [];
  let query = db.from('tkbs_work_photos').select('*').eq('work_order_id', workOrderId);
  if (step) query = query.eq('step', step);
  query = query.order('taken_at', { ascending: true });
  const { data, error } = await query;
  if (error) { console.error('getWorkPhotos error:', error); return []; }
  return data || [];
}

export async function createWorkPhoto(photoData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_photos').insert(photoData).select().single();
  if (error) { console.error('createWorkPhoto error:', error); return null; }
  return data;
}

export async function deleteWorkPhoto(id) {
  if (!db) return false;
  const { error } = await db.from('tkbs_work_photos').delete().eq('id', id);
  if (error) { console.error('deleteWorkPhoto error:', error); return false; }
  return true;
}

// =============================================
// チェックリスト (tkbs_checklists)
// =============================================

export async function getChecklist(workOrderId) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_checklists').select('*').eq('work_order_id', workOrderId).maybeSingle();
  if (error) { console.error('getChecklist error:', error); return null; }
  return data;
}

export async function upsertChecklist(workOrderId, items, completedBy = null) {
  if (!db) return null;
  const allDone = items.every(i => i.checked);
  const payload = {
    work_order_id: workOrderId,
    items,
    completed_by: allDone ? completedBy : null,
    completed_at: allDone ? new Date().toISOString() : null,
  };

  // 既存があればupdate
  const existing = await getChecklist(workOrderId);
  if (existing) {
    const { data, error } = await db.from('tkbs_checklists').update(payload).eq('id', existing.id).select().single();
    if (error) { console.error('upsertChecklist error:', error); return null; }
    return data;
  } else {
    const { data, error } = await db.from('tkbs_checklists').insert(payload).select().single();
    if (error) { console.error('upsertChecklist error:', error); return null; }
    return data;
  }
}

// =============================================
// 作業ログ・タイマー (tkbs_work_logs)
// =============================================

export async function getWorkLogs(workOrderId) {
  if (!db) return [];
  const { data, error } = await db.from('tkbs_work_logs').select('*').eq('work_order_id', workOrderId).order('start_time', { ascending: true });
  if (error) { console.error('getWorkLogs error:', error); return []; }
  return data || [];
}

export async function createWorkLog(logData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_logs').insert(logData).select().single();
  if (error) { console.error('createWorkLog error:', error); return null; }
  return data;
}

export async function updateWorkLog(id, updates) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_work_logs').update(updates).eq('id', id).select().single();
  if (error) { console.error('updateWorkLog error:', error); return null; }
  return data;
}

// =============================================
// 動産記録 (tkbs_found_items)
// =============================================

export async function getFoundItems(workOrderId) {
  if (!db) return [];
  const { data, error } = await db.from('tkbs_found_items').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false });
  if (error) { console.error('getFoundItems error:', error); return []; }
  return data || [];
}

export async function createFoundItem(itemData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_found_items').insert(itemData).select().single();
  if (error) { console.error('createFoundItem error:', error); return null; }
  return data;
}

// =============================================
// 現場メモ (tkbs_memos)
// =============================================

export async function getMemos(workOrderId) {
  if (!db) return [];
  const { data, error } = await db.from('tkbs_memos').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false });
  if (error) { console.error('getMemos error:', error); return []; }
  return data || [];
}

export async function createMemo(memoData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_memos').insert(memoData).select().single();
  if (error) { console.error('createMemo error:', error); return null; }
  return data;
}

// =============================================
// 完了報告 (tkbs_completion_reports)
// =============================================

export async function getCompletionReport(workOrderId) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_completion_reports').select('*').eq('work_order_id', workOrderId).maybeSingle();
  if (error) { console.error('getCompletionReport error:', error); return null; }
  return data;
}

export async function createCompletionReport(reportData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_completion_reports').insert(reportData).select().single();
  if (error) { console.error('createCompletionReport error:', error); return null; }
  return data;
}

// =============================================
// 経費 (tkbs_expenses)
// =============================================

export async function getExpenses(filters = {}) {
  if (!db) return [];
  let query = db.from('tkbs_expenses').select('*');
  if (filters.work_order_id) query = query.eq('work_order_id', filters.work_order_id);
  if (filters.recorded_by) query = query.eq('recorded_by', filters.recorded_by);
  query = query.order('expense_date', { ascending: false });
  if (filters.limit) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) { console.error('getExpenses error:', error); return []; }
  return data || [];
}

export async function createExpense(expenseData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_expenses').insert(expenseData).select().single();
  if (error) { console.error('createExpense error:', error); return null; }
  return data;
}

// =============================================
// 勤怠 (tkbs_attendance)
// =============================================

export async function getAttendance(staffId, date) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_attendance').select('*').eq('staff_id', staffId).eq('date', date).maybeSingle();
  if (error) { console.error('getAttendance error:', error); return null; }
  return data;
}

export async function getAttendanceByDate(date) {
  if (!db) return [];
  const { data, error } = await db.from('tkbs_attendance').select('*').eq('date', date);
  if (error) { console.error('getAttendanceByDate error:', error); return []; }
  return data || [];
}

export async function upsertAttendance(attendanceData) {
  if (!db) return null;
  const existing = await getAttendance(attendanceData.staff_id, attendanceData.date);
  if (existing) {
    const { data, error } = await db.from('tkbs_attendance').update(attendanceData).eq('id', existing.id).select().single();
    if (error) { console.error('upsertAttendance error:', error); return null; }
    return data;
  } else {
    const { data, error } = await db.from('tkbs_attendance').insert(attendanceData).select().single();
    if (error) { console.error('upsertAttendance error:', error); return null; }
    return data;
  }
}

// =============================================
// お知らせ (tkbs_notices)
// =============================================

export async function getNotices(limit = 10) {
  if (!db) return [];
  const { data, error } = await db.from('tkbs_notices').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('getNotices error:', error); return []; }
  return data || [];
}

export async function createNotice(noticeData) {
  if (!db) return null;
  const { data, error } = await db.from('tkbs_notices').insert(noticeData).select().single();
  if (error) { console.error('createNotice error:', error); return null; }
  return data;
}

// =============================================
// 写真アップロード (Supabase Storage)
// =============================================

export async function uploadPhoto(file, path) {
  if (!db) return null;
  const { data, error } = await db.storage.from(CONFIG.PHOTO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) { console.error('uploadPhoto error:', error); return null; }
  const { data: urlData } = db.storage.from(CONFIG.PHOTO_BUCKET).getPublicUrl(data.path);
  return urlData?.publicUrl || null;
}

// =============================================
// 統計
// =============================================

export async function getWorkOrderStatusCounts() {
  if (!db) return {};
  const { data, error } = await db.from('tkbs_work_orders').select('status');
  if (error) { console.error('getWorkOrderStatusCounts error:', error); return {}; }
  const counts = {};
  for (const row of (data || [])) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  return counts;
}

export async function getTodayWorkOrders(staffId = null) {
  const today = todayLocal();
  const filters = {
    work_date: today,
    status: ['受注確定', '現場作業中'],
  };
  // 全員分取得して、staff_idsで絞る
  let orders = await getWorkOrders({ work_date: today });
  // ステータスフィルタ
  orders = orders.filter(o => ['受注確定', '現場作業中'].includes(o.status));
  if (staffId) {
    orders = orders.filter(o => (o.staff_ids || []).includes(staffId));
  }
  return orders;
}
