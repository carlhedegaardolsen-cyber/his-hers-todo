
const forms = document.querySelectorAll(".todo-form");

forms.forEach((form) => {
    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const input = form.querySelector("input");
        const task = input.value.trim();
        const owner = form.dataset.owner;

        if (!task) return;

        addTodo(task, owner);
        input.value = "";
        input.focus();
    });
});

function addTodo(task, owner) {
    const list = document.getElementById(`${owner}-todos`);

    const li = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
        li.classList.toggle("done", checkbox.checked);
    });

    const span = document.createElement("span");
    span.textContent = task;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "Slet opgave");

    deleteButton.addEventListener("click", () => {
        li.remove();
    });

    li.append(checkbox, span, deleteButton);
    list.appendChild(li);
}

