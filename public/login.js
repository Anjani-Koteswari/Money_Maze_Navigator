document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.message === 'Welcome to Money Maze Navigator!') {
            // ✅ Save logged-in user to localStorage
            // Prefer backend userId, otherwise fallback to username
            localStorage.setItem('loggedInUser', data.userId || username);

            // Redirect to welcome page
            window.location.href = 'welcome.html';
        } else {
            document.getElementById('loginStatus').textContent = data.message;
            document.getElementById('loginStatus').style.color = 'red';
        }
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginStatus').textContent = 'Something went wrong. Please try again.';
        document.getElementById('loginStatus').style.color = 'red';
    }
});
