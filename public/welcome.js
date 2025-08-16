document.addEventListener('DOMContentLoaded', async function () {
    const userId = localStorage.getItem('loggedInUser'); // stored after login

    if (!userId) {
        window.location.href = "login.html";
        return;
    }

    let expenses = [];
    let budgets = {};
    let salary = 0;

    const expenseForm = document.getElementById('expense-input');
    const expenseNameInput = document.getElementById('expenseName');
    const expenseAmountInput = document.getElementById('expenseAmount');
    const expenseTableBody = document.querySelector('#expenseTable tbody');
    const showSummaryBtn = document.querySelector('.show-summary');
    const setSalaryBtn = document.querySelector('.set-salary');
    const showPieChartBtn = document.querySelector('.show-pie-chart');
    const showBarChartBtn = document.querySelector('.show-bar-chart');
    const setBudgetBtn = document.querySelector('.set-budget');
    const logoutBtn = document.getElementById('logoutBtn');

    const pieChartCanvas = document.getElementById('myPieChart');
    const barChartCanvas = document.getElementById('myBarChart');
    let currentChart = null;

    // 🔹 Load initial data from backend
    await loadData();

    if (expenseForm) {
        expenseForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            await addExpense();
        });

        showSummaryBtn?.addEventListener('click', function () {
            window.open('summary.html', '_blank');
        });

        setSalaryBtn?.addEventListener('click', async function () {
            const salaryInput = parseFloat(prompt('Enter your monthly Income'));
            if (!isNaN(salaryInput) && salaryInput > 0) {
                salary = salaryInput;
                await fetch(`https://money-maze-navigator.onrender.com/api/salary`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, salary })
                });
                alert(`Monthly Salary set: ${salary}`);
            } else {
                alert('Please enter a valid salary amount.');
            }
        });

        showPieChartBtn?.addEventListener('click', showPieChart);
        showBarChartBtn?.addEventListener('click', showBarChart);

        setBudgetBtn?.addEventListener('click', async function () {
            const budgetInputName = prompt('Enter the expense name for the budget:');
            const budgetInputAmount = parseFloat(prompt('Enter the budget amount:'));
            if (budgetInputName && !isNaN(budgetInputAmount) && budgetInputAmount > 0) {
                budgets[budgetInputName] = budgetInputAmount;
                await fetch(`https://money-maze-navigator.onrender.com/api/budget`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, name: budgetInputName, amount: budgetInputAmount })
                });
                alert(`Budget for ${budgetInputName} set: ${budgetInputAmount}`);
            } else {
                alert('Please enter valid budget details.');
            }
        });

        // 🔹 Logout
        logoutBtn?.addEventListener('click', async function () {
            await fetch('https://money-maze-navigator.onrender.com/api/logout', {
                method: "POST",
                credentials: "include"
            });
            localStorage.removeItem('loggedInUser');
            window.location.href = 'login.html';
        });
    }

    // === FUNCTIONS ===

    async function loadData() {
        // Fetch expenses
        const expRes = await fetch(`https://money-maze-navigator.onrender.com/api/expenses?userId=${userId}`);
        expenses = await expRes.json();

        // Fetch salary
        const salRes = await fetch(`https://money-maze-navigator.onrender.com/api/salary?userId=${userId}`);
        const salData = await salRes.json();
        salary = salData.salary || 0;

        // Fetch budgets
        const budRes = await fetch(`https://money-maze-navigator.onrender.com/api/budget?userId=${userId}`);
        const budData = await budRes.json();
        budgets = budData || {};

        updateTable();
    }

    async function addExpense() {
        const name = expenseNameInput.value;
        const amount = parseFloat(expenseAmountInput.value);

        if (name && !isNaN(amount)) {
            const res = await fetch(`https://money-maze-navigator.onrender.com/api/expenses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, name, amount })
            });
            const newExpense = await res.json();

            expenses.push(newExpense);
            updateTable();
            clearInputs();
            checkBudgetAlert(name, amount);
            checkSalaryAlert();
        } else {
            alert('Please fill in all fields.');
        }
    }

    function updateTable() {
        expenseTableBody.innerHTML = '';
        expenses.forEach((expense, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(expense.date).toLocaleDateString()}</td>
                <td>${expense.name}</td>
                <td>${expense.amount.toFixed(2)}</td>
                <td>
                    <button class="btn edit-expense" data-id="${expense.id}">Edit</button>
                    <button class="btn delete-expense" data-id="${expense.id}">Delete</button>
                </td>
            `;
            expenseTableBody.appendChild(row);
        });
        updateTotal();
        attachEventListeners();
    }

    function updateTotal() {
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        document.getElementById('totalExpenditure').textContent = `Total Expenditure: ${total.toFixed(2)}`;
    }

    function checkSalaryAlert() {
        const totalExpenditure = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        if (salary > 0 && totalExpenditure > salary) {
            alert('Warning: Budget exceeds the salary for this month!');
        }
    }

    function clearInputs() {
        expenseNameInput.value = '';
        expenseAmountInput.value = '';
    }

    function checkBudgetAlert(name, amount) {
        if (budgets[name] && amount > budgets[name]) {
            alert(`Warning: You have exceeded the budget for ${name}!`);
        }
    }

    function showPieChart() {
        hideCurrentChart();
        pieChartCanvas.style.display = 'block';
        const data = {};
        expenses.forEach(expense => {
            data[expense.name] = (data[expense.name] || 0) + expense.amount;
        });
        currentChart = new Chart(pieChartCanvas, {
            type: 'pie',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Expenses',
                    data: Object.values(data),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
                }]
            }
        });
    }

    function showBarChart() {
        hideCurrentChart();
        barChartCanvas.style.display = 'block';
        const data = {};
        expenses.forEach(expense => {
            data[expense.name] = (data[expense.name] || 0) + expense.amount;
        });
        currentChart = new Chart(barChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    label: 'Expenses',
                    data: Object.values(data),
                    backgroundColor: '#36A2EB',
                }]
            }
        });
    }

    function hideCurrentChart() {
        if (currentChart) currentChart.destroy();
        pieChartCanvas.style.display = 'none';
        barChartCanvas.style.display = 'none';
    }

    function attachEventListeners() {
        document.querySelectorAll('.delete-expense').forEach(button => {
            button.addEventListener('click', async function () {
                const id = this.getAttribute('data-id');
                const confirmDelete = confirm('Are you sure you want to delete this expense?');
                if (confirmDelete) {
                    await fetch(`https://money-maze-navigator.onrender.com/api/expenses/${id}`, {
                        method: "DELETE"
                    });
                    expenses = expenses.filter(e => e.id != id);
                    updateTable();
                }
            });
        });

        document.querySelectorAll('.edit-expense').forEach(button => {
            button.addEventListener('click', async function () {
                const id = this.getAttribute('data-id');
                const expense = expenses.find(e => e.id == id);
                const newAmount = parseFloat(prompt('Enter new amount:', expense.amount));
                if (!isNaN(newAmount)) {
                    await fetch(`https://money-maze-navigator.onrender.com/api/expenses/${id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ amount: newAmount })
                    });
                    expense.amount = newAmount;
                    updateTable();
                }
            });
        });
    }
});
