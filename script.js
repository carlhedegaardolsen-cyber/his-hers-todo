const SUPABASE_URL = "https://szhnuktnsyjqiqlqessv.supabase.co";
const SUPABASE_KEY = "sb_publishable_jHfLkut2pVyMjGanZE1pkQ_1kn16OQa";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const forms = document.querySelectorAll(".todo-form");

forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const input = form.querySelector("input");
        const task = input.value.trim();
        const owner = form.dataset.owner;

        if (!task) return;

        input.disabled = true;

        const { error } = await supabaseClient
            .from("todos")
            .insert({
                text: task,
                completed: false,
                owner: owner
            });

        input.disabled = false;

        if (error) {
            alert("Kunne ikke gemme opgaven: " + error.message);
            input.focus();
            return;
        }

        input.value = "";
        input.focus();
        await loadTodos();
    });
});

async function loadTodos() {
    const { data, error } = await supabaseClient
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Fejl ved hentning:", error.message);
        alert("Kunne ikke hente opgaver: " + error.message);
        return;
    }

    document.getElementById("blue-todos").replaceChildren();
    document.getElementById("pink-todos").replaceChildren();

    data.forEach((todo) => {
        addTodoToPage(todo);
    });
}

function addTodoToPage(todo) {
    const list = document.getElementById(`${todo.owner}-todos`);
    if (!list) return;

    const li = document.createElement("li");
    if (todo.completed) li.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;

    checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;

        const { error } = await supabaseClient
            .from("todos")
            .update({ completed: checkbox.checked })
            .eq("id", todo.id);

        checkbox.disabled = false;

        if (error) {
            checkbox.checked = !checkbox.checked;
            alert("Kunne ikke opdatere opgaven: " + error.message);
            return;
        }

        li.classList.toggle("done", checkbox.checked);
    });

    const span = document.createElement("span");
    span.textContent = todo.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "Slet opgave");

    deleteButton.addEventListener("click", async () => {
        deleteButton.disabled = true;

        const { error } = await supabaseClient
            .from("todos")
            .delete()
            .eq("id", todo.id);

        if (error) {
            deleteButton.disabled = false;
            alert("Kunne ikke slette opgaven: " + error.message);
            return;
        }

        li.remove();
    });

    li.append(checkbox, span, deleteButton);
    list.appendChild(li);
}

loadTodos();
