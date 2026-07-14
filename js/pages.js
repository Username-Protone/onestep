/**
 * OneStep - ページ描画モジュール
 * 各画面のレンダリング関数
 */

// ========================================
// ホーム画面
// ========================================

function renderHome() {
  setPageTitle('ホーム');
  setHeaderActions('');

  const subtask = getNextSubTask();
  const content = document.getElementById('page-content');
  const contextBarHtml = renderContextSummaryBar();

  if (!subtask) {
    const filteredByContext = hasAnyIncompleteSubtask();
    content.innerHTML = `
      <div class="flex flex-col items-center" style="min-height: 60vh; padding-top: 16px;">
        ${contextBarHtml}
        <div class="flex-1 flex items-center justify-center w-full">
          <div class="text-center">
            <div class="empty-state">
              <i class="fas fa-check-circle" style="color: #d1fae5; font-size: 72px;"></i>
              <h2 class="text-2xl font-semibold text-gray-700 mt-4">${filteredByContext ? '今の条件に合うタスクはありません' : 'すべて完了！'}</h2>
              <p class="text-gray-400 text-sm mt-2">${filteredByContext ? '上の実行条件を変更すると表示されるかもしれません' : '今は実行中のタスクがありません。'}</p>
            </div>
            <div class="mt-8 flex gap-3 justify-center">
              <button onclick="navigateTo('design')" class="btn-primary">
                <i class="fas fa-plus"></i> 新しいタスクを設計
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const task = getTaskById(subtask.taskId);
  const days = daysUntil(subtask.dueDate);
  const urgentClass = (days !== null && days <= 3) ? 'text-red-500' : 'text-gray-500';
  const urgentBg = (days !== null && days <= 3) ? 'bg-red-50' : 'bg-blue-50';

  // リンクのチップ
  const linksHtml = (subtask.links || []).map(l => `
    <a href="${escHtml(l.url)}" target="_blank" rel="noopener" class="chip chip-link" title="${escHtml(l.url)}">
      <i class="fas fa-link" style="font-size:9px;"></i> ${escHtml(l.label || l.url)}
    </a>
  `).join('');

  const chipsHtml = linksHtml
    ? `<div class="flex flex-wrap gap-2 mt-4">${linksHtml}</div>`
    : '';

  content.innerHTML = `
    <div class="flex flex-col items-center justify-center" style="min-height: 60vh;">
      ${contextBarHtml}
      <div class="home-card w-full max-w-lg p-10">

        <!-- 親タスク名 -->
        <div class="mb-6">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">現在のタスク</p>
          <p class="text-sm text-gray-500 font-medium">${escHtml(task ? task.title : '—')}</p>
        </div>

        <div class="divider" style="margin: 0 0 24px 0;"></div>

        <!-- サブタスク名（メイン） -->
        <div class="mb-8">
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">今やること</p>
          <h2 class="text-2xl font-bold text-gray-900 leading-tight">${escHtml(subtask.title || '（タイトルなし）')}</h2>
          ${chipsHtml}
        </div>

        <!-- 日付情報 -->
        <div class="flex gap-6 mb-10">
          <div>
            <p class="text-xs text-gray-400 mb-1">着手日</p>
            <p class="text-sm font-medium text-gray-700">${formatDate(subtask.startDate)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-1">締切日</p>
            <p class="text-sm font-medium ${urgentClass}">${formatDate(subtask.dueDate)}</p>
          </div>
          ${days !== null ? `
          <div>
            <p class="text-xs text-gray-400 mb-1">残り</p>
            <p class="text-sm font-bold ${urgentClass}">${days < 0 ? '期限切れ' : days === 0 ? '今日' : `${days} 日`}</p>
          </div>` : ''}
        </div>

        <!-- 完了ボタン -->
        <button onclick="handleCompleteSubTask('${subtask.id}')" class="done-button w-full">
          <i class="fas fa-check mr-2"></i> 完了にする
        </button>

        <!-- サブタスク分割ボタン -->
        <button onclick="navigateTo('split', '${subtask.id}')" class="btn-secondary w-full justify-center mt-3">
          <i class="fas fa-arrows-split-up-and-left"></i> サブタスクを分割
        </button>

      </div>

      <!-- 下部リンク -->
      <div class="mt-6 flex gap-4 text-sm text-gray-400">
        <button onclick="navigateTo('design', '${subtask.taskId}')" class="hover:text-blue-500 transition-colors">
          <i class="fas fa-pen-to-square mr-1"></i> タスクを編集
        </button>
        <span class="text-gray-200">|</span>
        <button onclick="navigateTo('tasks')" class="hover:text-blue-500 transition-colors">
          <i class="fas fa-list mr-1"></i> 一覧を見る
        </button>
      </div>
    </div>
  `;
}

function handleCompleteSubTask(id) {
  completeSubTask(id);
  showToast('サブタスクを完了しました ✓');
  renderHome();
}

// ========================================
// ホーム画面: 実行条件パネル（折りたたみ式）
// ========================================

let contextPanelOpen = false;

function renderContextSummaryBar() {
  const categories = getContextCategories();
  if (categories.length === 0) return '';

  const currentContext = loadCurrentContext();
  const allValues = loadContextValues();

  const summaryHtml = categories.map(cat => {
    const activeId = currentContext[cat.id];
    const activeValue = activeId ? allValues.find(v => v.id === activeId) : null;
    const valueLabel = activeValue ? escHtml(activeValue.label) : '未設定';
    const valueClass = activeValue ? 'text-gray-700 font-medium' : 'text-gray-400';
    return `<span class="flex items-center gap-1.5 text-xs"><span class="text-gray-500">【${escHtml(cat.label)}】</span><span class="${valueClass}">${valueLabel}</span></span>`;
  }).join('<span class="text-gray-300 text-xs">|</span>');

  return `
    <div class="w-full max-w-lg mb-4">
      <button onclick="toggleContextPanel()" class="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
        <span class="flex items-center gap-3">${summaryHtml}</span>
        <i id="context-panel-chevron" class="fas fa-chevron-down text-gray-500 text-xs transition-transform ${contextPanelOpen ? 'rotate-180' : ''}"></i>
      </button>
      <div id="context-panel-body" class="${contextPanelOpen ? '' : 'hidden'} mt-2 p-4 bg-white border border-gray-300 rounded-xl space-y-4">
        ${renderContextPanelBody()}
      </div>
    </div>
  `;
}

function renderContextPanelBody() {
  const categories = getContextCategories();
  const currentContext = loadCurrentContext();

  return categories.map(cat => {
    const values = getContextValuesByCategory(cat.id);
    const pills = values.map(v => {
      const active = currentContext[cat.id] === v.id;
      return `<button type="button" class="context-pill ${active ? 'active' : ''}" onclick="selectCurrentContext('${cat.id}','${v.id}')">${escHtml(v.label)}</button>`;
    }).join('');
    return `
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">${escHtml(cat.label)}</p>
        <div class="flex flex-wrap gap-2">${pills || '<span class="text-xs text-gray-300">候補なし</span>'}</div>
      </div>
    `;
  }).join('');
}

function toggleContextPanel() {
  contextPanelOpen = !contextPanelOpen;
  const body = document.getElementById('context-panel-body');
  const chevron = document.getElementById('context-panel-chevron');
  if (body) body.classList.toggle('hidden', !contextPanelOpen);
  if (chevron) chevron.classList.toggle('rotate-180', contextPanelOpen);
}

// 現在の実行条件を選択（同じ値を再選択したら未設定に戻す）
function selectCurrentContext(categoryId, valueId) {
  setCurrentContextValue(categoryId, valueId);
  renderHome();
}

// ========================================
// 未完了タスク一覧
// ========================================

function renderTasks() {
  setPageTitle('未完了タスク一覧');
  setHeaderActions(`
    <button onclick="navigateTo('design')" class="btn-primary text-xs py-2 px-4">
      <i class="fas fa-plus"></i> 新規
    </button>
  `);

  const tasks = getActiveTasks();
  const content = document.getElementById('page-content');

  if (tasks.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-list-check"></i>
        <p class="text-lg font-medium text-gray-500">未完了のタスクはありません</p>
        <p class="text-sm text-gray-400">タスク設計から新しいタスクを追加しましょう</p>
        <button onclick="navigateTo('design')" class="btn-primary mt-4">
          <i class="fas fa-plus"></i> タスクを作成
        </button>
      </div>
    `;
    return;
  }

  const rows = tasks.map(task => {
    const next = getNextSubTaskForTask(task.id);
    const subtasks = getSubTasksByTaskId(task.id);
    const completedCount = subtasks.filter(s => s.completed).length;
    const progress = subtasks.length > 0
      ? Math.round((completedCount / subtasks.length) * 100)
      : 0;

    const nextTitle = next ? escHtml(next.title) : '<span class="text-gray-300">—</span>';
    const nextDue = next ? formatDate(next.dueDate) : '—';
    const days = next ? daysUntil(next.dueDate) : null;
    const urgentClass = (days !== null && days <= 3) ? 'text-red-500 font-semibold' : 'text-gray-600';

    return `
      <tr onclick="navigateTo('design', '${task.id}')" class="cursor-pointer hover:bg-blue-50 transition-colors">
        <td class="px-4 py-3">
          <div class="font-semibold text-gray-800">${escHtml(task.title || '（タイトルなし）')}</div>
          <div class="mt-1 flex items-center gap-2">
            <div class="h-1.5 rounded-full bg-gray-100 flex-1" style="max-width:120px;">
              <div class="h-1.5 rounded-full bg-blue-400 transition-all" style="width:${progress}%"></div>
            </div>
            <span class="text-xs text-gray-400">${completedCount}/${subtasks.length}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-gray-600">${nextTitle}</td>
        <td class="px-4 py-3 text-sm text-gray-500">${formatDate(task.startDate)}</td>
        <td class="px-4 py-3 text-sm ${urgentClass}">${nextDue}</td>
      </tr>
    `;
  }).join('');

  content.innerHTML = `
    <div class="card overflow-hidden">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:35%">タスク名</th>
            <th style="width:30%">次のサブタスク</th>
            <th style="width:17%">着手日</th>
            <th style="width:18%">締切日</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

// ========================================
// タスク設計画面
// ========================================

let currentDesignTaskId = null;
let modalContext = null; // { id, type: 'link' }

// ========================================
// 編集対象の抽象化
// リンク/実行条件モーダルは「タスク設計画面の実サブタスク」と
// 「サブタスク分割画面の下書き行（未保存）」の両方から開かれる。
// id が "draft:<index>" の形式なら下書き配列を、それ以外なら実サブタスクを操作する。
// ========================================

function resolveEditTarget(id) {
  if (typeof id === 'string' && id.startsWith('draft:')) {
    const idx = parseInt(id.slice(6), 10);
    return {
      get: () => splitDraftSubtasks[idx],
      set: (fields) => {
        splitDraftSubtasks[idx] = { ...splitDraftSubtasks[idx], ...fields };
        renderSplitDraftTable();
      },
    };
  }
  return {
    get: () => loadSubTasks().find(s => s.id === id),
    set: (fields) => {
      updateSubTask(id, fields);
      refreshSubTaskTable();
    },
  };
}

function renderDesign(taskId) {
  setPageTitle('タスク設計');

  let task;
  if (taskId) {
    task = getTaskById(taskId);
    if (!task) {
      // 存在しないIDなら新規作成
      task = createTask();
    }
  } else {
    task = createTask();
  }
  currentDesignTaskId = task.id;

  setHeaderActions(`
    <div class="flex gap-2">
      <button onclick="deleteCurrentTask()" class="btn-danger text-xs py-1.5 px-3">
        <i class="fas fa-trash-can"></i>
      </button>
    </div>
  `);

  renderDesignView(task);
}

function renderDesignView(task) {
  const subtasks = getSubTasksByTaskId(task.id);
  const content = document.getElementById('page-content');

  const subtaskRows = subtasks.map((s, idx) => renderSubTaskRow(s, idx)).join('');

  content.innerHTML = `
    <div class="design-container">

      <!-- タスクタイトル -->
      <div class="mb-6">
        <input
          id="task-title"
          type="text"
          class="task-title-input"
          placeholder="タスクタイトルを入力..."
          value="${escHtml(task.title)}"
          onblur="saveTaskField('title', this.value)"
          onkeydown="if(event.key==='Enter') this.blur()"
        />
      </div>

      <!-- タスク基本情報 -->
      <div class="card p-5 mb-6">
        <p class="section-title">タスク情報</p>
        <div class="space-y-2">
          <div class="property-row">
            <span class="property-label"><i class="fas fa-calendar-day text-gray-300 mr-1"></i> 着手日</span>
            <input
              type="date"
              class="property-input"
              value="${task.startDate || ''}"
              onchange="saveTaskField('startDate', this.value)"
            />
          </div>
          <div class="property-row">
            <span class="property-label"><i class="fas fa-flag text-gray-300 mr-1"></i> 締切日</span>
            <input
              type="date"
              class="property-input"
              value="${task.dueDate || ''}"
              onchange="saveTaskField('dueDate', this.value)"
            />
          </div>
        </div>
      </div>

      <!-- サブタスク一覧 -->
      <div class="card overflow-hidden mb-4">
        <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p class="section-title mb-0">サブタスク</p>
          <span class="text-xs text-gray-400">${subtasks.filter(s=>s.completed).length} / ${subtasks.length} 完了</span>
        </div>
        <div class="overflow-x-auto">
          <table class="subtask-table" id="subtask-table">
            <colgroup>
              <col style="width: 40px;">   <!-- No -->
              <col style="width: 40px;">   <!-- check -->
              <col>                        <!-- タイトル -->
              <col style="width: 130px;"> <!-- 着手日 -->
              <col style="width: 130px;"> <!-- 締切日 -->
              <col style="width: 180px;"> <!-- リンク/ファイル -->
              <col style="width: 40px;">  <!-- 操作 -->
            </colgroup>
            <thead>
              <tr>
                <th>No</th>
                <th></th>
                <th>サブタスク名</th>
                <th>着手日</th>
                <th>締切日</th>
                <th>URL / 実行条件</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="subtask-tbody">
              ${subtaskRows}
            </tbody>
          </table>
        </div>

        <!-- サブタスク追加ボタン -->
        <div class="px-3 py-2 border-t border-gray-50">
          <button onclick="addSubTask()" class="add-row-btn text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 text-sm">
            <i class="fas fa-plus text-xs"></i> サブタスクを追加
          </button>
        </div>
      </div>

    </div>
  `;
}

function renderSubTaskRow(s, idx) {
  const linksHtml = (s.links || []).map((l, li) => `
    <a href="${escHtml(l.url)}" target="_blank" rel="noopener" class="chip chip-link" title="${escHtml(l.url)}">
      <i class="fas fa-link" style="font-size:8px;"></i> ${escHtml(l.label || 'URL')}
      <span class="chip-remove" onclick="event.preventDefault();removeLink('${s.id}',${li})" title="削除"><i class="fas fa-xmark"></i></span>
    </a>
  `).join('');

  const allContextValues = loadContextValues();
  const contextHtml = (s.contextValueIds || []).map(vid => {
    const val = allContextValues.find(v => v.id === vid);
    if (!val) return '';
    return `<span class="chip chip-context" title="実行条件"><i class="fas fa-compass" style="font-size:8px;"></i> ${escHtml(val.label)}</span>`;
  }).join('');

  const completedClass = s.completed ? 'subtask-completed' : '';

  return `
    <tr class="${completedClass}" id="strow-${s.id}">
      <td class="text-center text-gray-400 text-xs select-none">${s.no}</td>
      <td class="text-center">
        <input
          type="checkbox"
          class="custom-check"
          ${s.completed ? 'checked' : ''}
          onchange="toggleSubTaskComplete('${s.id}', this.checked)"
        />
      </td>
      <td>
        <input
          type="text"
          class="subtask-input"
          value="${escHtml(s.title)}"
          placeholder="サブタスク名..."
          onblur="saveSubTaskField('${s.id}', 'title', this.value)"
          onkeydown="handleSubTaskKeydown(event, '${s.id}')"
          style="${s.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}"
        />
      </td>
      <td>
        <input
          type="date"
          class="subtask-input date-input"
          value="${s.startDate || ''}"
          onchange="saveSubTaskField('${s.id}', 'startDate', this.value)"
        />
      </td>
      <td>
        <input
          type="date"
          class="subtask-input date-input"
          value="${s.dueDate || ''}"
          onchange="saveSubTaskField('${s.id}', 'dueDate', this.value)"
        />
      </td>
      <td>
        <div class="flex flex-col gap-1.5">
          <div class="link-context-group${linksHtml ? '' : ' is-empty'}">
            <button onclick="openLinkModal('${s.id}')" class="row-action-btn" title="URLを追加">
              <i class="fas fa-link text-xs"></i> URL
            </button>
            ${linksHtml ? `<div class="flex flex-wrap gap-1">${linksHtml}</div>` : ''}
          </div>
          <div class="link-context-group${contextHtml ? '' : ' is-empty'}">
            <button onclick="openContextModal('${s.id}')" class="row-action-btn" title="実行条件を設定">
              <i class="fas fa-compass text-xs"></i> 実行条件
            </button>
            ${contextHtml ? `<div class="flex flex-wrap gap-1">${contextHtml}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="text-center">
        <button onclick="removeSubTask('${s.id}')" class="text-gray-200 hover:text-red-400 transition-colors p-1" title="削除">
          <i class="fas fa-xmark text-xs"></i>
        </button>
      </td>
    </tr>
  `;
}

function refreshSubTaskTable() {
  const task = getTaskById(currentDesignTaskId);
  if (!task) return;
  const subtasks = getSubTasksByTaskId(task.id);
  const tbody = document.getElementById('subtask-tbody');
  if (tbody) {
    tbody.innerHTML = subtasks.map((s, idx) => renderSubTaskRow(s, idx)).join('');
  }
  // 進捗テキスト更新
  const card = document.querySelector('.card .flex.items-center.justify-between span');
  if (card) {
    card.textContent = `${subtasks.filter(s=>s.completed).length} / ${subtasks.length} 完了`;
  }
}

function saveTaskField(field, value) {
  if (!currentDesignTaskId) return;
  updateTask(currentDesignTaskId, { [field]: value });
}

function saveSubTaskField(id, field, value) {
  updateSubTask(id, { [field]: value });
}

function toggleSubTaskComplete(id, checked) {
  if (checked) {
    completeSubTask(id);
  } else {
    uncompleteSubTask(id);
  }
  refreshSubTaskTable();
}

function addSubTask() {
  if (!currentDesignTaskId) return;
  const s = createSubTask(currentDesignTaskId);
  refreshSubTaskTable();
  // 新しい行のinputにフォーカス
  setTimeout(() => {
    const row = document.getElementById(`strow-${s.id}`);
    if (row) {
      const input = row.querySelector('.subtask-input');
      if (input) input.focus();
    }
  }, 50);
}

function removeSubTask(id) {
  deleteSubTask(id);
  refreshSubTaskTable();
}

function deleteCurrentTask() {
  if (!currentDesignTaskId) return;
  if (!confirm('このタスクをゴミ箱に移動しますか？')) return;
  deleteTask(currentDesignTaskId);
  showToast('タスクをゴミ箱に移動しました');
  navigateTo('tasks');
}

function handleSubTaskKeydown(event, id) {
  if (event.key === 'Enter') {
    event.target.blur();
    addSubTask();
  }
  if (event.key === 'Escape') {
    event.target.blur();
  }
}

// ========================================
// リンク・ファイルパス モーダル
// ========================================

function openLinkModal(id) {
  modalContext = { id, type: 'link' };
  document.getElementById('link-label').value = '';
  document.getElementById('link-url').value = '';
  openModal('modal-link');
}

function saveLink() {
  if (!modalContext) return;
  const label = document.getElementById('link-label').value.trim();
  const url = document.getElementById('link-url').value.trim();
  if (!url) { alert('URLを入力してください'); return; }

  const target = resolveEditTarget(modalContext.id);
  const s = target.get();
  if (!s) return;
  const links = [...(s.links || []), { label: label || url, url }];
  target.set({ links });
  closeModal('modal-link');
  showToast('URLを追加しました');
}

function removeLink(id, index) {
  const target = resolveEditTarget(id);
  const s = target.get();
  if (!s) return;
  const links = [...(s.links || [])];
  links.splice(index, 1);
  target.set({ links });
}

// ========================================
// 実行条件 モーダル
// ========================================

let currentContextModalTargetId = null;

function openContextModal(id) {
  currentContextModalTargetId = id;
  renderContextModalBody(id);
  openModal('modal-context');
}

function renderContextModalBody(id) {
  const subtask = resolveEditTarget(id).get();
  const body = document.getElementById('context-modal-body');
  if (!subtask || !body) return;

  const selectedIds = new Set(subtask.contextValueIds || []);
  const categories = getContextCategories();

  if (categories.length === 0) {
    body.innerHTML = `<p class="text-sm text-gray-400">実行条件カテゴリがまだありません</p>`;
    return;
  }

  body.innerHTML = categories.map(cat => {
    const values = getContextValuesByCategory(cat.id);
    const pills = values.map(v => {
      const active = selectedIds.has(v.id);
      return `
        <span class="context-pill-wrap">
          <button type="button" class="context-pill ${active ? 'active' : ''}" onclick="toggleContextValueInModal('${v.id}')">${escHtml(v.label)}</button>
          <span class="context-pill-edit" onclick="renameContextValue('${v.id}')" title="名称を変更"><i class="fas fa-pen"></i></span>
        </span>
      `;
    }).join('');

    return `
      <div>
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">${escHtml(cat.label)}</p>
        <div class="flex flex-wrap gap-2 mb-2">${pills || '<span class="text-xs text-gray-300">候補なし</span>'}</div>
        <div class="flex gap-2">
          <input
            type="text"
            id="context-new-input-${cat.id}"
            placeholder="新しい${escHtml(cat.label)}を追加"
            class="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
            onkeydown="if(event.key==='Enter'){event.preventDefault();addContextValueFromModal('${cat.id}');}"
          />
          <button onclick="addContextValueFromModal('${cat.id}')" class="text-xs text-blue-500 hover:text-blue-600 px-2 whitespace-nowrap font-medium">＋ 追加</button>
        </div>
      </div>
    `;
  }).join('<div class="divider" style="margin:16px 0;"></div>');
}

function toggleContextValueInModal(valueId) {
  if (!currentContextModalTargetId) return;
  const target = resolveEditTarget(currentContextModalTargetId);
  const s = target.get();
  if (!s) return;
  const ids = new Set(s.contextValueIds || []);
  if (ids.has(valueId)) ids.delete(valueId); else ids.add(valueId);
  target.set({ contextValueIds: Array.from(ids) });
  renderContextModalBody(currentContextModalTargetId);
}

function addContextValueFromModal(categoryId) {
  const input = document.getElementById(`context-new-input-${categoryId}`);
  if (!input) return;
  const label = input.value.trim();
  if (!label) return;

  const value = createContextValue(categoryId, label);
  if (currentContextModalTargetId) {
    const target = resolveEditTarget(currentContextModalTargetId);
    const s = target.get();
    const ids = new Set((s && s.contextValueIds) || []);
    ids.add(value.id);
    target.set({ contextValueIds: Array.from(ids) });
  }
  renderContextModalBody(currentContextModalTargetId);
  showToast(`候補「${label}」を追加しました`);
}

function renameContextValue(valueId) {
  const value = loadContextValues().find(v => v.id === valueId);
  if (!value) return;
  const newLabel = prompt('候補名を変更', value.label);
  if (newLabel === null) return;
  const trimmed = newLabel.trim();
  if (!trimmed || trimmed === value.label) return;

  updateContextValue(valueId, { label: trimmed });
  renderContextModalBody(currentContextModalTargetId);
  // ラベル変更はマスター全体に影響するため、現在開いている一覧側があれば再描画する
  if (document.getElementById('subtask-tbody')) refreshSubTaskTable();
  if (document.getElementById('split-draft-tbody')) renderSplitDraftTable();
  showToast('候補名を変更しました');
}

// ========================================
// 完了済みタスク
// ========================================

function renderCompleted() {
  setPageTitle('完了済みタスク');
  setHeaderActions('');

  const tasks = getCompletedTasks();
  const content = document.getElementById('page-content');

  if (tasks.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-circle-check"></i>
        <p class="text-lg font-medium text-gray-500">完了済みタスクはまだありません</p>
        <p class="text-sm text-gray-400">タスクのすべてのサブタスクが完了すると、ここに表示されます</p>
      </div>
    `;
    return;
  }

  const cards = tasks.map(task => {
    const subtasks = getSubTasksByTaskId(task.id);
    const subRows = subtasks.map(s => `
      <div class="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
        <i class="fas fa-check-circle text-green-400 text-xs flex-shrink-0"></i>
        <span class="text-sm text-gray-500 line-through">${escHtml(s.title)}</span>
        <span class="ml-auto text-xs text-gray-300">${formatDate(s.dueDate)}</span>
      </div>
    `).join('');

    return `
      <div class="card p-5 mb-4">
        <div class="flex items-start justify-between mb-3">
          <div>
            <span class="badge badge-completed mb-2"><i class="fas fa-check mr-1"></i> 完了</span>
            <h3 class="font-semibold text-gray-700 line-through">${escHtml(task.title || '（タイトルなし）')}</h3>
          </div>
          <button onclick="moveToTrash('${task.id}')" class="text-gray-300 hover:text-red-400 transition-colors p-1 text-sm" title="ゴミ箱へ">
            <i class="fas fa-trash-can"></i>
          </button>
        </div>
        <div class="flex gap-4 text-xs text-gray-400 mb-3">
          <span><i class="fas fa-calendar-day mr-1"></i> 着手: ${formatDate(task.startDate)}</span>
          <span><i class="fas fa-flag mr-1"></i> 締切: ${formatDate(task.dueDate)}</span>
        </div>
        <div class="divider" style="margin: 12px 0;"></div>
        <div>${subRows}</div>
      </div>
    `;
  }).join('');

  content.innerHTML = `<div class="max-w-2xl">${cards}</div>`;
}

function moveToTrash(taskId) {
  deleteTask(taskId);
  showToast('ゴミ箱に移動しました');
  renderCompleted();
}

// ========================================
// ゴミ箱
// ========================================

function renderTrash() {
  setPageTitle('ゴミ箱');
  setHeaderActions(`
    <button onclick="emptyTrash()" class="btn-danger text-xs py-1.5 px-3">
      <i class="fas fa-trash-can mr-1"></i> 全て削除
    </button>
  `);

  const tasks = getDeletedTasks();
  const content = document.getElementById('page-content');

  if (tasks.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-trash-can"></i>
        <p class="text-lg font-medium text-gray-500">ゴミ箱は空です</p>
      </div>
    `;
    return;
  }

  const cards = tasks.map(task => `
    <div class="card p-4 mb-3 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p class="font-medium text-gray-600">${escHtml(task.title || '（タイトルなし）')}</p>
        <p class="text-xs text-gray-400 mt-0.5">締切: ${formatDate(task.dueDate)}</p>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <button onclick="restoreTaskFromTrash('${task.id}')" class="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap">
          <i class="fas fa-rotate-left mr-1"></i> 復元
        </button>
        <button onclick="permanentRemoveTask('${task.id}')" class="btn-danger text-xs py-1.5 px-3 whitespace-nowrap">
          <i class="fas fa-xmark mr-1"></i> 完全削除
        </button>
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700 flex items-center gap-2">
      <i class="fas fa-triangle-exclamation"></i>
      完全削除すると元に戻せません
    </div>
    <div class="max-w-2xl">${cards}</div>
  `;
}

function restoreTaskFromTrash(id) {
  restoreTask(id);
  showToast('タスクを復元しました');
  renderTrash();
}

function permanentRemoveTask(id) {
  if (!confirm('完全に削除しますか？この操作は取り消せません。')) return;
  permanentDeleteTask(id);
  showToast('完全に削除しました');
  renderTrash();
}

function emptyTrash() {
  const tasks = getDeletedTasks();
  if (tasks.length === 0) return;
  if (!confirm(`ゴミ箱内の${tasks.length}件を完全に削除しますか？この操作は取り消せません。`)) return;
  tasks.forEach(t => permanentDeleteTask(t.id));
  showToast('ゴミ箱を空にしました');
  renderTrash();
}

// ========================================
// サブタスク分割（行動開始支援機能）
// ホーム画面の「今やること」が実は大きすぎた場合に、
// その場でさらに小さな作業へ分割し直すための画面。
// 保存ボタンを押すまでは何もDBに書き込まない下書き状態で編集する。
// ========================================

let splitOriginalSubtaskId = null;
let splitDraftSubtasks = []; // [{ title, startDate, dueDate, links, contextValueIds }]（分割画面・Inbox変換画面で共有）
let draftRowDefaults = { startDate: '', dueDate: '', links: [], contextValueIds: [] }; // 「＋追加」で行を増やす際の初期値

function renderSplit(subtaskId) {
  const original = loadSubTasks().find(s => s.id === subtaskId);
  const content = document.getElementById('page-content');

  setPageTitle('サブタスクを分割');
  setHeaderActions('');

  if (!original) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-triangle-exclamation"></i>
        <p class="text-lg font-medium text-gray-500">対象のサブタスクが見つかりませんでした</p>
        <button onclick="navigateTo('home')" class="btn-primary mt-4">ホームへ戻る</button>
      </div>
    `;
    return;
  }

  splitOriginalSubtaskId = subtaskId;
  draftRowDefaults = {
    startDate: original.startDate,
    dueDate: original.dueDate,
    links: [...(original.links || [])],
    contextValueIds: [...(original.contextValueIds || [])],
  };
  splitDraftSubtasks = [
    {
      title: '',
      startDate: original.startDate,
      dueDate: original.dueDate,
      links: [...(original.links || [])],
      contextValueIds: [...(original.contextValueIds || [])],
    },
    {
      title: '',
      startDate: original.startDate,
      dueDate: original.dueDate,
      links: [...(original.links || [])],
      contextValueIds: [...(original.contextValueIds || [])],
    },
  ];

  // 分割前サブタスクの参考表示（編集不可）
  const refLinksHtml = (original.links || []).map(l => `
    <a href="${escHtml(l.url)}" target="_blank" rel="noopener" class="chip chip-link" title="${escHtml(l.url)}">
      <i class="fas fa-link" style="font-size:9px;"></i> ${escHtml(l.label || l.url)}
    </a>
  `).join('');
  const allContextValues = loadContextValues();
  const refContextHtml = (original.contextValueIds || []).map(vid => {
    const val = allContextValues.find(v => v.id === vid);
    if (!val) return '';
    return `<span class="chip chip-context" title="実行条件"><i class="fas fa-compass" style="font-size:8px;"></i> ${escHtml(val.label)}</span>`;
  }).join('');

  content.innerHTML = `
    <div class="design-container">

      <!-- 分割前サブタスク（参考表示のみ・編集不可） -->
      <div class="card p-5 mb-4">
        <p class="section-title">分割前のサブタスク（参考）</p>
        <p class="text-lg font-semibold text-gray-800 mb-3">${escHtml(original.title || '（タイトルなし）')}</p>
        <div class="flex gap-6 mb-3 text-sm">
          <div>
            <p class="text-xs text-gray-400 mb-0.5">着手日</p>
            <p class="text-gray-600">${formatDate(original.startDate)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-400 mb-0.5">締切日</p>
            <p class="text-gray-600">${formatDate(original.dueDate)}</p>
          </div>
        </div>
        ${(refLinksHtml || refContextHtml) ? `<div class="flex flex-wrap gap-2">${refLinksHtml}${refContextHtml}</div>` : ''}
      </div>

      <p class="text-sm text-gray-500 mb-4">現在のサブタスクがまだ始めにくい場合は、さらに小さな作業へ分割しましょう。</p>

      <!-- 分割後サブタスク（下書き・Notion風表形式） -->
      <div class="card overflow-hidden mb-4">
        <div class="px-4 py-3 border-b border-gray-100">
          <p class="section-title mb-0">分割後のサブタスク</p>
        </div>
        <div class="overflow-x-auto">
          <table class="subtask-table draft-table" id="split-draft-table">
            <colgroup>
              <col style="width: 40px;">   <!-- No -->
              <col>                        <!-- タイトル -->
              <col style="width: 130px;"> <!-- 着手日 -->
              <col style="width: 130px;"> <!-- 締切日 -->
              <col style="width: 180px;"> <!-- URL/実行条件 -->
              <col style="width: 40px;">  <!-- 操作 -->
            </colgroup>
            <thead>
              <tr>
                <th>No</th>
                <th>サブタスク名</th>
                <th>着手日</th>
                <th>締切日</th>
                <th>URL / 実行条件</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="split-draft-tbody">
              ${splitDraftSubtasks.map((d, idx) => renderDraftSubtaskRow(d, idx)).join('')}
            </tbody>
          </table>
        </div>
        <div class="px-3 py-2 border-t border-gray-50">
          <button onclick="addDraftRow()" class="add-row-btn text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 text-sm">
            <i class="fas fa-plus text-xs"></i> サブタスクを追加
          </button>
        </div>
      </div>

      <div class="flex gap-3">
        <button onclick="navigateTo('home')" class="btn-secondary">キャンセル</button>
        <button onclick="confirmSplitSubTask()" class="btn-primary">
          <i class="fas fa-arrows-split-up-and-left"></i> この内容で分割する
        </button>
      </div>

    </div>
  `;
}

function renderDraftSubtaskRow(draft, idx) {
  const id = `draft:${idx}`;

  const linksHtml = (draft.links || []).map((l, li) => `
    <a href="${escHtml(l.url)}" target="_blank" rel="noopener" class="chip chip-link" title="${escHtml(l.url)}">
      <i class="fas fa-link" style="font-size:8px;"></i> ${escHtml(l.label || 'URL')}
      <span class="chip-remove" onclick="event.preventDefault();removeLink('${id}',${li})" title="削除"><i class="fas fa-xmark"></i></span>
    </a>
  `).join('');

  const allContextValues = loadContextValues();
  const contextHtml = (draft.contextValueIds || []).map(vid => {
    const val = allContextValues.find(v => v.id === vid);
    if (!val) return '';
    return `<span class="chip chip-context" title="実行条件"><i class="fas fa-compass" style="font-size:8px;"></i> ${escHtml(val.label)}</span>`;
  }).join('');

  return `
    <tr id="draft-row-${idx}">
      <td class="text-center text-gray-400 text-xs select-none">${idx + 1}</td>
      <td>
        <input
          type="text"
          class="subtask-input"
          value="${escHtml(draft.title)}"
          placeholder="サブタスク名..."
          onblur="updateDraftField(${idx}, 'title', this.value)"
          onkeydown="handleDraftKeydown(event, ${idx})"
        />
      </td>
      <td>
        <input
          type="date"
          class="subtask-input date-input"
          value="${draft.startDate || ''}"
          onchange="updateDraftField(${idx}, 'startDate', this.value)"
        />
      </td>
      <td>
        <input
          type="date"
          class="subtask-input date-input"
          value="${draft.dueDate || ''}"
          onchange="updateDraftField(${idx}, 'dueDate', this.value)"
        />
      </td>
      <td>
        <div class="flex flex-col gap-1.5">
          <div class="link-context-group${linksHtml ? '' : ' is-empty'}">
            <button onclick="openLinkModal('${id}')" class="row-action-btn" title="URLを追加">
              <i class="fas fa-link text-xs"></i> URL
            </button>
            ${linksHtml ? `<div class="flex flex-wrap gap-1">${linksHtml}</div>` : ''}
          </div>
          <div class="link-context-group${contextHtml ? '' : ' is-empty'}">
            <button onclick="openContextModal('${id}')" class="row-action-btn" title="実行条件を設定">
              <i class="fas fa-compass text-xs"></i> 実行条件
            </button>
            ${contextHtml ? `<div class="flex flex-wrap gap-1">${contextHtml}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="text-center">
        <button onclick="removeDraftRow(${idx})" class="text-gray-200 hover:text-red-400 transition-colors p-1" title="削除">
          <i class="fas fa-xmark text-xs"></i>
        </button>
      </td>
    </tr>
  `;
}

function renderSplitDraftTable() {
  const tbody = document.getElementById('split-draft-tbody');
  if (!tbody) return;
  tbody.innerHTML = splitDraftSubtasks.map((d, idx) => renderDraftSubtaskRow(d, idx)).join('');
}

function updateDraftField(idx, field, value) {
  if (!splitDraftSubtasks[idx]) return;
  splitDraftSubtasks[idx][field] = value;
}

function handleDraftKeydown(event, idx) {
  if (event.key === 'Enter') {
    event.target.blur();
    addDraftRow();
  }
  if (event.key === 'Escape') {
    event.target.blur();
  }
}

function addDraftRow() {
  splitDraftSubtasks.push({
    title: '',
    startDate: draftRowDefaults.startDate || '',
    dueDate: draftRowDefaults.dueDate || '',
    links: [...(draftRowDefaults.links || [])],
    contextValueIds: [...(draftRowDefaults.contextValueIds || [])],
  });
  renderSplitDraftTable();

  const idx = splitDraftSubtasks.length - 1;
  setTimeout(() => {
    const row = document.getElementById(`draft-row-${idx}`);
    const input = row && row.querySelector('.subtask-input');
    if (input) input.focus();
  }, 50);
}

function removeDraftRow(idx) {
  splitDraftSubtasks.splice(idx, 1);
  renderSplitDraftTable();
}

function confirmSplitSubTask() {
  const validItems = splitDraftSubtasks
    .map(d => ({ ...d, title: (d.title || '').trim() }))
    .filter(d => d.title !== '');

  if (validItems.length === 0) {
    alert('少なくとも1つはサブタスク名を入力してください');
    return;
  }

  splitSubTask(splitOriginalSubtaskId, validItems);
  showToast(`${validItems.length}件のサブタスクに分割しました`);
  navigateTo('home');
}

// ========================================
// Inbox（GTD Inbox）
// 「考えずに思いついたことを一旦放り込む場所」。
// 表示するのはタイトル・サブタスク化・完了のみ。整理はしない。
// ========================================

function renderInbox() {
  setPageTitle('Inbox');
  setHeaderActions('');
  const content = document.getElementById('page-content');

  const items = getActiveInboxItems();

  content.innerHTML = `
    <div class="design-container">

      <div class="card p-2 mb-4">
        <div class="flex items-center gap-2 px-2">
          <i class="fas fa-plus text-gray-300 text-xs"></i>
          <input
            type="text"
            id="inbox-new-input"
            class="flex-1 border-none focus:outline-none text-sm py-2.5 bg-transparent"
            placeholder="新しいInbox項目"
            onkeydown="if(event.key==='Enter'){event.preventDefault();handleAddInboxItem();}"
          />
        </div>
      </div>

      ${items.length === 0 ? `
        <p class="text-center text-gray-300 text-sm py-12">Inboxは空です</p>
      ` : `
        <div class="space-y-2">
          ${items.map(item => renderInboxRow(item)).join('')}
        </div>
      `}

    </div>
  `;

  const input = document.getElementById('inbox-new-input');
  if (input) input.focus();
}

function renderInboxRow(item) {
  return `
    <div class="card p-4 flex items-center justify-between gap-3 flex-wrap" id="inbox-row-${item.id}">
      <div class="flex items-center gap-2.5 min-w-0">
        <i class="fa-regular fa-square text-gray-300"></i>
        <span class="text-sm text-gray-700">${escHtml(item.title)}</span>
      </div>
      <div class="flex gap-2 flex-shrink-0">
        <button onclick="navigateTo('inboxConvert', '${item.id}')" class="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap">
          <i class="fas fa-arrows-split-up-and-left"></i> サブタスク化
        </button>
        <button onclick="handleCompleteInboxItem('${item.id}')" class="btn-primary text-xs py-1.5 px-3 whitespace-nowrap">
          <i class="fas fa-check"></i> 完了
        </button>
      </div>
    </div>
  `;
}

function handleAddInboxItem() {
  const input = document.getElementById('inbox-new-input');
  if (!input) return;
  const title = input.value.trim();
  if (!title) return;

  createInboxItem(title);
  renderInbox();
  updateInboxBadge();
}

function handleCompleteInboxItem(id) {
  completeInboxItem(id);
  showToast('完了しました ✓');
  renderInbox();
  updateInboxBadge();
}

// ========================================
// Inbox → サブタスク化画面
// 既存のサブタスク分割画面と同じ下書きテーブル（Notion風）を再利用する。
// 保存すると: ①新規タスクを作成 ②下書き行をそのサブタスクとして作成
// ③Inbox項目を削除 ④ホームへ戻る
// ========================================

function renderInboxConvert(inboxItemId) {
  const item = loadInboxItems().find(i => i.id === inboxItemId);
  const content = document.getElementById('page-content');

  setPageTitle('サブタスク化');
  setHeaderActions('');

  if (!item) {
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-triangle-exclamation"></i>
        <p class="text-lg font-medium text-gray-500">対象のInbox項目が見つかりませんでした</p>
        <button onclick="navigateTo('inbox')" class="btn-primary mt-4">Inboxへ戻る</button>
      </div>
    `;
    return;
  }

  splitOriginalSubtaskId = null; // 分割画面の状態と混ざらないようクリア
  draftRowDefaults = { startDate: '', dueDate: '', links: [], contextValueIds: [] };
  splitDraftSubtasks = [
    { title: '', startDate: '', dueDate: '', links: [], contextValueIds: [] },
    { title: '', startDate: '', dueDate: '', links: [], contextValueIds: [] },
  ];

  content.innerHTML = `
    <div class="design-container">

      <!-- 元のInbox項目（参考表示のみ・編集不可） -->
      <div class="card p-5 mb-4">
        <p class="section-title">Inbox</p>
        <p class="text-lg font-semibold text-gray-800">${escHtml(item.title)}</p>
      </div>

      <p class="text-sm text-gray-500 mb-4">このInbox項目を具体的なサブタスクへ分解してください。</p>

      <!-- サブタスク（下書き・Notion風表形式） -->
      <div class="card overflow-hidden mb-4">
        <div class="px-4 py-3 border-b border-gray-100">
          <p class="section-title mb-0">サブタスク</p>
        </div>
        <div class="overflow-x-auto">
          <table class="subtask-table draft-table" id="split-draft-table">
            <colgroup>
              <col style="width: 40px;">   <!-- No -->
              <col>                        <!-- タイトル -->
              <col style="width: 130px;"> <!-- 着手日 -->
              <col style="width: 130px;"> <!-- 締切日 -->
              <col style="width: 180px;"> <!-- URL/実行条件 -->
              <col style="width: 40px;">  <!-- 操作 -->
            </colgroup>
            <thead>
              <tr>
                <th>No</th>
                <th>サブタスク名</th>
                <th>着手日</th>
                <th>締切日</th>
                <th>URL / 実行条件</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="split-draft-tbody">
              ${splitDraftSubtasks.map((d, idx) => renderDraftSubtaskRow(d, idx)).join('')}
            </tbody>
          </table>
        </div>
        <div class="px-3 py-2 border-t border-gray-50">
          <button onclick="addDraftRow()" class="add-row-btn text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1.5 text-sm">
            <i class="fas fa-plus text-xs"></i> サブタスクを追加
          </button>
        </div>
      </div>

      <div class="flex gap-3">
        <button onclick="navigateTo('inbox')" class="btn-secondary">キャンセル</button>
        <button onclick="confirmInboxConvert('${inboxItemId}')" class="btn-primary">
          <i class="fas fa-arrows-split-up-and-left"></i> タスクとして追加
        </button>
      </div>

    </div>
  `;
}

function confirmInboxConvert(inboxItemId) {
  const validItems = splitDraftSubtasks
    .map(d => ({ ...d, title: (d.title || '').trim() }))
    .filter(d => d.title !== '');

  if (validItems.length === 0) {
    alert('少なくとも1つはサブタスク名を入力してください');
    return;
  }

  const item = loadInboxItems().find(i => i.id === inboxItemId);
  const taskTitle = item ? item.title : '（無題）';

  const task = createTask({ title: taskTitle });
  validItems.forEach(v => {
    createSubTask(task.id, {
      title: v.title,
      startDate: v.startDate || '',
      dueDate: v.dueDate || '',
      links: v.links || [],
      contextValueIds: v.contextValueIds || [],
    });
  });

  removeInboxItem(inboxItemId);
  showToast(`「${taskTitle}」をタスクへ追加しました`);
  navigateTo('inbox');
}

// ========================================
// ユーティリティ
// ========================================

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setPageTitle(title) {
  document.getElementById('page-title').textContent = title;
}

function setHeaderActions(html) {
  document.getElementById('header-actions').innerHTML = html;
}
