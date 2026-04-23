/**
 * テイクバック再生 v2 - ツール（Tools）モジュール
 * ガイド / 取引先住所録 / AI相談 / 報告書作成
 */
import { CONFIG } from '../core/config.js';
import { showToast, showLoading, emptyState, escapeHtml } from '../core/ui.js';
import { getCurrentStaff, isAdmin } from '../core/auth.js';

// --- 色定数 ---
const C = {
  bg: '#0f0f1a',
  card: '#16213e',
  accent: '#e67e22',
  text: '#e0e0e0',
  sub: '#8892a4',
  border: '#2a3a5c',
};

// ============================================================
// メイン描画
// ============================================================
export function renderTools(container, params = {}) {
  // サブページへのルーティング
  if (params.page) {
    switch (params.page) {
      case 'guide-safety':    return renderGuideSafety(container);
      case 'guide-customer':  return renderGuideCustomer(container);
      case 'guide-sorting':   return renderGuideSorting(container);
      case 'guide-app':       return renderGuideApp(container);
      case 'addresses':       return renderAddresses(container);
      case 'ai':              return renderAiConsult(container);
      case 'report':          return renderReport(container);
      default: break;
    }
  }

  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <h2 style="color:#fff;font-size:18px;font-weight:700;margin-bottom:16px;">ツール</h2>

      <!-- ガイド -->
      <div style="margin-bottom:20px;">
        <div style="color:${C.sub};font-size:12px;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">ガイド（作業マニュアル）</div>
        <div id="toolGuides" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div>
      </div>

      <!-- 取引先住所録 -->
      <div style="margin-bottom:20px;">
        <div style="color:${C.sub};font-size:12px;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">便利ツール</div>
        <div id="toolUtils" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>

      <!-- 管理者専用 -->
      <div id="toolAdminSection" style="margin-bottom:20px;display:none;">
        <div style="color:${C.sub};font-size:12px;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">管理者ツール</div>
        <div id="toolAdmin" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>
    </div>
  `;

  // --- ガイドカード ---
  const guides = [
    { key: 'guide-safety',   icon: '🛡️', label: '安全ガイド',       desc: '熱中症・重量物・高所' },
    { key: 'guide-customer', icon: '🤝', label: 'お客さん対応',      desc: '挨拶・服装・クレーム' },
    { key: 'guide-sorting',  icon: '♻️', label: '分別ガイド',        desc: '岐阜市のルール' },
    { key: 'guide-app',      icon: '📱', label: 'アプリ使い方',      desc: '各機能の説明' },
  ];

  const guidesEl = container.querySelector('#toolGuides');
  guides.forEach(g => {
    const card = document.createElement('button');
    card.style.cssText = `background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px 12px;text-align:center;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
    card.innerHTML = `
      <div style="font-size:28px;margin-bottom:6px;">${g.icon}</div>
      <div style="color:#fff;font-size:14px;font-weight:600;">${g.label}</div>
      <div style="color:${C.sub};font-size:11px;margin-top:2px;">${g.desc}</div>
    `;
    card.addEventListener('click', () => renderTools(container, { page: g.key }));
    guidesEl.appendChild(card);
  });

  // --- 便利ツール ---
  const utils = [
    { key: 'addresses', icon: '📒', label: '取引先住所録', desc: 'よく使う住所・ナビ起動' },
    { key: 'ai',        icon: '🤖', label: 'AI相談',      desc: '作業の疑問をAIに聞く' },
  ];

  const utilsEl = container.querySelector('#toolUtils');
  utils.forEach(u => {
    const card = document.createElement('button');
    card.style.cssText = `display:flex;align-items:center;gap:12px;background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;cursor:pointer;transition:all 0.2s;text-align:left;width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
    card.innerHTML = `
      <div style="font-size:24px;flex-shrink:0;">${u.icon}</div>
      <div>
        <div style="color:#fff;font-size:14px;font-weight:600;">${u.label}</div>
        <div style="color:${C.sub};font-size:11px;margin-top:1px;">${u.desc}</div>
      </div>
      <div style="margin-left:auto;color:${C.sub};font-size:16px;">›</div>
    `;
    card.addEventListener('click', () => renderTools(container, { page: u.key }));
    utilsEl.appendChild(card);
  });

  // --- 管理者ツール ---
  if (isAdmin()) {
    const adminSection = container.querySelector('#toolAdminSection');
    adminSection.style.display = '';
    const adminEl = container.querySelector('#toolAdmin');
    const card = document.createElement('button');
    card.style.cssText = `display:flex;align-items:center;gap:12px;background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;cursor:pointer;transition:all 0.2s;text-align:left;width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.2);`;
    card.innerHTML = `
      <div style="font-size:24px;flex-shrink:0;">📄</div>
      <div>
        <div style="color:#fff;font-size:14px;font-weight:600;">報告書作成</div>
        <div style="color:${C.sub};font-size:11px;margin-top:1px;">作業報告書PDF生成</div>
      </div>
      <div style="margin-left:auto;color:${C.sub};font-size:16px;">›</div>
    `;
    card.addEventListener('click', () => renderTools(container, { page: 'report' }));
    adminEl.appendChild(card);
  }
}

// ============================================================
// サブページ共通ヘッダー
// ============================================================
function subPageHeader(container, title) {
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';
  header.innerHTML = `
    <button id="toolBack" style="background:none;border:none;color:${C.accent};font-size:22px;cursor:pointer;padding:4px;">←</button>
    <h2 style="color:#fff;font-size:18px;font-weight:700;margin:0;">${title}</h2>
  `;
  return header;
}

function setupBackButton(container) {
  container.querySelector('#toolBack')?.addEventListener('click', () => {
    renderTools(container, {});
  });
}

// ============================================================
// 1. 安全ガイド
// ============================================================
function renderGuideSafety(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <!-- 熱中症対策 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">☀️ 熱中症対策</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>作業前に必ず500ml以上の水分を確保する</li>
            <li>30分に1回は水分補給。のどが渇く前に飲む</li>
            <li>めまい・吐き気を感じたらすぐ日陰で休む</li>
            <li>WBGT 31度以上（環境省発表）の場合、屋外作業は中止を検討</li>
            <li>塩分タブレット・経口補水液を車に常備</li>
            <li>帽子・タオルは必須。冷却スプレーも有効</li>
            <li>異変を感じたら無理せず浅野に連絡する</li>
          </ul>
        </div>

        <!-- 重量物の持ち方 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">💪 重量物の持ち方</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>膝を曲げて腰を落とし、背中はまっすぐ</li>
            <li>荷物はできるだけ体に近づけて持つ</li>
            <li>ひねり動作は禁止。体ごと方向を変える</li>
            <li>20kg以上は必ず2人以上で運ぶ</li>
            <li>冷蔵庫・洗濯機は台車+養生ベルト必須</li>
            <li>階段では下側の人が声かけ（「せーの」で合わせる）</li>
            <li>腰ベルト（コルセット）の着用を推奨</li>
            <li>無理だと思ったら「無理です」と言う。怪我をしたら全員が困る</li>
          </ul>
        </div>

        <!-- 高所作業 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">🪜 高所作業</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>脚立は必ず開き止めをロックしてから使う</li>
            <li>脚立の天板には絶対に乗らない</li>
            <li>2m以上の高さで作業する場合はヘルメット必須</li>
            <li>脚立の下に人がいないことを確認してから作業</li>
            <li>物を上から投げない。必ず手渡しまたはロープで降ろす</li>
            <li>雨・風の強い日は高所作業を避ける</li>
          </ul>
        </div>

        <!-- 車両安全 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">🚛 車両・運転</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>出発前に積荷の固定を確認（ロープ・ラッシング）</li>
            <li>住宅街では最徐行。子どもの飛び出しに注意</li>
            <li>バック時は必ず降りて後方確認。誘導者をつける</li>
            <li>現場到着後、車両を停める位置を最初に決める</li>
            <li>作業中はハザードランプ点灯＋コーンを置く</li>
          </ul>
        </div>

        <!-- 緊急連絡先 -->
        <div style="background:${C.card};border:1px solid #e74c3c40;border-radius:12px;padding:16px;">
          <div style="color:#e74c3c;font-size:15px;font-weight:700;margin-bottom:10px;">🚨 緊急時の対応</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>怪我：応急処置 → 浅野に電話 → 必要なら119</li>
            <li>事故：安全確保 → 110/119 → 浅野に電話</li>
            <li>物損：写真を撮る → 浅野に電話 → お客さんに説明</li>
            <li><strong>浅野 連絡先：080-XXXX-XXXX</strong>（CONFIG更新後に表示）</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '🛡️ 安全ガイド'));
  setupBackButton(container);
}

// ============================================================
// 2. お客さん対応ガイド
// ============================================================
function renderGuideCustomer(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <!-- 挨拶 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">👋 挨拶・第一印象</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>到着したら「テイクバックの○○です。本日はよろしくお願いいたします」</li>
            <li>帰る時は「本日はありがとうございました。何かあればいつでもご連絡ください」</li>
            <li>近隣の方には「ご迷惑をおかけします。○時頃に終わる予定です」</li>
            <li>笑顔で目を見て話す。声の大きさに気をつける</li>
          </ul>
        </div>

        <!-- 服装 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">👔 服装・身だしなみ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>テイクバックのポロシャツまたはジャンパーを着る</li>
            <li>清潔感が一番大事。汚れたらすぐ着替える</li>
            <li>作業着でもだらしなく見えないよう注意</li>
            <li>タバコの臭いがお客さんの家に残らないよう注意</li>
            <li>室内に入る時は新しい靴下に履き替える（夏場は特に）</li>
          </ul>
        </div>

        <!-- 言葉遣い -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">💬 言葉遣い</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>敬語が基本。「です・ます」を使う</li>
            <li>「ゴミ」は使わない →「不用品」「お荷物」</li>
            <li>「捨てる」は使わない →「処分する」「お引き取りする」</li>
            <li>遺品整理では特に言葉に気をつける。「大切なお品物」</li>
            <li>判断に迷うものは「こちらはいかがいたしましょうか？」と必ず確認</li>
          </ul>
        </div>

        <!-- クレーム対応 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">⚡ クレーム対応</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>まず謝る。「申し訳ございません」</li>
            <li>言い訳しない。理由の説明は後でいい</li>
            <li>お客さんの話を最後まで聞く。途中で遮らない</li>
            <li>自分で判断しない。「確認いたしますので少々お待ちください」と言って浅野に電話</li>
            <li>物を壊した場合：写真を撮る → 謝る → 浅野に電話</li>
            <li>絶対にお客さんと口論しない</li>
          </ul>
        </div>

        <!-- 遺品整理の心得 -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">🙏 遺品整理の心得</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>故人の品物を雑に扱わない</li>
            <li>お客さんが泣いていたら、そっと待つ</li>
            <li>思い出の品は丁寧にまとめて最後にお客さんに確認</li>
            <li>仏壇・位牌・写真は特に丁寧に扱う</li>
            <li>作業中の私語・笑い声は控える</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '🤝 お客さん対応ガイド'));
  setupBackButton(container);
}

// ============================================================
// 3. 分別ガイド
// ============================================================
function renderGuideSorting(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:14px;color:${C.sub};font-size:12px;line-height:1.6;">
          ※ 岐阜市のゴミ分別ルールに基づいています。持ち込み先が市外の場合はそちらのルールに従ってください。
        </div>

        <!-- 可燃ごみ -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="display:inline-block;width:28px;height:28px;background:#e74c3c;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:bold;">燃</span>
            <span style="color:${C.accent};font-size:15px;font-weight:700;">可燃ごみ</span>
          </div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>生ごみ（水をよく切る）</li>
            <li>紙くず・布・革製品</li>
            <li>プラスチック製品（汚れたもの）</li>
            <li>木片・枝（50cm以内に切る）</li>
            <li>ゴム・ビニール類</li>
            <li>指定袋：黄色い袋</li>
          </ul>
        </div>

        <!-- 不燃ごみ -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="display:inline-block;width:28px;height:28px;background:#3498db;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:bold;">不</span>
            <span style="color:${C.accent};font-size:15px;font-weight:700;">不燃ごみ</span>
          </div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>ガラス・陶器・鏡</li>
            <li>金属類（鍋・フライパン等）</li>
            <li>小型家電（ドライヤー・アイロン等）</li>
            <li>蛍光灯・電球</li>
            <li>スプレー缶（穴を開けて中身を出す）</li>
            <li>指定袋：緑の袋</li>
          </ul>
        </div>

        <!-- 粗大ごみ -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="display:inline-block;width:28px;height:28px;background:#9b59b6;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:bold;">粗</span>
            <span style="color:${C.accent};font-size:15px;font-weight:700;">粗大ごみ</span>
          </div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>指定袋に入らない大きさのもの</li>
            <li>家具（タンス・机・椅子・ソファ等）</li>
            <li>布団・マットレス</li>
            <li>自転車</li>
            <li>クリーンセンターへ直接持ち込み可（10kgあたり120円）</li>
          </ul>
        </div>

        <!-- 家電リサイクル -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="display:inline-block;width:28px;height:28px;background:#e67e22;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:bold;">家</span>
            <span style="color:${C.accent};font-size:15px;font-weight:700;">家電リサイクル法対象</span>
          </div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li><strong>テレビ</strong>（ブラウン管・液晶・プラズマ）</li>
            <li><strong>エアコン</strong></li>
            <li><strong>冷蔵庫・冷凍庫</strong></li>
            <li><strong>洗濯機・衣類乾燥機</strong></li>
            <li>→ クリーンセンターでは受入不可</li>
            <li>→ 郵便局でリサイクル券を購入 → 指定引取場所へ</li>
            <li>→ またはリサイクル業者に引き渡し</li>
          </ul>
        </div>

        <!-- 資源ごみ -->
        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="display:inline-block;width:28px;height:28px;background:#27ae60;border-radius:6px;text-align:center;line-height:28px;color:#fff;font-size:13px;font-weight:bold;">資</span>
            <span style="color:${C.accent};font-size:15px;font-weight:700;">資源ごみ</span>
          </div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>新聞・雑誌・段ボール（ひもで縛る）</li>
            <li>ペットボトル（キャップとラベルを外す）</li>
            <li>缶（アルミ・スチール）</li>
            <li>ビン（中をすすぐ）</li>
            <li>古着・古布（透明袋に入れる）</li>
          </ul>
        </div>

        <!-- 処分できないもの -->
        <div style="background:${C.card};border:1px solid #e74c3c40;border-radius:12px;padding:16px;">
          <div style="color:#e74c3c;font-size:15px;font-weight:700;margin-bottom:10px;">🚫 処分できないもの</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>タイヤ・バッテリー → カー用品店へ</li>
            <li>消火器 → 専門業者へ</li>
            <li>塗料・シンナー → 産業廃棄物業者へ</li>
            <li>ガスボンベ（プロパン等） → 販売店へ返却</li>
            <li>農薬・劇薬 → 専門業者へ</li>
            <li>迷ったら浅野に確認する</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '♻️ 分別ガイド'));
  setupBackButton(container);
}

// ============================================================
// 4. アプリ使い方ガイド
// ============================================================
function renderGuideApp(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="display:flex;flex-direction:column;gap:12px;">

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">📋 案件タブ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>アスカラから受け取った案件の一覧が表示されます</li>
            <li>案件をタップすると詳細（住所・作業内容・チェックリスト）が見れます</li>
            <li>ステータスは作業の進み具合に合わせて変更してください</li>
          </ul>
        </div>

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">🏗️ 今日の現場タブ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>今日作業予定の案件だけが表示されます</li>
            <li>チェックリストで作業漏れを防ぎます</li>
            <li>写真撮影：作業前・作業後の写真を撮ってください</li>
            <li>経費があれば「経費追加」からレシートを撮影</li>
          </ul>
        </div>

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">💰 経費タブ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>作業で使ったお金を記録します</li>
            <li>レシートの写真を撮ると自動で金額を読み取ります（OCR）</li>
            <li>カテゴリを選んで保存してください</li>
          </ul>
        </div>

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">🛠️ ツールタブ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>このページです。各種ガイドや住所録があります</li>
            <li>困ったときはここを見てください</li>
          </ul>
        </div>

        <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
          <div style="color:${C.accent};font-size:15px;font-weight:700;margin-bottom:10px;">👤 マイページタブ</div>
          <ul style="color:${C.text};font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
            <li>自分の作業実績が見れます</li>
            <li>ログアウトもここからできます</li>
          </ul>
        </div>
      </div>
    </div>
  `;
  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '📱 アプリ使い方'));
  setupBackButton(container);
}

// ============================================================
// 5. 取引先住所録
// ============================================================
const ADDRESS_BOOK = [
  {
    name: '岐阜市クリーンセンター',
    desc: 'ゴミ処分場（粗大・可燃・不燃）',
    address: '岐阜県岐阜市奥1-104',
    phone: '058-239-9600',
    hours: '平日 8:30〜16:00',
  },
  {
    name: '岐阜市南部事務所',
    desc: '粗大ごみ受付・リサイクル券',
    address: '岐阜県岐阜市加納城南通1-20',
    phone: '058-271-0214',
    hours: '平日 8:45〜17:30',
  },
  {
    name: 'テイクバック倉庫',
    desc: '自社倉庫・資材置き場',
    address: '岐阜県岐阜市茜部中島2-72',
    phone: '--',
    hours: '--',
  },
  {
    name: '岐阜金属リサイクル',
    desc: '鉄・非鉄金属の買取',
    address: '岐阜県岐阜市柳津町下佐波5-25',
    phone: '058-270-1234',
    hours: '平日 8:00〜17:00 / 土 8:00〜12:00',
  },
  {
    name: '東海古紙センター',
    desc: '段ボール・古紙回収',
    address: '岐阜県岐阜市則武東2-1-18',
    phone: '058-232-5678',
    hours: '平日 8:00〜17:00',
  },
  {
    name: 'エコパーク岐阜',
    desc: '家電リサイクル指定引取場所',
    address: '岐阜県岐阜市北山1-14-20',
    phone: '058-237-8900',
    hours: '平日 9:00〜12:00, 13:00〜17:00',
  },
];

function renderAddresses(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>
      <div id="addressList" style="display:flex;flex-direction:column;gap:10px;"></div>
    </div>
  `;

  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '📒 取引先住所録'));
  setupBackButton(container);

  const list = container.querySelector('#addressList');

  ADDRESS_BOOK.forEach(entry => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.address)}`;
    const card = document.createElement('div');
    card.style.cssText = `background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:14px 16px;`;
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <div>
          <div style="color:#fff;font-size:14px;font-weight:600;">${escapeHtml(entry.name)}</div>
          <div style="color:${C.sub};font-size:11px;margin-top:2px;">${escapeHtml(entry.desc)}</div>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener"
           style="flex-shrink:0;display:inline-flex;align-items:center;gap:4px;background:${C.accent};color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;box-shadow:0 2px 8px rgba(230,126,34,0.3);">
          📍 ナビ
        </a>
      </div>
      <div style="font-size:12px;color:${C.text};margin-bottom:4px;">📍 ${escapeHtml(entry.address)}</div>
      ${entry.phone !== '--' ? `<div style="font-size:12px;color:${C.text};margin-bottom:4px;">📞 <a href="tel:${entry.phone}" style="color:${C.accent};text-decoration:none;">${escapeHtml(entry.phone)}</a></div>` : ''}
      ${entry.hours !== '--' ? `<div style="font-size:11px;color:${C.sub};">🕐 ${escapeHtml(entry.hours)}</div>` : ''}
    `;
    list.appendChild(card);
  });
}

// ============================================================
// 6. AI相談（スタブ）
// ============================================================
function renderAiConsult(container) {
  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;margin-bottom:12px;">
        <div style="color:${C.sub};font-size:12px;margin-bottom:10px;">作業中に困ったことをAIに相談できます</div>
        <textarea id="aiQuestion" rows="4" placeholder="例：エアコンの取り外し手順を教えて"
          style="width:100%;box-sizing:border-box;background:#0d0d1a;border:1px solid ${C.border};border-radius:8px;color:${C.text};font-size:14px;padding:12px;resize:vertical;font-family:inherit;"></textarea>
        <button id="aiSendBtn"
          style="margin-top:10px;width:100%;padding:12px;background:${C.accent};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">
          送信
        </button>
      </div>

      <div id="aiResponse" style="display:none;background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:16px;">
        <div style="color:${C.sub};font-size:11px;margin-bottom:8px;">AIの回答</div>
        <div id="aiResponseText" style="color:${C.text};font-size:14px;line-height:1.7;"></div>
      </div>
    </div>
  `;

  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '🤖 AI相談'));
  setupBackButton(container);

  const sendBtn = container.querySelector('#aiSendBtn');
  const questionEl = container.querySelector('#aiQuestion');
  const responseEl = container.querySelector('#aiResponse');
  const responseText = container.querySelector('#aiResponseText');

  sendBtn.addEventListener('click', () => {
    const q = questionEl.value.trim();
    if (!q) {
      showToast('質問を入力してください');
      return;
    }
    responseEl.style.display = '';
    responseText.textContent = 'この機能は今後追加予定です。現場で困ったことがあれば浅野に電話してください。';
    showToast('AI機能は準備中です');
  });
}

// ============================================================
// 7. 報告書作成（管理者のみ）
// ============================================================
function renderReport(container) {
  if (!isAdmin()) {
    container.innerHTML = emptyState('🔒', 'この機能は管理者のみ利用できます');
    return;
  }

  container.innerHTML = `
    <div style="padding:16px 16px 100px;max-width:480px;margin:0 auto;">
      <div id="subHeader"></div>

      <div style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:24px;text-align:center;">
        <div style="font-size:48px;margin-bottom:12px;">📄</div>
        <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:8px;">報告書作成</div>
        <div style="color:${C.sub};font-size:13px;line-height:1.6;">
          作業報告書のPDF生成機能は今後追加予定です。<br>
          案件の作業記録・写真・経費をまとめて<br>
          お客さま向け報告書を自動生成します。
        </div>
        <button disabled style="margin-top:20px;padding:12px 24px;background:${C.border};color:${C.sub};border:none;border-radius:8px;font-size:14px;cursor:not-allowed;">
          準備中
        </button>
      </div>
    </div>
  `;

  const headerEl = container.querySelector('#subHeader');
  headerEl.replaceWith(subPageHeader(container, '📄 報告書作成'));
  setupBackButton(container);
}
