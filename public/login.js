const API_URL = "https://money-maze-navigator.onrender.com";

document.getElementById("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const statusMessage = document.getElementById("loginStatus");

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // ✅ Save JWT in localStorage
            localStorage.setItem("authToken", data.token);

            // ✅ Redirect to welcome page
            window.location.href = "welcome.html";
        } else {
            statusMessage.textContent = data.message;
            statusMessage.style.color = "red";
        }
    } catch (error) {
        console.error("Login error:", error);
        statusMessage.textContent = "❌ Something went wrong. Try again.";
        statusMessage.style.color = "red";
    }
});
