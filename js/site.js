/*!
 * site.js — Jamaran Online Quran Academy
 * Shared front-end behaviour for every public page:
 *   1. Responsive mobile navigation (hamburger)
 *   2. Logo fallback (never shows a broken image)
 *   3. Dynamic, admin-managed website content (text + images)
 *   4. Dynamic course slider / grid
 *   5. Dynamic teacher grid
 *
 * Every fetch fails gracefully — a content problem never breaks
 * the page, it simply falls back to the existing static markup.
 */
"use strict";

(function () {
    const API_BASE = window.location.origin.startsWith("http")
        ? ""
        : "http://localhost:3000";

    /* ---------------------------------------------------------
       Small helpers
       --------------------------------------------------------- */

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, c => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[c]);
    }

    async function getJSON(path) {
        const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json();
    }

    /* ---------------------------------------------------------
       1. Mobile navigation
       --------------------------------------------------------- */

    function initMobileNav() {
        const navbar = document.querySelector(".navbar");
        const navLinks = document.querySelector(".navbar .nav-links");
        if (!navbar || !navLinks) return;

        // Already initialised (defensive)
        if (navbar.querySelector(".nav-toggle")) return;

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "nav-toggle";
        toggle.setAttribute("aria-label", "Toggle navigation menu");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = '<span class="nav-toggle-icon"><i class="fa-solid fa-bars"></i></span>';

        navbar.appendChild(toggle);

        function closeMenu() {
            navLinks.classList.remove("nav-open");
            document.body.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
            toggle.querySelector("i").className = "fa-solid fa-bars";
        }

        function openMenu() {
            navLinks.classList.add("nav-open");
            document.body.classList.add("nav-open");
            toggle.setAttribute("aria-expanded", "true");
            toggle.querySelector("i").className = "fa-solid fa-xmark";
        }

        toggle.addEventListener("click", () => {
            if (navLinks.classList.contains("nav-open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // On small screens, tapping a dropdown parent opens the sub list
        navLinks.querySelectorAll(".dropdown > a").forEach(link => {
            link.addEventListener("click", (event) => {
                if (window.matchMedia("(max-width: 992px)").matches) {
                    const parent = link.parentElement;
                    const menu = parent.querySelector(".dropdown-menu");
                    if (menu && !parent.classList.contains("submenu-open")) {
                        event.preventDefault();
                        parent.classList.add("submenu-open");
                    }
                }
            });
        });

        // Close the menu when clicking outside, or on a real link tap
        document.addEventListener("click", (event) => {
            if (!navLinks.classList.contains("nav-open")) return;
            if (!navbar.contains(event.target)) closeMenu();
        });

        navLinks.querySelectorAll("a").forEach(a => {
            a.addEventListener("click", () => {
                if (window.matchMedia("(max-width: 992px)").matches) {
                    const isDropdownParent = a.parentElement.classList.contains("dropdown");
                    if (!isDropdownParent) closeMenu();
                }
            });
        });

        // Reset when resizing back to desktop
        window.addEventListener("resize", () => {
            if (!window.matchMedia("(max-width: 992px)").matches) {
                navLinks.classList.remove("nav-open");
                document.body.classList.remove("nav-open");
                toggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    /* ---------------------------------------------------------
       2. Logo fallback
       --------------------------------------------------------- */

    function initLogoFallback() {
        document.querySelectorAll(".logo img, .footer-logo img").forEach(img => {
            img.addEventListener("error", function handleError() {
                if (this.dataset.fallbackApplied) return;
                this.dataset.fallbackApplied = "1";
                this.src = this.src.includes("images/")
                    ? "images/logo.jpeg"
                    : "logo.jpeg";
            });
        });
    }

    /* ---------------------------------------------------------
       3. Dynamic website content
       --------------------------------------------------------- */

    // Map of [data-site] keys → element updates.
    function applySiteContent(content) {
        if (!content) return;

        document.querySelectorAll("[data-site]").forEach(el => {
            const key = el.getAttribute("data-site");
            const value = content[key];
            if (value === undefined || value === null || value === "") return;

            const type = el.getAttribute("data-site-type") || "text";

            if (type === "image") {
                el.src = value;
            } else if (type === "html") {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
        });

        // Static hero background image (animations and sliding transitions removed)
        const hero = document.querySelector(".hero");
        if (hero) {
            const staticImg = content.hero_image_1 || content.hero_image || "images/Image1.png";
            hero.style.setProperty("--hero-img-1", `url("${staticImg}")`);
            hero.style.backgroundImage = `url("${staticImg}")`;
            hero.style.animation = "none";
        }

        // Social links (footer)
        const socialMap = {
            facebook: content.social_facebook,
            youtube: content.social_youtube,
            instagram: content.social_instagram,
            linkedin: content.social_linkedin,
            whatsapp: content.contact_whatsapp_link
        };

        document.querySelectorAll("[data-social]").forEach(a => {
            const href = socialMap[a.getAttribute("data-social")];
            if (href) {
                a.href = href;
                a.style.display = "";
                a.target = "_blank";
                a.rel = "noopener noreferrer";
            } else {
                a.style.display = "none"; // hide links with no configured URL
            }
        });

        // Primary WhatsApp CTAs and the floating button
        document.querySelectorAll("[data-site-whatsapp-link]").forEach(a => {
            if (content.contact_whatsapp_link) {
                a.href = content.contact_whatsapp_link;
                a.style.display = "";
            } else {
                a.style.display = "none";
            }
        });
        ensureFloatingWhatsApp(content.contact_whatsapp_link);

        // Expose the latest content so page-specific scripts can reuse it
        // (e.g. contact.html mirrors the central WhatsApp number).
        window.JamaranSiteContent = content;
        document.dispatchEvent(new CustomEvent("jamaran:site-content", {
            detail: content
        }));
    }

    async function loadSiteContent() {
        try {
            const data = await getJSON("/api/site-content");
            applySiteContent(data.content || {});
        } catch (err) {
            // Non-fatal: keep the static wording.
            console.warn("Site content unavailable, using defaults:", err.message);
        }
    }

    /* ---------------------------------------------------------
       4. Dynamic course slider / grid
       --------------------------------------------------------- */

    function courseLink(course) {
        if (!course) return "/courses";
        const slug = course.slug || (course.name ? String(course.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-") : "");
        if (slug) return `/courses/${encodeURIComponent(slug)}`;
        return "/courses";
    }

    function buildCourseCard(course) {
        const defaultImg = "images/quran.jpeg";
        const imgSrc = (course.image && String(course.image).trim()) ? escapeHTML(course.image) : defaultImg;
        const img = `<div class="dyn-card-img-wrap"><img src="${imgSrc}" alt="${escapeHTML(course.name)}" loading="lazy" onerror="this.onerror=null;this.src='${defaultImg}'"></div>`;

        const level = course.level
            ? `<span class="dyn-level">${escapeHTML(course.level)}</span>`
            : "";

        const description = course.description
            ? escapeHTML(course.description).slice(0, 140)
            : "Quality online Quran education with qualified teachers.";

        return `
            <article class="course-card">
                ${img}
                <div class="dyn-card-body">
                    <div class="dyn-card-header-row">
                        ${level}
                    </div>
                    <h3>${escapeHTML(course.name)}</h3>
                    <p>${description}</p>
                    <div class="dyn-card-actions">
                        <a class="dyn-card-link" href="${courseLink(course)}">
                            View Course <i class="fa-solid fa-arrow-right"></i>
                        </a>
                        <a class="dyn-card-enroll-btn" href="/register?course=${encodeURIComponent(course.slug || course.name)}">
                            Enroll Now
                        </a>
                    </div>
                </div>
            </article>`;
    }

    function initCourseSlider(container) {
        const track = container.querySelector("[data-course-track]");
        const prev = container.querySelector("[data-course-prev]");
        const next = container.querySelector("[data-course-next]");
        const status = container.querySelector("[data-course-status]");
        if (!track) return;

        function visibleCount() {
            if (window.innerWidth <= 600) return 1;
            if (window.innerWidth <= 992) return 2;
            return 3;
        }

        let index = 0;
        let cards = Array.from(track.children);

        function update() {
            cards = Array.from(track.children);
            if (!cards.length) return;

            const perView = visibleCount();
            const maxIndex = Math.max(0, cards.length - perView);
            if (index > maxIndex) index = maxIndex;
            if (index < 0) index = 0;

            const cardWidth = cards[0].getBoundingClientRect().width;
            const gap = parseFloat(getComputedStyle(track).gap) || 0;

            track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`;

            if (prev) prev.disabled = index === 0;
            if (next) next.disabled = index >= maxIndex;
        }

        if (prev) prev.addEventListener("click", () => { index--; update(); });
        if (next) next.addEventListener("click", () => { index++; update(); });
        window.addEventListener("resize", update);
        setTimeout(update, 60);
    }

    async function loadCourses() {
        const sliders = document.querySelectorAll("[data-course-slider]");
        const grids = document.querySelectorAll("[data-course-grid]");
        if (!sliders.length && !grids.length) return;

        sliders.forEach(container => {
            const status = container.querySelector("[data-course-status]");
            if (status) {
                status.textContent = "Loading courses…";
                status.hidden = false;
            }
        });

        try {
            const data = await getJSON("/api/courses/public");
            const courses = Array.isArray(data.courses) ? data.courses : [];

            sliders.forEach(container => {
                const track = container.querySelector("[data-course-track]");
                const status = container.querySelector("[data-course-status]");
                const controls = container.querySelector("[data-course-controls]");

                if (!track) return;

                if (!courses.length) {
                    if (status) {
                        status.hidden = false;
                        status.textContent = "Courses will appear here soon.";
                    }
                    if (controls) controls.hidden = true;
                    return;
                }

                track.innerHTML = courses.map(buildCourseCard).join("");
                if (status) status.hidden = true;
                if (controls) controls.hidden = courses.length <= 1;
                initCourseSlider(container);
            });

            // Rich course directory grid (courses.html)
            grids.forEach(grid => {
                const statusEl = grid.querySelector("[data-course-grid-status]");
                if (!courses.length) {
                    if (statusEl) statusEl.textContent = "Our courses will appear here soon.";
                    return;
                }

                if (statusEl) statusEl.remove();

                grid.innerHTML = courses.map(course => {
                    const defaultImg = "images/quran.jpeg";
                    const img = (course.image && String(course.image).trim()) ? escapeHTML(course.image) : defaultImg;
                    const level = course.level
                        ? `<span class="dir-level">${escapeHTML(course.level)}</span>`
                        : "";
                    const desc = course.description
                        ? escapeHTML(course.description)
                        : "Quality online Quran education with qualified teachers.";
                    const enrollQuery = course.slug
                        ? `/register?course=${encodeURIComponent(course.slug)}`
                        : "/register";

                    return `
                        <article class="dir-card">
                            <div class="dir-card-head">
                                <img src="${escapeHTML(img)}" alt="${escapeHTML(course.name)}" loading="lazy" onerror="this.onerror=null;this.src='${defaultImg}'">
                                <div>
                                    <h3>${escapeHTML(course.name)}</h3>
                                    <div class="dir-meta-row">
                                        ${level}
                                    </div>
                                </div>
                            </div>
                            <p>${desc}</p>
                            <div class="dir-card-actions">
                                <a class="dir-learn" href="${courseLink(course)}">Learn More →</a>
                                <a class="dir-enroll" href="${enrollQuery}">Enroll Now</a>
                            </div>
                        </article>`;
                }).join("");
            });
        } catch (err) {
            console.warn("Courses unavailable:", err.message);
            sliders.forEach(container => {
                const status = container.querySelector("[data-course-status]");
                const track = container.querySelector("[data-course-track]");
                if (status) {
                    status.hidden = false;
                    status.textContent = "Unable to load courses right now. Please try again later.";
                }
                if (track && !track.children.length) track.innerHTML = "";
            });
            grids.forEach(grid => {
                const statusEl = grid.querySelector("[data-course-grid-status]");
                if (statusEl) statusEl.textContent = "Unable to load courses right now. Please try again later.";
            });
        }
    }

    /* ---------------------------------------------------------
       5. Dynamic teacher grid
       --------------------------------------------------------- */

    function buildTeacherCard(teacher) {
        const defaultAvatar = "images/quran.jpeg";
        const photo = teacher.photo
            ? `<img class="dyn-teacher-photo" src="${escapeHTML(teacher.photo)}" alt="${escapeHTML(teacher.name)}" loading="lazy" onerror="this.onerror=null;this.src='${defaultAvatar}';">`
            : `<div class="dyn-teacher-photo-fallback"><i class="fa-solid fa-chalkboard-user"></i></div>`;

        const spec = teacher.specialization
            ? `<p class="dyn-teacher-spec"><i class="fa-solid fa-book-quran"></i> ${escapeHTML(teacher.specialization)}</p>`
            : "";

        const bio = teacher.bio
            ? `<p class="dyn-teacher-bio">${escapeHTML(teacher.bio)}</p>`
            : `<p class="dyn-teacher-bio">Qualified Quran and Islamic studies teacher dedicated to guiding students with patience and care.</p>`;

        const metaParts = [];
        if (teacher.qualification) {
            metaParts.push(`<span><i class="fa-solid fa-graduation-cap"></i> ${escapeHTML(teacher.qualification)}</span>`);
        }
        if (teacher.experience) {
            metaParts.push(`<span><i class="fa-solid fa-clock"></i> ${escapeHTML(teacher.experience)}</span>`);
        }

        return `
            <div class="dyn-teacher-card">
                ${photo}
                <div class="dyn-teacher-body">
                    <h3>${escapeHTML(teacher.name)}</h3>
                    ${spec}
                    ${bio}
                    ${metaParts.length ? `<div class="dyn-teacher-meta">${metaParts.join("")}</div>` : ""}
                </div>
            </div>`;
    }

    async function loadTeachers() {
        const grids = document.querySelectorAll("[data-teacher-grid]");
        if (!grids.length) return;

        try {
            const data = await getJSON("/api/teachers/public");
            const teachers = Array.isArray(data.teachers) ? data.teachers : [];

            grids.forEach(grid => {
                const gender = grid.getAttribute("data-teacher-gender"); // "male" | "female" | null
                const list = gender
                    ? teachers.filter(t => t.gender === gender)
                    : teachers;

                if (!list.length) {
                    grid.innerHTML = `<p class="dyn-teacher-status">Our teacher profiles are being updated. Please check back soon.</p>`;
                    return;
                }

                grid.innerHTML = list.map(buildTeacherCard).join("");
            });

            // Hide a whole section if its grid ends up empty on a gendered page
            document.querySelectorAll("[data-teacher-section]").forEach(section => {
                const grid = section.querySelector("[data-teacher-grid]");
                if (grid && grid.querySelector(".dyn-teacher-status")) {
                    section.hidden = true;
                }
            });
        } catch (err) {
            console.warn("Teachers unavailable:", err.message);
            grids.forEach(grid => {
                grid.innerHTML = `<p class="dyn-teacher-status">Unable to load teacher profiles right now. Please try again later.</p>`;
            });
        }
    }

    /* ---------------------------------------------------------
       6. Floating WhatsApp button
       --------------------------------------------------------- */

    function ensureFloatingWhatsApp(link) {
        let btn = document.querySelector(".floating-whatsapp-btn");
        const resolvedLink = link || (window.JamaranSiteContent && window.JamaranSiteContent.contact_whatsapp_link) || "";
        if (!btn) {
            btn = document.createElement("a");
            btn.className = "floating-whatsapp-btn";
            btn.setAttribute("data-site-whatsapp-link", "");
            btn.target = "_blank";
            btn.rel = "noopener noreferrer";
            btn.setAttribute("aria-label", "Chat on WhatsApp");
            btn.innerHTML = '<i class="fa-brands fa-whatsapp"></i>';
            document.body.appendChild(btn);
        }

        if (resolvedLink) {
            btn.href = resolvedLink;
            btn.style.display = "";
        } else {
            // No central number configured: keep the button out of the way.
            btn.style.display = "none";
        }
    }

    /* ---------------------------------------------------------
       Boot
       --------------------------------------------------------- */

    document.addEventListener("DOMContentLoaded", function () {
        ensureFloatingWhatsApp();
        initMobileNav();
        initLogoFallback();
        loadSiteContent();
        loadCourses();
        loadTeachers();
    });
})();
