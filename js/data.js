/**
 * OneStep - データ管理モジュール
 * localStorage を使ったタスク・サブタスクの CRUD
 * + Firestore 同期（Phase 2: 読み込みのみ）
 */

const STORAGE_KEYS = {
  TASKS: 'onestep_tasks',
  SUBTASKS: 'onestep_subtasks',
  CONTEXT_CATEGORIES: 'onestep_context_categories',
  CONTEXT_VALUES: 'onestep_context_values',
  CURRENT_CONTEXT: 'onestep_current_context', // ローカル限定・Firestore同期しない
  INBOX: 'onestep_inbox',
};

// ========================================
// Firebase 初期化
// ========================================
// ⚠️ Phase 1 で取得した firebaseConfig を以下に貼り付けてください。貼り付けました
const firebaseConfig = {
  apiKey: "AIzaSyCDxZtGgjWONu16TyrwxQDp5xjhnNZS_c4",
  authDomain: "onestep-f1e42.firebaseapp.com",
  projectId: "onestep-f1e42",
  storageBucket: "onestep-f1e42.firebasestorage.app",
  messagingSenderId: "187766148042",
  appId: "1:187766148042:web:64fe4761575bc76a415d33"
};


let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  console.log('Firebase initialized ✓');
} catch (e) {
  console.warn('Firebase初期化失敗（localStorageのみで動作します）:', e);
}

// ========================================
// ユーティリティ
// ========================================

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

function formatDate(dateStr) {
  if (!dateStr) return '未設定';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '未設定';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function deadlineBadge(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return '';
  if (days < 0) return `<span class="badge badge-deadline-soon">期限切れ</span>`;
  if (days === 0) return `<span class="badge badge-deadline-soon">今日</span>`;
  if (days <= 3) return `<span class="badge badge-deadline-soon">あと ${days} 日</span>`;
  return `<span class="badge badge-normal">あと ${days} 日</span>`;
}

// ========================================
// localStorage 読み書き
// ========================================

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS) || '[]');
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  const oldTasks = loadTasks();
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  syncCollectionDiff('tasks', oldTasks, tasks); // fire-and-forget
}

function loadSubTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBTASKS) || '[]');
  } catch {
    return [];
  }
}

function saveSubTasks(subtasks) {
  const oldSubtasks = loadSubTasks();
  localStorage.setItem(STORAGE_KEYS.SUBTASKS, JSON.stringify(subtasks));
  syncCollectionDiff('subtasks', oldSubtasks, subtasks); // fire-and-forget
}

// ========================================
// タスク CRUD
// ========================================

function createTask({ title = '', startDate = '', dueDate = '' } = {}) {
  const tasks = loadTasks();
  const task = {
    id: generateId(),
    title,
    startDate,
    dueDate,
    completed: false,
    deleted: false,
    createdAt: now(),
    updatedAt: now(),
  };
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

function updateTask(id, fields) {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...fields, updatedAt: now() };
  saveTasks(tasks);
  return tasks[idx];
}

function deleteTask(id) {
  // ゴミ箱へ移動（deleted フラグ）
  return updateTask(id, { deleted: true });
}

function restoreTask(id) {
  return updateTask(id, { deleted: false });
}

function permanentDeleteTask(id) {
  let tasks = loadTasks();
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(tasks);
  // サブタスクも削除
  let subtasks = loadSubTasks();
  subtasks = subtasks.filter(s => s.taskId !== id);
  saveSubTasks(subtasks);
}

function getTaskById(id) {
  return loadTasks().find(t => t.id === id) || null;
}

function getActiveTasks() {
  return loadTasks().filter(t => !t.deleted && !t.completed);
}

function getCompletedTasks() {
  return loadTasks().filter(t => !t.deleted && t.completed);
}

function getDeletedTasks() {
  return loadTasks().filter(t => t.deleted);
}

// ========================================
// サブタスク CRUD
// ========================================

function createSubTask(taskId, { title = '', startDate = '', dueDate = '', links = [], contextValueIds = [] } = {}) {
  resequenceSubTasks(taskId); // 既存データにorder未設定のものがあれば先に整える

  const subtasks = loadSubTasks();
  const maxOrder = subtasks
    .filter(s => s.taskId === taskId && !s.deleted)
    .reduce((max, s) => Math.max(max, typeof s.order === 'number' ? s.order : -1), -1);

  const subtask = {
    id: generateId(),
    taskId,
    no: 0, // resequenceSubTasks で確定させる
    order: maxOrder + 1,
    title,
    startDate,
    dueDate,
    completed: false,
    deleted: false,
    links,          // [{ label: string, url: string }]
    contextValueIds, // ExecutionContextValue.id の配列（空=そのカテゴリは条件なし）
    createdAt: now(),
    updatedAt: now(),
  };
  subtasks.push(subtask);
  saveSubTasks(subtasks);

  resequenceSubTasks(taskId);
  return subtask;
}

// order順に0始まりで振り直し、その順番からNo（1始まり・表示専用）を自動採番する。
// order未設定の既存データが混ざっている場合は、no→作成日時の順序を引き継いでorderを新規付与する（遅延移行）。
// 実際に値が変わったサブタスクだけ updatedAt を更新するので、Firestoreへの書き込みも変更分のみになる。
function resequenceSubTasks(taskId) {
  const subtasks = loadSubTasks();
  const taskSubtasks = subtasks.filter(s => s.taskId === taskId && !s.deleted);
  if (taskSubtasks.length === 0) return;

  const sorted = taskSubtasks.slice().sort((a, b) => {
    const aHasOrder = typeof a.order === 'number';
    const bHasOrder = typeof b.order === 'number';
    if (aHasOrder && bHasOrder) return a.order - b.order;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    return (a.no - b.no) || a.createdAt.localeCompare(b.createdAt);
  });

  let anyChanged = false;
  sorted.forEach((s, idx) => {
    const target = subtasks.find(x => x.id === s.id);
    const newNo = idx + 1;
    if (target.order !== idx || target.no !== newNo) {
      target.order = idx;
      target.no = newNo;
      target.updatedAt = now();
      anyChanged = true;
    }
  });

  if (anyChanged) saveSubTasks(subtasks);
}

function updateSubTask(id, fields) {
  const subtasks = loadSubTasks();
  const idx = subtasks.findIndex(s => s.id === id);
  if (idx === -1) return null;
  subtasks[idx] = { ...subtasks[idx], ...fields, updatedAt: now() };
  saveSubTasks(subtasks);

  // 全サブタスク完了なら親タスクを完了に
  const taskId = subtasks[idx].taskId;
  checkAndCompleteTask(taskId);

  return subtasks[idx];
}

function deleteSubTask(id) {
  const target = loadSubTasks().find(s => s.id === id);
  const result = updateSubTask(id, { deleted: true });
  if (target) resequenceSubTasks(target.taskId); // Noの欠番を詰める
  return result;
}

function permanentDeleteSubTask(id) {
  let subtasks = loadSubTasks();
  subtasks = subtasks.filter(s => s.id !== id);
  saveSubTasks(subtasks);
}

function getSubTasksByTaskId(taskId, includeDeleted = false) {
  if (!includeDeleted) resequenceSubTasks(taskId); // order/No の遅延移行・整合
  return loadSubTasks()
    .filter(s => s.taskId === taskId && (includeDeleted || !s.deleted))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.no - b.no);
}

// ========================================
// サブタスク分割（行動開始支援機能）
// 元サブタスクを削除し、その order 位置へ新しいサブタスク群を挿入する。
// 後続のサブタスクは order を後ろへずらす。
// ========================================

// 指定したorderへ直接差し込むための内部生成関数（createSubTaskとは異なり末尾追加ではない）
function createSubTaskAtOrder(taskId, order, { title = '', startDate = '', dueDate = '', links = [], contextValueIds = [] } = {}) {
  const subtasks = loadSubTasks();
  const subtask = {
    id: generateId(),
    taskId,
    no: 0, // resequenceSubTasks で確定させる
    order,
    title,
    startDate,
    dueDate,
    completed: false,
    deleted: false,
    links,
    contextValueIds,
    createdAt: now(),
    updatedAt: now(),
  };
  subtasks.push(subtask);
  saveSubTasks(subtasks);
  return subtask;
}

// originalSubtaskId のサブタスクを削除し、newItems（配列）で置き換える。
// newItems の各要素: { title, startDate, dueDate, links, contextValueIds }
function splitSubTask(originalSubtaskId, newItems) {
  const original = loadSubTasks().find(s => s.id === originalSubtaskId);
  if (!original || newItems.length === 0) return [];

  const taskId = original.taskId;
  const sortedBefore = getSubTasksByTaskId(taskId); // order/Noを整えつつ現在の並びを取得
  const insertIndex = sortedBefore.findIndex(s => s.id === originalSubtaskId);
  if (insertIndex === -1) return [];

  // 元サブタスクをソフト削除する。
  // updateSubTask() は内部で checkAndCompleteTask() → getSubTasksByTaskId() を
  // 経由して resequenceSubTasks() を呼ぶため、この時点で削除跡の order は
  // 自動的に詰められる（例: order 0,1,2,3 → Bを消すと 0,1,2）。
  // そのため後続をずらす基準は「詰め終わった後のinsertIndex」で考える。
  updateSubTask(originalSubtaskId, { deleted: true });

  // 挿入位置(insertIndex)以降のサブタスクを newItems.length 個分うしろへずらす
  const subtasks = loadSubTasks();
  subtasks.forEach(s => {
    if (s.taskId === taskId && !s.deleted && typeof s.order === 'number' && s.order >= insertIndex) {
      s.order += newItems.length;
      s.updatedAt = now();
    }
  });
  saveSubTasks(subtasks);

  // 新しいサブタスク群を元の位置へ挿入
  const created = newItems.map((item, idx) => createSubTaskAtOrder(taskId, insertIndex + idx, {
    title: item.title || '',
    startDate: item.startDate || '',
    dueDate: item.dueDate || '',
    links: item.links || [],
    contextValueIds: item.contextValueIds || [],
  }));

  resequenceSubTasks(taskId); // Noを整える
  return created;
}

function completeSubTask(id) {
  return updateSubTask(id, { completed: true });
}

function uncompleteSubTask(id) {
  const subtasks = loadSubTasks();
  const idx = subtasks.findIndex(s => s.id === id);
  if (idx === -1) return null;
  subtasks[idx] = { ...subtasks[idx], completed: false, updatedAt: now() };
  saveSubTasks(subtasks);

  // 親タスクも未完了に戻す
  const taskId = subtasks[idx].taskId;
  updateTask(taskId, { completed: false });

  return subtasks[idx];
}

// ========================================
// 親タスク自動完了チェック
// ========================================

function checkAndCompleteTask(taskId) {
  const subtasks = getSubTasksByTaskId(taskId);
  if (subtasks.length === 0) return;
  const allDone = subtasks.every(s => s.completed);
  if (allDone) {
    updateTask(taskId, { completed: true });
  } else {
    // サブタスクが未完了になったら親も未完了に
    const task = getTaskById(taskId);
    if (task && task.completed) {
      updateTask(taskId, { completed: false });
    }
  }
}

// ========================================
// ホーム画面: 次のサブタスク取得
// ========================================

function getNextSubTask() {
  const activeTasks = getActiveTasks().map(t => t.id);
  const subtasks = loadSubTasks().filter(s =>
    activeTasks.includes(s.taskId) &&
    !s.completed &&
    !s.deleted &&
    subtaskMatchesCurrentContext(s)
  );

  if (subtasks.length === 0) return null;

  // 締切昇順 → サブタスクの並び順（order）→ 作成日昇順
  // order は resequenceSubTasks() を通ったタスクにのみ存在するため、
  // 未移行のタスクが混ざっていても安全に動作するよう作成日時へフォールバックする
  // （ここでは書き込みを発生させない読み取り専用のフォールバック）
  subtasks.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;

    const aOrder = typeof a.order === 'number' ? a.order : null;
    const bOrder = typeof b.order === 'number' ? b.order : null;
    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;

    return a.createdAt.localeCompare(b.createdAt);
  });

  return subtasks[0];
}

// 実行条件フィルタを無視して、未完了サブタスクが1件でも存在するか
// （ホーム画面で「すべて完了」と「今の条件に合うタスクなし」を区別するために使用）
function hasAnyIncompleteSubtask() {
  const activeTasks = getActiveTasks().map(t => t.id);
  return loadSubTasks().some(s =>
    activeTasks.includes(s.taskId) && !s.completed && !s.deleted
  );
}

// ========================================
// タスク一覧: 次のサブタスク取得（タスク別）
// ========================================

function getNextSubTaskForTask(taskId) {
  const subtasks = loadSubTasks().filter(s =>
    s.taskId === taskId && !s.completed && !s.deleted
  );
  if (subtasks.length === 0) return null;
  subtasks.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return a.createdAt.localeCompare(b.createdAt);
  });
  return subtasks[0];
}

// ========================================
// 実行条件マスター（Execution Context）
// カテゴリ（場所・状態…）と候補（自宅・電車…）を
// アプリ全体で共有し、SubTask は候補IDのみを参照する。
// カテゴリを追加してもSubTaskのスキーマは変わらない。
// ========================================

function loadContextCategories() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTEXT_CATEGORIES) || '[]');
  } catch {
    return [];
  }
}

function saveContextCategories(categories) {
  const old = loadContextCategories();
  localStorage.setItem(STORAGE_KEYS.CONTEXT_CATEGORIES, JSON.stringify(categories));
  syncCollectionDiff('contextCategories', old, categories);
}

function loadContextValues() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTEXT_VALUES) || '[]');
  } catch {
    return [];
  }
}

function saveContextValues(values) {
  const old = loadContextValues();
  localStorage.setItem(STORAGE_KEYS.CONTEXT_VALUES, JSON.stringify(values));
  syncCollectionDiff('contextValues', old, values);
}

function getContextCategories() {
  return loadContextCategories().slice().sort((a, b) => a.order - b.order);
}

function getContextValuesByCategory(categoryId) {
  return loadContextValues()
    .filter(v => v.categoryId === categoryId)
    .sort((a, b) => a.order - b.order);
}

function createContextCategory({ key, label, order } = {}) {
  const categories = loadContextCategories();
  const category = {
    id: generateId(),
    key,
    label,
    order: order ?? categories.length,
    createdAt: now(),
    updatedAt: now(),
  };
  categories.push(category);
  saveContextCategories(categories);
  return category;
}

function createContextValue(categoryId, label) {
  const values = loadContextValues();
  const orderInCat = values.filter(v => v.categoryId === categoryId).length;
  const value = {
    id: generateId(),
    categoryId,
    label,
    order: orderInCat,
    createdAt: now(),
    updatedAt: now(),
  };
  values.push(value);
  saveContextValues(values);
  return value;
}

function updateContextValue(id, fields) {
  const values = loadContextValues();
  const idx = values.findIndex(v => v.id === id);
  if (idx === -1) return null;
  values[idx] = { ...values[idx], ...fields, updatedAt: now() };
  saveContextValues(values);
  return values[idx];
}

// 初回起動時のみ、デフォルトの「場所」「状態」カテゴリと候補を投入する
function initContextMasterSeed() {
  if (loadContextCategories().length > 0) return;

  const locationCat = createContextCategory({ key: 'location', label: '場所', order: 0 });
  ['自宅', '大学', '電車', '外出先'].forEach(label => createContextValue(locationCat.id, label));

  const stateCat = createContextCategory({ key: 'state', label: '状態', order: 1 });
  ['集中できる', '普通', '疲れている'].forEach(label => createContextValue(stateCat.id, label));
}

// ========================================
// 現在の実行条件（デバイスローカル・Firestore同期しない）
// カテゴリごとに1候補のみ選択（例: 場所=電車, 状態=疲れている）
// ========================================

function loadCurrentContext() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_CONTEXT) || '{}');
  } catch {
    return {};
  }
}

function saveCurrentContext(context) {
  localStorage.setItem(STORAGE_KEYS.CURRENT_CONTEXT, JSON.stringify(context));
}

// 同じ値を選び直したら「未設定」に戻す（トグル動作）
function setCurrentContextValue(categoryId, valueId) {
  const context = loadCurrentContext();
  if (context[categoryId] === valueId) {
    delete context[categoryId];
  } else {
    context[categoryId] = valueId;
  }
  saveCurrentContext(context);
  return context;
}

function toggleSubTaskContextValue(subtaskId, valueId) {
  const subtasks = loadSubTasks();
  const target = subtasks.find(s => s.id === subtaskId);
  if (!target) return null;
  const ids = new Set(target.contextValueIds || []);
  if (ids.has(valueId)) ids.delete(valueId); else ids.add(valueId);
  return updateSubTask(subtaskId, { contextValueIds: Array.from(ids) });
}

// サブタスクが「現在の実行条件」に一致するか判定
// カテゴリ内でサブタスクの候補が空 → そのカテゴリは無条件で合格（未設定=すべて可）
// 現在の実行条件が未選択のカテゴリ → フィルタしない
function subtaskMatchesCurrentContext(subtask) {
  const categories = getContextCategories();
  if (categories.length === 0) return true;

  const currentContext = loadCurrentContext();
  const valueCategoryMap = new Map(loadContextValues().map(v => [v.id, v.categoryId]));
  const subtaskValueIds = subtask.contextValueIds || [];

  return categories.every(cat => {
    const subtaskValuesInCat = subtaskValueIds.filter(vid => valueCategoryMap.get(vid) === cat.id);
    if (subtaskValuesInCat.length === 0) return true;
    const activeValueId = currentContext[cat.id];
    if (!activeValueId) return true;
    return subtaskValuesInCat.includes(activeValueId);
  });
}

// ========================================
// Inbox（GTD Inbox）
// 「考えずに思いついたことを一旦放り込む場所」。
// タスク/サブタスクとは完全に独立したコレクションで管理する。
// 「完了」はTaskと同じくソフト削除的に completed:true にするだけ
// （履歴として残す）。「サブタスク化」は内容が実タスクへ引き継がれるため
// 文字通り削除する（confirmInboxConvert 側で removeInboxItem を呼ぶ）。
// ========================================

function loadInboxItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.INBOX) || '[]');
  } catch {
    return [];
  }
}

function saveInboxItems(items) {
  const old = loadInboxItems();
  localStorage.setItem(STORAGE_KEYS.INBOX, JSON.stringify(items));
  syncCollectionDiff('inbox', old, items);
}

function createInboxItem(title) {
  const items = loadInboxItems();
  const item = {
    id: generateId(),
    title,
    completed: false,
    createdAt: now(),
    updatedAt: now(),
  };
  items.push(item);
  saveInboxItems(items);
  return item;
}

function completeInboxItem(id) {
  const items = loadInboxItems();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], completed: true, updatedAt: now() };
  saveInboxItems(items);
  return items[idx];
}

function removeInboxItem(id) {
  let items = loadInboxItems();
  items = items.filter(i => i.id !== id);
  saveInboxItems(items);
}

function getActiveInboxItems() {
  return loadInboxItems()
    .filter(i => !i.completed)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function getActiveInboxCount() {
  return loadInboxItems().filter(i => !i.completed).length;
}

// ========================================
// サンプルデータ投入（初回起動用）
// ========================================

function initSampleData() {
  if (loadTasks().length > 0) return; // 既にデータあり

  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const addDays = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return fmt(d); };

  const task1 = createTask({ title: 'プロジェクト提案書の作成', startDate: fmt(today), dueDate: addDays(5) });
  createSubTask(task1.id, { title: '競合調査', startDate: fmt(today), dueDate: addDays(2) });
  createSubTask(task1.id, { title: '構成案の作成', startDate: addDays(2), dueDate: addDays(3) });
  createSubTask(task1.id, { title: 'スライド制作', startDate: addDays(3), dueDate: addDays(4) });
  createSubTask(task1.id, { title: '上司レビュー', startDate: addDays(4), dueDate: addDays(5) });

  const task2 = createTask({ title: 'ウェブサイトリニューアル', startDate: fmt(today), dueDate: addDays(14) });
  createSubTask(task2.id, { title: 'デザインカンプ確認', startDate: fmt(today), dueDate: addDays(3) });
  createSubTask(task2.id, { title: 'コーディング実装', startDate: addDays(3), dueDate: addDays(10) });
  createSubTask(task2.id, { title: '動作テスト', startDate: addDays(10), dueDate: addDays(13) });
}

// ========================================
// Firestore → localStorage 取り込み（起動時）
// ========================================
// 役割: アプリ起動時に1回だけFirestoreから全件取得し、
//      localStorageへ書き込む。以降の読み込みはlocalStorage経由で高速。
//      Firestoreが空・接続失敗時はlocalStorageだけで動作（既存挙動を維持）。

async function bootstrapFromFirestore() {
  if (!db) return; // Firebase未初期化なら何もしない

  try {
    const [tasksSnap, subtasksSnap, categoriesSnap, valuesSnap, inboxSnap] = await Promise.all([
      db.collection('tasks').get(),
      db.collection('subtasks').get(),
      db.collection('contextCategories').get(),
      db.collection('contextValues').get(),
      db.collection('inbox').get(),
    ]);

    const tasksFromCloud = tasksSnap.docs.map(d => d.data());
    const subtasksFromCloud = subtasksSnap.docs.map(d => d.data());
    const categoriesFromCloud = categoriesSnap.docs.map(d => d.data());
    const valuesFromCloud = valuesSnap.docs.map(d => d.data());
    const inboxFromCloud = inboxSnap.docs.map(d => d.data());

    // タスク: Firestoreにデータがあれば取り込み、空ならlocalStorageを初回アップロード
    if (tasksFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasksFromCloud));
      console.log(`Firestoreから ${tasksFromCloud.length} 件のタスクを取得`);
    } else {
      const localTasks = loadTasks();
      if (localTasks.length > 0) {
        await syncCollectionDiff('tasks', [], localTasks);
        console.log(`localStorage→Firestore: ${localTasks.length} 件のタスクを初回アップロード`);
      }
    }

    // サブタスク: 同上
    if (subtasksFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.SUBTASKS, JSON.stringify(subtasksFromCloud));
      console.log(`Firestoreから ${subtasksFromCloud.length} 件のサブタスクを取得`);
    } else {
      const localSubtasks = loadSubTasks();
      if (localSubtasks.length > 0) {
        await syncCollectionDiff('subtasks', [], localSubtasks);
        console.log(`localStorage→Firestore: ${localSubtasks.length} 件のサブタスクを初回アップロード`);
      }
    }

    // 実行条件カテゴリ: 同上
    if (categoriesFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CONTEXT_CATEGORIES, JSON.stringify(categoriesFromCloud));
      console.log(`Firestoreから ${categoriesFromCloud.length} 件の実行条件カテゴリを取得`);
    } else {
      const localCategories = loadContextCategories();
      if (localCategories.length > 0) {
        await syncCollectionDiff('contextCategories', [], localCategories);
        console.log(`localStorage→Firestore: ${localCategories.length} 件の実行条件カテゴリを初回アップロード`);
      }
    }

    // 実行条件候補: 同上
    if (valuesFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CONTEXT_VALUES, JSON.stringify(valuesFromCloud));
      console.log(`Firestoreから ${valuesFromCloud.length} 件の実行条件候補を取得`);
    } else {
      const localValues = loadContextValues();
      if (localValues.length > 0) {
        await syncCollectionDiff('contextValues', [], localValues);
        console.log(`localStorage→Firestore: ${localValues.length} 件の実行条件候補を初回アップロード`);
      }
    }

    // Inbox: 同上
    if (inboxFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.INBOX, JSON.stringify(inboxFromCloud));
      console.log(`Firestoreから ${inboxFromCloud.length} 件のInbox項目を取得`);
    } else {
      const localInbox = loadInboxItems();
      if (localInbox.length > 0) {
        await syncCollectionDiff('inbox', [], localInbox);
        console.log(`localStorage→Firestore: ${localInbox.length} 件のInbox項目を初回アップロード`);
      }
    }
  } catch (e) {
    console.warn('Firestore取り込み失敗（localStorageで動作継続）:', e);
  }
}

// ========================================
// Firestore 差分書き込みヘルパー
// ========================================
// 役割: 旧配列と新配列を比較し、変更/追加されたものだけwrite、消えたものをdelete。
//       updatedAtフィールドの違いで「変更あり」と判定（既存CRUDが更新済み）。
//       db未初期化や通信エラーは握りつぶしてlocalStorageで動作継続。

async function syncCollectionDiff(collectionName, oldList, newList) {
  if (!db) return;

  const oldMap = new Map(oldList.map(x => [x.id, x]));
  const newMap = new Map(newList.map(x => [x.id, x]));

  const writes = newList.filter(x => {
    const old = oldMap.get(x.id);
    return !old || old.updatedAt !== x.updatedAt;
  });
  const deletes = oldList.filter(x => !newMap.has(x.id)).map(x => x.id);

  if (writes.length === 0 && deletes.length === 0) return;

  try {
    const batch = db.batch();
    writes.forEach(x => batch.set(db.collection(collectionName).doc(x.id), x));
    deletes.forEach(id => batch.delete(db.collection(collectionName).doc(id)));
    await batch.commit();
    console.log(`Firestore[${collectionName}] write:${writes.length} delete:${deletes.length}`);
  } catch (e) {
    console.warn(`Firestore ${collectionName} sync failed:`, e);
  }
}
