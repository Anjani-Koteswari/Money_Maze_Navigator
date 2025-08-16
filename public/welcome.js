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

// ✅ Expense state
let expenses = [];
let chart;

// Fetch Expenses
async function fetchExpenses() {
    try {
        const res = await fetch(`${API_URL}/api/expenses`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch expenses");
        expenses = await res.json();
        updateTable();
        updateChart();
    } catch (err) {
        console.error("Error loading expenses:", err);
        showNotification("Unable to load expenses. Please try again later.");
    }
}

// ✅ Add Expense
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

        // ✅ Ensure id/date exist
        expenses.push({
            ...newExpense,
            date: newExpense.date || new Date().toISOString(),
            id: newExpense.id || Date.now()
        });

        document.getElementById("expenseForm").reset();
        updateTable();
        updateChart();
        checkSalaryBudget();
    } catch (err) {
        console.error("Add expense error:", err);
        showNotification("❌ Could not add expense. Try again.");
    }
});

// ✅ Delete Expense
async function deleteExpense(id) {
    try {
        const res = await fetch(`${API_URL}/api/expenses/${id}`, {
            method: "DELETE",
            credentials: "include"
        });

        if (!res.ok) throw new Error("Failed to delete expense");

        expenses = expenses.filter(exp => exp.id !== id);
        updateTable();
        updateChart();
        checkSalaryBudget();
    } catch (err) {
        console.error("Delete expense error:", err);
        showNotification("❌ Could not delete expense. Try again.");
    }
}

// ✅ Update Table
function updateTable() {
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

// ✅ Update Chart (dynamic colors)
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

// ✅ Salary & Budget Checks
function checkSalaryBudget() {
    const salary = parseFloat(document.getElementById("salaryInput").value) || 0;
    const budget = parseFloat(document.getElementById("budgetInput").value) || 0;
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);

    if (salary > 0 && total > salary) {
        showNotification("⚠️ Warning: Expenses exceed your salary!");
    }
    if (budget > 0 && total > budget) {
        showNotification("⚠️ Warning: Expenses exceed your budget!");
    }
}

document.getElementById("salaryInput").addEventListener("input", checkSalaryBudget);
document.getElementById("budgetInput").addEventListener("input", checkSalaryBudget);

// ✅ Logout
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
