# OneStep 技術説明書（初心者向け学習ガイド）

> このドキュメントは、自分のアプリの仕組みを理解し、今後自力で修正・拡張できるようになるための学習教材です。

---

## 📌 事前メモ：このアプリで使っているサービス

あなたは説明依頼で「Supabase同期」と書きましたが、実際にこのアプリで使っているのは **Firebase Firestore** です。
（Phase 1〜3 で設定した、Googleが提供するクラウドデータベース）

- **Firebase Firestore** ＝ Google製のクラウドデータベース
- **Supabase** ＝ Firebaseと似た別サービス（オープンソース、PostgreSQLベース）

どちらも「ネット上のデータベース」という意味では同じ役割なので、概念の理解は共通です。このドキュメントでは実際に使っている **Firebase Firestore** で説明します。

---

# 目次

1. [アプリの全体像](#1-アプリの全体像)
2. [データの流れ（具体例で追う）](#2-データの流れ具体例で追う)
3. [Firebase Firestore 同期の仕組み](#3-firebase-firestore-同期の仕組み)
4. [現在のデータ構造](#4-現在のデータ構造)
5. [UI更新の仕組み（JavaScriptがどう動くか）](#5-ui更新の仕組みjavascriptがどう動くか)
6. [セキュリティの現状](#6-セキュリティの現状)
7. [今後Google認証を追加するとき](#7-今後google認証を追加するとき)
8. [初心者向け用語解説](#8-初心者向け用語解説)

---

# 1. アプリの全体像

## 🏠 Webアプリを家に例える

```
┌────────────────────────────────────────┐
│  あなたのWebアプリ（家）                  │
│                                        │
│   index.html        ← 家の骨組み（壁・床）│
│      +                                 │
│   css/style.css     ← 内装・色・家具配置  │
│      +                                 │
│   js/*.js           ← 住人の動き（行動）  │
│                                        │
└────────────────────────────────────────┘
```

- **HTML** は「何があるか」を決める（部屋・ドア・窓）
- **CSS** は「どう見えるか」を決める（色・大きさ・配置）
- **JavaScript** は「何が起こるか」を決める（クリックで何が動く）

この3つが揃って初めて「動くWebアプリ」になります。

## 📂 ファイル構造

```
プロジェクトフォルダ/
├── index.html          ← メインHTML（全画面の骨組み）
├── css/
│   └── style.css       ← デザイン用CSS
├── js/
│   ├── data.js         ← データを保存・読み込みする部分
│   ├── pages.js        ← 画面を描く部分
│   └── app.js          ← 全体の制御
├── README.md           ← プロジェクト紹介文
└── STUDY_GUIDE.md      ← この説明書
```

## 🔗 ファイル同士の連携

各JavaScriptファイルは **「役割分担」** されています。

```
┌──────────────────────────────────────────────┐
│                index.html                    │
│  (画面の骨組み + 3つのJSファイルを読み込む)       │
└──────────────────────────────────────────────┘
         │
         ▼ ブラウザが起動時に読み込む順番
┌──────────────────────────────────────────────┐
│ ① data.js                                    │
│   ・タスク・サブタスクの保存と読み込み           │
│   ・Firestoreとの通信                          │
│   ・「DBレイヤー」（データを扱う部隊）           │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ ② pages.js                                   │
│   ・各画面（ホーム/一覧/設計/完了/ゴミ箱）の描画 │
│   ・data.jsから取ったデータを画面に変換          │
│   ・「描画レイヤー」（見た目を作る部隊）         │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ ③ app.js                                     │
│   ・ページ切替（ナビゲーション）                 │
│   ・サイドバー・モーダル・トースト              │
│   ・「制御レイヤー」（全体を取りまとめる司令塔） │
└──────────────────────────────────────────────┘
```

### 例: 「タスク完了ボタンを押す」の流れ

```
[ボタンクリック (HTML上)]
        │
        ▼
[app.js or pages.js] が「クリックされたよ」を検知
        │
        ▼
[data.js] でタスクを「完了」状態に更新
        │
        ▼
[pages.js] で画面を描き直す
        │
        ▼
[Firestore] にも更新を反映（クラウド同期）
```

## 🎯 設計のポイント

**「データ層・描画層・制御層」** が分かれているので:
- 保存方法を変えたい → `data.js` だけ触る
- 見た目を変えたい → `pages.js` か `css/style.css` だけ触る
- 画面切替の動きを変えたい → `app.js` だけ触る

これを **「関心の分離」** と呼びます。修正範囲を予測しやすい良い設計です。

---

# 2. データの流れ（具体例で追う）

理論より、**実際の操作で内部で何が起きているか** を追う方が理解が早いです。3つのシナリオで見てみましょう。

## 📥 シナリオA: 「新規タスクを作成する」

ユーザー操作: 一覧画面で右上の「新規」ボタンを押す

```
[クリック]
   │
   ▼ ① HTMLのonclick="navigateTo('design')" が発動
[app.js] navigateTo('design', null)
   │
   ▼ ② ページを「タスク設計」に切り替え
[pages.js] renderDesign(null)
   │
   ▼ ③ パラメータがnullなので新規作成と判断
[data.js] createTask()
   │
   ├─ generateId() で「id_xxxxx_yyyy」のようなIDを生成
   ├─ デフォルト値で空タスクオブジェクトを作る
   ├─ loadTasks() で既存タスク全部を読む
   ├─ 配列に push（追加）
   ├─ saveTasks(配列) で保存
   │     │
   │     ├─ localStorage に保存（瞬時）
   │     └─ Firestore にも書き込み（ネット経由で非同期）
   │
   ▼ ④ 新規タスクのオブジェクトが返る
[pages.js] renderDesignView(task)
   │
   ▼ ⑤ タイトル空欄・サブタスク空の編集画面を描画
[ユーザーが入力できる状態に]
```

## ✅ シナリオB: 「ホーム画面で完了ボタンを押す」

```
[「完了にする」ボタンをクリック]
   │
   ▼ ① HTMLのonclick="handleCompleteSubTask('id_xxx')" が発動
[pages.js] handleCompleteSubTask('id_xxx')
   │
   ▼ ② サブタスクを完了状態に
[data.js] completeSubTask(id)
   │
   └─ updateSubTask(id, { completed: true })
        │
        ├─ loadSubTasks() で全サブタスク読み込み
        ├─ 該当subtaskのcompletedをtrueに変更
        ├─ updatedAt を今の時刻に更新
        ├─ saveSubTasks(配列)
        │     │
        │     ├─ localStorage更新
        │     └─ Firestoreに「変更されたsubtaskだけ」を書き込み
        │           （差分検知: updatedAtが変わったやつだけ）
        │
        └─ checkAndCompleteTask(taskId)
             │
             └─ 親タスクのサブタスクが全部完了なら
                 → 親タスクも completed: true に
                 → saveTasks() で保存（Firestore同期）
   │
   ▼ ③ トースト通知を表示
[app.js] showToast('サブタスクを完了しました ✓')
   │
   ▼ ④ ホーム画面を描き直す
[pages.js] renderHome()
   │
   ├─ getNextSubTask() で「次に表示すべきサブタスク」を計算
   ├─ サブタスクの締切順で並び替え、先頭1件を選ぶ
   └─ 画面に1件分のカードを表示

[ユーザーから見ると: 「今やること」が次のサブタスクに切り替わって見える]
```

## 🔄 シナリオC: 「アプリを開いたとき（同期）」

```
[ブラウザでURLを開く / リロード]
   │
   ▼ ① HTML・CSS・JavaScriptを読み込む
[ブラウザ] HTML解析 → script タグでJSをロード
   │
   ▼ ② DOMContentLoaded イベント発火（HTMLの解析完了）
[app.js] DOMContentLoadedハンドラ実行
   │
   ▼ ③ Firestoreから最新データを取り込む
[data.js] bootstrapFromFirestore()
   │
   ├─ db.collection('tasks').get()       ← Firestoreから全タスク取得
   ├─ db.collection('subtasks').get()    ← Firestoreから全サブタスク取得
   │
   ├─ Firestoreにデータあり?
   │   ├─ YES → localStorage を上書き
   │   └─ NO  → localStorage にデータがあれば、それをFirestoreへ初回アップロード
   │
   ▼ ④ サンプルデータ投入（初回起動時のみ）
[data.js] initSampleData()
   │
   └─ localStorageが空ならサンプル2タスクを作成
       ※ Firestoreから取り込んでいれば空ではないのでスキップされる
   │
   ▼ ⑤ ホーム画面を表示
[app.js] navigateTo('home')
[pages.js] renderHome()
   │
   ▼ ⑥ 完了
[画面表示]
```

### 🎯 同期がうまくいくのはなぜか?

- **PCで編集** → Firestoreに書き込み → クラウドに記録
- **スマホでアプリを開く** → bootstrapFromFirestoreがFirestoreから取り込み → 最新表示
- **localStorageは「キャッシュ」** ＝ 高速表示のための一時保管庫。Firestoreが「本当の保存場所」

---

# 3. Firebase Firestore 同期の仕組み

## 🌐 なぜスマホとPCでデータ共有できるのか?

**答え**: データを「インターネット上の共通の倉庫」に置いているから。

```
[Before: localStorage だけだった時代]

┌─────────┐                  ┌─────────┐
│   PC    │                  │ スマホ   │
│ ┌─────┐ │                  │ ┌─────┐ │
│ │L S  │ │ ←別物→             │ │L S  │ │
│ └─────┘ │                  │ └─────┘ │
└─────────┘                  └─────────┘
   PCで保存                   スマホで保存
   ↓                          ↓
   PCのブラウザだけ            スマホのブラウザだけ
   で見える                    で見える
```

```
[After: Firebase Firestore を導入後]

┌─────────┐                  ┌─────────┐
│   PC    │                  │ スマホ   │
│ ┌─────┐ │                  │ ┌─────┐ │
│ │L S  │ │ (キャッシュ)        │ │L S  │ │
│ └─────┘ │                  │ └─────┘ │
└────┬────┘                  └────┬────┘
     │ ▲                          │ ▲
     │ │ 書き込み                  │ │ 読み込み
     ▼ │                          ▼ │
┌───────────────────────────────────────┐
│   Firebase Firestore (Google のクラウド) │
│                                       │
│   ┌──────────────┐                    │
│   │ tasks コレクション │ ← タスクの本物    │
│   │ subtasks コレクション│ ← サブタスクの本物│
│   └──────────────┘                    │
└───────────────────────────────────────┘
```

## 📦 localStorage と Firestore の違い

| 項目 | localStorage | Firestore |
|---|---|---|
| **保存場所** | ブラウザ内 | インターネット上のサーバー |
| **共有** | ❌ ブラウザごとに別々 | ✅ どの端末からでも同じ |
| **オフライン動作** | ✅ ネット不要 | ❌ ネット必須（または書き込みキュー） |
| **速度** | 速い（同期的、一瞬） | 遅い（ネット通信が必要） |
| **容量制限** | 約5MB | 1GB（無料枠） |
| **クッキー削除で消える** | ✅ 消える | ❌ 消えない |

このアプリでは **両方を組み合わせて使っています**:
- **localStorage** = 高速キャッシュ（普段の読み書きはここ）
- **Firestore** = 真の保存場所 + 端末間同期

## 🔌 API とは何か?

**API（Application Programming Interface）** = プログラム同士の連絡通路。

身近な例えで言うと:

```
[レストランの例え]

あなた → ウェイター → 厨房
              ↑
              API（注文の窓口）
```

あなたが「ハンバーガーください」と頼むと、ウェイター（API）が厨房に伝えて、料理を持ってきてくれる。あなたは厨房の中身を知らなくていい。

**プログラムの世界では**:

```
あなたのアプリ → Firebase API → Firestoreデータベース
                    ↑
                    Googleが提供する窓口
```

`db.collection('tasks').get()` という1行を書くだけで、Googleのサーバー奥にあるデータベースから情報を取ってこられる。これがAPIの恩恵。

## 📡 通信の流れ（実例）

タスク完了時にFirestoreへ書き込む処理を例に:

```javascript
// data.js の syncCollectionDiff 関数より抜粋

const batch = db.batch();
writes.forEach(x =>
  batch.set(db.collection('subtasks').doc(x.id), x)
);
await batch.commit();
```

このコードが裏でやっていること:

1. ブラウザが **HTTPSリクエスト** を作る（暗号化された通信）
2. インターネット経由で **Googleのサーバー** に届く
3. Googleが「このリクエストはFirestoreへの書き込みだな」と判断
4. **セキュリティルール** をチェック（書き込み許可されているか）
5. データベースに書き込み
6. 結果（成功 or 失敗）を返す
7. あなたのブラウザがその結果を受け取る

これが **1秒以内** に終わります。すごい技術です。

---

# 4. 現在のデータ構造

## 📊 全体像

データには2種類あります:

```
タスク (Task)         ← 大きな目標
  └─ サブタスク (SubTask) ← 細かいステップ
  └─ サブタスク (SubTask)
  └─ サブタスク (SubTask)
```

例えば「ウェブサイトリニューアル」というタスクの中に、「デザインカンプ確認」「コーディング実装」「動作テスト」という3つのサブタスクが入る、という構造です。

## 📋 Task の中身

```json
{
  "id": "id_lyk5z3_abcde",
  "title": "プロジェクト提案書の作成",
  "startDate": "2026-05-21",
  "dueDate": "2026-05-26",
  "completed": false,
  "deleted": false,
  "createdAt": "2026-05-21T10:00:00.000Z",
  "updatedAt": "2026-05-21T10:00:00.000Z"
}
```

| フィールド | 役割 |
|---|---|
| `id` | このタスクの世界唯一の識別子 |
| `title` | タスク名 |
| `startDate` | 着手日（YYYY-MM-DD形式） |
| `dueDate` | 締切日 |
| `completed` | 完了したか？（true / false） |
| `deleted` | ゴミ箱に入れたか？（ソフトデリート用） |
| `createdAt` | 作成日時 |
| `updatedAt` | 最終更新日時（Firestore同期の差分検知に使用） |

## 📋 SubTask の中身

```json
{
  "id": "id_lyk5z4_fghij",
  "taskId": "id_lyk5z3_abcde",
  "no": 1,
  "title": "競合調査",
  "startDate": "2026-05-21",
  "dueDate": "2026-05-23",
  "completed": false,
  "deleted": false,
  "links": [
    { "label": "競合A資料", "url": "https://example.com/a" }
  ],
  "createdAt": "2026-05-21T10:01:00.000Z",
  "updatedAt": "2026-05-21T10:01:00.000Z"
}
```

| フィールド | 役割 |
|---|---|
| `id` | サブタスクの識別子 |
| `taskId` | 親タスクのIDを指す（リレーション） |
| `no` | 表示順の番号 |
| `title` | サブタスク名 |
| `links` | 関連URLの配列（複数追加可） |
| その他 | Taskと同じフィールド |

## 🗄️ 保存場所別の構造

### localStorage 内

JavaScriptの配列をそのまま文字列化して保存:

```
キー: 'onestep_tasks'
値: '[{ "id": "id_xxx", ... }, { "id": "id_yyy", ... }]'

キー: 'onestep_subtasks'
値: '[{ "id": "id_aaa", ... }, ...]'
```

### Firestore 内

ドキュメント単位で保存（コレクション = 表、ドキュメント = 行のようなイメージ）:

```
Firestore
├── tasks (コレクション)
│   ├── id_lyk5z3_abcde (ドキュメント) → { title, startDate, ... }
│   ├── id_lyk5z3_fghij (ドキュメント) → { ... }
│   └── ...
└── subtasks (コレクション)
    ├── id_lyk5z4_xxxxx (ドキュメント) → { taskId, title, ... }
    └── ...
```

ドキュメントIDに `id` フィールドの値をそのまま使っているので、`localStorage` の配列と1:1で対応します。

## 🔍 親子関係はどう表現されているか?

サブタスクが `taskId` フィールドに「親タスクのID」を持つ仕組み:

```
タスク: { id: "task_001", title: "Webサイト制作" }
        ↑
        │ taskId で参照
        │
サブタスク: { id: "sub_001", taskId: "task_001", title: "デザイン" }
サブタスク: { id: "sub_002", taskId: "task_001", title: "コーディング" }
```

「タスク001に紐づくサブタスクを取得」と言いたいときは:

```javascript
// data.js より
function getSubTasksByTaskId(taskId) {
  return loadSubTasks()
    .filter(s => s.taskId === taskId);
}
```

全サブタスクから `taskId === 指定ID` のものだけ抽出する、というシンプルな仕組みです。

---

# 5. UI更新の仕組み（JavaScriptがどう動くか）

## 🎬 「ボタンを押したら画面が変わる」を分解する

これがWebアプリの最大の魔法ですが、原理はとてもシンプルです。

### 仕組みの基本3要素

```
1. HTML要素にID/onclick属性を持たせる
2. JavaScriptがID経由でその要素を見つける
3. JavaScriptが要素の中身を書き換える
```

### ▶️ 実例: ホーム画面のレンダリング

#### HTML側 (index.html)

```html
<main id="page-content" class="flex-1 p-6">
  <!-- ここに各ページが描画される -->
</main>
```

`id="page-content"` という「タグ」が付いた空の枠があるだけ。

#### JavaScript側 (pages.js)

```javascript
function renderHome() {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="...">
      <h2>${subtask.title}</h2>
      <button onclick="handleCompleteSubTask('${subtask.id}')">完了</button>
    </div>
  `;
}
```

ここで起きていること:

1. `document.getElementById('page-content')` → さっきの空の枠を見つける
2. `.innerHTML = '...'` → その中身を新しいHTMLで上書き
3. 結果: 画面に新しいコンテンツが表示される

### 🔄 「再描画」の流れ

ボタンを押すと画面が変わる理由:

```
[完了ボタン] onclick="handleCompleteSubTask('id_xxx')"
   │
   ▼
[JavaScript] データを更新
   │
   ▼
[JavaScript] renderHome() を再度呼ぶ
   │
   ▼
[innerHTML を新しい内容で上書き]
   │
   ▼
[ブラウザ] 新しいHTMLを画面に描画
   │
   ▼
ユーザーから見ると: 画面が変わった！
```

実際には **数十ミリ秒** で全部終わります。

## 🎯 「イベント」って何?

ブラウザは常に **イベント** を監視しています:

- ボタンクリック → `click` イベント
- キー入力 → `keydown` イベント
- ページ読込完了 → `DOMContentLoaded` イベント
- フォーカス外し → `blur` イベント

JavaScriptで「このイベントが起きたらこの関数を呼んで」と登録するのが **イベントリスナー** です。

### 2つの登録方法

#### 方法A: HTMLの属性に直接書く（このアプリ採用）

```html
<button onclick="navigateTo('home')">ホーム</button>
```

ボタンに「クリックされたらnavigateTo('home')を呼ぶ」とラベルを貼っている感じ。

#### 方法B: JavaScriptで登録（モダンな書き方）

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSidebar();
});
```

「キーボード入力イベントが起きたらこの関数を呼ぶ」と中央で登録。

このアプリでは **両方を使い分けています**:
- ボタンクリック → onclick属性で簡潔に
- キーボード操作・ページ読込 → addEventListenerで柔軟に

## 🖼️ DOM とは?

**DOM (Document Object Model)** = HTMLをJavaScriptから操作するための「樹形図」のイメージ。

```
html
 └── body
      ├── header
      │    ├── button (id="menu")
      │    └── h1 (id="page-title")
      └── main (id="page-content")
           └── ...
```

JavaScriptは `document.getElementById('page-title')` のように DOM 上の要素を指して、その中身を書き換えたりイベントを取り付けたりします。

---

# 6. セキュリティの現状

## ✅ 安全なところ

### 🔒 HTTPS で通信されている
Vercelが自動でHTTPSを設定してくれているので、ブラウザ ↔ Firestore の通信は暗号化されています。途中の通信路で内容を盗み見られる心配はありません。

### 🔒 ソースコード自体に「秘密」は埋め込まれていない
パスワードやAPIシークレットなどの「本当に秘密にすべき情報」はコードに含まれていません。`firebaseConfig` の `apiKey` はそういう「秘密」ではなく、公開前提の識別子です。

### 🔒 Firestore のコレクションを制限
セキュリティルールで `tasks` と `subtasks` の2コレクションだけに読み書きを許可しています。第三者が勝手なコレクション名でゴミデータを大量に作る攻撃は防げています。

### 🔒 入力時のエスケープ処理あり
pages.jsの `escHtml()` 関数で、ユーザー入力の `<`, `>`, `"`, `'` 等をHTML安全な文字に置換しています。これがないと「タスク名にスクリプトを仕込まれて勝手にコードが実行される」XSS攻撃の余地が生まれます。

## ⚠️ 危険なところ

### 🚨 Firestore ルールが「誰でも読み書き可」

```
allow read, write: if true;
```

= URLとconfigを知っていれば、世界中の誰でもあなたのDBに書き込み・削除できます。

**現実的なリスク**:
- このサイトを偶然見つけた悪意ある人が、タスクを全部削除する
- スパム的にタスクを大量作成して使用容量を埋める
- データを書き換える（あなたが書いた内容と違うものに）

**被害の規模**:
- データが失われる
- 無料枠が消費される（とはいえ復旧可能）
- 個人情報の漏洩はない（あなたが個人情報を書かない限り）

### 🚨 「誰のデータか」の区別がない
今のままでは、もし他の人にURLを教えたら、その人もあなたのタスクを見て編集できます。「あなただけ」のアプリではなく「URLを知る全員」のアプリ。

### 🚨 `firebaseConfig` がGitHub公開リポジトリにある
これは仕様上仕方ないこと（前提として承知済み）ですが、SNS等で広めると攻撃者を呼び込む確率が上がります。

## 🛡️ 「現状で許される」範囲

このアプリは「**趣味用・個人用・URLを誰にも教えない**」前提なら、現実的にはほぼ無事に運用できます。

許される範囲を表で:

| 用途 | 安全度 |
|---|---|
| 自分1人で使う | ✅ 問題なし |
| 家族・親しい友人と共有 | ✅ 問題なし |
| URLを公開する（SNSで紹介） | ⚠️ 攻撃リスク増 |
| 仕事用・機密情報の管理 | ❌ NG。認証必須 |
| 複数ユーザーがそれぞれのデータを持つ | ❌ NG。認証必須 |

## 🔐 安全度を上げる方法

将来的に以下の対策を入れることで段階的に安全に:

1. **Phase 6 で Google認証導入** → 「あなたしか書けない」DBにする
2. Firestore ルールに「サイズ制限」を追加 → 1ドキュメント10KB以下など
3. レート制限を入れる → 短時間に100回書込みされたら遮断
4. 監視ログを有効化 → 不審なアクセスを検知

---

# 7. 今後Google認証を追加するとき

## 🎯 認証を追加することで何が変わるか

```
[認証なし（現状）]

誰でも     ─→  あなたのアプリ  ─→  Firestore（誰でもアクセス可）

[認証あり]

ユーザーA  ─→  ログイン  ─→  あなたのアプリ  ─→  Firestore（Aのデータだけアクセス可）
ユーザーB  ─→  ログイン  ─→  あなたのアプリ  ─→  Firestore（Bのデータだけアクセス可）
```

具体的には:
- 各ユーザーが自分のデータだけにアクセスできる
- 他人のデータには絶対に触れない
- 「自分専用」が本当の意味で実現

## 📂 影響するファイル

| ファイル | 変更内容 | 変更量 |
|---|---|---|
| `index.html` | Firebase Auth SDKを追加、ログインボタン用UI追加 | +20行 |
| `js/data.js` | 認証SDKの初期化、認証状態の確認、コレクションパス変更 | +30行 |
| `js/app.js` | 起動時のログイン待ち、ログアウト処理 | +15行 |
| Firestoreルール | `if true` → `if request.auth.uid != null` に変更 | +1行 |

合計でだいたい **70行程度** の追加・変更。既存ロジックを大きく書き換える必要はありません。

## 🔄 コードの変化（イメージ）

### 現状

```javascript
// data.js (起動時)
document.addEventListener('DOMContentLoaded', async () => {
  await bootstrapFromFirestore();  // すぐにデータ取得
  navigateTo('home');
});
```

### 認証導入後

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // ログイン状態を監視
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      // ログイン済み → データ取得して表示
      await bootstrapFromFirestore();
      navigateTo('home');
    } else {
      // 未ログイン → ログインボタンを表示
      showLoginScreen();
    }
  });
});
```

### Firestoreルールの変化

**現状**:
```
match /tasks/{taskId} {
  allow read, write: if true;   // 誰でも可
}
```

**認証あり（基本）**:
```
match /tasks/{taskId} {
  allow read, write: if request.auth.uid != null;   // ログインユーザーのみ
}
```

**認証あり（自分のデータだけ）**:
```
match /users/{userId}/tasks/{taskId} {
  allow read, write: if request.auth.uid == userId;   // 本人のみ
}
```

## 📦 データ構造への影響（オプション）

「複数ユーザー対応」までするなら、コレクションパスを変更:

**現状**:
```
tasks/{taskId}
subtasks/{subtaskId}
```

**ユーザー別に分ける場合**:
```
users/{userId}/tasks/{taskId}
users/{userId}/subtasks/{subtaskId}
```

ただし「自分1人だけのアプリ」なら、現状のパス構造のままでも認証は機能します（ルールで `request.auth.uid == "あなたのUID"` と固定するだけ）。

## ✨ ユーザー体験

```
[初回]
1. アプリを開く
2. 「Googleでログイン」ボタンが表示される
3. ボタンを押す → Googleの選択画面
4. アカウントを選ぶ → アプリ画面が出る

[2回目以降]
1. アプリを開く
2. 自動ログイン → 即アプリ画面（数秒の待ちあり）
```

スマホでも一度Googleにログインしていれば、ボタン1タップで完了。「面倒な認証」ではないので、心理的なハードルは低いです。

---

# 8. 初心者向け用語解説

## 🌐 HTML
**HyperText Markup Language（ハイパーテキストマークアップ言語）**

Webページの「骨組み」を作る言語。文字や画像、ボタンなどを「タグ」と呼ばれる印で囲んで配置する。

例えば `<button>クリック</button>` でボタンができ、`<h1>見出し</h1>` で大見出しになる。

「見た目」や「動き」は含まれず、純粋に「何があるか」だけを表現する。

## 🎨 CSS
**Cascading Style Sheets（カスケーディング スタイル シート）**

Webページの「見た目」を決める言語。色・大きさ・余白・配置などを指定。

例えば「ボタンを青くしたい」「文字を大きくしたい」「中央寄せにしたい」を全部CSSでやる。

このアプリは **Tailwind CSS** という「事前に用意されたCSSパーツ集」を使っているので、HTMLに `class="bg-blue-500"` のように書くだけで青背景になる、という仕組み。

## ⚙️ JavaScript
**JavaScript（ジャバスクリプト）**

Webページに「動き」を与えるプログラミング言語。

「ボタンを押したら何かする」「データを保存する」「画面の中身を入れ替える」など、ユーザーとアプリのやり取り全般を担当する。

HTMLが「家の骨組み」、CSSが「内装」、JavaScriptが「住人の動き」。

## 💾 localStorage
**ローカルストレージ**

ブラウザの中にあるミニ収納庫。Key-Value（鍵と値）形式で文字列を保存できる。

```javascript
localStorage.setItem('好きな食べ物', 'カレー');
const food = localStorage.getItem('好きな食べ物');  // 'カレー'が返る
```

特徴:
- ブラウザを閉じても消えない
- そのブラウザでのみ使える（他のブラウザ・他のPCには共有されない）
- 約5MBまで保存可能
- クッキー削除すると消える

このアプリでは「Firestoreから取ってきたデータの一時保管庫」として使っている。

## 🔌 API
**Application Programming Interface（アプリケーション プログラミング インターフェース）**

プログラム同士の「通信の窓口」。

例えば天気予報API:
- あなたのアプリ: 「東京の今日の天気を教えて」
- 天気予報API: 「晴れ、25度」と返事

裏で何が起きているかは知らなくても、決められた呼び方で頼めば情報がもらえる。

Firebase APIなら「タスク保存して」「タスク取ってきて」と頼める。

## 🔥 Supabase
**スーパベース**

Firebaseの「対抗馬」になるサービス。オープンソースで、内部的にはPostgreSQLというデータベースを使っている。

| 機能 | Firebase | Supabase |
|---|---|---|
| データベース | Firestore（NoSQL） | PostgreSQL（SQL） |
| 認証 | あり | あり |
| ストレージ | あり | あり |
| 無料枠 | あり | あり |
| ホスティング | あり | なし |
| 雰囲気 | Google系の作り | オープンソース寄り |

このアプリは **Firebase** を使っているが、後でSupabaseに乗り換えることも理論的には可能。

## 🚀 Vercel
**ヴァーセル**

Webサイトを「公開」してくれるサービス。GitHubと連携すると、コードをpushするだけで自動的にネット上に公開してくれる。

このアプリは Vercel に置いてあるので [onestep-olive.vercel.app](https://onestep-olive.vercel.app/) のようなURLで世界中からアクセスできる。

無料で使えて、HTTPS（暗号化通信）も自動で設定してくれる。

## 🔐 認証
**Authentication（オーセンティケーション）**

「あなたが本当にあなた本人ですか?」を確認する仕組み。

身近な例:
- 銀行ATM = 暗証番号で「あなたですね」を確認
- 玄関のカギ = カギを持っている人だけが本人と認める
- スマホの指紋認証 = 指紋でユーザー確認

Webアプリでは:
- パスワード認証 = メールアドレス+パスワード
- ソーシャル認証 = Googleアカウント・Twitterアカウント等で確認
- 二段階認証 = パスワード+SMSコード等で二重確認

このアプリは現状 **認証なし** で運用中。Phase 6 でGoogle認証を追加予定。

## 🗄️ データベース
**Database（DB）**

データを整理して保管する仕組み。本棚や倉庫の電子版。

身近な例:
- スマホの連絡先アプリ = 連絡先データベース
- Excelの表 = ミニデータベース
- 図書館の蔵書管理 = 大型データベース

種類:
- **SQLデータベース**: 表（テーブル）形式。例: PostgreSQL, MySQL
- **NoSQLデータベース**: 階層的・柔軟形式。例: Firestore, MongoDB

このアプリは **Firestore（NoSQL）** を使っている。

## 💻 クライアント
**Client（クライアント）**

サービスを使う側。「お客さん側」。

このアプリでは:
- あなたのブラウザ（PC のChromeとかEdgeとか） = クライアント
- スマホのSafari = クライアント

クライアントは「お願い」をする側。

## 🖥️ サーバー
**Server（サーバー）**

サービスを提供する側。「お店側」。

このアプリでは:
- Vercelが配信している `index.html` 等のファイル置き場 = Webサーバー
- Firebase Firestore = データベースサーバー

サーバーは「お願いに答える」側。

### クライアントとサーバーの関係

```
[クライアント]              [サーバー]
ブラウザ                    Vercel + Firestore
   │                            ▲
   │  ① 「ページください」       │
   ├───────────────────────────→│
   │                            │
   │  ② 「はい、これです」        │
   │←───────────────────────────┤
   │                            │
   │  ③ 「データ保存して」        │
   ├───────────────────────────→│ (Firestore宛)
   │                            │
   │  ④ 「保存しました」          │
   │←───────────────────────────┤
```

この「お願い」と「答え」のやり取りが、インターネット上で常に行われている。

---

# 🎓 まとめ

## 全体の動きの覚え方

```
ブラウザを開く
   ↓
HTML/CSS/JS が読み込まれる
   ↓
JavaScriptが Firestore からデータを取ってくる
   ↓
localStorage にキャッシュ
   ↓
JavaScriptが画面を描く（DOMを書き換える）
   ↓
ユーザーが操作する（クリック等）
   ↓
JavaScriptがイベントを検知
   ↓
データを更新（localStorage + Firestore 両方）
   ↓
画面を描き直す
   ↓
ループ
```

## 自力修正・拡張のコツ

修正したいことに応じて、見るべきファイルを切り分ける:

| やりたいこと | 見るファイル |
|---|---|
| 色を変えたい | `css/style.css` または index.html の class |
| 文言を変えたい | `js/pages.js`（各render関数内のHTML） |
| ボタンの動作を変えたい | `js/pages.js` または `js/app.js` |
| 保存方法を変えたい | `js/data.js` |
| 新しい画面を追加したい | `js/pages.js`（renderXxx関数を追加）+ `js/app.js`（navigateToのswitch追加）|
| データ項目を増やしたい | `js/data.js`（createTask/createSubTaskにフィールド追加） |
| Firestoreルールを変えたい | Firebase Console（コード変更なし） |

## 今後の学習の方向性

- **HTML/CSS/JavaScript の基礎** を体系的に学ぶ → [MDN Web Docs](https://developer.mozilla.org/ja/)
- **Firebase の公式チュートリアル** をやってみる → 認証、ストレージなど他の機能も使える
- **このアプリを「写経」しながら改造** → 一番身に付く

---

このアプリのコードは「データ層・描画層・制御層」が綺麗に分かれている良い設計です。少しずつ拡張しながら学んでいけば、いつかゼロから自分のアプリが作れるようになります。
