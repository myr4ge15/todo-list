const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');

// Modal Elements
const resultModal = document.getElementById('result-modal');
const resultInput = document.getElementById('result-input');
const saveResultBtn = document.getElementById('save-result-btn');
const cancelResultBtn = document.getElementById('cancel-result-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

const viewResultModal = document.getElementById('view-result-modal');
const fullResultText = document.getElementById('full-result-text');

// Безопасное чтение из localStorage: битые данные не должны ронять приложение
function loadTodos() {
    try {
        const parsed = JSON.parse(localStorage.getItem('todos'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        console.error('Не удалось прочитать задачи из localStorage:', e);
        return [];
    }
}

let todos = loadTodos();
let currentFilter = 'all';
let pendingTodoId = null; // ID для модальных окон

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFilteredTodos() {
    if (currentFilter === 'backlog') return todos.filter(t => t.status === 'backlog');
    if (currentFilter === 'in_progress') return todos.filter(t => t.status === 'in_progress');
    if (currentFilter === 'completed') return todos.filter(t => t.status === 'completed');
    if (currentFilter === 'cancelled') return todos.filter(t => t.status === 'cancelled');
    return todos;
}

function checkEmptyState() {
    const visibleTodos = getFilteredTodos();
    if (visibleTodos.length === 0) {
        emptyState.style.display = 'block';
        if(currentFilter === 'completed') emptyState.textContent = 'Нет завершенных задач';
        else if(currentFilter === 'in_progress') emptyState.textContent = 'Ничего в работе';
        else if(currentFilter === 'backlog') emptyState.textContent = 'Бэклог пуст';
        else if(currentFilter === 'cancelled') emptyState.textContent = 'Нет отмененных';
        else emptyState.textContent = 'Список пуст 🍃';
    } else {
        emptyState.style.display = 'none';
    }
}

function render() {
    todoList.innerHTML = '';
    const itemsToRender = getFilteredTodos();

    itemsToRender.forEach((todo) => {
        const li = document.createElement('li');
        li.setAttribute('data-id', todo.id);
        li.classList.add(`status-${todo.status}`); // Добавляем класс статуса для CSS

        const taskRow = document.createElement('div');
        taskRow.className = 'task-row';

        // 1. Кнопка статуса (цикл: backlog <-> in_progress)
        const statusBtn = document.createElement('div');
        statusBtn.className = 'status-btn';
        statusBtn.title = todo.status === 'backlog' ? 'Взять в работу' : 'Вернуть в бэклог';
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

        // Кнопка "Завершить" (видна только если in_progress)
        const finishBtn = document.createElement('button');
        finishBtn.className = 'action-btn btn-finish';
        finishBtn.innerHTML = '✅';
        finishBtn.title = 'Завершить задачу';
        finishBtn.onclick = () => openResultModal(todo.id);

        // Кнопка "Отменить"
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn btn-cancel';
        cancelBtn.innerHTML = todo.status === 'cancelled' ? '↩️' : '🚫';
        cancelBtn.title = todo.status === 'cancelled' ? 'Вернуть' : 'Отменить';
        cancelBtn.onclick = () => setStatus(todo.id, todo.status === 'cancelled' ? 'backlog' : 'cancelled');

        // Кнопка "Удалить"
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Удалить';
        // ИСПРАВЛЕНИЕ: передаем ID явно
        deleteBtn.onclick = () => openDeleteModal(todo.id);

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

        // Результат
        if (todo.status === 'completed' && todo.result) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-text';
            resultDiv.textContent = todo.result;
            resultDiv.onclick = () => openViewResultModal(todo.result);
            li.appendChild(resultDiv);
        }

        todoList.appendChild(li);
    });

    checkEmptyState();
}

function addTodo() {
    const text = input.value.trim();
    if (text) {
        todos.push({
            id: generateId(),
            text,
            status: 'backlog', // По умолчанию бэклог
            result: null,
            createdAt: Date.now(),
            completedAt: null
        });
        input.value = '';
        saveTodos();
        render();
    }
}

// --- Редактирование задачи ---

// Инлайн-правка текста: Enter/blur — сохранить, Escape — отменить
function startEdit(id, span) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = todo.text;
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

// --- Логика Статусов ---

// Переключение между Бэклогом и В работе
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
    // Если completed, то через эту кнопку не переключаем, только через отмену
    
    saveTodos();
    updateItemVisuals(todo);
}

// Установка конкретного статуса
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

// --- Модальные окна ---

function openResultModal(id) {
    pendingTodoId = id;
    resultInput.value = '';
    resultModal.classList.add('show');
    setTimeout(() => resultInput.focus(), 100);
}

function closeResultModal() {
    resultModal.classList.remove('show');
    pendingTodoId = null;
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

// Удаление
function openDeleteModal(id) {
    pendingTodoId = id;
    confirmModal.classList.add('show');
}

function closeDeleteModal() {
    confirmModal.classList.remove('show');
    pendingTodoId = null;
}

// ИСПРАВЛЕНИЕ: Обработчик кнопки подтверждения удаления
confirmDeleteBtn.onclick = () => {
    if (pendingTodoId) {
        const li = document.querySelector(`li[data-id="${pendingTodoId}"]`);
        if (li) {
            li.classList.add('removing');
            setTimeout(() => {
                todos = todos.filter(t => t.id !== pendingTodoId);
                saveTodos();
                render();
                closeDeleteModal();
            }, 300);
        }
    }
};

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

// Просмотр результата
function openViewResultModal(text) {
    fullResultText.textContent = text;
    viewResultModal.classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

window.addEventListener('click', (e) => {
    if (e.target === resultModal) closeResultModal();
    if (e.target === confirmModal) closeDeleteModal();
    if (e.target === viewResultModal) closeModal('view-result-modal');
});

// --- Обновление UI ---

function updateItemVisuals(todo) {
    const li = document.querySelector(`li[data-id="${todo.id}"]`);
    if (li) {
        // Удаляем старые классы статусов
        li.classList.remove('status-backlog', 'status-in_progress', 'status-completed', 'status-cancelled');
        li.classList.add(`status-${todo.status}`);

        // Обновляем иконки кнопок
        const statusBtn = li.querySelector('.status-btn');
        const cancelBtn = li.querySelector('.btn-cancel');
        const oldResult = li.querySelector('.result-text');
        
        if (oldResult) oldResult.remove();

        if (cancelBtn) {
            if (todo.status === 'cancelled') {
                cancelBtn.innerHTML = '↩️';
                cancelBtn.title = 'Вернуть';
            } else {
                cancelBtn.innerHTML = '🚫';
                cancelBtn.title = 'Отменить';
            }
        }

        if (todo.status === 'completed' && todo.result) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-text';
            resultDiv.textContent = todo.result;
            resultDiv.onclick = () => openViewResultModal(todo.result);
            li.appendChild(resultDiv);
        }

        // Проверка видимости при фильтрации
        const isVisible = 
            (currentFilter === 'all') ||
            (currentFilter === todo.status);
            
        if (!isVisible) {
             li.classList.add('removing');
             setTimeout(() => {
                 li.remove();
                 checkEmptyState();
             }, 300);
        }
    }
}

// --- Экспорт / импорт ---

const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

const VALID_STATUSES = ['backlog', 'in_progress', 'completed', 'cancelled'];

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

            // Нормализация: валидируем статус, проставляем недостающие поля
            const imported = data
                .filter(t => t && typeof t.text === 'string')
                .map(t => ({
                    id: t.id || generateId(),
                    text: t.text,
                    status: VALID_STATUSES.includes(t.status) ? t.status : 'backlog',
                    result: t.status === 'completed' ? (t.result ?? 'Выполнено') : null,
                    createdAt: t.createdAt ?? Date.now(),
                    completedAt: t.status === 'completed' ? (t.completedAt ?? Date.now()) : null
                }));

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

addBtn.addEventListener('click', addTodo);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTodo(); });

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        render();
    });
});

render();
