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

let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all'; 

// Временные переменные для модальных окон
let pendingTodoId = null; // ID задачи, которую хотим выполнить или удалить

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getFilteredTodos() {
    if (currentFilter === 'active') return todos.filter(t => t.status === 'active');
    if (currentFilter === 'completed') return todos.filter(t => t.status === 'completed');
    if (currentFilter === 'cancelled') return todos.filter(t => t.status === 'cancelled');
    return todos;
}

function checkEmptyState() {
    const visibleTodos = getFilteredTodos();
    if (visibleTodos.length === 0) {
        emptyState.style.display = 'block';
        if(currentFilter === 'completed') emptyState.textContent = 'Нет завершенных задач';
        else if(currentFilter === 'active') emptyState.textContent = 'Нет активных задач';
        else if(currentFilter === 'cancelled') emptyState.textContent = 'Нет отмененных задач';
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
        
        if (todo.status === 'completed') li.classList.add('completed');
        if (todo.status === 'cancelled') li.classList.add('cancelled');

        // Контейнер для верхней строки (чекбокс, текст, кнопки)
        const taskRow = document.createElement('div');
        taskRow.className = 'task-row';

        // 1. Чекбокс
        const checkbox = document.createElement('div');
        checkbox.className = 'custom-checkbox';
        checkbox.onclick = () => handleCheckboxClick(todo.id);

        // 2. Текст
        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = todo.text;

        // 3. Кнопки действий
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        // Кнопка "Отменить/Вернуть"
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn btn-cancel';
        cancelBtn.innerHTML = todo.status === 'cancelled' ? '↩️' : '🚫';
        cancelBtn.title = todo.status === 'cancelled' ? 'Вернуть задачу' : 'Отменить задачу';
        cancelBtn.onclick = () => setStatus(todo.id, todo.status === 'cancelled' ? 'active' : 'cancelled');

        // Кнопка "Удалить"
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = 'Удалить навсегда';
        deleteBtn.onclick = () => openDeleteModal(todo.id);

        if (todo.status !== 'cancelled') {
             actionsDiv.appendChild(cancelBtn);
        } else {
             actionsDiv.appendChild(cancelBtn);
        }
        actionsDiv.appendChild(deleteBtn);

        taskRow.appendChild(checkbox);
        taskRow.appendChild(span);
        taskRow.appendChild(actionsDiv);

        li.appendChild(taskRow);

        // 4. Результат (если есть и статус completed)
        if (todo.status === 'completed' && todo.result) {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'result-text';
            resultDiv.textContent = todo.result;
            resultDiv.title = 'Нажмите, чтобы посмотреть полностью';
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
            status: 'active',
            result: null 
        });
        input.value = '';
        saveTodos();
        render();
    }
}

// --- Логика Чекбокса и Модального окна результата ---

function handleCheckboxClick(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (todo.status === 'active') {
        // Пытаемся выполнить -> открываем модалку
        pendingTodoId = id;
        openResultModal();
    } else if (todo.status === 'completed') {
        // Возвращаем в активные
        todo.status = 'active';
        todo.result = null; // Очищаем результат при возврате
        saveTodos();
        updateItemVisuals(todo);
    } else if (todo.status === 'cancelled') {
        // Возвращаем из отмены
        todo.status = 'active';
        saveTodos();
        updateItemVisuals(todo);
    }
}

function openResultModal() {
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
            todo.result = resultInput.value.trim() || 'Выполнено'; // Дефолтный текст, если пусто
            saveTodos();
            render(); // Полная перерисовка, чтобы элемент мог исчезнуть из фильтра "Активные"
        }
    }
    closeResultModal();
});

cancelResultBtn.addEventListener('click', closeResultModal);

// Закрытие по клику вне окна
window.addEventListener('click', (e) => {
    if (e.target === resultModal) closeResultModal();
    if (e.target === confirmModal) closeDeleteModal();
    if (e.target === viewResultModal) closeModal('view-result-modal');
});

// --- Логика Удаления ---

function openDeleteModal(id) {
    pendingTodoId = id;
    confirmModal.classList.add('show');
}

function closeDeleteModal() {
    confirmModal.classList.remove('show');
    pendingTodoId = null;
}

confirmDeleteBtn.addEventListener('click', () => {
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
});

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

// --- Логика Просмотра результата ---

function openViewResultModal(text) {
    fullResultText.textContent = text;
    viewResultModal.classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// --- Общая логика ---

function setStatus(id, newStatus) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.status = newStatus;
        if (newStatus !== 'completed') todo.result = null; // Сброс результата при отмене
        saveTodos();
        updateItemVisuals(todo);
    }
}

function updateItemVisuals(todo) {
    const li = document.querySelector(`li[data-id="${todo.id}"]`);
    if (li) {
        li.classList.remove('completed', 'cancelled');
        if (todo.status === 'completed') li.classList.add('completed');
        if (todo.status === 'cancelled') li.classList.add('cancelled');

        const cancelBtn = li.querySelector('.btn-cancel');
        if (cancelBtn) {
            if (todo.status === 'cancelled') {
                cancelBtn.innerHTML = '↩️';
                cancelBtn.title = 'Вернуть задачу';
            } else {
                cancelBtn.innerHTML = '🚫';
                cancelBtn.title = 'Отменить задачу';
            }
        }
        
        // Обновление результата в DOM без полной перерисовки сложно, 
        // поэтому если статус изменился на completed, лучше перерисовать список,
        // но для плавности мы оставим это на откуп пользователю (переключение фильтра)
        // или просто удалим старый результат визуально, если он был.
        const oldResult = li.querySelector('.result-text');
        if (oldResult) oldResult.remove();

        if (todo.status === 'completed' && todo.result) {
             const resultDiv = document.createElement('div');
            resultDiv.className = 'result-text';
            resultDiv.textContent = todo.result;
            resultDiv.onclick = () => openViewResultModal(todo.result);
            li.appendChild(resultDiv);
        }
            
        const isVisible = 
            (currentFilter === 'all') ||
            (currentFilter === 'active' && todo.status === 'active') ||
            (currentFilter === 'completed' && todo.status === 'completed') ||
            (currentFilter === 'cancelled' && todo.status === 'cancelled');
            
        if (!isVisible) {
             li.classList.add('removing');
             setTimeout(() => {
                 li.remove();
                 checkEmptyState();
             }, 300);
        }
    }
}

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
