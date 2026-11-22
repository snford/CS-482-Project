
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// LT-04: Test the filtering code from the real lobby page
const html = fs.readFileSync(
    path.join(__dirname, "..", "lobby.html"),
    "utf8"
);

const start = html.indexOf("function renderTables() {");
const end = html.indexOf("// LT-01: load the public tables", start);

if (start === -1 || end === -1) {
    throw new Error("Could not find renderTables in lobby.html");
}

const renderCode = html.slice(start, end);

const tables = [
    {
        name: "Easy Table",
        status: "waiting",
        bots: "easy",
        players: ["Amy"],
        maxPlayers: 5,
        ante: "5 / 10 / 20 / 40"
    },
    {
        name: "Hard Table",
        status: "waiting",
        bots: "hard",
        players: ["Amy", "Ben", "Sam"],
        maxPlayers: 5,
        ante: "10 / 20 / 50 / 100"
    },
    {
        name: "Playing Table",
        status: "playing",
        bots: "off",
        players: ["Amy"],
        maxPlayers: 7,
        ante: "1 / 2 / 5 / 10"
    }
];

function filterTables(options = {}) {
    const shown = [];

    const list = {
        innerHTML: "",
        replaceChildren: function() {
            shown.length = 0;
        },
        appendChild: function(table) {
            shown.push(table);
        }
    };

    const elements = {
        tablesList: list,
        tableMessage: { textContent: "" },
        tableSearch: { value: options.search || "" },
        botFilter: { value: options.bots || "all" },
        seatFilter: { value: String(options.seats || 0) },
        maxBetFilter: {
            value: options.maxBet == null
                ? ""
                : String(options.maxBet)
        }
    };

    vm.runInNewContext(renderCode + "\nrenderTables();", {
        document: {
            getElementById: function(id) {
                return elements[id];
            }
        },
        allTables: tables,
        activeFilter: options.status || "all",
        tableCard: function(table) {
            return table;
        }
    });

    return {
        names: shown.map(function(table) {
            return table.name;
        }),
        message: list.innerHTML
    };
}

test("LT-04: Shows all tables by default", function() {
    expect(filterTables().names).toEqual([
        "Easy Table",
        "Hard Table",
        "Playing Table"
    ]);
});

test("LT-04: Filters by bot difficulty", function() {
    expect(filterTables({ bots: "easy" }).names)
        .toEqual(["Easy Table"]);
});

test("LT-04: Filters by available seats", function() {
    expect(filterTables({ seats: 3 }).names)
        .toEqual(["Easy Table"]);
});

test("LT-04: Filters by maximum big bet", function() {
    expect(filterTables({ maxBet: 40 }).names)
        .toEqual(["Easy Table", "Playing Table"]);
});

test("LT-04: Combines multiple filters", function() {
    expect(filterTables({
        bots: "easy",
        seats: 3,
        maxBet: 50
    }).names).toEqual(["Easy Table"]);
});

test("LT-04: Keeps the existing in-progress filter", function() {
    expect(filterTables({ status: "playing" }).names)
        .toEqual(["Playing Table"]);
});

test("LT-04: Still searches table names", function() {
    expect(filterTables({ search: "hard" }).names)
        .toEqual(["Hard Table"]);
});

test("LT-04: Shows a message when nothing matches", function() {
    const result = filterTables({ bots: "medium" });

    expect(result.names).toEqual([]);
    expect(result.message).toContain("No tables match");
});
