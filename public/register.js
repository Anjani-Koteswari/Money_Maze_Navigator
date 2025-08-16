const API_URL = "https://money-maze-navigator.onrender.com";

document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // ✅ Use camelCase variables
    const firstName = document.getElementById('first_name').value.trim();
    const lastName = document.getElementById('last_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const pincode = document.getElementById('pincode').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    const statusMessage = document.getElementById("registrationStatus");

    // Reset previous status
    statusMessage.textContent = "";

    // Password strength check
    const strength = checkPasswordStrength(password);
    document.getElementById("passwordStrength").textContent = password
        ? `Password strength: ${strength}`
        : "";

    if (password !== confirmPassword) {
        statusMessage.textContent = "❌ Passwords do not match";
        statusMessage.style.color = "red";
        return;
    }

    if (strength === "Weak") {
        statusMessage.textContent = "❌ Please choose a stronger password";
        statusMessage.style.color = "red";
        return;
    }

    // ✅ Send camelCase to backend
    fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({
            firstName,
            lastName,
            email,
            pincode,
            username,
            password
        })
    })
    .then(response => response.json())
    .then(data => {
        statusMessage.textContent = data.message || "⚠️ Unknown response";
        statusMessage.style.color = data.success ? "green" : "red";
        if (data.success) {
            // ✅ Redirect after success
            window.location.href = "welcome.html";
        }
    })
    .catch(error => {
        console.error("Error:", error);
        statusMessage.textContent = "❌ Registration failed. Try again later.";
        statusMessage.style.color = "red";
    });
});

// ✅ Username availability check
const usernameInput = document.getElementById("username");
const usernameStatus = document.getElementById("usernameStatus");

usernameInput.addEventListener("input", () => {
    const username = usernameInput.value.trim();
    if (!username) {
        usernameStatus.textContent = "";
        return;
    }
    if (username.length < 3) {
        usernameStatus.textContent = "⚠️ Username must be at least 3 characters";
        usernameStatus.style.color = "orange";
        return;
    }

    fetch(`${API_URL}/check-username?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            usernameStatus.textContent = data.available
                ? "✅ Username is available"
                : "❌ Username already taken";
            usernameStatus.style.color = data.available ? "green" : "red";
        })
        .catch(err => {
            console.error("Error checking username:", err);
            usernameStatus.textContent = "";
        });
});

// ✅ Email availability check
const emailInput = document.getElementById("email");
const emailStatus = document.getElementById("emailStatus");

emailInput.addEventListener("input", () => {
    const email = emailInput.value.trim();
    if (!email) {
        emailStatus.textContent = "";
        return;
    }
    if (!email.includes("@") || !email.includes(".")) {
        emailStatus.textContent = "⚠️ Enter a valid email address";
        emailStatus.style.color = "orange";
        return;
    }

    fetch(`${API_URL}/check-email?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
            emailStatus.textContent = data.available
                ? "✅ Email is available"
                : "❌ Email already registered";
            emailStatus.style.color = data.available ? "green" : "red";
        })
        .catch(err => {
            console.error("Error checking email:", err);
            emailStatus.textContent = "";
        });
});

function checkPasswordStrength(password) {
    if (!password) return "Weak";
    if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && /[\W_]/.test(password)) {
        return "Strong";
    }
    if (password.length >= 6 && (/[A-Z]/.test(password) || /\d/.test(password))) {
        return "Medium";
    }
    return "Weak";
}
