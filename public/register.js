const API_URL = window.location.origin.includes("localhost")
  ? "http://localhost:3000"
  : "https://money-maze-navigator.onrender.com";

// Password strength checker
const passwordInput = document.getElementById("password");
const passwordStrength = document.getElementById("passwordStrength");

passwordInput.addEventListener("input", function () {
  const password = passwordInput.value;
  let strength = "";

  if (password.length < 6) {
    strength = "Weak ❌ (at least 6 characters required)";
    passwordStrength.style.color = "red";
  } else if (
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*]/.test(password)
  ) {
    strength = "Medium ⚠️ (add uppercase, numbers & symbols)";
    passwordStrength.style.color = "orange";
  } else {
    strength = "Strong ✅";
    passwordStrength.style.color = "green";
  }

  passwordStrength.textContent = strength;
});

// Form submission
document.getElementById("registerForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const email = document.getElementById("email").value;
  const pincode = document.getElementById("pincode").value;
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const registrationStatus = document.getElementById("registrationStatus");

  // Password match check
  if (password !== confirmPassword) {
    registrationStatus.textContent = "⚠️ Passwords do not match!";
    registrationStatus.style.color = "red";
    return;
  }

  fetch(`${API_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ firstName, lastName, email, pincode, username, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      registrationStatus.textContent = data.message;

      if (data.message.includes("already exists")) {
        registrationStatus.style.color = "red";
      } else {
        registrationStatus.style.color = "green";
      }

      // Redirect if successful
      if (data.redirect) {
        setTimeout(() => {
          window.location.href = data.redirect;
        }, 1500);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      registrationStatus.textContent = "❌ Something went wrong. Try again.";
      registrationStatus.style.color = "red";
    });
});
