
// AM-01: Shared report conversation interface

function initReportConversation(isAdmin) {
    const list = document.getElementById("reportList");
    const conversation = document.getElementById("conversation");
    const form = document.getElementById("messageForm");
    const resolve = document.getElementById("resolveButton");
    const status = document.getElementById("status");

    let selectedId = null;

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
            throw new Error(data.msg || "Request failed.");
        }

        return data;
    }

    function line(parent, label, value) {
        const p = document.createElement("p");
        const strong = document.createElement("strong");

        strong.textContent = label + ": ";

        p.append(
            strong,
            document.createTextNode(value || "")
        );

        parent.appendChild(p);
    }

    // Open an individual report
    async function openReport(id) {
        try {
            const { report } = await api(
                "/api/reports/" + encodeURIComponent(id)
            );

            selectedId = report.id;

            document.getElementById("reportTitle").textContent =
                "Report: " + report.reportedUsername;

            const info = document.getElementById("reportInfo");

            info.replaceChildren();

            line(info, "Reporter", report.reporterName);
            line(info, "Reason", report.reason);
            line(info, "Status", report.status);
            line(info, "Details", report.details);

            conversation.replaceChildren();

            if (!report.messages.length) {
                conversation.textContent = "No messages yet.";
            }

            for (const message of report.messages) {
                const box = document.createElement("div");

                box.className = "border rounded p-2 mb-2";

                line(
                    box,
                    message.senderName +
                    " (" + message.senderRole + ")",
                    message.text
                );

                conversation.appendChild(box);
            }

            form.hidden = report.status !== "open";

            resolve.hidden =
                !isAdmin || report.status !== "open";

            status.textContent =
                report.status === "resolved"
                    ? "This conversation is closed."
                    : "";

        } catch (error) {
            status.textContent = error.message;
        }
    }

    // Load report list
    async function loadReports() {
        try {
            const { reports } = await api(
                isAdmin
                    ? "/api/admin/reports"
                    : "/api/reports/mine"
            );

            list.replaceChildren();

            if (!reports.length) {
                list.textContent = "No reports yet.";
            }

            for (const report of reports) {
                const button = document.createElement("button");

                button.type = "button";

                button.className =
                    "btn btn-outline-primary w-100 text-start mb-2";

                button.textContent =
                    (isAdmin
                        ? report.reporterName + " reported "
                        : "Reported ") +
                    report.reportedUsername +
                    " — " +
                    report.status;

                button.addEventListener("click", () => {
                    openReport(report.id);
                });

                list.appendChild(button);
            }

            const requested = new URLSearchParams(
                location.search
            ).get("id");

            if (
                requested &&
                reports.some(r => r.id === requested)
            ) {
                await openReport(requested);

            } else if (reports.length && !selectedId) {
                await openReport(reports[0].id);
            }

        } catch (error) {
            status.textContent = error.message;
        }
    }

    // Send a message
    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!selectedId) return;

        const input = document.getElementById("messageText");
        const message = input.value.trim();

        if (!message) return;

        const button = form.querySelector(
            'button[type="submit"]'
        );

        button.disabled = true;

        try {
            await api(
                "/api/reports/" +
                encodeURIComponent(selectedId) +
                "/messages",
                {
                    method: "POST",
                    body: JSON.stringify({
                        text: message
                    })
                }
            );

            input.value = "";

            await openReport(selectedId);

        } catch (error) {
            status.textContent = error.message;

        } finally {
            button.disabled = false;
        }
    });

    // Administrator resolves a report
    resolve.addEventListener("click", async () => {
        if (
            !isAdmin ||
            !selectedId ||
            !confirm("Mark this report as resolved?")
        ) {
            return;
        }

        try {
            await api(
                "/api/admin/reports/" +
                encodeURIComponent(selectedId) +
                "/resolve",
                {
                    method: "PATCH"
                }
            );

            await loadReports();
            await openReport(selectedId);

        } catch (error) {
            status.textContent = error.message;
        }
    });

    loadReports();
}
