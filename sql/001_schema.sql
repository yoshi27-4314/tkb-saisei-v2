-- ============================================
-- テイクバック再生事業 v2 - スキーマ
-- Supabase: firsteight-group (peportftucwuxfnmaanr)
-- プレフィックス: tkbs_
-- 参照: ask_cases, ask_contacts (アスカラ管理)
-- ============================================

-- 作業指示（浅野が作成）
CREATE TABLE IF NOT EXISTS tkbs_work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID REFERENCES ask_cases(id),
  work_date DATE NOT NULL,
  work_date_end DATE,
  start_time TEXT,
  site_address TEXT,
  staff_ids TEXT[] DEFAULT '{}',
  tools TEXT[] DEFAULT '{}',
  instructions TEXT,
  checklist_template JSONB DEFAULT '[]',
  status TEXT DEFAULT '案件受取' CHECK (status IN (
    '案件受取', '作業計画', '見積提出', '受注確定',
    '現場作業中', '完了報告済', '請求・精算',
    '保留', '追加作業発生', 'キャンセル'
  )),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 現場写真（ステップ別: before/during/after）
CREATE TABLE IF NOT EXISTS tkbs_work_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  step TEXT NOT NULL CHECK (step IN ('before', 'during', 'after')),
  caption TEXT,
  taken_by TEXT,
  taken_at TIMESTAMPTZ DEFAULT now()
);

-- チェックリスト
CREATE TABLE IF NOT EXISTS tkbs_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  items JSONB DEFAULT '[]',
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 作業ログ・タイマー
CREATE TABLE IF NOT EXISTS tkbs_work_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL,
  staff_name TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 動産記録（売れるもの → 流通に連携）
CREATE TABLE IF NOT EXISTS tkbs_found_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  photo_url TEXT,
  estimated_value INTEGER DEFAULT 0,
  category TEXT,
  sent_to_ryutsu BOOLEAN DEFAULT false,
  note TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 現場メモ
CREATE TABLE IF NOT EXISTS tkbs_memos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  photo_url TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 完了報告
CREATE TABLE IF NOT EXISTS tkbs_completion_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  photo_urls TEXT[] DEFAULT '{}',
  comment TEXT,
  reported_by TEXT,
  reported_at TIMESTAMPTZ DEFAULT now(),
  notified_asukara BOOLEAN DEFAULT false
);

-- 経費
CREATE TABLE IF NOT EXISTS tkbs_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES tkbs_work_orders(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  category TEXT DEFAULT 'その他' CHECK (category IN (
    '材料費', '交通費', '廃棄費', '食費', '道具', 'その他'
  )),
  description TEXT,
  receipt_url TEXT,
  ocr_data JSONB,
  recorded_by TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 勤怠
CREATE TABLE IF NOT EXISTS tkbs_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  work_minutes INTEGER DEFAULT 0,
  is_proxy BOOLEAN DEFAULT false,
  proxy_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

-- お知らせ
CREATE TABLE IF NOT EXISTS tkbs_notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_tkbs_work_orders_case_id ON tkbs_work_orders(case_id);
CREATE INDEX IF NOT EXISTS idx_tkbs_work_orders_work_date ON tkbs_work_orders(work_date);
CREATE INDEX IF NOT EXISTS idx_tkbs_work_orders_status ON tkbs_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_tkbs_work_photos_order ON tkbs_work_photos(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tkbs_work_logs_order ON tkbs_work_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tkbs_expenses_order ON tkbs_expenses(work_order_id);
CREATE INDEX IF NOT EXISTS idx_tkbs_attendance_staff ON tkbs_attendance(staff_id, date);

-- updated_atトリガー
CREATE OR REPLACE FUNCTION update_tkbs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_tkbs_work_orders_updated
    BEFORE UPDATE ON tkbs_work_orders
    FOR EACH ROW EXECUTE FUNCTION update_tkbs_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tkbs_checklists_updated
    BEFORE UPDATE ON tkbs_checklists
    FOR EACH ROW EXECUTE FUNCTION update_tkbs_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tkbs_attendance_updated
    BEFORE UPDATE ON tkbs_attendance
    FOR EACH ROW EXECUTE FUNCTION update_tkbs_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
