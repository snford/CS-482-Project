
// AM-06: Administrator game management interface

(() => {

    const rows = document.getElementById("gameRows");
    const search = document.getElementById("search");

    const filter =
        document.getElementById("statusFilter");

    const status =
        document.getElementById("statusMessage");

    let games = [];
    let busy = false;

    async function api(url, options = {}) {

        const response = await fetch(url, {
            credentials: "same-origin",

            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },

            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.msg || "Request failed."
            );
        }

        return data;
    }

    function cell(row, value) {

        const td = document.createElement("td");

        td.textContent =
            value == null ? "" : String(value);

        row.appendChild(td);

        return td;
    }

    function detail(parent, label, value) {

        const p = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = label + ": ";

        p.append(
            strong,
            document.createTextNode(String(value))
        );

        parent.appendChild(p);
    }

    // Display detailed information about a game

    function viewGame(game) {

        const content =
            document.getElementById("gameDetails");

        content.replaceChildren();

        detail(content, "Table", game.name);
        detail(content, "Table ID", game.id);
        detail(content, "Status", game.status);
        detail(content, "Privacy", game.privacy);
        detail(content, "Ante", game.ante);
        detail(content, "Bots", game.bots);

        detail(
            content,
            "Players",
            game.players.length + "/" + game.maxPlayers
        );

        detail(
            content,
            "Player Names",
            game.players.join(", ") || "No players"
        );

        detail(
            content,
            "Active Game",
            game.activeGame ? "Yes" : "No"
        );

        detail(
            content,
            "Round Status",
            game.roundStatus || "No round"
        );

        detail(
            content,
            "Street",
            game.street || "N/A"
        );

        detail(content, "Pot", game.pot);

        if (game.participants.length) {

            detail(
                content,
                "Game Participants",
                game.participants.map(player =>
                    player.username +
                    (player.isBot ? " (Bot)" : "") +
                    (player.folded ? " (Folded)" : "")
                ).join(", ")
            );
        }

        const modal = bootstrap.Modal.getOrCreateInstance(
            document.getElementById("gameDetailsModal")
        );

        modal.show();
    }

    function actionButton(label, css, callback) {

        const button = document.createElement("button");

        button.type = "button";
        button.className = css;
        button.textContent = label;
        button.disabled = busy;

        button.addEventListener("click", callback);

        return button;
    }

    // Render filtered games

    function render() {

        rows.replaceChildren();

        const term =
            search.value.trim().toLowerCase();

        const selectedStatus = filter.value;

        const filtered = games.filter(game => {

            const matchesSearch =
                game.name.toLowerCase().includes(term) ||
                game.players.some(player =>
                    player.toLowerCase().includes(term)
                );

            const matchesStatus =
                selectedStatus === "all" ||
                game.status === selectedStatus;

            return matchesSearch && matchesStatus;
        });

        if (!filtered.length) {

            const row = document.createElement("tr");
            const td = document.createElement("td");

            td.colSpan = 7;
            td.textContent = "No matching tables found.";

            row.appendChild(td);
            rows.appendChild(row);

            return;
        }

        for (const game of filtered) {

            const row = document.createElement("tr");

            cell(row, game.name);

            cell(
                row,
                game.players.length + "/" + game.maxPlayers
            );

            cell(row, game.privacy);

            const statusCell = cell(row, game.status);

            if (game.status === "playing") {
                statusCell.className = "text-success";
            }

            if (game.status === "closed") {
                statusCell.className = "text-danger";
            }

            cell(row, game.ante);
            cell(row, game.bots);

            const actions = document.createElement("td");
            actions.className = "game-actions";

            actions.appendChild(
                actionButton(
                    "View Details",
                    "btn btn-sm btn-outline-light",
                    () => viewGame(game)
                )
            );

            if (
                game.activeGame ||
                game.status === "playing"
            ) {

                actions.appendChild(
                    actionButton(
                        "End Game",
                        "btn btn-sm btn-warning",
                        () => endGame(game)
                    )
                );
            }
            // AM-06-T5: Remove Table button

            row.appendChild(actions);
            rows.appendChild(row);
        }
    }

    // Load all games from the backend

    async function loadGames() {

        status.textContent = "Loading games...";

        try {

            const data = await api("/api/admin/games");

            games = data.games;

            document.getElementById("totalTables")
                .textContent = data.summary.totalTables;

            document.getElementById("activeGames")
                .textContent = data.summary.activeGames;

            document.getElementById("waitingTables")
                .textContent = data.summary.waitingTables;

            document.getElementById("closedTables")
                .textContent = data.summary.closedTables;

            status.textContent = "";

    async function endGame(game) {

        if (busy) return;

        if (!confirm(
            "End the game at " + game.name +
            "? The table will close and unfinished bets will be refunded."
        )) {
            return;
        }

        busy = true;
        render();

        try {

            const data = await api(
                "/api/admin/games/" +
                encodeURIComponent(game.id) +
                "/end",
                {
                    method: "PATCH"
                }
            );

            alert(data.msg);

            await loadGames();

        } catch (error) {

            alert(error.message);

        } finally {

            busy = false;
            render();
        }
    }

            render();

        } catch (error) {

            status.textContent = error.message;
        }
    }

    search.addEventListener("input", render);

    filter.addEventListener("change", render);

    document.getElementById("refreshButton")
        .addEventListener("click", loadGames);

    loadGames();

})();
