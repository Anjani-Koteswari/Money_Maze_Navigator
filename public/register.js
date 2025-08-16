const API_URL = "https://money-maze-navigator.onrender.com";

document.getElementById('registerForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const pincode = document.getElementById('pincode').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirmPassword').value.trim();

    const statusMessage = document.getElementById("registrationStatus");

    // Password strength check
    const strength = checkPasswordStrength(password);
    document.getElementById("passwordStrength").textContent = `Password strength: ${strength}`;

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

    fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",  // ✅ important: send/receive cookies for session
        body: JSON.stringify({ firstName, lastName, email, pincode, username, password })
    })
    .then(response => response.json())
    .then(data => {
        statusMessage.textContent = data.message;
        statusMessage.style.color = data.success ? "green" : "red";
        if (data.success) {
            // ✅ redirect only if backend session is set
            window.location.href = "/welcome.html";
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
    if (username.length < 3) {
        usernameStatus.textContent = "⚠️ Username must be at least 3 characters";
        usernameStatus.style.color = "orange";
        return;
    }

    fetch(`${API_URL}/check-username?username=${encodeURIComponent(username)}`)
        .then(res => res.json())
        .then(data => {
            if (data.available) {
                usernameStatus.textContent = "✅ Username is available";
                usernameStatus.style.color = "green";
            } else {
                usernameStatus.textContent = "❌ Username already taken";
                usernameStatus.style.color = "red";
            }
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
    if (!email.includes("@") || !email.includes(".")) {
        emailStatus.textContent = "⚠️ Enter a valid email address";
        emailStatus.style.color = "orange";
        return;
    }

    fetch(`${API_URL}/check-email?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
            if (data.available) {
                emailStatus.textContent = "✅ Email is available";
                emailStatus.style.color = "green";
            } else {
                emailStatus.textContent = "❌ Email already registered";
                emailStatus.style.color = "red";
            }
        })
        .catch(err => {
            console.error("Error checking email:", err);
            emailStatus.textContent = "";
        });
});

function checkPasswordStrength(password) {
    let strength = "Weak";
    if (password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && /[\W_]/.test(password)) {
        strength = "Strong";
    } else if (password.length >= 6 && (/[A-Z]/.test(password) || /\d/.test(password))) {
        strength = "Medium";
    }
    return strength;
}
