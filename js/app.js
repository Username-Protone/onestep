/**
 * OneStep - アプリケーションエントリポイント
 * ルーティング・サイドバー・モーダル・トースト管理
 */

// ========================================
// 現在のページ管理
// ========================================

let currentPage = 'home';
let currentPageParam = null;

function navigateTo(page, param = null) {
  currentPage = page;
  currentPageParam = param;
  closeSidebar();
  updateNavActive(page);

  // ページレンダリング
  switch (page) {
    case 'home':
      renderHome();
      break;
    case 'tasks':
      renderTasks();
      break;
    case 'design':
      renderDesign(param);
      break;
    case 'completed':
      renderCompleted();
      break;
    case 'trash':
      renderTrash();
      break;
    case 'split':
      renderSplit(param);
      break;
    default:
      renderHome();
  }
}

function updateNavActive(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.remove('active');
    if (el.dataset.page === page) {
      el.classList.add('active');
    }
  });
}

// ========================================
// サイドバー
// ========================================

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ========================================
// モーダル
// ========================================

function openModal(id) {
  document.getElementById('modal-overlay').classList.remove('hidden');
  const modal = document.getElementById(id);
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.classList.add('show');

  // 最初の入力にフォーカス
  setTimeout(() => {
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  modal.classList.add('hidden');
  modal.classList.remove('flex', 'show');
  document.getElementById('modal-overlay').classList.add('hidden');
  modalContext = null;
  if (id === 'modal-context') currentContextModalTargetId = null;
}

function closeAllModals() {
  ['modal-link', 'modal-context'].forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex', 'show');
    }
  });
  document.getElementById('modal-overlay').classList.add('hidden');
  modalContext = null;
  currentContextModalTargetId = null;
}

// Enterキーでモーダル内のフォームをサブミット
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllModals();
    closeSidebar();
  }
  if (e.key === 'Enter') {
    const linkModal = document.getElementById('modal-link');
    if (!linkModal.classList.contains('hidden') && document.activeElement !== linkModal.querySelector('button')) {
      saveLink();
    }
  }
});

// ========================================
// トースト通知
// ========================================

let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-message');
  msg.textContent = message;

  // リセット
  toast.classList.remove('hidden', 'show');
  toast.offsetHeight; // reflow

  toast.classList.remove('hidden');
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 400);
  }, 2800);
}

// ========================================
// キーボードショートカット
// ========================================

document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + ショートカット
  if (e.metaKey || e.ctrlKey) {
    // Ctrl+H: ホーム
    // Ctrl+N: 新規タスク設計
    // 現在は実装しない（MVPのシンプルさを優先）
  }
});

// ========================================
// 初期化
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
  // Firestoreから最新データを取り込む（接続失敗・空ならスキップ）
  await bootstrapFromFirestore();

  // 実行条件マスターのデフォルト投入（Firestore/localStorage共に空のときだけ）
  initContextMasterSeed();

  // サンプルデータ投入（Firestore/localStorage共に空のときだけ）
  initSampleData();

  // ホームページを表示
  navigateTo('home');

  console.log('OneStep initialized ✓');
});
