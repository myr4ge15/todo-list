const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('search-input');
const createPriority = document.getElementById('create-priority');
const createDue = document.getElementById('create-due');
const toast = document.getElementById('toast');

// Modal Elements
const resultModal = document.getElementById('result-modal');
const resultInput = document.getElementById('result-input');
const saveResultBtn = document.getElementById('save-result-btn');
const cancelResultBtn = document.getElementById('cancel-result-btn');

const viewResultModal = document.getElementById('view-result-modal');
const fullResultText = document.getElementById('full-result-text');
const closeViewResultBtn = document.getElementById('close-view-result-btn');

const VALID_STATUSES = ['backlog', 'in_progress', 'completed', 'cancelled'];
const PRIORITY_ORDER = ['low', 'medium', 'high'];
const PRIORITY_LABELS = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
function priorityWeight(p) { return { low: 1, medium: 2, high: 3 }[p] || 2; }

// --- Работа с датами (строки формата YYYY-MM-DD, сравнимы лексикографически) ---
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isValidDate(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isOverdue(todo) {
    return todo.dueDate
        && (todo.status === 'backlog' || todo.status === 'in_progress')
        && todo.dueDate < todayStr();
}
function formatDate(s) {
    const [y, m, d] = s.split('-');
    return `${d}.${m}.${y.slice(2)}`;
}

// Нормализация задачи: проставляет недостающие/битые поля (для legacy и импорта)
function normalizeTodo(t) {
    return {
        id: t.id || generateId(),
        text: t.text,
        status: VALID_STATUSES.includes(t.status) ? t.status : 'backlog',
        result: t.status === 'completed' ? (t.result ?? 'Выполнено') : null,
        createdAt: t.createdAt ?? Date.now(),
        completedAt: t.status === 'completed' ? (t.completedAt ?? Date.now()) : null,
        priority: PRIORITY_ORDER.includes(t.priority) ? t.priority : 'medium',
        dueDate: isValidDate(t.dueDate) ? t.dueDate : null
    };
}

// Безопасное чтение из localStorage: битые данные не должны ронять приложение
function loadTodos() {
    try {
        const parsed = JSON.parse(localStorage.getItem('todos'));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(t => t && typeof t.text === 'string').map(normalizeTodo);
    } catch (e) {
        console.error('Не удалось прочитать задачи из localStorage:', e);
        return [];
    }
}

let todos = loadTodos();
let currentFilter = 'all';
let currentSearch = '';
let pendingTodoId = null; // ID для модальных окон

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// --- Фильтрация и сортировка ---

function doneRank(t) {
    return (t.status === 'completed' || t.status === 'cancelled') ? 1 : 0;
}

// Активные — вверху; среди них по сроку (без срока — вниз), затем по приоритету, затем по дате создания.
// Завершённые/отменённые — вниз, недавние выше.
function sortTodos(list) {
    return list.slice().sort((a, b) => {
        const ra = doneRank(a), rb = doneRank(b);
        if (ra !== rb) return ra - rb;
        if (ra === 0) {
            const da = a.dueDate || '9999-99-99';
            const db = b.dueDate || '9999-99-99';
            if (da !== db) return da < db ? -1 : 1;
            if (priorityWeight(b.priority) !== priorityWeight(a.priority)) {
                return priorityWeight(b.priority) - priorityWeight(a.priority);
            }
            return a.createdAt - b.createdAt;
        }
        return (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt);
    });
}

function matchesSearch(t) {
    return !currentSearch || t.text.toLowerCase().includes(currentSearch);
}

function getFilteredTodos() {
    const list = todos.filter(t => {
        const byStatus = currentFilter === 'all' || t.status === currentFilter;
        return byStatus && matchesSearch(t);
    });
    return sortTodos(list);
}

// --- Счётчики фильтров ---
function updateFilterCounts() {
    const counts = { all: 0, backlog: 0, in_progress: 0, completed: 0, cancelled: 0 };
    todos.forEach(t => {
        if (!matchesSearch(t)) return;
        counts.all++;
        if (counts[t.status] !== undefined) counts[t.status]++;
    });
    filterBtns.forEach(btn => {
        const f = btn.dataset.filter;
        btn.textContent = `${btn.dataset.label} (${counts[f] ?? 0})`;
    });
}

function checkEmptyState() {
    const visibleTodos = getFilteredTodos();
    if (visibleTodos.length === 0) {
        emptyState.style.display = 'block';
        if (currentSearch) emptyState.textContent = 'Ничего не найдено 🔍';
        else if (currentFilter === 'completed') emptyState.textContent = 'Нет завершенных задач';
        else if (currentFilter === 'in_progress') emptyState.textContent = 'Ничего в работе';
        else if (currentFilter === 'backlog') emptyState.textContent = 'Бэклог пуст';
        else if (currentFilter === 'cancelled') emptyState.textContent = 'Нет отмененных';
        else emptyState.textContent = 'Список пуст 🍃';
    } else {
        emptyState.style.display = 'none';
    }
}

function statusBtnLabel(todo) {
    switch (todo.status) {
        case 'backlog': return 'Взять в работу';
        case 'in_progress': return 'Вернуть в бэклог';
        case 'completed': return 'Задача завершена';
        case 'cancelled': return 'Вернуть в бэклог';
        default: return 'Сменить статус';
    }
}

// --- Построение элемента задачи (общий код для render и updateItemVisuals) ---
function createTaskElement(todo) {
    const li = document.createElement('li');
    li.setAttribute('data-id', todo.id);
    li.classList.add(`status-${todo.status}`, `priority-${todo.priority}`);
    if (isOverdue(todo)) li.classList.add('overdue');

    const taskRow = document.createElement('div');
    taskRow.className = 'task-row';

    // 1. Кнопка статуса (цикл: backlog <-> in_progress)
    const statusBtn = document.createElement('button');
    statusBtn.type = 'button';
    statusBtn.className = 'status-btn';
    statusBtn.title = statusBtnLabel(todo);
    statusBtn.setAttribute('aria-label', statusBtnLabel(todo));
    statusBtn.onclick = () => toggleWorkStatus(todo.id);

    // 2. Текст
    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = todo.text;
    span.title = 'Двойной клик — редактировать';
    span.ondblclick = () => startEdit(todo.id, span);

    // 3. Кнопки действий
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'actions';

    const finishBtn = document.createElement('button');
    finishBtn.type = 'button';
    finishBtn.className = 'action-btn btn-finish';
    finishBtn.textContent = '✅';
    finishBtn.title = 'Завершить задачу';
    finishBtn.setAttribute('aria-label', 'Завершить задачу');
    finishBtn.onclick = () => openResultModal(todo.id);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'action-btn btn-cancel';
    cancelBtn.textContent = todo.status === 'cancelled' ? '↩️' : '🚫';
    cancelBtn.title = todo.status === 'cancelled' ? 'Вернуть' : 'Отменить';
    cancelBtn.setAttribute('aria-label', todo.status === 'cancelled' ? 'Вернуть задачу' : 'Отменить задачу');
    cancelBtn.onclick = () => setStatus(todo.id, todo.status === 'cancelled' ? 'backlog' : 'cancelled');

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'action-btn btn-delete';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = 'Удалить';
    deleteBtn.setAttribute('aria-label', 'Удалить задачу');
    deleteBtn.onclick = () => deleteTodo(todo.id);

    if (todo.status !== 'cancelled') {
        actionsDiv.appendChild(finishBtn);
        actionsDiv.appendChild(cancelBtn);
    } else {
        actionsDiv.appendChild(cancelBtn);
    }
    actionsDiv.appendChild(deleteBtn);

    taskRow.appendChild(statusBtn);
    taskRow.appendChild(span);
    taskRow.appendChild(actionsDiv);
    li.appendChild(taskRow);

    // Мета-строка: приоритет + срок
    const meta = document.createElement('div');
    meta.className = 'task-meta';

    const priorityBadge = document.createElement('button');
    priorityBadge.type = 'button';
    priorityBadge.className = 'priority-badge';
    priorityBadge.textContent = PRIORITY_LABELS[todo.priority];
    priorityBadge.title = 'Сменить приоритет';
    priorityBadge.setAttribute('aria-label', `Приоритет: ${PRIORITY_LABELS[todo.priority]}. Нажмите, чтобы сменить`);
    priorityBadge.onclick = () => cyclePriority(todo.id);
    meta.appendChild(priorityBadge);

    const dueBadge = document.createElement('button');
    dueBadge.type = 'button';
    dueBadge.className = 'due-badge';
    if (todo.dueDate) {
        dueBadge.textContent = '📅 ' + formatDate(todo.dueDate);
        if (isOverdue(todo)) dueBadge.classList.add('overdue-badge');
        dueBadge.setAttribute('aria-label',
            `Срок: ${formatDate(todo.dueDate)}${isOverdue(todo) ? ', просрочено' : ''}. Нажмите, чтобы изменить`);
    } else {
        dueBadge.textContent = '📅 срок';
        dueBadge.classList.add('due-empty');
        dueBadge.setAttribute('aria-label', 'Задать срок');
    }
    dueBadge.title = 'Задать / изменить срок';
    dueBadge.onclick = () => startDueEdit(todo.id, dueBadge);
    meta.appendChild(dueBadge);

    li.appendChild(meta);

    // Результат (у завершённых)
    if (todo.status === 'completed' && todo.result) {
        const resultBtn = document.createElement('button');
        resultBtn.type = 'button';
        resultBtn.className = 'result-text';
        resultBtn.textContent = todo.result;
        resultBtn.title = 'Показать итог';
        resultBtn.setAttribute('aria-label', `Итог: ${todo.result}. Открыть полностью`);
        resultBtn.onclick = () => openViewResultModal(todo.result);
        li.appendChild(resultBtn);
    }

    return li;
}

function render() {
    todoList.innerHTML = '';
    getFilteredTodos().forEach(todo => todoList.appendChild(createTaskElement(todo)));
    updateFilterCounts();
    checkEmptyState();
}

function addTodo() {
    const text = input.value.trim();
    if (text) {
        todos.push({
            id: generateId(),
            text,
            status: 'backlog',
            result: null,
            createdAt: Date.now(),
            completedAt: null,
            priority: createPriority.value || 'medium',
            dueDate: createDue.value || null
        });
        input.value = '';
        createDue.value = '';
        saveTodos();
        render();
        input.focus();
    }
}

// --- Редактирование текста задачи ---
function startEdit(id, span) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = todo.text;
    editInput.setAttribute('aria-label', 'Редактирование текста задачи');
    span.replaceWith(editInput);
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);

    let done = false;
    const finish = (save) => {
        if (done) return; // защита от двойного вызова (Enter + blur)
        done = true;
        if (save) {
            const val = editInput.value.trim();
            if (val) { // пустой ввод не затирает задачу
                todo.text = val;
                saveTodos();
            }
        }
        render();
    };

    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
    });
    editInput.addEventListener('blur', () => finish(true));
}

// --- Инлайн-редактирование срока ---
function startDueEdit(id, badge) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'due-input';
    dateInput.value = todo.dueDate || '';
    dateInput.setAttribute('aria-label', 'Срок задачи');
    badge.replaceWith(dateInput);
    dateInput.focus();
    try { dateInput.showPicker && dateInput.showPicker(); } catch (e) { /* не поддерживается */ }

    let done = false;
    const finish = (save) => {
        if (done) return;
        done = true;
        if (save) {
            todo.dueDate = dateInput.value || null;
            saveTodos();
        }
        render();
    };

    dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
    });
    dateInput.addEventListener('change', () => finish(true));
    dateInput.addEventListener('blur', () => finish(true));
}

// --- Приоритет ---
function cyclePriority(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const idx = PRIORITY_ORDER.indexOf(todo.priority);
    todo.priority = PRIORITY_ORDER[(idx + 1) % PRIORITY_ORDER.length];
    saveTodos();
    updateItemVisuals(todo);
}

// --- Логика статусов ---
function toggleWorkStatus(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (todo.status === 'backlog') {
        todo.status = 'in_progress';
    } else if (todo.status === 'in_progress') {
        todo.status = 'backlog';
    } else if (todo.status === 'cancelled') {
        todo.status = 'backlog';
    }
    // completed этой кнопкой не трогаем

    saveTodos();
    updateItemVisuals(todo);
}

function setStatus(id, newStatus) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.status = newStatus;
        if (newStatus !== 'completed') {
            todo.result = null;
            todo.completedAt = null;
        }
        saveTodos();
        updateItemVisuals(todo);
    }
}

// Точечное обновление одного <li> без полной перерисовки списка (чтобы не мигал список).
function updateItemVisuals(todo) {
    const oldLi = document.querySelector(`li[data-id="${todo.id}"]`);
    if (!oldLi) return;

    const visible =
        (currentFilter === 'all' || currentFilter === todo.status) && matchesSearch(todo);

    if (!visible) {
        oldLi.classList.add('removing');
        setTimeout(() => {
            oldLi.remove();
            checkEmptyState();
        }, 300);
        updateFilterCounts();
        return;
    }

    const newLi = createTaskElement(todo);
    newLi.classList.add('no-anim'); // без повторной анимации появления
    oldLi.replaceWith(newLi);
    updateFilterCounts();
}

// --- Удаление с возможностью отмены (тост) ---
let toastTimer = null;

function deleteTodo(id) {
    const idx = todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    const removed = todos[idx];

    const finish = () => {
        const i = todos.findIndex(t => t.id === id);
        if (i !== -1) todos.splice(i, 1);
        saveTodos();
        render();
        showUndoToast(removed, idx);
    };

    const li = document.querySelector(`li[data-id="${id}"]`);
    if (li) {
        li.classList.add('removing');
        setTimeout(finish, 300);
    } else {
        finish();
    }
}

function showUndoToast(removed, idx) {
    clearTimeout(toastTimer);
    toast.innerHTML = '';

    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = 'Задача удалена';

    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'toast-undo';
    undoBtn.textContent = '↩️ Отменить';
    undoBtn.onclick = () => {
        const pos = Math.min(idx, todos.length);
        todos.splice(pos, 0, removed);
        saveTodos();
        render();
        hideToast();
    };

    toast.appendChild(msg);
    toast.appendChild(undoBtn);
    toast.classList.add('show');
    toastTimer = setTimeout(hideToast, 5000);
}

function hideToast() {
    clearTimeout(toastTimer);
    toast.classList.remove('show');
}

// --- Модальные окна (a11y: Escape, фокус-ловушка, возврат фокуса) ---
let currentModal = null;
let lastFocused = null;

function getFocusable(modal) {
    return Array.from(modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
}

function openModal(modal, focusEl) {
    lastFocused = document.activeElement;
    modal.classList.add('show');
    currentModal = modal;
    const target = focusEl || getFocusable(modal)[0];
    if (target) setTimeout(() => target.focus(), 50);
}

function closeCurrentModal() {
    if (!currentModal) return;
    const m = currentModal;
    currentModal = null;
    m.classList.remove('show');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
}

function handleModalClose(modal) {
    if (modal === resultModal) closeResultModal();
    else closeCurrentModal();
}

document.addEventListener('keydown', (e) => {
    if (!currentModal) return;
    if (e.key === 'Escape') {
        e.preventDefault();
        handleModalClose(currentModal);
    } else if (e.key === 'Tab') {
        const f = getFocusable(currentModal);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

// Модалка результата
function openResultModal(id) {
    pendingTodoId = id;
    resultInput.value = '';
    openModal(resultModal, resultInput);
}

function closeResultModal() {
    pendingTodoId = null;
    closeCurrentModal();
}

saveResultBtn.addEventListener('click', () => {
    if (pendingTodoId) {
        const todo = todos.find(t => t.id === pendingTodoId);
        if (todo) {
            todo.status = 'completed';
            todo.result = resultInput.value.trim() || 'Выполнено';
            todo.completedAt = Date.now();
            saveTodos();
            render();
        }
    }
    closeResultModal();
});

cancelResultBtn.addEventListener('click', closeResultModal);

// Модалка просмотра результата
function openViewResultModal(text) {
    fullResultText.textContent = text;
    openModal(viewResultModal);
}

closeViewResultBtn.addEventListener('click', closeCurrentModal);

// Клик по фону закрывает модалку
window.addEventListener('click', (e) => {
    if (e.target === resultModal) closeResultModal();
    else if (e.target === viewResultModal) closeCurrentModal();
});

// --- Экспорт / импорт ---
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

function exportTodos() {
    const blob = new Blob([JSON.stringify(todos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importTodos(file) {
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!Array.isArray(data)) throw new Error('Ожидался массив задач');

            const imported = data
                .filter(t => t && typeof t.text === 'string')
                .map(normalizeTodo);

            if (todos.length > 0 &&
                !confirm(`Импорт заменит текущий список (${todos.length} задач) на ${imported.length}. Продолжить?`)) {
                return;
            }

            todos = imported;
            saveTodos();
            render();
        } catch (e) {
            alert('Не удалось импортировать файл: ' + e.message);
        }
    };
    reader.readAsText(file);
}

exportBtn.addEventListener('click', exportTodos);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importTodos(file);
    importFile.value = ''; // сброс, чтобы повторный выбор того же файла сработал
});

// --- Ввод / поиск / фильтры ---
addBtn.addEventListener('click', addTodo);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });

searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value.trim().toLowerCase();
    render();
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        currentFilter = btn.getAttribute('data-filter');
        render();
    });
});

render();
