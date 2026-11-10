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
    // ---- Light / dark mode (picked on the Profile page, saved on this device) ----
    const THEME_KEY = "sop-theme";

    function getTheme() {
        try {
            return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
        } catch (error) {
            return "light"; // storage blocked
        }
    }

    function setTheme(theme) {
        const value = theme === "dark" ? "dark" : "light";
        // data-theme is for our CSS, data-bs-theme makes Bootstrap's parts match
        document.documentElement.setAttribute("data-theme", value);
        document.documentElement.setAttribute("data-bs-theme", value);
        try { localStorage.setItem(THEME_KEY, value); } catch (error) { /* ignore */ }
    }

    // Runs right away (nav.js is near the top of <body>) so the page doesn't flash white
    setTheme(getTheme());

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
        getTheme: getTheme,
        setTheme: setTheme,
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
    {
        id: "adminDashboardLink",
        href: "/admin-dashboard.html",
        label: "Admin Dashboard",
        icon: "bi-speedometer2",
        pages: ["admin-dashboard.html"]

    },
    {
        id: "adminReportsLink",
        href: "/admin.html",
        label: "Reports",
        icon: "bi-flag-fill"
    },
    {
        id: "adminAdsLink",
        href: "/adminads.html",
        label: "Ads",
        icon: "bi-megaphone-fill"
    },
    {
        id: "backToSiteLink",
        href: "/home.html",
        label: "Back to site",
        icon: "bi-box-arrow-left"
    }
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
                loadChipBalance(); 
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
        const active = (link.pages || []).includes(page);
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

if (!chipDisplay) {
    return;
}

// Identify whether the current player is a registered user or guest.
await SOP.ready;

const username = SOP.user || SOP.guestName;

if (!username) {
    chipDisplay.textContent = "--";
    return;
}

try {
    const response = await fetch(
        "/users/" + encodeURIComponent(username) + "/chips",
        {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
            cache: "no-store"
        }
    );

    if (!response.ok) {
        throw new Error("Could not load chips");
    }

    const data = await response.json();
    const chips = Number(data.chips);

    if (!Number.isSafeInteger(chips) || chips < 0) {
        throw new Error("Invalid chip balance");
    }

    chipDisplay.textContent = chips.toLocaleString();

} catch (error) {
    console.error("Error loading chip balance:", error);
    chipDisplay.textContent = "--";
}

// AM-05: Add Admin Dashboard link for administrators
async function addAdminNavigationLink() {

    // Do not add an extra link to admin pages
    if (variant !== "main") {
        return;
    }

    try {

        // Check whether the current user is an administrator
        const response = await fetch("/api/admin/dashboard", {
            credentials: "same-origin"
        });

        // Only administrators receive a successful response
        if (!response.ok) {
            return;
        }

        // Find the existing navigation list
        const navList = document.querySelector(
            "#siteNavLinks ul.navbar-nav"
        );

        if (!navList) {
            return;
        }

        // Prevent duplicate links
        if (document.getElementById("adminDashboardMainLink")) {
            return;
        }

        // Create the list item
        const listItem = document.createElement("li");
        listItem.className = "nav-item";

        // Create the dashboard link
        const adminLink = document.createElement("a");

        adminLink.id = "adminDashboardMainLink";
        adminLink.href = "/admin-dashboard.html";
        adminLink.className = "nav-link";

        // Add the icon
        const icon = document.createElement("i");
        icon.className = "bi bi-shield-lock-fill";
        icon.setAttribute("aria-hidden", "true");

        adminLink.appendChild(icon);

        // Add the text
        adminLink.appendChild(
            document.createTextNode(" Admin Dashboard")
        );

        // Insert the link into the navigation
        listItem.appendChild(adminLink);
        navList.appendChild(listItem);

    } catch (error) {

        console.error("Unable to check admin access:", error);

    }

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
        // AM-05: Check administrator access after rendering navigation
        addAdminNavigationLink();
      
})();

/* BT-02: Floating tutorial inside poker tables */
(function () {
    // Only run on the poker table page
    const path = window.location.pathname;
    if (path !== "/table.html" && !path.startsWith("/table/")) {
        return;
    }

    function setupTableHelp() {
        const params = new URLSearchParams(window.location.search);
        const match = path.match(/^\/table\/([^/]+)/);

        const tableId =
            params.get("tableId") ||
            params.get("id") ||
            (match ? decodeURIComponent(match[1]) : null) ||
            sessionStorage.getItem("currentTableId");

        if (!tableId) return;

        // Same six steps as the original tutorial
        const steps = [
            {
                title: "Join a Table",
                text: "Open the Lobby and join a public table or create your own table."
            },
            {
                title: "Start the Game",
                text: "Seven-Card Stud is played with 2 to 7 players. Start a round when enough players have joined."
            },
            {
                title: "Get Your First Cards",
                text: "Each player starts with three cards. Two are face down and one is face up."
            },
            {
                title: "Choose Your Action",
                text: "During betting, you can Fold to leave the hand, Check if you do not need to bet, Call to match a bet, or Raise to increase it."
            },
            {
                title: "Receive More Cards",
                text: "More cards are dealt during the round, with betting between deals. Each player eventually receives seven cards."
            },
            {
                title: "Win the Hand",
                text: "At the showdown, players use their best five cards out of seven. The strongest poker hand wins the pot."
            }
        ];

        const handRankings = [
            "Royal Flush",
            "Straight Flush",
            "Four of a Kind",
            "Full House",
            "Flush",
            "Straight",
            "Three of a Kind",
            "Two Pair",
            "One Pair",
            "High Card"
        ];

        // All styles are kept here so no CSS file needs editing
        const style = document.createElement("style");
        style.textContent = `
            .table-help-widget {
                position: fixed;
                left: 20px;
                bottom: 20px;
                z-index: 2000;
                font-family: inherit;
            }

            .table-help-widget[hidden],
            .table-help-panel[hidden],
            .table-help-rankings[hidden],
            .table-help-progress[hidden] {
                display: none !important;
            }

            .table-help-button {
                width: 55px;
                height: 55px;
                border: 2px solid white;
                border-radius: 50%;
                background: linear-gradient(135deg, #bf40bf, #752080);
                color: white;
                font-size: 30px;
                font-weight: bold;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.2s;
            }

            .table-help-button:hover {
                transform: scale(1.1);
            }

            .table-help-panel {
                position: absolute;
                bottom: 70px;
                left: 0;
                width: min(365px, calc(100vw - 40px));
                max-height: min(530px, 75vh);
                overflow-y: auto;
                background: var(--surface, #fff);
                color: var(--ink, #29212e);
                border: 1px solid var(--line, #ddd);
                border-radius: 18px;
                box-shadow: 0 12px 45px rgba(0,0,0,0.3);
            }

            .table-help-header {
                background: linear-gradient(120deg, #8e2a8e, #bf40bf);
                color: white;
                padding: 15px 17px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .table-help-header strong {
                font-size: 16px;
            }

            .table-help-close {
                background: transparent;
                border: none;
                color: white;
                font-size: 25px;
                cursor: pointer;
                line-height: 1;
            }

            .table-help-tabs {
                display: flex;
                gap: 8px;
                padding: 14px 16px 0;
            }

            .table-help-tab {
                flex: 1;
                padding: 8px;
                border: 1px solid var(--line, #ddd);
                border-radius: 9px;
                background: var(--surface, #fff);
                color: var(--ink, #29212e);
                cursor: pointer;
                font-size: 13px;
            }

            .table-help-tab.active {
                background: #bf40bf;
                color: white;
                border-color: #bf40bf;
            }

            .table-help-content {
                padding: 16px;
            }

            .table-help-counter {
                font-size: 12px;
                color: var(--ink-muted, #777);
                margin-bottom: 7px;
            }

            .table-help-title {
                font-size: 19px;
                font-weight: bold;
                margin: 0 0 10px;
                color: var(--ink, #29212e);
            }

            .table-help-description {
                font-size: 14px;
                line-height: 1.6;
                min-height: 65px;
                color: var(--ink, #29212e);
            }

            .table-help-progress {
                height: 6px;
                background: var(--line, #eee);
                border-radius: 10px;
                overflow: hidden;
                margin: 14px 0;
            }

            .table-help-progress-bar {
                height: 100%;
                background: #bf40bf;
                transition: width 0.2s;
            }

            .table-help-controls {
                display: flex;
                justify-content: space-between;
                gap: 10px;
            }

            .table-help-control {
                border: none;
                border-radius: 10px;
                padding: 9px 16px;
                background: #bf40bf;
                color: white;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
            }

            .table-help-control:disabled {
                background: #aaa;
                cursor: default;
            }

            .table-help-rankings {
                padding-left: 23px;
                font-size: 14px;
                line-height: 1.9;
            }

            .table-help-footer {
                border-top: 1px solid var(--line, #ddd);
                padding: 12px 16px;
                font-size: 12px;
                text-align: center;
            }

            @media (max-width: 600px) {
                .table-help-widget {
                    left: 12px;
                    bottom: 12px;
                }

                .table-help-button {
                    width: 48px;
                    height: 48px;
                    font-size: 26px;
                }

                .table-help-panel {
                    bottom: 60px;
                    width: calc(100vw - 24px);
                    max-height: 65vh;
                }
            }
        `;
        document.head.appendChild(style);

        const widget = document.createElement("div");
        widget.className = "table-help-widget";
        widget.hidden = true;

        widget.innerHTML = `
            <button
                class="table-help-button"
                id="tableHelpButton"
                type="button"
                aria-label="Open poker tutorial"
                aria-expanded="false"
                title="How to Play"
            >?</button>

            <section
                class="table-help-panel"
                id="tableHelpPanel"
                aria-label="Poker tutorial"
                hidden
            >
                <div class="table-help-header">
                    <strong>♠ Poker Table Guide</strong>
                    <button
                        class="table-help-close"
                        id="tableHelpClose"
                        type="button"
                        aria-label="Close tutorial"
                    >&times;</button>
                </div>

                <div class="table-help-tabs">
                    <button class="table-help-tab active"
                            id="tableHelpGuideTab"
                            type="button">
                        How to Play
                    </button>
                    <button class="table-help-tab"
                            id="tableHelpRanksTab"
                            type="button">
                        Hand Rankings
                    </button>
                </div>

                <div class="table-help-content">
                    <div id="tableHelpCounter"
                         class="table-help-counter"></div>

                    <h2 class="table-help-title"
                        id="tableHelpTitle"></h2>

                    <p class="table-help-description"
                       id="tableHelpDescription"></p>

                    <ol class="table-help-rankings"
                        id="tableHelpRankings"
                        hidden></ol>

                    <div class="table-help-progress"
                         id="tableHelpProgress">
                        <div class="table-help-progress-bar"
                             id="tableHelpProgressBar"></div>
                    </div>

                    <div class="table-help-controls"
                         id="tableHelpControls">
                        <button class="table-help-control"
                                id="tableHelpPrevious"
                                type="button">
                            Previous
                        </button>

                        <button class="table-help-control"
                                id="tableHelpNext"
                                type="button">
                            Next
                        </button>
                    </div>
                </div>

                <div class="table-help-footer">
                    <a href="/tutorial.html">
                        Open Full Tutorial
                    </a>
                </div>
            </section>
        `;

        document.body.appendChild(widget);

        const helpButton = document.getElementById("tableHelpButton");
        const panel = document.getElementById("tableHelpPanel");
        const closeButton = document.getElementById("tableHelpClose");
        const guideTab = document.getElementById("tableHelpGuideTab");
        const ranksTab = document.getElementById("tableHelpRanksTab");
        const counter = document.getElementById("tableHelpCounter");
        const title = document.getElementById("tableHelpTitle");
        const description = document.getElementById("tableHelpDescription");
        const rankings = document.getElementById("tableHelpRankings");
        const progress = document.getElementById("tableHelpProgress");
        const progressBar = document.getElementById("tableHelpProgressBar");
        const controls = document.getElementById("tableHelpControls");
        const previous = document.getElementById("tableHelpPrevious");
        const next = document.getElementById("tableHelpNext");

        let currentStep = 0;
        let rankingMode = false;

        // Fill the rankings once
        handRankings.forEach(function (name) {
            const item = document.createElement("li");
            item.textContent = name;
            rankings.appendChild(item);
        });

        function renderTutorial() {
            guideTab.classList.toggle("active", !rankingMode);
            ranksTab.classList.toggle("active", rankingMode);

            if (rankingMode) {
                counter.textContent = "Quick Reference";
                title.textContent = "Poker Hand Rankings";
                description.textContent = "Strongest to weakest:";
                rankings.hidden = false;
                progress.hidden = true;
                controls.hidden = true;
                controls.style.display = "none";
            } else {
                const step = steps[currentStep];

                counter.textContent =
                    "Step " + (currentStep + 1) + " of " + steps.length;

                title.textContent = step.title;
                description.textContent = step.text;

                rankings.hidden = true;
                progress.hidden = false;
                controls.hidden = false;
                controls.style.display = "flex";

                progressBar.style.width =
                    ((currentStep + 1) / steps.length * 100) + "%";

                previous.disabled = currentStep === 0;
                next.textContent =
                    currentStep === steps.length - 1
                        ? "Restart"
                        : "Next";
            }
        }

        function setOpen(open) {
            panel.hidden = !open;
            helpButton.setAttribute("aria-expanded", String(open));
        }

        helpButton.addEventListener("click", function () {
            setOpen(panel.hidden);
        });

        closeButton.addEventListener("click", function () {
            setOpen(false);
            helpButton.focus();
        });

        guideTab.addEventListener("click", function () {
            rankingMode = false;
            renderTutorial();
        });

        ranksTab.addEventListener("click", function () {
            rankingMode = true;
            renderTutorial();
        });

        previous.addEventListener("click", function () {
            if (currentStep > 0) currentStep--;
            renderTutorial();
        });

        next.addEventListener("click", function () {
            if (currentStep === steps.length - 1) {
                currentStep = 0;
            } else {
                currentStep++;
            }
            renderTutorial();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && !panel.hidden) {
                setOpen(false);
                helpButton.focus();
            }
        });

        renderTutorial();

        // Only show the ? when the current player is seated.
        // Works for both Google accounts and guests.
        async function checkIfJoined() {
            const playerName = SOP.user || SOP.guestName;

            if (!playerName) {
                widget.hidden = true;
                setOpen(false);
                return;
            }

            try {
                const response = await fetch(
                    "/api/tables/" + encodeURIComponent(tableId),
                    {
                        credentials: "same-origin",
                        cache: "no-store"
                    }
                );

                if (!response.ok) return;

                const table = await response.json();
                const players = Array.isArray(table.players)
                    ? table.players
                    : [];

                const joined = players.includes(playerName);

                widget.hidden = !joined;

                if (!joined) setOpen(false);
            } catch (error) {
                // Keep the game working if the request fails.
            }
        }

        SOP.ready.then(function () {
            checkIfJoined();

            // Detect joining or leaving without refreshing.
            setInterval(checkIfJoined, 3000);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupTableHelp);
    } else {
        setupTableHelp();
    }
})();

