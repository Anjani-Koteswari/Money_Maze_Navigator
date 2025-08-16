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

        if (!response.ok) {
            throw new Error("Server error");
        }

        const data = await response.json();

        if (data.success) {
            // ✅ No need to save token manually (stored in cookie)
            window.location.href = "welcome.html";
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
