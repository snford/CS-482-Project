/*
 * Shared navigation for every page.
 *
 * - Draws the purple top bar into <div id="siteNav"></div>.
 * - Remembers the logged-in username (from ?username=... after login) in
 *   sessionStorage, so it is no longer lost when moving between pages.
 * - Adds ?username= to every nav link and exposes small helpers on window.SOP.
 *
 * Usage on a page:
 *   <div id="siteNav"></div>                      main site nav
 *   <div id="siteNav" data-variant="admin"></div> admin nav
 *   <div id="siteNav" data-variant="minimal"></div> logo only (sign-in page)
 *   <script src="js/nav.js"></script>              right after the div
 */
(function () {
    const USER_KEY = "sopUser";

    // ---- Logged-in user ----------------------------------------------------
    const params = new URLSearchParams(window.location.search);
    let user = params.get("username");

    try {
        if (user) {
            sessionStorage.setItem(USER_KEY, user);
        } else {
            user = sessionStorage.getItem(USER_KEY);
        }
    } catch (error) {
        // Storage can be blocked (private mode); the URL value still works.
    }

    function withUser(href) {
        if (!user) return href;
        const joiner = href.includes("?") ? "&" : "?";
        return href + joiner + "username=" + encodeURIComponent(user);
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

    function logOut() {
        try {
            sessionStorage.removeItem(USER_KEY);
            sessionStorage.removeItem("currentUsername");
        } catch (error) { /* ignore */ }
        window.location.href = "/index.html";
    }

    window.SOP = {
        user: user,
        withUser: withUser,
        escapeHtml: escapeHtml,
        avatarHtml: avatarHtml,
        avatarTone: avatarTone,
        toast: toast,
        logOut: logOut
    };

    // ---- Draw the nav --------------------------------------------------------
    const mount = document.getElementById("siteNav");
    if (!mount) return;

    const variant = mount.getAttribute("data-variant") || "main";
    const path = window.location.pathname.toLowerCase();
    const page = path.startsWith("/table/") ? "table.html" : (path.split("/").pop() || "index.html");

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
    const homeHref = user ? withUser("/home.html") : "/index.html";

    let linksHtml = "";
    for (const link of links) {
        const active = link.pages.includes(page);
        linksHtml +=
            '<li class="nav-item">' +
            '<a class="nav-link' + (active ? " active" : "") + '" id="' + link.id + '" href="' + withUser(link.href) + '"' +
            (active ? ' aria-current="page"' : "") + ">" +
            '<i class="bi ' + link.icon + '" aria-hidden="true"></i>' + link.label +
            "</a></li>";
    }

    let rightHtml = "";
    if (variant !== "minimal") {
        if (user) {
            rightHtml =
                '<div class="d-flex align-items-center gap-2 mt-3 mt-lg-0">' +
                '<a class="user-chip" href="' + withUser("/profile.html") + '" title="Your profile">' +
                avatarHtml(user, "avatar-sm") + '<span class="name">' + escapeHtml(user) + "</span></a>" +
                '<button type="button" class="nav-icon-btn" id="logoutButton" title="Log out" aria-label="Log out">' +
                '<i class="bi bi-box-arrow-right"></i></button>' +
                "</div>";
        } else {
            rightHtml =
                '<a class="btn btn-sm btn-outline-light-glass mt-3 mt-lg-0" href="/index.html">' +
                '<i class="bi bi-person-fill"></i>Sign in</a>';
        }
    }

    const brandSub = variant === "admin" ? "Admin" : "Seven-Card Stud";

    mount.outerHTML =
        '<header class="site-nav">' +
        '<nav class="navbar navbar-expand-lg navbar-dark" aria-label="Main navigation">' +
        '<div class="container">' +
        '<a class="brand-link me-lg-4" id="homeLink" href="' + homeHref + '">' +
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

    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) logoutButton.addEventListener("click", logOut);
})();
