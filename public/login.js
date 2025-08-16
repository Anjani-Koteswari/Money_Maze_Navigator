const API_URL = "https://money-maze-navigator.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const statusMessage = document.getElementById("loginStatus");

    if (!username || !password) {
        statusMessage.textContent = "⚠️ Please enter both username and password.";
        statusMessage.style.color = "red";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",  // ✅ send/receive cookies
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            // ✅ Show actual backend error instead of generic "Server error"
            statusMessage.textContent = data.message || "❌ Login failed.";
            statusMessage.style.color = "red";
            return;
        }

        if (data.success) {
            statusMessage.textContent = "✅ Login successful! Redirecting...";
            statusMessage.style.color = "green";
            setTimeout(() => {
                window.location.href = "welcome.html";
            }, 800);
        } else {
            statusMessage.textContent = data.message || "❌ Invalid login credentials.";
            statusMessage.style.color = "red";
        }
    } catch (error) {
        console.error("Login error:", error);
        statusMessage.textContent = "❌ Unable to connect. Please try again later.";
        statusMessage.style.color = "red";
    }
});
