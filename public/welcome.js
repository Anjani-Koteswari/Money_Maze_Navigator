const API_URL = "https://money-maze-navigator.onrender.com";

// ✅ Check session on page load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch(`${API_URL}/api/check-session`, {
            method: "GET",
            credentials: "include"
        });

        if (!res.ok) throw new Error("Session check failed");
        const data = await res.json();

        if (!data.loggedIn) {
            window.location.href = "login.html";
        } else {
            document.getElementById("usernameDisplay").textContent = data.username;
            fetchExpenses();
            fetchBudgets();
        }
    } catch (err) {
        console.error("Session check error:", err);
        window.location.href = "login.html";
    }
});

// ✅ Utility: Show notifications instead of alerts
function showNotification(msg, type = "error") {
    const notif = document.getElementById("notification");
    notif.style.color = type === "error" ? "red" : "green";
    notif.textContent = msg;
    setTimeout(() => notif.textContent = "", 4000);
}

// ✅ State
let expenses = [];
let budgets = [];
let chart;

// ---------------- EXPENSES ----------------

// Fetch Expenses
async function fetchExpenses() {
    try {
        const res = await fetch(`${API_URL}/api/expenses`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch expenses");
        expenses = await res.json();
        updateExpenseTable();
        updateChart();
    } catch (err) {
        console.error("Error loading expenses:", err);
        showNotification("Unable to load expenses. Please try again later.");
    }
}

// Add Expense
document.getElementById("expenseForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("expenseName").value.trim();
    const amount = parseFloat(document.getElementById("expenseAmount").value.trim());

    if (!name || isNaN(amount) || amount <= 0) {
        showNotification("⚠️ Please enter valid expense details.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/expenses`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name, amount })
        });

        if (!res.ok) throw new Error("Failed to add expense");

        const newExpense = await res.json();

        expenses.push({
            ...newExpense,
            date: newExpense.date || new Date().toISOString(),
            id: newExpense.id || Date.now()
        });

        document.getElementById("expenseForm").reset();
        updateExpenseTable();
        updateChart();
        checkSalaryBudget();
    } catch (err) {
        console.error("Add expense error:", err);
        showNotification("❌ Could not add expense. Try again.");
    }
});

// Delete Expense
async function deleteExpense(id) {
    try {
        const res = await fetch(`${API_URL}/api/expenses/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!res.ok) throw new Error("Failed to delete expense");

        expenses = expenses.filter(exp => exp.id !== id);
        updateExpenseTable();
        updateChart();
        checkSalaryBudget();
    } catch (err) {
        console.error("Delete expense error:", err);
        showNotification("❌ Could not delete expense. Try again.");
    }
}

// Update Expense Table
function updateExpenseTable() {
    const tbody = document.getElementById("expenseTableBody");
    tbody.innerHTML = "";

    expenses.forEach(exp => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${exp.name}</td>
            <td>₹${exp.amount}</td>
            <td>${new Date(exp.date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteExpense(${exp.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById("totalExpense").textContent =
        expenses.reduce((sum, exp) => sum + exp.amount, 0).toFixed(2);
}

// ---------------- BUDGETS ----------------

// Fetch Budgets
async function fetchBudgets() {
    try {
        const res = await fetch(`${API_URL}/api/budgets`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch budgets");
        budgets = await res.json();
        updateBudgetTable();
    } catch (err) {
        console.error("Error loading budgets:", err);
        showNotification("Unable to load budgets. Please try again later.");
    }
}

// Add Budget
document.getElementById("budgetForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const category = document.getElementById("budgetCategory").value.trim();
    const amount = parseFloat(document.getElementById("budgetAmount").value.trim());

    if (!category || isNaN(amount) || amount <= 0) {
        showNotification("⚠️ Please enter valid budget details.");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/api/budgets`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ category, amount })
        });

        if (!res.ok) throw new Error("Failed to add budget");

        const newBudget = await res.json();

        budgets.push({
            ...newBudget,
            created_at: newBudget.created_at || new Date().toISOString(),
            id: newBudget.id || Date.now()
        });

        document.getElementById("budgetForm").reset();
        updateBudgetTable();
        checkSalaryBudget();
    } catch (err) {
        console.error("Add budget error:", err);
        showNotification("❌ Could not add budget. Try again.");
    }
});

// Delete Budget
async function deleteBudget(id) {
    try {
        const res = await fetch(`${API_URL}/api/budgets/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!res.ok) throw new Error("Failed to delete budget");

        budgets = budgets.filter(b => b.id !== id);
        updateBudgetTable();
        checkSalaryBudget();
    } catch (err) {
        console.error("Delete budget error:", err);
        showNotification("❌ Could not delete budget. Try again.");
    }
}

// Update Budget Table
function updateBudgetTable() {
    const tbody = document.getElementById("budgetTableBody");
    tbody.innerHTML = "";

    budgets.forEach(b => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${b.category}</td>
            <td>₹${b.amount}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteBudget(${b.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById("totalBudget").textContent =
        budgets.reduce((sum, b) => sum + b.amount, 0).toFixed(2);
}

// ---------------- CHART ----------------
function updateChart() {
    const ctx = document.getElementById("expenseChart").getContext("2d");
    const data = expenses.reduce((acc, exp) => {
        acc[exp.name] = (acc[exp.name] || 0) + exp.amount;
        return acc;
    }, {});

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(data),
            datasets: [{
                data: Object.values(data),
                backgroundColor: Object.keys(data).map((_, i) => `hsl(${i * 50}, 70%, 50%)`)
            }]
        }
    });
}

// ---------------- SALARY & BUDGET CHECK ----------------
function checkSalaryBudget() {
    const salary = parseFloat(document.getElementById("salaryInput").value) || 0;
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

    if (salary > 0 && totalExpenses > salary) {
        showNotification("⚠️ Warning: Expenses exceed your salary!");
    }
    if (totalBudget > 0 && totalExpenses > totalBudget) {
        showNotification("⚠️ Warning: Expenses exceed your budget allocations!");
    }
}

document.getElementById("salaryInput").addEventListener("input", checkSalaryBudget);

// ---------------- LOGOUT ----------------
document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
        const res = await fetch(`${API_URL}/api/logout`, {
            method: "POST",
            credentials: "include"
        });

        if (res.ok) {
            window.location.href = "login.html";
        } else {
            showNotification("Logout failed. Try again.");
        }
    } catch (err) {
        console.error("Logout error:", err);
        showNotification("❌ Unable to logout.");
    }
});
