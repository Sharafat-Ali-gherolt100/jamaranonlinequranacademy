"use strict";

const API_BASE = window.location.origin.startsWith("http")
    ? "/api/admin"
    : "http://localhost:3000/api/admin";

const $ = (id) => document.getElementById(id);

let studentsData = [];
let registrationsData = [];
let teachersData = [];
let coursesData = [];
let reviewsData = [];
let countryChart = null;
let noticeTimer = null;

const token = sessionStorage.getItem("adminToken");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function showNotice(message, type = "success") {
    const notice = $("notice");
    if (!notice) return;
    notice.textContent = message;
    notice.className = `notice show ${type}`;

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
        notice.className = "notice";
    }, 5000);
}

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${sessionStorage.getItem("adminToken") || ""}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
        sessionStorage.removeItem("adminToken");
        sessionStorage.removeItem("adminInfo");
        window.location.href = "/login";
        throw new Error("Your session has expired. Please log in again.");    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "The request could not be completed.");
    }

    return data;
}

// Raw binary image upload (sends file as application/octet-stream)
async function uploadImageFile(file) {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("Image is too large. Maximum size is 5 MB.");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        throw new Error("Unsupported file type. Please use JPG, PNG, GIF, or WEBP.");
    }

    const buffer = await file.arrayBuffer();
    const response = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${sessionStorage.getItem("adminToken") || ""}`,
            "Content-Type": file.type
        },
        body: buffer
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        throw new Error(data.message || "Image upload failed.");
    }
    return data.url;
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString();
}

function emptyRow(columns, message = "No records found.") {
    return `<tr><td colspan="${columns}" class="empty">${escapeHTML(message)}</td></tr>`;
}

function statusBadge(status) {
    const key = String(status || "").toLowerCase();
    return `<span class="status ${escapeHTML(key)}">${escapeHTML(status || "Unknown")}</span>`;
}

// ════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════

function showSection(sectionId) {
    const section = $(sectionId);
    if (!section) return;

    document.querySelectorAll(".page-section").forEach(item => {
        item.classList.toggle("active", item.id === sectionId);
    });

    document.querySelectorAll(".nav-link").forEach(button => {
        button.classList.toggle("active", button.dataset.section === sectionId);
    });

    const titles = {
        overview:      "Dashboard Overview",
        students:      "Student Records",
        registrations: "Registration Requests",
        teachers:      "Teacher Management",
        courses:       "Course Management",
        reviews:       "Parent Reviews & Progress Feedback",
        content:       "Website Content & Media"
    };

    $("pageTitle").textContent = titles[sectionId] || "Dashboard";
    $("sidebar").classList.remove("open");

    if (sectionId === "overview")      loadOverview();
    if (sectionId === "students")      loadStudents();
    if (sectionId === "registrations") loadRegistrations();
    if (sectionId === "teachers")      loadTeachers();
    if (sectionId === "courses")       loadCourses();
    if (sectionId === "reviews")       loadReviews();
    if (sectionId === "content")       loadContent();
}

document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.section);
    });
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => {
        showSection(button.dataset.go);
    });
});

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

$("refreshBtn").addEventListener("click", async () => {
    const active = document.querySelector(".page-section.active");
    if (!active) return;

    try {
        await loadSection(active.id);
        showNotice("Dashboard data refreshed.");
    } catch (error) {
        showNotice(error.message, "error");
    }
});

async function loadSection(id) {
    if (id === "overview")      return loadOverview();
    if (id === "students")      return loadStudents();
    if (id === "registrations") return loadRegistrations();
    if (id === "teachers")      return loadTeachers();
    if (id === "courses")       return loadCourses();
    if (id === "reviews")       return loadReviews();
    if (id === "content")       return loadContent();
}

// ════════════════════════════════════════
// OVERVIEW
// ════════════════════════════════════════

async function loadOverview() {
    try {
        const data = await api("/overview");
        const o = data.overview;

        $("totalStudents").textContent = o.totalStudents;
        $("totalTeachers").textContent = o.activeTeachers;
        $("totalCourses").textContent = o.activeCourses;
        $("pendingRegistrations").textContent = o.pendingRegistrations;
        $("totalRegistrations").textContent = o.totalRegistrations;
        $("approvedRegistrations").textContent = o.approvedRegistrations;
        $("rejectedRegistrations").textContent = o.rejectedRegistrations;

        if ($("pendingReviewsCount")) {
            $("pendingReviewsCount").textContent = o.pendingReviews || 0;
        }
        if ($("publishedReviewsCount")) {
            $("publishedReviewsCount").textContent = o.publishedReviews || 0;
        }

        renderCountryChart(data.countries || []);
        renderRecent(data.recent || []);
    } catch (error) {
        showNotice(error.message, "error");
    }
}

function renderCountryChart(countries) {
    const labels = countries.map(item => item.country || "Unknown");
    const values = countries.map(item => Number(item.total));

    $("countryList").innerHTML = countries.length
        ? countries.map(item => `
            <div class="country-row">
                <span>${escapeHTML(item.country || "Unknown")}</span>
                <strong>${Number(item.total)}</strong>
            </div>
        `).join("")
        : '<p class="empty">No country data available.</p>';

    const canvas = $("countryChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (countryChart) countryChart.destroy();

    countryChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    "#126b3a", "#d4af37", "#5b9bd5",
                    "#ed9b40", "#7b68ae", "#52a89b",
                    "#dc7777", "#9da9a1", "#739d54"
                ],
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { boxWidth: 12, padding: 10, font: { size: 11 } }
                }
            }
        }
    });
}

function renderRecent(rows) {
    $("recentTable").innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td>${escapeHTML(row.name)}</td>
                <td>${escapeHTML(row.country)}</td>
                <td>${statusBadge(row.status)}</td>
            </tr>
        `).join("")
        : emptyRow(3);
}

// ════════════════════════════════════════
// STUDENTS
// ════════════════════════════════════════

async function loadStudents() {
    try {
        const search = $("studentSearch").value.trim();
        const country = $("studentCountry").value;

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (country) query.set("country", country);

        const data = await api(`/students?${query.toString()}`);
        studentsData = data.students || [];

        renderStudents(studentsData);
        updateCountryOptions();
    } catch (error) {
        showNotice(error.message, "error");
        $("studentsTable").innerHTML = emptyRow(9, "Could not load students.");
    }
}

function renderStudents(rows) {
    $("studentsTable").innerHTML = rows.length
        ? rows.map(student => `
            <tr>
                <td>#${Number(student.student_id)}</td>
                <td><strong>${escapeHTML(student.name)}</strong></td>
                <td>${escapeHTML(student.email || "—")}</td>
                <td>${escapeHTML(student.country)}</td>
                <td>${escapeHTML((student.country_code || "") + " " + student.whatsapp)}</td>
                <td>${escapeHTML(student.gender)} (${Number(student.age)})</td>
                <td>${escapeHTML(student.enrolled_courses || "—")}</td>
                <td>${formatDate(student.created_at)}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn" data-edit-student="${Number(student.student_id)}" title="Edit student details">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button class="small-btn" data-performance-student="${Number(student.student_id)}" title="View & add performance records">
                            <i class="fa-solid fa-chart-line"></i> Performance
                        </button>
                        <button class="small-btn delete" data-delete-student="${Number(student.student_id)}" title="Delete student record">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(9);

    $("studentCount").textContent = `Showing ${rows.length} student record(s).`;
}

function updateCountryOptions() {
    const select = $("studentCountry");
    const previous = select.value;

    const countries = [...new Set(
        studentsData.map(student => student.country).filter(Boolean)
    )].sort();

    select.innerHTML =
        '<option value="">All countries</option>' +
        countries.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");

    select.value = countries.includes(previous) ? previous : "";
}

let studentSearchTimer;
$("studentSearch").addEventListener("input", () => {
    clearTimeout(studentSearchTimer);
    studentSearchTimer = setTimeout(loadStudents, 300);
});
$("studentCountry").addEventListener("change", loadStudents);

$("addStudentBtn").addEventListener("click", () => {
    $("studentForm").reset();
    $("studentId").value = "";
    $("studentModalTitle").textContent = "Add Student";
    openModal("studentModal");
});

$("studentsTable").addEventListener("click", async event => {
    const editBtn = event.target.closest("[data-edit-student]");
    const deleteBtn = event.target.closest("[data-delete-student]");
    const perfBtn = event.target.closest("[data-performance-student]");

    if (editBtn) {
        const id = Number(editBtn.dataset.editStudent);
        const s = studentsData.find(item => Number(item.student_id) === id);
        if (!s) return;

        $("studentId").value = s.student_id;
        $("studentName").value = s.name;
        $("studentEmail").value = s.email || "";
        $("studentCountryInput").value = s.country;
        $("studentCountryCode").value = s.country_code || "+92";
        $("studentWhatsApp").value = s.whatsapp;
        $("studentGender").value = s.gender;
        $("studentAge").value = s.age;
        $("studentModalTitle").textContent = "Edit Student";
        openModal("studentModal");
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.deleteStudent;
        if (!confirm(`Delete student record #${id}? This action cannot be undone and will remove all associated performance records.`)) return;

        deleteBtn.disabled = true;
        try {
            const res = await api(`/students/${id}`, { method: "DELETE" });
            showNotice(res.message);
            await loadStudents();
            await loadOverview();
        } catch (err) {
            showNotice(err.message, "error");
            deleteBtn.disabled = false;
        }
    }

    if (perfBtn) {
        const id = Number(perfBtn.dataset.performanceStudent);
        const s = studentsData.find(item => Number(item.student_id) === id);
        if (!s) return;
        await openPerformancePanel(s);
    }
});

$("studentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("studentId").value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    const name = $("studentName").value.trim();
    const country = $("studentCountryInput").value.trim();
    const country_code = $("studentCountryCode").value.trim() || "+92";
    const whatsapp = $("studentWhatsApp").value.trim();
    const gender = $("studentGender").value;
    const age = Number($("studentAge").value);

    if (name.length < 2) {
        showNotice("Student name must be at least 2 characters.", "error");
        return;
    }
    if (!country) {
        showNotice("Country is required.", "error");
        return;
    }
    if (!whatsapp) {
        showNotice("Phone / WhatsApp number is required.", "error");
        return;
    }
    if (isNaN(age) || age < 1 || age > 120) {
        showNotice("Please provide a valid student age.", "error");
        return;
    }

    const body = {
        name,
        email: $("studentEmail").value.trim() || null,
        country,
        country_code,
        whatsapp,
        gender,
        age
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = id ? "Updating..." : "Saving...";
    }

    try {
        const result = await api(
            id ? `/students/${id}` : "/students",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        closeModal("studentModal");
        showNotice(result.message || (id ? "Student updated successfully." : "Student added successfully."));
        await loadStudents();
        await loadOverview();
    } catch (err) {
        showNotice(err.message, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Student";
        }
    }
});

// ════════════════════════════════════════
// STUDENT PERFORMANCE PANEL
// ════════════════════════════════════════

let currentPerfStudentId = null;
let currentPerfStudentName = "";
let performanceData = [];

async function openPerformancePanel(student) {
    currentPerfStudentId = student.student_id;
    currentPerfStudentName = student.name;

    $("perfStudentName").textContent = student.name;
    $("perfStudentInfo").textContent = `${student.country} · ${student.gender} · Age ${student.age}`;
    $("perfAddForm").reset();
    $("perfAddId").value = "";
    $("perfFormTitle").textContent = "Add Performance Record";

    await loadPerformance();
    openModal("performanceModal");
}

async function loadPerformance() {
    if (!currentPerfStudentId) return;
    const tbody = $("performanceTable");
    tbody.innerHTML = `<tr><td colspan="8" class="empty">Loading...</td></tr>`;

    try {
        const data = await api(`/students/${currentPerfStudentId}/performance`);
        performanceData = data.performance || [];
        renderPerformance();
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty" style="color:var(--danger);">${escapeHTML(err.message)}</td></tr>`;
    }
}

function renderPerformance() {
    const tbody = $("performanceTable");
    const levelColors = {
        "Excellent": "approved",
        "Very Good": "approved",
        "Good": "pending",
        "Satisfactory": "pending",
        "Needs Improvement": "rejected"
    };

    tbody.innerHTML = performanceData.length
        ? performanceData.map(p => `
            <tr>
                <td>${escapeHTML(p.assessment_title)}<br><small>${formatDate(p.assessment_date)}</small></td>
                <td>${escapeHTML(p.course_name || "—")}</td>
                <td>${escapeHTML(p.teacher_name || "—")}</td>
                <td>${p.score !== null ? `${p.score}/${p.max_score || "—"}` : "—"}</td>
                <td>${p.attendance_percent !== null ? `${p.attendance_percent}%` : "—"}</td>
                <td>${p.progress_level ? `<span class="status ${levelColors[p.progress_level] || "pending"}">${escapeHTML(p.progress_level)}</span>` : "—"}</td>
                <td style="max-width:200px; font-size:11px;">${escapeHTML(p.teacher_feedback || p.progress_notes || "—")}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn" data-edit-perf="${Number(p.performance_id)}" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="small-btn delete" data-delete-perf="${Number(p.performance_id)}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="8" class="empty">No performance records yet. Add the first one above.</td></tr>`;
}

// Performance form submission (add or update)
if ($("perfAddForm")) {
    $("perfAddForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!currentPerfStudentId) return;

        const id = $("perfAddId").value;
        const body = {
            course_id: $("perfCourseId").value || null,
            teacher_id: $("perfTeacherId").value || null,
            assessment_title: $("perfTitle").value.trim(),
            assessment_date: $("perfDate").value || null,
            score: $("perfScore").value !== "" ? Number($("perfScore").value) : null,
            max_score: $("perfMaxScore").value !== "" ? Number($("perfMaxScore").value) : null,
            attendance_percent: $("perfAttendance").value !== "" ? Number($("perfAttendance").value) : null,
            progress_level: $("perfLevel").value || null,
            progress_notes: $("perfNotes").value.trim() || null,
            teacher_feedback: $("perfFeedback").value.trim() || null
        };

        try {
            if (id) {
                await api(`/performance/${id}`, { method: "PUT", body: JSON.stringify(body) });
                showNotice("Performance record updated.");
            } else {
                await api(`/students/${currentPerfStudentId}/performance`, { method: "POST", body: JSON.stringify(body) });
                showNotice("Performance record added.");
            }
            $("perfAddForm").reset();
            $("perfAddId").value = "";
            $("perfFormTitle").textContent = "Add Performance Record";
            await loadPerformance();
        } catch (err) {
            showNotice(err.message, "error");
        }
    });
}

if ($("performanceTable")) {
    $("performanceTable").addEventListener("click", async (e) => {
        const editBtn = e.target.closest("[data-edit-perf]");
        const deleteBtn = e.target.closest("[data-delete-perf]");

        if (editBtn) {
            const id = Number(editBtn.dataset.editPerf);
            const p = performanceData.find(item => Number(item.performance_id) === id);
            if (!p) return;

            $("perfAddId").value = p.performance_id;
            $("perfCourseId").value = p.course_id || "";
            $("perfTeacherId").value = p.teacher_id || "";
            $("perfTitle").value = p.assessment_title || "";
            $("perfDate").value = p.assessment_date ? p.assessment_date.split("T")[0] : "";
            $("perfScore").value = p.score !== null ? p.score : "";
            $("perfMaxScore").value = p.max_score !== null ? p.max_score : "";
            $("perfAttendance").value = p.attendance_percent !== null ? p.attendance_percent : "";
            $("perfLevel").value = p.progress_level || "";
            $("perfNotes").value = p.progress_notes || "";
            $("perfFeedback").value = p.teacher_feedback || "";
            $("perfFormTitle").textContent = "Edit Performance Record";

            $("perfTitle").scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.deletePerf;
            if (!confirm("Delete this performance record?")) return;
            deleteBtn.disabled = true;
            try {
                await api(`/performance/${id}`, { method: "DELETE" });
                showNotice("Performance record deleted.");
                await loadPerformance();
            } catch (err) {
                showNotice(err.message, "error");
                deleteBtn.disabled = false;
            }
        }
    });
}

if ($("perfCancelBtn")) {
    $("perfCancelBtn").addEventListener("click", () => {
        $("perfAddForm").reset();
        $("perfAddId").value = "";
        $("perfFormTitle").textContent = "Add Performance Record";
    });
}

// ════════════════════════════════════════
// REGISTRATIONS
// ════════════════════════════════════════

async function loadRegistrations() {
    try {
        const data = await api("/registrations");
        registrationsData = data.registrations || [];
        renderRegistrations();
    } catch (error) {
        showNotice(error.message, "error");
        $("registrationsTable").innerHTML = emptyRow(8, "Could not load registrations.");
    }
}

function renderRegistrations() {
    const search = $("registrationSearch").value.trim().toLowerCase();
    const status = $("registrationStatus").value;

    const rows = registrationsData.filter(row => {
        const searchable = [
            row.name, row.email, row.country, row.whatsapp, row.course_names
        ].join(" ").toLowerCase();

        return searchable.includes(search) && (!status || row.status === status);
    });

    $("registrationsTable").innerHTML = rows.length
        ? rows.map(row => `
            <tr>
                <td>
                    #${Number(row.registration_id)}
                    <br><small>${formatDate(row.created_at)}</small>
                </td>
                <td>
                    <strong>${escapeHTML(row.name)}</strong>
                    <br>${escapeHTML(row.country)}
                    <br><small>${escapeHTML(row.gender)}, age ${Number(row.age)}</small>
                    ${row.message ? `<br><small style="color:#555;">Message: ${escapeHTML(row.message)}</small>` : ""}
                </td>
                <td>
                    ${escapeHTML(row.email || "—")}
                    <br>${escapeHTML((row.country_code || "") + " " + row.whatsapp)}
                </td>
                <td><strong>${escapeHTML(row.course_names || "No course selected")}</strong></td>
                <td>
                    ${escapeHTML(row.teacher_preference)}
                    ${row.teacher_name ? `<br><small>Assigned: ${escapeHTML(row.teacher_name)}</small>` : ""}
                </td>
                <td>${escapeHTML(row.preferred_timing)}</td>
                <td>${statusBadge(row.status)}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn approve"
                            data-status-id="${Number(row.registration_id)}"
                            data-status="Approved"
                            ${row.status === "Approved" ? "disabled" : ""}>
                            Approve
                        </button>
                        <button class="small-btn reject"
                            data-status-id="${Number(row.registration_id)}"
                            data-status="Rejected"
                            ${row.status === "Rejected" ? "disabled" : ""}>
                            Reject
                        </button>
                        <button class="small-btn"
                            data-status-id="${Number(row.registration_id)}"
                            data-status="Pending"
                            ${row.status === "Pending" ? "disabled" : ""}>
                            Pending
                        </button>
                        <button class="small-btn delete"
                            data-delete-reg="${Number(row.registration_id)}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(8);
}

$("registrationSearch").addEventListener("input", renderRegistrations);
$("registrationStatus").addEventListener("change", renderRegistrations);

$("registrationsTable").addEventListener("click", async event => {
    const statusBtn = event.target.closest("[data-status-id]");
    const deleteBtn = event.target.closest("[data-delete-reg]");

    if (statusBtn && !statusBtn.disabled) {
        const id = statusBtn.dataset.statusId;
        const status = statusBtn.dataset.status;

        if (!confirm(`Change registration #${id} status to ${status}?`)) return;

        statusBtn.disabled = true;
        try {
            const result = await api(`/registrations/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });

            showNotice(result.message);
            await loadRegistrations();
            await loadStudents();
            await loadOverview();
        } catch (error) {
            showNotice(error.message, "error");
            statusBtn.disabled = false;
        }
    }

    if (deleteBtn && !deleteBtn.disabled) {
        const id = deleteBtn.dataset.deleteReg;
        if (!confirm(`Delete registration request #${id}?`)) return;

        deleteBtn.disabled = true;
        try {
            const result = await api(`/registrations/${id}`, { method: "DELETE" });
            showNotice(result.message);
            await loadRegistrations();
            await loadOverview();
        } catch (error) {
            showNotice(error.message, "error");
            deleteBtn.disabled = false;
        }
    }
});

// ════════════════════════════════════════
// PARENT REVIEWS
// ════════════════════════════════════════

async function loadReviews() {
    try {
        const search = $("reviewSearch")?.value.trim() || "";
        const status = $("reviewStatus")?.value || "";
        const published = $("reviewPublished")?.value || "";

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);
        if (published !== "") query.set("published", published);

        const data = await api(`/reviews?${query.toString()}`);
        reviewsData = data.reviews || [];
        renderReviews();
    } catch (error) {
        showNotice(error.message, "error");
        if ($("reviewsTable")) $("reviewsTable").innerHTML = emptyRow(9, "Could not load parent reviews.");
    }
}

function publishBadge(isPublished) {
    return isPublished
        ? `<span class="publish-badge published"><i class="fa-solid fa-globe"></i> Published</span>`
        : `<span class="publish-badge unpublished"><i class="fa-solid fa-eye-slash"></i> Not Published</span>`;
}

function renderReviews() {
    const table = $("reviewsTable");
    if (!table) return;

    table.innerHTML = reviewsData.length
        ? reviewsData.map(r => {
            const canPublish = r.status === "Approved" && Number(r.consent_to_publish) === 1;
            const isPublished = Number(r.is_published) === 1;

            return `
            <tr>
                <td>
                    #${Number(r.review_id)}
                    <br><small>${formatDate(r.created_at)}</small>
                </td>
                <td>
                    <strong>${escapeHTML(r.student_name)}</strong>
                    <br><small style="color:var(--green);">${escapeHTML(r.course_name)}</small>
                </td>
                <td>
                    ${escapeHTML(r.parent_name)}
                    ${r.relationship ? `<br><small><em>${escapeHTML(r.relationship)}</em></small>` : ""}
                    <br><small>${escapeHTML(r.parent_email)}</small>
                    ${r.parent_phone ? `<br><small>${escapeHTML(r.parent_phone)}</small>` : ""}
                </td>
                <td>
                    <div class="star-rating">${"★".repeat(r.rating || 5)}${"☆".repeat(Math.max(0, 5 - (r.rating || 5)))}</div>
                    <small>${r.rating || 5}/5</small>
                </td>
                <td>
                    <p style="max-width:280px; font-size:12px; margin-bottom:4px;">
                        <strong>Feedback:</strong> ${escapeHTML((r.progress_feedback || "").slice(0, 160))}${(r.progress_feedback || "").length > 160 ? "…" : ""}
                    </p>
                    ${r.parent_comments ? `<p style="max-width:280px; font-size:11px; color:#555;"><strong>Comments:</strong> ${escapeHTML((r.parent_comments || "").slice(0, 120))}${(r.parent_comments || "").length > 120 ? "…" : ""}</p>` : ""}
                </td>
                <td>
                    ${r.consent_to_publish
                        ? '<span class="consent-badge yes"><i class="fa-solid fa-check"></i> Public OK</span>'
                        : '<span class="consent-badge no"><i class="fa-solid fa-lock"></i> Private</span>'}
                </td>
                <td>${statusBadge(r.status)}</td>
                <td>${publishBadge(isPublished)}</td>
                <td>
                    <div class="action-group">
                        ${canPublish && !isPublished
                            ? `<button class="small-btn publish-btn"
                                data-publish-id="${Number(r.review_id)}"
                                data-publish="true"
                                title="Publish to website">
                                <i class="fa-solid fa-globe"></i> Publish
                               </button>`
                            : ""}
                        ${isPublished
                            ? `<button class="small-btn unpublish-btn"
                                data-publish-id="${Number(r.review_id)}"
                                data-publish="false"
                                title="Remove from website">
                                <i class="fa-solid fa-eye-slash"></i> Unpublish
                               </button>`
                            : ""}
                        <button class="small-btn approve"
                            data-review-status-id="${Number(r.review_id)}"
                            data-status="Approved"
                            ${r.status === "Approved" ? "disabled" : ""}>
                            Approve
                        </button>
                        <button class="small-btn reject"
                            data-review-status-id="${Number(r.review_id)}"
                            data-status="Rejected"
                            ${r.status === "Rejected" ? "disabled" : ""}>
                            Reject
                        </button>
                        <button class="small-btn" data-edit-review="${Number(r.review_id)}" title="Edit review">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button class="small-btn delete" data-delete-review="${Number(r.review_id)}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        }).join("")
        : emptyRow(9, "No parent reviews found.");
}

if ($("reviewSearch")) $("reviewSearch").addEventListener("input", loadReviews);
if ($("reviewStatus")) $("reviewStatus").addEventListener("change", loadReviews);
if ($("reviewPublished")) $("reviewPublished").addEventListener("change", loadReviews);

if ($("reviewsTable")) {
    $("reviewsTable").addEventListener("click", async event => {
        const publishBtn = event.target.closest("[data-publish-id]");
        const statusBtn = event.target.closest("[data-review-status-id]");
        const editBtn = event.target.closest("[data-edit-review]");
        const deleteBtn = event.target.closest("[data-delete-review]");

        if (publishBtn && !publishBtn.disabled) {
            const id = publishBtn.dataset.publishId;
            const isPublishing = publishBtn.dataset.publish === "true";
            const action = isPublishing ? "publish" : "unpublish";

            if (!confirm(`${isPublishing ? "Publish" : "Unpublish"} this review on the public website?`)) return;

            publishBtn.disabled = true;
            try {
                const res = await api(`/reviews/${id}/publish`, {
                    method: "PATCH",
                    body: JSON.stringify({ publish: isPublishing })
                });
                showNotice(res.message);
                await loadReviews();
                await loadOverview();
            } catch (err) {
                showNotice(err.message || `Could not ${action} review.`, "error");
                publishBtn.disabled = false;
            }
        }

        if (statusBtn && !statusBtn.disabled) {
            const id = statusBtn.dataset.reviewStatusId;
            const status = statusBtn.dataset.status;

            statusBtn.disabled = true;
            try {
                const res = await api(`/reviews/${id}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ status })
                });
                showNotice(res.message);
                await loadReviews();
                await loadOverview();
            } catch (err) {
                showNotice(err.message, "error");
                statusBtn.disabled = false;
            }
        }

        if (editBtn) {
            const id = Number(editBtn.dataset.editReview);
            const r = reviewsData.find(item => Number(item.review_id) === id);
            if (!r) return;

            $("reviewEditId").value = r.review_id;
            $("reviewFeedbackInput").value = r.progress_feedback || "";
            $("reviewStrengthsInput").value = r.strengths || "";
            $("reviewImproveInput").value = r.areas_for_improvement || "";
            $("reviewCommentsInput").value = r.parent_comments || "";
            $("reviewRatingInput").value = r.rating || 5;
            $("reviewConsentInput").checked = Boolean(r.consent_to_publish);
            $("reviewAdminNotes").value = r.admin_notes || "";
            $("reviewStatusSelect").value = r.status || "Pending";

            openModal("reviewModal");
        }

        if (deleteBtn) {
            const id = deleteBtn.dataset.deleteReview;
            if (!confirm(`Delete parent review #${id}? This cannot be undone.`)) return;

            deleteBtn.disabled = true;
            try {
                const res = await api(`/reviews/${id}`, { method: "DELETE" });
                showNotice(res.message);
                await loadReviews();
                await loadOverview();
            } catch (err) {
                showNotice(err.message, "error");
                deleteBtn.disabled = false;
            }
        }
    });
}

if ($("reviewEditForm")) {
    $("reviewEditForm").addEventListener("submit", async event => {
        event.preventDefault();
        const id = $("reviewEditId").value;
        const body = {
            progress_feedback: $("reviewFeedbackInput").value.trim(),
            strengths: $("reviewStrengthsInput").value.trim() || null,
            areas_for_improvement: $("reviewImproveInput").value.trim() || null,
            parent_comments: $("reviewCommentsInput").value.trim() || null,
            rating: Number($("reviewRatingInput").value),
            consent_to_publish: $("reviewConsentInput").checked ? 1 : 0,
            admin_notes: $("reviewAdminNotes").value.trim() || null,
            status: $("reviewStatusSelect").value
        };

        try {
            const result = await api(`/reviews/${id}`, {
                method: "PUT",
                body: JSON.stringify(body)
            });

            closeModal("reviewModal");
            showNotice(result.message);
            await loadReviews();
            await loadOverview();
        } catch (err) {
            showNotice(err.message, "error");
        }
    });
}

// ════════════════════════════════════════
// TEACHERS
// ════════════════════════════════════════

async function loadTeachers() {
    try {
        const data = await api("/teachers");
        teachersData = data.teachers || [];
        renderTeachers();
    } catch (error) {
        showNotice(error.message, "error");
        $("teachersTable").innerHTML = emptyRow(9, "Could not load teachers.");
    }
}

function renderTeachers() {
    $("teachersTable").innerHTML = teachersData.length
        ? teachersData.map(teacher => `
            <tr>
                <td>#${Number(teacher.teacher_id)}</td>
                <td>
                    ${teacher.photo_url
                        ? `<img src="${escapeHTML(teacher.photo_url)}" alt="${escapeHTML(teacher.name)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);vertical-align:middle;margin-right:7px;">`
                        : `<span style="display:inline-flex;width:38px;height:38px;border-radius:50%;background:var(--green-light);border:2px solid var(--gold);align-items:center;justify-content:center;font-size:15px;color:var(--green);vertical-align:middle;margin-right:7px;"><i class="fa-solid fa-user-tie"></i></span>`}
                    <strong>${escapeHTML(teacher.name)}</strong>
                    ${teacher.specialization ? `<br><small style="color:var(--gold);">${escapeHTML(teacher.specialization)}</small>` : ""}
                </td>
                <td>${escapeHTML(teacher.email || "—")}</td>
                <td>${escapeHTML(teacher.whatsapp || "—")}</td>
                <td>${escapeHTML(teacher.gender)}</td>
                <td>${escapeHTML(teacher.country || "—")}</td>
                <td>${escapeHTML(teacher.qualification || "—")}</td>
                <td>${Number(teacher.is_active) ? statusBadge("Active") : statusBadge("Inactive")}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn" data-edit-teacher="${Number(teacher.teacher_id)}" title="Edit teacher">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button class="small-btn"
                            data-toggle-teacher="${Number(teacher.teacher_id)}"
                            data-active="${Number(teacher.is_active) ? "0" : "1"}"
                            title="${Number(teacher.is_active) ? "Deactivate" : "Activate"}">
                            ${Number(teacher.is_active) ? "Deactivate" : "Activate"}
                        </button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(9);
}

$("addTeacherBtn").addEventListener("click", () => {
    $("teacherForm").reset();
    $("teacherId").value = "";
    $("teacherModalTitle").textContent = "Add Teacher";
    $("teacherPhotoPreview").style.display = "none";
    openModal("teacherModal");
});

$("teachersTable").addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-teacher]");
    const toggleButton = event.target.closest("[data-toggle-teacher]");

    if (editButton) {
        const teacher = teachersData.find(
            item => Number(item.teacher_id) === Number(editButton.dataset.editTeacher)
        );
        if (!teacher) return;

        $("teacherId").value = teacher.teacher_id;
        $("teacherName").value = teacher.name || "";
        $("teacherEmail").value = teacher.email || "";
        $("teacherWhatsApp").value = teacher.whatsapp || "";
        $("teacherGender").value = teacher.gender || "Male";
        $("teacherCountry").value = teacher.country || "";
        $("teacherQualification").value = teacher.qualification || "";
        $("teacherSpecialization").value = teacher.specialization || "";
        $("teacherExperience").value = teacher.experience_years || "";
        $("teacherPhoto").value = teacher.photo_url || "";
        $("teacherDisplayOrder").value = teacher.display_order || 0;
        $("teacherBio").value = teacher.bio || "";

        // Show photo preview if URL exists
        if (teacher.photo_url) {
            $("teacherPhotoPreview").src = teacher.photo_url;
            $("teacherPhotoPreview").style.display = "block";
        } else {
            $("teacherPhotoPreview").style.display = "none";
        }

        $("teacherModalTitle").textContent = "Edit Teacher";
        openModal("teacherModal");
    }

    if (toggleButton) {
        const id = toggleButton.dataset.toggleTeacher;
        const is_active = toggleButton.dataset.active === "1";

        if (!confirm(`${is_active ? "Activate" : "Deactivate"} this teacher?`)) return;

        try {
            const result = await api(`/teachers/${id}/active`, {
                method: "PATCH",
                body: JSON.stringify({ is_active })
            });

            showNotice(result.message);
            await loadTeachers();
            await loadOverview();
        } catch (error) {
            showNotice(error.message, "error");
        }
    }
});

// Teacher photo upload
if ($("teacherPhotoFile")) {
    $("teacherPhotoFile").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const btn = $("teacherPhotoUploadBtn");
        if (btn) btn.disabled = true;
        showNotice("Uploading photo...");

        try {
            const url = await uploadImageFile(file);
            $("teacherPhoto").value = url;
            $("teacherPhotoPreview").src = url;
            $("teacherPhotoPreview").style.display = "block";
            showNotice("Photo uploaded successfully. Save the teacher to apply it.");
        } catch (err) {
            showNotice(err.message, "error");
        } finally {
            if (btn) btn.disabled = false;
            e.target.value = "";
        }
    });
}

$("teacherPhoto").addEventListener("input", () => {
    const url = $("teacherPhoto").value.trim();
    if (url) {
        $("teacherPhotoPreview").src = url;
        $("teacherPhotoPreview").style.display = "block";
    } else {
        $("teacherPhotoPreview").style.display = "none";
    }
});

$("teacherForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("teacherId").value;
    const body = {
        name: $("teacherName").value.trim(),
        email: $("teacherEmail").value.trim() || null,
        whatsapp: $("teacherWhatsApp").value.trim() || null,
        gender: $("teacherGender").value,
        country: $("teacherCountry").value.trim() || null,
        qualification: $("teacherQualification").value.trim() || null,
        specialization: $("teacherSpecialization").value.trim() || null,
        experience_years: $("teacherExperience").value.trim() || null,
        photo_url: $("teacherPhoto").value.trim() || null,
        display_order: Number($("teacherDisplayOrder").value) || 0,
        bio: $("teacherBio").value.trim() || null
    };

    try {
        const result = await api(
            id ? `/teachers/${id}` : "/teachers",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        closeModal("teacherModal");
        showNotice(result.message);
        await loadTeachers();
        await loadOverview();
    } catch (error) {
        showNotice(error.message, "error");
    }
});

// ════════════════════════════════════════
// COURSES
// ════════════════════════════════════════

async function loadCourses() {
    try {
        const data = await api("/courses");
        coursesData = data.courses || [];
        renderCourses();
    } catch (error) {
        showNotice(error.message, "error");
        $("coursesTable").innerHTML = emptyRow(8, "Could not load courses.");
    }
}

function renderCourses() {
    $("coursesTable").innerHTML = coursesData.length
        ? coursesData.map(course => `
            <tr>
                <td>#${Number(course.course_id)}</td>
                <td>
                    ${course.image_url
                        ? `<img src="${escapeHTML(course.image_url)}" alt="${escapeHTML(course.course_name)}" style="width:38px;height:38px;border-radius:6px;object-fit:cover;border:1px solid var(--border);vertical-align:middle;margin-right:7px;">`
                        : ""}
                    <strong>${escapeHTML(course.course_name)}</strong>
                </td>
                <td><small style="max-width:180px;display:block;">${escapeHTML((course.description || "—").slice(0, 100))}${(course.description || "").length > 100 ? "…" : ""}</small></td>
                <td>
                    ${course.level ? `<strong>${escapeHTML(course.level)}</strong><br>` : ""}
                    <small>${escapeHTML(course.duration || "—")}</small>
                </td>
                <td><strong>${Number(course.enrolled_students || 0)}</strong></td>
                <td>${Number(course.is_active) ? statusBadge("Active") : statusBadge("Inactive")}</td>
                <td>
                    <div class="action-group">
                        <a href="/courses/${encodeURIComponent(course.slug || course.course_id)}" target="_blank" class="small-btn" title="View Public Course Page" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> View Page
                        </a>
                        <button class="small-btn" data-edit-course="${Number(course.course_id)}" title="Edit course">
                            <i class="fa-solid fa-pen"></i> Edit
                        </button>
                        <button class="small-btn"
                            data-toggle-course="${Number(course.course_id)}"
                            data-active="${Number(course.is_active) ? "0" : "1"}"
                            title="${Number(course.is_active) ? "Deactivate" : "Activate"}">
                            ${Number(course.is_active) ? "Deactivate" : "Activate"}
                        </button>
                        <button class="small-btn delete" data-delete-course="${Number(course.course_id)}" title="Delete course">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(7);
}

$("addCourseBtn").addEventListener("click", () => {
    $("courseForm").reset();
    $("courseId").value = "";
    $("courseModalTitle").textContent = "Add Course";
    $("courseImagePreview").style.display = "none";
    openModal("courseModal");
});

$("coursesTable").addEventListener("click", async event => {
    const editBtn = event.target.closest("[data-edit-course]");
    const toggleBtn = event.target.closest("[data-toggle-course]");
    const deleteBtn = event.target.closest("[data-delete-course]");

    if (editBtn) {
        const course = coursesData.find(item => Number(item.course_id) === Number(editBtn.dataset.editCourse));
        if (!course) return;

        $("courseId").value = course.course_id;
        $("courseName").value = course.course_name || "";
        $("courseDescription").value = course.description || "";
        $("courseLevel").value = course.level || "";
        $("courseDuration").value = course.duration || "";
        $("courseDisplayOrder").value = course.display_order || 0;
        $("courseImage").value = course.image_url || "";

        if (course.image_url) {
            $("courseImagePreview").src = course.image_url;
            $("courseImagePreview").style.display = "block";
        } else {
            $("courseImagePreview").style.display = "none";
        }

        $("courseModalTitle").textContent = "Edit Course";
        openModal("courseModal");
    }

    if (toggleBtn) {
        const id = toggleBtn.dataset.toggleCourse;
        const is_active = toggleBtn.dataset.active === "1";

        if (!confirm(`${is_active ? "Activate" : "Deactivate"} this course? ${!is_active ? "It will no longer appear on the public website." : "It will appear on the public website."}`)) return;

        try {
            const result = await api(`/courses/${id}/active`, {
                method: "PATCH",
                body: JSON.stringify({ is_active })
            });

            showNotice(result.message);
            await loadCourses();
            await loadOverview();
        } catch (error) {
            showNotice(error.message, "error");
        }
    }

    if (deleteBtn) {
        const id = deleteBtn.dataset.deleteCourse;
        if (!confirm(`Permanently delete course #${id}? This cannot be undone. Courses with active enrollments cannot be deleted.`)) return;

        deleteBtn.disabled = true;
        try {
            const res = await api(`/courses/${id}`, { method: "DELETE" });
            showNotice(res.message);
            await loadCourses();
            await loadOverview();
        } catch (err) {
            showNotice(err.message, "error");
            deleteBtn.disabled = false;
        }
    }
});

// Course image upload
if ($("courseImageFile")) {
    $("courseImageFile").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showNotice("Uploading course image...");
        try {
            const url = await uploadImageFile(file);
            $("courseImage").value = url;
            $("courseImagePreview").src = url;
            $("courseImagePreview").style.display = "block";
            showNotice("Image uploaded successfully. Save the course to apply it.");
        } catch (err) {
            showNotice(err.message, "error");
        } finally {
            e.target.value = "";
        }
    });
}

$("courseImage").addEventListener("input", () => {
    const url = $("courseImage").value.trim();
    if (url) {
        $("courseImagePreview").src = url;
        $("courseImagePreview").style.display = "block";
    } else {
        $("courseImagePreview").style.display = "none";
    }
});

$("courseForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("courseId").value;

    const body = {
        course_name: $("courseName").value.trim(),
        description: $("courseDescription").value.trim() || null,
        image_url: $("courseImage").value.trim() || null,
        level: $("courseLevel").value.trim() || null,
        duration: $("courseDuration").value.trim() || null,
        display_order: Number($("courseDisplayOrder").value) || 0
    };

    try {
        const result = await api(
            id ? `/courses/${id}` : "/courses",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        closeModal("courseModal");
        showNotice(result.message);
        await loadCourses();
        await loadOverview();
    } catch (error) {
        showNotice(error.message, "error");
    }
});

// ════════════════════════════════════════
// WEBSITE CONTENT MANAGEMENT
// ════════════════════════════════════════

let contentData = [];

async function loadContent() {
    const editor = $("contentEditor");
    if (!editor) return;
    editor.innerHTML = `<p class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading website content…</p>`;

    try {
        const data = await api("/site-content");
        contentData = data.settings || [];
        renderContentEditor();
    } catch (err) {
        editor.innerHTML = `<p class="empty" style="color:var(--danger);">Could not load website content: ${escapeHTML(err.message)}</p>`;
    }
}

function renderContentEditor() {
    const editor = $("contentEditor");
    if (!editor || !contentData.length) {
        if (editor) editor.innerHTML = `<p class="empty">No editable content settings found. Run the database migrations first.</p>`;
        return;
    }

    // Group settings by setting_group
    const groups = {};
    contentData.forEach(s => {
        const g = s.setting_group || "general";
        if (!groups[g]) groups[g] = [];
        groups[g].push(s);
    });

    const groupLabels = {
        homepage: "Homepage",
        about: "About Page",
        contact: "Contact & Social",
        general: "General"
    };

    editor.innerHTML = Object.entries(groups).map(([groupKey, settings]) => {
        // The WhatsApp link is derived from the central number by the server,
        // so it is not shown as a separately editable field.
        const visible = settings.filter(s => s.setting_key !== "contact_whatsapp_link");
        if (!visible.length) return "";

        return `
        <div class="content-group" data-content-group="${escapeHTML(groupKey)}">
            <div class="content-group-head">
                <h3 class="content-group-title">
                    <i class="fa-solid fa-folder-open"></i>
                    ${escapeHTML(groupLabels[groupKey] || groupKey.charAt(0).toUpperCase() + groupKey.slice(1))}
                </h3>
                <button type="button" class="primary-btn content-group-save" data-save-group="${escapeHTML(groupKey)}">
                    <i class="fa-solid fa-floppy-disk"></i> Save
                </button>
            </div>
            <div class="content-fields">
                ${visible.map(s => renderSettingField(s)).join("")}
            </div>
        </div>
    `;
    }).join("");
}

function renderSettingField(setting) {
    const val = escapeHTML(setting.setting_value || "");
    const key = escapeHTML(setting.setting_key);
    const label = escapeHTML(setting.label || setting.setting_key);
    const type = setting.field_type || "text";

    let field = "";

    if (type === "textarea" || type === "html") {
        field = `<textarea class="content-field" data-key="${key}" rows="3">${val}</textarea>`;
    } else if (type === "image" || type === "url") {
        field = `
            <div class="content-image-row">
                <input type="text" class="content-field" data-key="${key}" value="${val}" placeholder="${type === "image" ? "images/example.jpg or upload →" : "https://…"}">
                ${type === "image" ? `
                    <label class="content-upload-btn" title="Upload image">
                        <i class="fa-solid fa-cloud-arrow-up"></i>
                        <input type="file" accept="image/*" class="content-upload-input" data-target-key="${key}" style="display:none;">
                    </label>
                    ${setting.setting_value ? `<img class="content-img-preview" src="${val}" alt="preview">` : ""}
                ` : ""}
            </div>`;
    } else {
        field = `<input type="text" class="content-field" data-key="${key}" value="${val}">`;
    }

    return `
        <div class="content-field-wrap">
            <label class="content-label">${label}</label>
            ${field}
        </div>`;
}

// Handle inline image uploads in content editor
if ($("contentEditor")) {
    $("contentEditor").addEventListener("change", async (e) => {
        const fileInput = e.target.closest(".content-upload-input");
        if (!fileInput || !fileInput.files[0]) return;

        const targetKey = fileInput.dataset.targetKey;
        const file = fileInput.files[0];

        showNotice("Uploading image...");
        try {
            const url = await uploadImageFile(file);

            // Update the matching text input
            const textInput = $("contentEditor").querySelector(`.content-field[data-key="${targetKey}"]`);
            if (textInput) textInput.value = url;

            // Update preview
            const preview = fileInput.closest(".content-image-row")?.querySelector(".content-img-preview");
            if (preview) {
                preview.src = url;
            } else {
                const previewEl = document.createElement("img");
                previewEl.className = "content-img-preview";
                previewEl.src = url;
                fileInput.closest(".content-image-row")?.appendChild(previewEl);
            }

            showNotice("Image uploaded. Click the section's Save button to apply.");
        } catch (err) {
            showNotice(err.message, "error");
        } finally {
            fileInput.value = "";
        }
    });
}

// Save one content group at a time (each module has its own Save button)
if ($("contentEditor")) {
    $("contentEditor").addEventListener("click", async (event) => {
        const saveBtn = event.target.closest("[data-save-group]");
        if (!saveBtn) return;

        const group = saveBtn.closest("[data-content-group]");
        if (!group) return;

        const fields = group.querySelectorAll(".content-field");
        if (!fields.length) {
            showNotice("No content fields found in this section.", "error");
            return;
        }

        const settings = {};
        fields.forEach(field => {
            const key = field.dataset.key;
            if (key) settings[key] = field.value;
        });

        const originalHTML = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

        try {
            const result = await api("/site-content", {
                method: "PUT",
                body: JSON.stringify({ settings })
            });
            showNotice(result.message || "This section was saved successfully.");
        } catch (err) {
            showNotice(err.message, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHTML;
        }
    });
}

// Upload Image button (top of content section)
if ($("uploadImageBtn")) {
    $("uploadImageBtn").addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.style.display = "none";
        document.body.appendChild(input);

        input.addEventListener("change", async () => {
            const file = input.files[0];
            if (!file) { document.body.removeChild(input); return; }

            showNotice("Uploading image...");
            try {
                const url = await uploadImageFile(file);
                showNotice(`Image uploaded! URL: ${url} — Paste this into any image field above.`);
                // Show a temporary copy-able notice
                const n = $("notice");
                if (n) {
                    n.innerHTML = `Image uploaded! URL: <strong><a href="/${url}" target="_blank" style="color:var(--green);">${escapeHTML(url)}</a></strong> — Copy and paste into any image field.`;
                }
            } catch (err) {
                showNotice(err.message, "error");
            } finally {
                document.body.removeChild(input);
            }
        });

        input.click();
    });
}

// ════════════════════════════════════════
// MODAL UTILITIES
// ════════════════════════════════════════

function openModal(id) {
    $(id).classList.add("open");
    $(id).setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    $(id).classList.remove("open");
    $(id).setAttribute("aria-hidden", "true");
    // Only restore scroll if no other modal is open
    if (!document.querySelector(".modal.open")) {
        document.body.style.overflow = "";
    }
}

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) closeModal(modal.id);
    });
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal.open").forEach(modal => closeModal(modal.id));
    }
});

// ════════════════════════════════════════
// LOGOUT & STARTUP
// ════════════════════════════════════════

$("logoutBtn").addEventListener("click", () => {
    if (!confirm("Are you sure you want to log out of the admin panel?")) return;
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminInfo");
    window.location.href = "/login";
});

$("year").textContent = new Date().getFullYear();

if (!token) {
    window.location.replace("/login");
} else {
    try {
        const adminInfo = JSON.parse(sessionStorage.getItem("adminInfo") || "{}");
        if (adminInfo.username) {
            $("adminName").textContent = adminInfo.username;
        }
    } catch {
        // Keep default admin label
    }

    loadOverview();
}
