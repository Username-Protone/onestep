/**
 * OneStep - データ管理モジュール
 * localStorage を使ったタスク・サブタスクの CRUD
 * + Firestore 同期（Phase 2: 読み込みのみ）
 */

const STORAGE_KEYS = {
  TASKS: 'onestep_tasks',
  SUBTASKS: 'onestep_subtasks',
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
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
}

function loadSubTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBTASKS) || '[]');
  } catch {
    return [];
  }
}

function saveSubTasks(subtasks) {
  localStorage.setItem(STORAGE_KEYS.SUBTASKS, JSON.stringify(subtasks));
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

function createSubTask(taskId, { title = '', startDate = '', dueDate = '' } = {}) {
  const subtasks = loadSubTasks();
  const existingNos = subtasks
    .filter(s => s.taskId === taskId && !s.deleted)
    .map(s => s.no);
  const nextNo = existingNos.length > 0 ? Math.max(...existingNos) + 1 : 1;

  const subtask = {
    id: generateId(),
    taskId,
    no: nextNo,
    title,
    startDate,
    dueDate,
    completed: false,
    deleted: false,
    links: [],      // [{ label: string, url: string }]
    filePaths: [],  // [{ label: string, path: string }]
    createdAt: now(),
    updatedAt: now(),
  };
  subtasks.push(subtask);
  saveSubTasks(subtasks);
  return subtask;
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
  return updateSubTask(id, { deleted: true });
}

function permanentDeleteSubTask(id) {
  let subtasks = loadSubTasks();
  subtasks = subtasks.filter(s => s.id !== id);
  saveSubTasks(subtasks);
}

function getSubTasksByTaskId(taskId, includeDeleted = false) {
  return loadSubTasks()
    .filter(s => s.taskId === taskId && (includeDeleted || !s.deleted))
    .sort((a, b) => a.no - b.no || a.createdAt.localeCompare(b.createdAt));
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
    !s.deleted
  );

  if (subtasks.length === 0) return null;

  // 締切昇順 → 作成日昇順
  subtasks.sort((a, b) => {
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return subtasks[0];
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
    const [tasksSnap, subtasksSnap] = await Promise.all([
      db.collection('tasks').get(),
      db.collection('subtasks').get(),
    ]);

    const tasksFromCloud = tasksSnap.docs.map(d => d.data());
    const subtasksFromCloud = subtasksSnap.docs.map(d => d.data());

    // Firestoreに何かあればlocalStorageを上書き
    // （初回はFirestoreが空なので何もしない＝既存挙動）
    if (tasksFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasksFromCloud));
      console.log(`Firestoreから ${tasksFromCloud.length} 件のタスクを取得`);
    }
    if (subtasksFromCloud.length > 0) {
      localStorage.setItem(STORAGE_KEYS.SUBTASKS, JSON.stringify(subtasksFromCloud));
      console.log(`Firestoreから ${subtasksFromCloud.length} 件のサブタスクを取得`);
    }
  } catch (e) {
    console.warn('Firestore取り込み失敗（localStorageで動作継続）:', e);
  }
}
