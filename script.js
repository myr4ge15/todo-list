const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');

let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all'; 

function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
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
        const originalIndex = todos.indexOf(todo);
        const li = document.createElement('li');
        
        // Добавляем классы в зависимости от статуса
        if (todo.status === 'completed') li.classList.add('completed');
        if (todo.status === 'cancelled') li.classList.add('cancelled');

        // 1. Чекбокс (переключает между active и completed)
        const checkbox = document.createElement('div');
        checkbox.className = 'custom-checkbox';
        checkbox.onclick = () => toggleStatus(originalIndex);

        // 2. Текст
        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = todo.text;

        // 3. Кнопки действий
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';

        // Кнопка "Отменить" (если задача активна) или "Вернуть" (если отменена/выполнена)
        // Для простоты: эта кнопка ставит статус "cancelled"
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn btn-cancel';
        cancelBtn.innerHTML = '🚫'; // Иконка запрета
        cancelBtn.title = 'Отменить задачу';
        cancelBtn.onclick = () => setStatus(originalIndex, 'cancelled');

        // Кнопка "Удалить"
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.innerHTML = '🗑️'; // Иконка корзины
        deleteBtn.title = 'Удалить навсегда';
        deleteBtn.onclick = () => deleteTodo(originalIndex, li);

        // Собираем кнопки. 
        // Если задача уже отменена, кнопку отмены можно скрыть или оставить для возврата.
        // Давайте оставим только удаление для отмененных, а для активных - отмену и удаление.
        if (todo.status !== 'cancelled') {
             actionsDiv.appendChild(cancelBtn);
        }
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(actionsDiv);
        todoList.appendChild(li);
    });

    checkEmptyState();
}

function addTodo() {
    const text = input.value.trim();
    if (text) {
        todos.push({ text, status: 'active' }); // status: 'active', 'completed', 'cancelled'
        input.value = '';
        saveTodos();
        render();
    }
}

// Переключение между active и completed по клику на чекбокс
function toggleStatus(index) {
    if (todos[index].status === 'active') {
        todos[index].status = 'completed';
    } else if (todos[index].status === 'completed') {
        todos[index].status = 'active';
    } else if (todos[index].status === 'cancelled') {
        todos[index].status = 'active'; // Возврат из отмены
    }
    saveTodos();
    render();
}

// Явная установка статуса (для кнопки отмены)
function setStatus(index, status) {
    todos[index].status = status;
    saveTodos();
    render();
}

function deleteTodo(index, liElement) {
    liElement.classList.add('removing');
    setTimeout(() => {
        todos.splice(index, 1);
        saveTodos();
        render();
    }, 300);
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
