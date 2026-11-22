
// AM-03: Administrator chat log search.
// All message text is rendered safely as text.

(() => {
    const form = document.getElementById("filters");
    const rows = document.getElementById("rows");
    const status = document.getElementById("status");
    const count = document.getElementById("count");
    const pageInfo = document.getElementById("pageInfo");
    const previous = document.getElementById("previous");
    const next = document.getElementById("next");

    let page = 1;
    let total = 0;

    function cell(tr, value, css = "") {
        const td = document.createElement("td");

        td.textContent =
            value == null ? "" : String(value);

        if (css) {
            td.className = css;
        }

        tr.appendChild(td);
    }

    async function load() {
        status.textContent = "Loading chat logs...";

        const params = new URLSearchParams({
            type: document.getElementById("type").value,
            player: document.getElementById("player").value.trim(),
            search: document.getElementById("search").value.trim(),
            page: String(page)
        });

        try {
            const response = await fetch(
                "/api/admin/chat-logs?" + params,
                {
                    headers: {
                        Accept: "application/json"
                    },
                    credentials: "same-origin"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.msg || "Unable to load logs."
                );
            }

            total = data.total;

            rows.replaceChildren();

            for (const m of data.messages) {
                const tr = document.createElement("tr");

                cell(
                    tr,
                    m.sentAt
                        ? new Date(m.sentAt).toLocaleString()
                        : "Unknown"
                );

                cell(
                    tr,
                    m.tableId ? "Table" : "Private"
                );

                cell(tr, m.from);

                cell(
                    tr,
                    m.tableId
                        ? "Table: " + m.tableId
                        : m.to
                );

                cell(tr, m.text, "log-text");

                rows.appendChild(tr);
            }

            status.textContent =
                data.messages.length
                    ? ""
                    : "No matching messages found.";

            count.textContent =
                total + " matching messages";

            pageInfo.textContent =
                "Page " + page +
                " of " +
                Math.max(1, Math.ceil(total / 25));

            previous.disabled = page <= 1;
            next.disabled = page * 25 >= total;

        } catch (error) {
            rows.replaceChildren();

            status.textContent = error.message;
            count.textContent = "";
            pageInfo.textContent = "";

            previous.disabled = true;
            next.disabled = true;
        }
    }

    // Search resets pagination
    form.addEventListener("submit", event => {
        event.preventDefault();

        page = 1;
        load();
    });

    // Previous page
    previous.addEventListener("click", () => {
        if (page > 1) {
            page--;
            load();
        }
    });

    // Next page
    next.addEventListener("click", () => {
        if (page * 25 < total) {
            page++;
            load();
        }
    });

    load();
})();
