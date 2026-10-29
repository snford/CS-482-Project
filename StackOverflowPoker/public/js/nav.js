/*
 * Shared navigation for every page.
 *
 * - Draws the purple top bar into <div id="siteNav"></div>.
 * - Asks the server who is signed in (GET /api/me, using the login cookie).
 *   Pages wait for that with SOP.ready before using SOP.user.
 * - Exposes small helpers on window.SOP.
 *
 * Usage on a page:
 *   <div id="siteNav"></div>                      main site nav
 *   <div id="siteNav" data-variant="admin"></div> admin nav
 *   <div id="siteNav" data-variant="minimal"></div> logo only (sign-in page)
 *   <script src="js/nav.js"></script>              right after the div
 *
 *   SOP.ready.then(function () {
 *       SOP.user       // poker name of the signed-in player, or null
 *       SOP.guestName  // "Guest-1234" when playing as a guest, or null
 *       SOP.me         // full /api/me answer (friends, friendRequests, ...) or null
 *   });
 */
(function () {
    // Links used to carry ?username=. The login cookie does that job now,
    // so this just returns the link unchanged (kept so old calls still work).
    function withUser(href) {
        return href;
    }

    function escapeHtml(text) {
        return String(text ?? "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    // Same name always gets the same avatar color.
    function avatarTone(name) {
        let total = 0;
        for (const ch of String(name || "?")) total += ch.charCodeAt(0);
        return "tone-" + ((total % 6) + 1);
    }

    function avatarHtml(name, sizeClass) {
        const initial = escapeHtml(String(name || "?").trim().charAt(0) || "?");
        return '<span class="avatar ' + (sizeClass || "") + " " + avatarTone(name) +
            '" aria-hidden="true">' + initial + "</span>";
    }

    // ---- Toast messages (replacement for alert()) --------------------------
    function toast(message, type) {
        let stack = document.querySelector(".so-toast-stack");
        if (!stack) {
            stack = document.createElement("div");
            stack.className = "so-toast-stack";
            stack.setAttribute("role", "status");
            stack.setAttribute("aria-live", "polite");
            document.body.appendChild(stack);
        }

        const kind = type || "info";
        const icons = { success: "bi-check-circle-fill", error: "bi-exclamation-octagon-fill", info: "bi-info-circle-fill" };
        const item = document.createElement("div");
        item.className = "so-toast " + kind;
        item.innerHTML = '<i class="bi ' + icons[kind] + '"></i><div></div>';
        item.lastChild.textContent = message;
        stack.appendChild(item);

        setTimeout(function () {
            item.classList.add("leaving");
            setTimeout(function () { item.remove(); }, 260);
        }, 3800);
    }

    // Logging out has to happen on the server (it ends the session), so post a form.
    function logOut() {
        const form = document.createElement("form");
        form.method = "post";
        form.action = "/logout";
        document.body.appendChild(form);
        form.submit();
    }

    // Send people who aren't signed in back to the sign-in page.
    function requireUser() {
        if (!SOP.user) {
            window.location.replace("/index.html");
            return false;
        }
        return true;
    }

    const path = window.location.pathname.toLowerCase();
    const page = path.startsWith("/table/") ? "table.html" : (path.split("/").pop() || "index.html");

    // ---- Who is signed in? -------------------------------------------------
    const ready = fetch("/api/me", { headers: { Accept: "application/json" }, cache: "no-store" })
        .then(function (response) { return response.json(); })
        .catch(function () { return { loggedIn: false }; })
        .then(function (me) {
            if (me && me.loggedIn) {
                // Signed in with Google but no poker name yet: finish that first
                if (me.needsUsername && page !== "choosename.html") {
                    window.location.replace("/choosename.html");
                    return new Promise(function () {}); // never continue on this page
                }
                SOP.me = me;
                SOP.user = me.username || null;
            } else {
                SOP.guestName = (me && me.guestName) || null;
            }
            drawRight();
            return SOP;
        });

    window.SOP = {
        ready: ready,
        me: null,
        user: null,
        guestName: null,
        requireUser: requireUser,
        withUser: withUser,
        escapeHtml: escapeHtml,
        avatarHtml: avatarHtml,
        avatarTone: avatarTone,
        toast: toast,
        logOut: logOut
    };

    // ---- Draw the nav --------------------------------------------------------
    const mount = document.getElementById("siteNav");
    const variant = mount ? (mount.getAttribute("data-variant") || "main") : "main";

    const mainLinks = [
        { id: "lobbyLink", href: "/lobby.html", label: "Lobby", icon: "bi-suit-spade-fill", pages: ["lobby.html", "createtable.html", "table.html"] },
        { id: "friendsLink", href: "/friends.html", label: "Friends", icon: "bi-people-fill", pages: ["friends.html", "player.html", "report.html"] },
        { id: "statsLink", href: "/stats.html", label: "Stats", icon: "bi-bar-chart-fill", pages: ["stats.html"] },
        { id: "leaderboardLink", href: "/leaderboard.html", label: "Leaderboard", icon: "bi-trophy-fill", pages: ["leaderboard.html"] },
        { id: "profileLink", href: "/profile.html", label: "Profile", icon: "bi-person-circle", pages: ["profile.html"] }
    ];

    const adminLinks = [
        { id: "adminReportsLink", href: "/admin.html", label: "Reports", icon: "bi-flag-fill", pages: ["admin.html"] },
        { id: "adminAdsLink", href: "/adminads.html", label: "Ads", icon: "bi-megaphone-fill", pages: ["adminads.html"] },
        { id: "backToSiteLink", href: "/home.html", label: "Back to site", icon: "bi-box-arrow-left", pages: [] }
    ];

    const links = variant === "admin" ? adminLinks : variant === "minimal" ? [] : mainLinks;

    // The right side (user chip / sign in) is filled in once /api/me answers
    function drawRight() {
        const right = document.getElementById("siteNavRight");
        if (!right) return;

        const home = document.getElementById("homeLink");
        if (home) home.href = SOP.user ? "/home.html" : "/index.html";

        const logoutButtonHtml =
            '<button type="button" class="nav-icon-btn" id="logoutButton" title="Log out" aria-label="Log out">' +
            '<i class="bi bi-box-arrow-right"></i></button>';

        if (SOP.user) {
            right.innerHTML =
                '<div class="d-flex align-items-center gap-2 mt-3 mt-lg-0">' +
                '<a class="user-chip" href="/profile.html" title="Your profile">' +
                avatarHtml(SOP.user, "avatar-sm") + '<span class="name">' + escapeHtml(SOP.user) + "</span></a>" +

                '<div class="nav-chip-balance" title="Your total chips">' +
                '<i class="bi bi-coin" aria-hidden="true"></i>' +
                '<span id="navChipBalance">Loading...</span>' +
                '</div>' +
                
                logoutButtonHtml + "</div>";
            loadChipBalance();    
        } else if (SOP.guestName) {
            right.innerHTML =
                '<div class="d-flex align-items-center gap-2 mt-3 mt-lg-0">' +
                '<span class="user-chip" title="Playing as a guest">' +
                avatarHtml(SOP.guestName, "avatar-sm") + '<span class="name">' + escapeHtml(SOP.guestName) + "</span></span>" +

                '<div class="nav-chip-balance" title="Temporary guest chips">' +
                '<i class="bi bi-coin" aria-hidden="true"></i>' +
                '<span id="navChipBalance">1,000</span>' +
                '</div>' +

                '<a class="btn btn-sm btn-outline-light-glass" href="/index.html">' +
                '<i class="bi bi-google"></i>Sign in</a>' +
                logoutButtonHtml + "</div>";
        } else {
            right.innerHTML =
                '<a class="btn btn-sm btn-outline-light-glass mt-3 mt-lg-0" href="/index.html">' +
                '<i class="bi bi-person-fill"></i>Sign in</a>';
        }

        const logoutButton = document.getElementById("logoutButton");
        if (logoutButton) logoutButton.addEventListener("click", logOut);
    }

    if (!mount) return;

    let linksHtml = "";
    for (const link of links) {
        const active = link.pages.includes(page);
        linksHtml +=
            '<li class="nav-item">' +
            '<a class="nav-link' + (active ? " active" : "") + '" id="' + link.id + '" href="' + link.href + '"' +
            (active ? ' aria-current="page"' : "") + ">" +
            '<i class="bi ' + link.icon + '" aria-hidden="true"></i>' + link.label +
            "</a></li>";
    }

    const rightHtml = variant !== "minimal" ? '<div id="siteNavRight"></div>' : "";
    const brandSub = variant === "admin" ? "Admin" : "Seven-Card Stud";

async function loadChipBalance() {
    const chipDisplay = document.getElementById("navChipBalance");

    if (!chipDisplay || !SOP.user) {
        return;
    }

    try {
        const response = await fetch(
            "/users/" + encodeURIComponent(SOP.user) + "/chips",
            {
                headers: { Accept: "application/json" },
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Could not load chips");
        }

        const data = await response.json();
        const chips = Number(data.chips);

        if (!Number.isFinite(chips) || chips < 0) {
            throw new Error("Invalid chip balance");
        }

        chipDisplay.textContent = chips.toLocaleString();
    } catch (error) {
        console.error("Error loading chip balance:", error);
        chipDisplay.textContent = "--";
    }
}

    mount.outerHTML =
        '<header class="site-nav">' +
        '<nav class="navbar navbar-expand-lg navbar-dark" aria-label="Main navigation">' +
        '<div class="container">' +
        '<a class="brand-link me-lg-4" id="homeLink" href="/index.html">' +
        '<img class="brand-logo" src="/images/logo.svg" alt="">' +
        '<span class="brand-name">Stack Overflow<small>' + brandSub + "</small></span></a>" +
        (links.length || rightHtml
            ? '<button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#siteNavLinks" ' +
              'aria-controls="siteNavLinks" aria-expanded="false" aria-label="Toggle navigation">' +
              '<span class="navbar-toggler-icon"></span></button>' +
              '<div class="collapse navbar-collapse" id="siteNavLinks">' +
              '<ul class="navbar-nav me-auto gap-1 mt-3 mt-lg-0">' + linksHtml + "</ul>" +
              rightHtml +
              "</div>"
            : "") +
        "</div></nav></header>";
})();

