
"use strict";

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const togglePasswordButton = document.getElementById("toggle-password");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");

const LOGIN_API = "http://localhost:3000/api/auth/login";

function showMessage(message, type = "error") {
    loginMessage.textContent = message;
    loginMessage.className = `login-message ${type}`;
}

// Show / hide password
togglePasswordButton.addEventListener("click", function () {
    const isPassword = passwordInput.type === "password";

    passwordInput.type = isPassword ? "text" : "password";

    togglePasswordButton.innerHTML = isPassword
        ? '<i class="fa-solid fa-eye-slash"></i>'
        : '<i class="fa-solid fa-eye"></i>';

    togglePasswordButton.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password"
    );

    togglePasswordButton.title = isPassword
        ? "Hide password"
        : "Show password";
});

// Admin login
loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    showMessage("");

    if (!username || !password) {
        showMessage("Please enter your username and password.");
        return;
    }

    loginButton.disabled = true;
    loginButton.querySelector("span").textContent = "Logging in...";

    try {
        const response = await fetch(LOGIN_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Invalid username or password."
            );
        }

        if (!result.token) {
            throw new Error(
                "The server did not return an authentication token."
            );
        }

        // Save login session
        sessionStorage.setItem("adminToken", result.token);
        sessionStorage.setItem(
            "adminInfo",
            JSON.stringify(result.admin || {})
        );

        showMessage(
            "Login successful. Opening dashboard...",
            "success"
        );

        // Open dashboard.html in the same folder as this login page
        window.location.assign("dashboard.html");

    } catch (error) {
        console.error("Admin login error:", error);

        if (error instanceof TypeError) {
            showMessage(
                "Cannot connect to the backend. Check that your server is running."
            );
        } else {
            showMessage(
                error.message || "Login failed. Please try again."
            );
        }
    } finally {
        loginButton.disabled = false;
        loginButton.querySelector("span").textContent =
            "Login to Dashboard";
    }
});
