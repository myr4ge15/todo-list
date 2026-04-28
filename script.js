// Элементы DOM
const input = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');

// Состояние
let todos = JSON.parse(localStorage.getItem('todos')) || [];
let currentFilter = 'all'; // 'all', 'active', 'completed'

// Сохранение в LocalStorage
function saveTodos() {
    localStorage.setItem('todos', JSON.stringify(todos));
}

// Проверка пустого списка
function checkEmptyState() {
    // Проверяем, есть ли задачи, соответствующие текущему фильтру
    const visibleTodos = getFilteredTodos();
    if (visibleTodos.length === 0) {
        emptyState.style.display = 'block';
        // Меняем текст в зависимости от фильтра
        if(currentFilter === 'completed') emptyState.textContent = 'Нет завершенных задач';
        else if(currentFilter === 'active') emptyState.textContent = 'Нет активных задач';
        else emptyState.textContent = 'Список пуст 🍃';
    } else {
        emptyState.style.display = 'none';
    }
}

// Получение отфильтрованного списка
function getFilteredTodos() {
    if (currentFilter === 'active') return todos.filter(t => !t.completed);
    if (currentFilter === 'completed') return todos.filter(t => t.completed);
    return todos;
}

// Отрисовка списка
function render() {
    todoList.innerHTML = '';
    
    const itemsToRender = getFilteredTodos();

    itemsToRender.forEach((todo) => {
        // Находим оригинальный индекс в массиве todos для корректного удаления/переключения
        // (так как фильтрованный список имеет другие индексы)
        const originalIndex = todos.indexOf(todo);

        const li = document.createElement('li');
        if (todo.completed) li.classList.add('completed');

        const span = document.createElement('span');
        span.textContent = todo.text;
        span.onclick = () => toggleTodo(originalIndex);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&times;';
        delBtn.className = 'delete-btn';
        delBtn.onclick = () => deleteTodo(originalIndex, li);

        li.appendChild(span);
        li.appendChild(delBtn);
        todoList.appendChild(li);
    });

    checkEmptyState();
}

// Добавление задачи
function addTodo() {
    const text = input.value.trim();
    if (text) {
        todos.push({ text, completed: false });
        input.value = '';
        saveTodos();
        render();
    }
}

// Удаление задачи с анимацией
function deleteTodo(index, liElement) {
    liElement.classList.add('removing');
    setTimeout(() => {
        todos.splice(index, 1);
        saveTodos();
        render();
    }, 300);
}

// Переключение статуса
function toggleTodo(index) {
    todos[index].completed = !todos[index].completed;
    saveTodos();
    render();
}

// Обработчики событий
addBtn.addEventListener('click', addTodo);

input.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') addTodo();
});

// Логика фильтров
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Убираем класс active у всех кнопок
        filterBtns.forEach(b => b.classList.remove('active'));
        // Добавляем текущей
        btn.classList.add('active');
        
        // Обновляем фильтр и перерисовываем
        currentFilter = btn.getAttribute('data-filter');
        render();
    });
});

// Первый запуск
render();