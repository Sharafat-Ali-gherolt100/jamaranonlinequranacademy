/*!
 * register.js  –  Jamaran Online Quran Academy
 * Shared registration-form logic for register.html and enrol.html.
 * Requires SweetAlert2 (loaded BEFORE this script on the page).
 */
"use strict";

// =========================================================
// CONFIG
// =========================================================

const REGISTER_API_URL = window.location.origin.startsWith("http")
    ? "/api/register"
    : "http://localhost:3000/api/register";

// =========================================================
// SWEETALERT2 HELPERS  –  consistent brand colours
// =========================================================

/**
 * Show the standard registration-success popup.
 * Resolves when the user closes it.
 */
function showRegistrationSuccess() {
    return Swal.fire({
        icon: "success",
        title: "Thank You for Registration!",
        html:
            "<p style='font-size:1rem; color:#444; line-height:1.7; margin-top:6px;'>" +
            "Your registration has been completed successfully. " +
            "Thank you for choosing <strong>Jamaran Online Quran Academy</strong>.<br><br>" +
            "Our team will contact you as soon as possible to guide you " +
            "through the next steps." +
            "</p>",
        confirmButtonText: "OK",
        confirmButtonColor: "#126B3A",
        iconColor: "#126B3A",
        customClass: {
            popup:          "jqa-swal-popup",
            title:          "jqa-swal-title",
            confirmButton:  "jqa-swal-confirm"
        }
    });
}

/**
 * Show a validation / server error alert.
 * @param {string} message  Human-readable message
 */
function showRegistrationError(message) {
    return Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: message,
        confirmButtonText: "Try Again",
        confirmButtonColor: "#126B3A",
        iconColor: "#c0392b"
    });
}

/**
 * Show a network connectivity error.
 */
function showNetworkError() {
    return Swal.fire({
        icon: "warning",
        title: "Connection Error",
        html:
            "<p style='font-size:0.95rem; color:#555;'>" +
            "Unable to reach the academy server.<br>" +
            "Please make sure the server is running and open this page via " +
            "<strong>http://localhost:3000</strong>." +
            "</p>",
        confirmButtonText: "OK",
        confirmButtonColor: "#126B3A"
    });
}

/**
 * Show a duplicate-registration alert.
 * @param {string} message  Message returned by the server
 */
function showDuplicateAlert(message) {
    return Swal.fire({
        icon: "info",
        title: "Already Registered",
        text: message,
        confirmButtonText: "OK",
        confirmButtonColor: "#126B3A",
        iconColor: "#D4AF37"
    });
}

// =========================================================
// INLINE BANNER  (used for field-level validation feedback)
// =========================================================

function showBanner(formMessage, message, type) {
    if (!formMessage) return;
    formMessage.textContent = message;
    formMessage.hidden = false;
    formMessage.className = "form-message " + type;
}

function hideBanner(formMessage) {
    if (!formMessage) return;
    formMessage.hidden = true;
    formMessage.textContent = "";
    formMessage.className = "form-message";
}

// =========================================================
// COUNTRY-CODE SYNC
// =========================================================

function bindCountryCode(countrySelect, countryCodeEl, phoneInput) {
    if (!countrySelect || !countryCodeEl) return;
    countrySelect.addEventListener("change", function () {
        const opt = this.options[this.selectedIndex];
        const code = opt.dataset.code || "";
        countryCodeEl.textContent = code;
        if (phoneInput) {
            phoneInput.placeholder = code === "+92" ? "3XX XXXXXXX" : "Enter phone number";
        }
    });
}

// =========================================================
// URL PARAMETER  –  pre-select course dropdown
// =========================================================

function applyUrlCourseParam() {
    const courseSelect = document.getElementById("course");
    if (!courseSelect) return;

    const raw = new URLSearchParams(window.location.search).get("course") || "";
    const courseParam = raw.toLowerCase().trim();
    if (!courseParam) return;

    const aliasMap = {
        "yassarnul-quran": "yassarnul-quran",
        "yassarnul":       "yassarnul-quran",
        "qaida":           "yassarnul-quran",
        "quran-tajweed":   "quran-tajweed",
        "tajweed":         "quran-tajweed",
        "duas-ziyarat":    "duas-ziyarat",
        "duas":            "duas-ziyarat",
        "ziyarat":         "duas-ziyarat",
        "tafseer":         "tafseer",
        "nahjul-balagha":  "nahjul-balagha",
        "nahjul":          "nahjul-balagha",
        "ahkam-namaz":     "ahkam-namaz",
        "ahkam":           "ahkam-namaz",
        "namaz":           "ahkam-namaz"
    };

    const target = aliasMap[courseParam] || courseParam;

    for (let i = 0; i < courseSelect.options.length; i++) {
        if (courseSelect.options[i].value.toLowerCase() === target) {
            courseSelect.selectedIndex = i;
            break;
        }
    }
}

// =========================================================
// MAIN FORM INIT
// =========================================================

function initRegistrationForm() {
    const form           = document.getElementById("registration-form");
    const countrySelect  = document.getElementById("country");
    const countryCodeEl  = document.getElementById("country-code");
    const phoneInput     = document.getElementById("phone");
    const submitBtn      = document.getElementById("submit-btn");
    const formMessage    = document.getElementById("form-message");

    if (!form || !submitBtn) return;   // guard: not on a registration page

    const btnText = submitBtn.querySelector(".button-text") || submitBtn;

    // Bind country-code helper
    bindCountryCode(countrySelect, countryCodeEl, phoneInput);

    // Pre-select course from URL
    applyUrlCourseParam();

    // Footer year (if present)
    const yearEl = document.getElementById("current-year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ------ FORM SUBMIT ------
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        if (submitBtn.disabled) return;  // prevent double-submit

        // Collect values
        const name             = document.getElementById("name").value.trim();
        const email            = document.getElementById("email").value.trim();
        const country          = (countrySelect && countrySelect.value) || "";
        const countryCode      = (countryCodeEl && countryCodeEl.textContent.trim()) || "+92";
        const phone            = phoneInput ? phoneInput.value.trim() : "";
        const age              = Number(document.getElementById("age").value);
        const gender           = document.getElementById("gender").value;
        const course           = document.getElementById("course").value;
        const teacherPref      = document.getElementById("teacher_preference").value;
        const timing           = document.getElementById("timing").value;
        const message          = document.getElementById("message").value.trim();

        // ---- Client-side validation ----
        if (name.length < 2 || name.length > 100) {
            showBanner(formMessage, "Name must be between 2 and 100 characters.", "error");
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            showBanner(formMessage, "Please provide a valid email address.", "error");
            return;
        }

        if (!/^\+[0-9]{1,5}$/.test(countryCode)) {
            showBanner(formMessage, "Please select a valid country.", "error");
            return;
        }

        if (!/^[0-9\s()+.\-]{5,20}$/.test(phone)) {
            showBanner(formMessage, "Please provide a valid WhatsApp number.", "error");
            return;
        }

        if (!Number.isInteger(age) || age < 3 || age > 100) {
            showBanner(formMessage, "Age must be between 3 and 100.", "error");
            return;
        }

        if (!["Male", "Female"].includes(gender)) {
            showBanner(formMessage, "Please select a valid gender.", "error");
            return;
        }

        if (!["Male", "Female", "Any"].includes(teacherPref)) {
            showBanner(formMessage, "Please select a valid teacher preference.", "error");
            return;
        }

        if (!["Morning", "Afternoon", "Evening", "Night"].includes(timing)) {
            showBanner(formMessage, "Please select a valid preferred timing.", "error");
            return;
        }

        if (message.length > 2000) {
            showBanner(formMessage, "Message cannot exceed 2000 characters.", "error");
            return;
        }

        // Clear any previous inline banner
        hideBanner(formMessage);

        // Lock button — loading state
        submitBtn.disabled = true;
        if (typeof btnText === "string") {
            submitBtn.textContent = "Submitting…";
        } else {
            btnText.textContent = "Submitting…";
        }

        const payload = {
            name,
            email,
            country,
            country_code: countryCode,
            phone,
            age,
            gender,
            course,
            teacher_preference: teacherPref,
            timing,
            message
        };

        try {
            const response = await fetch(REGISTER_API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.status === 409) {
                // Duplicate registration
                await showDuplicateAlert(result.message || "A registration for this course already exists.");
                return;
            }

            if (!response.ok) {
                await showRegistrationError(
                    result.message || result.error || "Registration failed. Please try again."
                );
                return;
            }

            // ✅ SUCCESS — show SweetAlert2 popup
            await showRegistrationSuccess();

            // Reset form after user dismisses popup
            form.reset();
            if (countryCodeEl) countryCodeEl.textContent = "+92";
            if (phoneInput)    phoneInput.placeholder = "3XX XXXXXXX";

        } catch (err) {
            console.error("Registration error:", err);
            if (err instanceof TypeError) {
                await showNetworkError();
            } else {
                await showRegistrationError(err.message || "Something went wrong. Please try again.");
            }
        } finally {
            submitBtn.disabled = false;
            if (typeof btnText === "string") {
                submitBtn.textContent = "Submit Registration";
            } else {
                btnText.textContent = "Submit Registration";
            }
        }
    });
}

// =========================================================
// AUTO-INIT  on DOMContentLoaded
// =========================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRegistrationForm);
} else {
    initRegistrationForm();
}
