const SUPABASE_URL = "https://szhnuktnsyjqiqlqessv.supabase.co";
const SUPABASE_KEY = "sb_publishable_jHfLkut2pVyMjGanZE1pkQ_1kn16OQa";

let supabaseClient = null;
let TASK_COLUMN = null; // will be set to either 'task' or 'text' depending on the DB
let initialLoadDone = false;

const forms = document.querySelectorAll(".todo-form");

// disable all form inputs until we've confirmed Supabase client and task column
function setFormsEnabled(enabled) {
    forms.forEach((form) => {
        const input = form.querySelector("input");
        const btn = form.querySelector("button[type=submit]");
        if (input) input.disabled = !enabled;
        if (btn) btn.disabled = !enabled;
    });
}

// Show a user-friendly error and disable UI
function fatal(msg) {
    alert(msg);
    setFormsEnabled(false);
}

// Initialize Supabase client safely
function initSupabase() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        fatal('Supabase biblioteket kunne ikke indlæses. Tjek at CDN-scriptet for @supabase/supabase-js er til stede og at du har internetforbindelse.');
        return null;
    }

    try {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (err) {
        fatal('Kunne ikke initialisere Supabase-klienten: ' + err.message);
        return null;
    }
}

// Try to detect whether the table uses column "task" or "text".
// We make small select calls for each candidate column and pick the one that succeeds.
async function detectTaskColumn() {
    const candidates = ["task", "text"];
    for (const col of candidates) {
        const { data, error } = await supabaseClient
            .from("todos")
            .select(col)
            .limit(1);

        if (!error) {
            TASK_COLUMN = col;
            return col;
        }

        // If the error indicates column doesn't exist, continue trying next candidate.
        // Otherwise, bubble up the error.
        // Supabase/Postgres returns SQLSTATE 42703 for undefined column; but the client may not expose code.
        // We'll treat any error as a signal to try the next candidate, but keep the last error for reporting.
    }

    // If we get here, neither candidate worked.
    return null;
}

// Keep track of per-form save state to prevent duplicate submissions.
const formSaving = new WeakMap();

forms.forEach((form) => {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // prevent submit if not ready
        if (!initialLoadDone) {
            alert('Appen er ikke færdig med at indlæse endnu — prøv igen om et øjeblik.');
            return;
        }

        if (formSaving.get(form)) return; // already saving

        const input = form.querySelector("input");
        const taskText = input.value.trim();
        const owner = form.dataset.owner;

        if (!taskText) return;

        if (!TASK_COLUMN) {
            alert('Kan ikke oprette opgaven fordi appen ikke ved hvilken kolonne i databasen der indeholder teksten.');
            return;
        }

        formSaving.set(form, true);
        input.disabled = true;
        const submitBtn = form.querySelector("button[type=submit]");
        if (submitBtn) submitBtn.disabled = true;

        // build row dynamically using detected TASK_COLUMN
        // The database requires category as well; use the same value as the selected list.
        const row = { completed: false, owner, category: owner };
        row[TASK_COLUMN] = taskText;

        const { data, error } = await supabaseClient
            .from("todos")
            .insert(row);

        input.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
        formSaving.set(form, false);

        if (error) {
            console.error('Fejl ved indsættelse:', error);
            alert('Kunne ikke gemme opgaven: ' + error.message);
            input.focus();
            return;
        }

        input.value = "";
        input.focus();
        await loadTodos();
    });
});

async function loadTodos() {
    if (!supabaseClient) return;

    // fetch all todos ordered by created_at if available
    const { data, error } = await supabaseClient
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Fejl ved hentning:", error);
        alert("Kunne ikke hente opgaver: " + error.message);
        return;
    }

    // Detect task column if we haven't yet
    if (!TASK_COLUMN) {
        // If we have at least one row, try to inspect keys
        if (Array.isArray(data) && data.length > 0) {
            const row = data[0];
            if (Object.prototype.hasOwnProperty.call(row, "task")) TASK_COLUMN = "task";
            else if (Object.prototype.hasOwnProperty.call(row, "text")) TASK_COLUMN = "text";
        }

        // If still unknown, attempt explicit detection (select task/text)
        if (!TASK_COLUMN) {
            const detected = await detectTaskColumn();
            if (detected) TASK_COLUMN = detected;
        }

        if (!TASK_COLUMN) {
            fatal('Kunne ikke bestemme hvilken kolonne i todos-tabellen der indeholder opgave-teksten. Sørg for at tabellen har enten en "task" eller "text" kolonne (NOT NULL).');
            return;
        }
    }

    const blueList = document.getElementById("his-todos") || document.getElementById("blue-todos");
    const pinkList = document.getElementById("hers-todos") || document.getElementById("pink-todos");

    if (blueList) blueList.replaceChildren();
    if (pinkList) pinkList.replaceChildren();

    data.forEach((todo) => addTodoToPage(todo));
}

function addTodoToPage(todo) {
    const ownerKey = todo.owner;
    const list = document.getElementById(`${ownerKey}-todos`);
    if (!list) return;

    const li = document.createElement("li");
    if (todo.completed) li.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!todo.completed;

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
    const text = (TASK_COLUMN && (todo[TASK_COLUMN] ?? todo.task ?? todo.text)) || "";
    span.textContent = text;

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

// Boot
(async function boot() {
    setFormsEnabled(false);

    supabaseClient = initSupabase();
    if (!supabaseClient) return;

    // load todos and determine task column
    await loadTodos();

    initialLoadDone = true;
    setFormsEnabled(true);
})();
