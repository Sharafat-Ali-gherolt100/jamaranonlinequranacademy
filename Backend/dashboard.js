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
        window.location.href = "login.html";
        throw new Error("Your session has expired. Please log in again.");
    }

    if (!response.ok || data.success === false) {
        throw new Error(data.message || "The request could not be completed.");
    }

    return data;
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

// ---------------- NAVIGATION ----------------

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
        overview: "Dashboard Overview",
        students: "Student Records",
        registrations: "Registration Requests",
        teachers: "Teacher Management",
        courses: "Course Management",
        reviews: "Parent Reviews & Progress Feedback"
    };

    $("pageTitle").textContent = titles[sectionId] || "Dashboard";
    $("sidebar").classList.remove("open");

    if (sectionId === "overview") loadOverview();
    if (sectionId === "students") loadStudents();
    if (sectionId === "registrations") loadRegistrations();
    if (sectionId === "teachers") loadTeachers();
    if (sectionId === "courses") loadCourses();
    if (sectionId === "reviews") loadReviews();
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
    if (id === "overview") return loadOverview();
    if (id === "students") return loadStudents();
    if (id === "registrations") return loadRegistrations();
    if (id === "teachers") return loadTeachers();
    if (id === "courses") return loadCourses();
    if (id === "reviews") return loadReviews();
}

// ---------------- OVERVIEW ----------------

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

// ---------------- STUDENTS ----------------

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
                        <button class="small-btn" data-edit-student="${Number(student.student_id)}">Edit</button>
                        <button class="small-btn delete" data-delete-student="${Number(student.student_id)}">Delete</button>
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
        if (!confirm(`Are you sure you want to delete student record #${id}? This cannot be undone.`)) return;

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
});

$("studentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("studentId").value;
    const body = {
        name: $("studentName").value.trim(),
        email: $("studentEmail").value.trim() || null,
        country: $("studentCountryInput").value.trim(),
        country_code: $("studentCountryCode").value.trim() || "+92",
        whatsapp: $("studentWhatsApp").value.trim(),
        gender: $("studentGender").value,
        age: Number($("studentAge").value)
    };

    try {
        const result = await api(
            id ? `/students/${id}` : "/students",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            }
        );

        closeModal("studentModal");
        showNotice(result.message);
        await loadStudents();
        await loadOverview();
    } catch (err) {
        showNotice(err.message, "error");
    }
});

// ---------------- REGISTRATIONS ----------------

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
                            data-delete-reg="${Number(row.registration_id)}" title="Delete Registration">
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
        if (!confirm(`Are you sure you want to delete registration request #${id}?`)) return;

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

// ---------------- PARENT REVIEWS ----------------

async function loadReviews() {
    try {
        const search = $("reviewSearch")?.value.trim() || "";
        const status = $("reviewStatus")?.value || "";

        const query = new URLSearchParams();
        if (search) query.set("search", search);
        if (status) query.set("status", status);

        const data = await api(`/reviews?${query.toString()}`);
        reviewsData = data.reviews || [];
        renderReviews();
    } catch (error) {
        showNotice(error.message, "error");
        if ($("reviewsTable")) $("reviewsTable").innerHTML = emptyRow(8, "Could not load parent reviews.");
    }
}

function renderReviews() {
    const table = $("reviewsTable");
    if (!table) return;

    table.innerHTML = reviewsData.length
        ? reviewsData.map(r => `
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
                    <br><small>${escapeHTML(r.parent_email)}</small>
                    ${r.parent_phone ? `<br><small>${escapeHTML(r.parent_phone)}</small>` : ""}
                </td>
                <td>
                    <div class="star-rating">${"★".repeat(r.rating || 5)}${"☆".repeat(Math.max(0, 5 - (r.rating || 5)))}</div>
                    <small>${r.rating || 5}/5</small>
                </td>
                <td>
                    <p style="max-width:280px; font-size:12px; margin-bottom:4px;">
                        <strong>Feedback:</strong> ${escapeHTML(r.progress_feedback)}
                    </p>
                    ${r.strengths ? `<p style="max-width:280px; font-size:11px; color:#27ae60;"><strong>Strengths:</strong> ${escapeHTML(r.strengths)}</p>` : ""}
                    ${r.areas_for_improvement ? `<p style="max-width:280px; font-size:11px; color:#c0392b;"><strong>Improve:</strong> ${escapeHTML(r.areas_for_improvement)}</p>` : ""}
                    ${r.parent_comments ? `<p style="max-width:280px; font-size:11px; color:#555;"><strong>Comments:</strong> ${escapeHTML(r.parent_comments)}</p>` : ""}
                </td>
                <td>
                    ${r.consent_to_publish ? '<span class="consent-badge yes"><i class="fa-solid fa-check"></i> Public Allowed</span>' : '<span class="consent-badge no"><i class="fa-solid fa-lock"></i> Private Only</span>'}
                </td>
                <td>${statusBadge(r.status)}</td>
                <td>
                    <div class="action-group">
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
                        <button class="small-btn" data-edit-review="${Number(r.review_id)}">Edit</button>
                        <button class="small-btn delete" data-delete-review="${Number(r.review_id)}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(8, "No parent reviews found.");
}

if ($("reviewSearch")) $("reviewSearch").addEventListener("input", loadReviews);
if ($("reviewStatus")) $("reviewStatus").addEventListener("change", loadReviews);

if ($("reviewsTable")) {
    $("reviewsTable").addEventListener("click", async event => {
        const statusBtn = event.target.closest("[data-review-status-id]");
        const editBtn = event.target.closest("[data-edit-review]");
        const deleteBtn = event.target.closest("[data-delete-review]");

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
            if (!confirm(`Delete parent review #${id}?`)) return;

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

// ---------------- TEACHERS ----------------

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
                <td><strong>${escapeHTML(teacher.name)}</strong></td>
                <td>${escapeHTML(teacher.email || "—")}</td>
                <td>${escapeHTML(teacher.whatsapp || "—")}</td>
                <td>${escapeHTML(teacher.gender)}</td>
                <td>${escapeHTML(teacher.country || "—")}</td>
                <td>${escapeHTML(teacher.qualification || "—")}</td>
                <td>${Number(teacher.is_active) ? statusBadge("Active") : statusBadge("Inactive")}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn" data-edit-teacher="${Number(teacher.teacher_id)}">Edit</button>
                        <button class="small-btn"
                            data-toggle-teacher="${Number(teacher.teacher_id)}"
                            data-active="${Number(teacher.is_active) ? "0" : "1"}">
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

$("teacherForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("teacherId").value;
    const body = {
        name: $("teacherName").value.trim(),
        email: $("teacherEmail").value.trim() || null,
        whatsapp: $("teacherWhatsApp").value.trim() || null,
        gender: $("teacherGender").value,
        country: $("teacherCountry").value.trim() || null,
        qualification: $("teacherQualification").value.trim() || null
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

// ---------------- COURSES ----------------

async function loadCourses() {
    try {
        const data = await api("/courses");
        coursesData = data.courses || [];
        renderCourses();
    } catch (error) {
        showNotice(error.message, "error");
        $("coursesTable").innerHTML = emptyRow(6, "Could not load courses.");
    }
}

function renderCourses() {
    $("coursesTable").innerHTML = coursesData.length
        ? coursesData.map(course => `
            <tr>
                <td>#${Number(course.course_id)}</td>
                <td><strong>${escapeHTML(course.course_name)}</strong></td>
                <td><small>${escapeHTML(course.description || "—")}</small></td>
                <td><strong>${Number(course.enrolled_students || 0)}</strong></td>
                <td>${Number(course.is_active) ? statusBadge("Active") : statusBadge("Inactive")}</td>
                <td>
                    <div class="action-group">
                        <button class="small-btn" data-edit-course="${Number(course.course_id)}">Edit</button>
                        <button class="small-btn"
                            data-toggle-course="${Number(course.course_id)}"
                            data-active="${Number(course.is_active) ? "0" : "1"}">
                            ${Number(course.is_active) ? "Deactivate" : "Activate"}
                        </button>
                        <button class="small-btn delete" data-delete-course="${Number(course.course_id)}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join("")
        : emptyRow(6);
}

$("addCourseBtn").addEventListener("click", () => {
    $("courseForm").reset();
    $("courseId").value = "";
    $("courseModalTitle").textContent = "Add Course";
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
        $("courseModalTitle").textContent = "Edit Course";
        openModal("courseModal");
    }

    if (toggleBtn) {
        const id = toggleBtn.dataset.toggleCourse;
        const is_active = toggleBtn.dataset.active === "1";

        if (!confirm(`${is_active ? "Activate" : "Deactivate"} this course?`)) return;

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
        if (!confirm(`Are you sure you want to permanently delete course #${id}?`)) return;

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

$("courseForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = $("courseId").value;
    const body = {
        course_name: $("courseName").value.trim(),
        description: $("courseDescription").value.trim() || null
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

// ---------------- MODAL UTILITIES ----------------

function openModal(id) {
    $(id).classList.add("open");
    $(id).setAttribute("aria-hidden", "false");
}

function closeModal(id) {
    $(id).classList.remove("open");
    $(id).setAttribute("aria-hidden", "true");
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

// ---------------- LOGOUT & STARTUP ----------------

$("logoutBtn").addEventListener("click", () => {
    if (!confirm("Are you sure you want to log out of the admin panel?")) return;
    sessionStorage.removeItem("adminToken");
    sessionStorage.removeItem("adminInfo");
    window.location.href = "login.html";
});

$("year").textContent = new Date().getFullYear();

if (!token) {
    window.location.replace("login.html");
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
