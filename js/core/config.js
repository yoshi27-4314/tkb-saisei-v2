/**
 * テイクバック再生 v2 - 設定
 */
export const CONFIG = {
  APP_VERSION: '2.0.0',
  APP_NAME: 'テイクバック再生',

  // Supabase (firsteight-group — アスカラと同じプロジェクト)
  SUPABASE_URL: 'https://peportftucwuxfnmaanr.supabase.co',
  SUPABASE_KEY: 'sb_publishable_ndRcO6c962YBhShB3gP3MA_kHRmaofQ',

  // AWAI Supabase (Edge Functions for OCR)
  AWAI_URL: 'https://njdnfvlucwasrafoepmu.supabase.co',
  AWAI_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZG5mdmx1Y3dhc3JhZm9lcG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTEzNjgsImV4cCI6MjA5MDg4NzM2OH0.jDjqf3nWqaQ0sMfDf-85dDQNbEhX90qLsOOhWJdDlM8',

  // ストレージバケット
  PHOTO_BUCKET: 'tkbs-photos',

  // ステータスフロー
  STATUS_FLOW: [
    '案件受取', '作業計画', '見積提出', '受注確定',
    '現場作業中', '完了報告済', '請求・精算',
  ],

  STATUS_ICONS: {
    '案件受取': '📥',
    '作業計画': '📋',
    '見積提出': '💰',
    '受注確定': '✅',
    '現場作業中': '🏗️',
    '完了報告済': '📸',
    '請求・精算': '💴',
    '保留': '⏸️',
    '追加作業発生': '⚠️',
    'キャンセル': '❌',
  },

  // スタッフ
  STAFF: [
    { id: 'asano', name: '浅野儀頼', role: 'admin', avatar: '👤', canLogin: true },
    { id: 'hirano', name: '平野光雄', role: 'worker', avatar: '👷', canLogin: true },
    { id: 'matsumoto', name: '松本豊彦', role: 'worker', avatar: '👷', canLogin: true },
    { id: 'kitase', name: '北瀬孝', role: 'display_only', avatar: '👤', canLogin: false },
  ],

  // 経費カテゴリ
  EXPENSE_CATEGORIES: ['材料費', '交通費', '廃棄費', '食費', '道具', 'その他'],

  // チェックリストテンプレート（案件種別ごと）
  CHECKLIST_TEMPLATES: {
    '片付け作業': [
      '近隣挨拶', '養生設置', '貴重品確認', '搬出完了',
      '清掃完了', '養生撤去', '施錠確認', '写真撮影（後）',
    ],
    '無料回収': [
      '近隣挨拶', '養生設置', '貴重品・思い出品の仕分け',
      'お客さまへの確認', '搬出完了', '清掃完了',
      '養生撤去', '施錠確認', '写真撮影（後）',
    ],
    '現場作業': [
      '近隣挨拶', '養生設置', '残置物確認', '搬出完了',
      '清掃完了', '養生撤去', '施錠確認', '写真撮影（後）',
    ],
    '入荷作業': [
      '車両確認', '荷下ろし', '数量確認', '検品',
      '倉庫搬入', '棚入れ', '写真撮影', '入荷記録',
    ],
    'デフォルト': [
      '現場到着', '作業開始前確認', '安全確認',
      '作業完了', '清掃', '写真撮影（後）', '施錠確認',
    ],
  },

  // 道具リスト
  DEFAULT_TOOLS: [
    '台車', '養生材', 'ほうき・ちりとり', 'ゴミ袋（大）',
    '軍手', 'ヘルメット', '安全靴', 'ドライバーセット',
    'カッター', 'ガムテープ', 'マジック', '脚立',
    'ブルーシート', '掃除機', 'バール', 'ハンマー',
  ],
};
