
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// TT-04: Test the actual advertisement display functions in both pages
function setupAds(page) {
    const isLobby = page === "lobby";
    const file = isLobby ? "lobby.html" : "table.html";
    const name = isLobby ? "Lobby" : "Table";

    const html = fs.readFileSync(
        path.join(__dirname, "..", file),
        "utf8"
    );

    const start = html.indexOf(
        "// TT-04: Automatically update " +
        page + " advertisements"
    );

    const end = html.indexOf(
        "// Load advertisements when the page opens",
        start
    );

    if (start === -1 || end === -1) {
        throw new Error("Could not find advertisement code in " + file);
    }

    const elements = {};

    elements[isLobby ? "adLink" : "tableAdLink"] = {
        hidden: true,
        removeAttribute: function(key) {
            delete this[key];
        }
    };

    elements[isLobby ? "adImage" : "tableAdImage"] = {
        src: "",
        alt: ""
    };

    elements[isLobby ? "adMessage" : "tableAdMessage"] = {
        textContent: ""
    };

    let ads = [];
    const timers = [];

    const setTimeoutMock = jest.fn(function(callback, ms) {
        const timer = {
            callback: callback,
            ms: ms
        };

        timers.push(timer);
        return timer;
    });

    const loadFunction = "load" + name + "Ad";

    const api = vm.runInNewContext(
        html.slice(start, end) +
        "\n({ load: " + loadFunction + " })",
        {
            document: {
                getElementById: function(id) {
                    return elements[id];
                }
            },
            fetch: async function() {
                return {
                    ok: true,
                    json: async function() {
                        return ads;
                    }
                };
            },
            setTimeout: setTimeoutMock,
            clearTimeout: jest.fn()
        }
    );

    return {
        load: api.load,
        setAds: function(value) {
            ads = value;
        },
        link: elements[isLobby ? "adLink" : "tableAdLink"],
        image: elements[isLobby ? "adImage" : "tableAdImage"],
        message: elements[isLobby ? "adMessage" : "tableAdMessage"],
        timers: timers
    };
}

function exampleAd(id, name) {
    return {
        _id: id,
        name: name,
        imageUrl: "/images/" + id + ".png",
        linkUrl: "https://example.com/" + id,
        intervalMinutes: 2,
        active: true
    };
}

for (const page of ["lobby", "table"]) {

    test("TT-04: " + page + " shows a newly enabled ad", async function() {
        const viewer = setupAds(page);

        viewer.setAds([
            exampleAd("ad1", "First Ad")
        ]);

        await viewer.load();

        expect(viewer.message.textContent).toBe("First Ad");
        expect(viewer.image.src).toBe("/images/ad1.png");
        expect(viewer.link.hidden).toBe(false);
    });

    test("TT-04: " + page + " shows edited ad details without a refresh", async function() {
        const viewer = setupAds(page);

        viewer.setAds([
            exampleAd("ad1", "Old Name")
        ]);
        await viewer.load();

        viewer.setAds([
            exampleAd("ad1", "New Name")
        ]);
        await viewer.load();

        expect(viewer.message.textContent).toBe("New Name");
    });

    test("TT-04: " + page + " hides an ad after it is disabled or deleted", async function() {
        const viewer = setupAds(page);

        viewer.setAds([
            exampleAd("ad1", "First Ad")
        ]);
        await viewer.load();

        // The active-ad API will return no ads after disable or delete
        viewer.setAds([]);
        await viewer.load();

        expect(viewer.link.hidden).toBe(true);
        expect(viewer.message.textContent)
            .toBe("No advertisement available");
    });

    test("TT-04: " + page + " keeps rotating when there are no changes", async function() {
        const viewer = setupAds(page);

        viewer.setAds([
            exampleAd("ad1", "First Ad"),
            exampleAd("ad2", "Second Ad")
        ]);
        await viewer.load();

        expect(viewer.timers.length).toBe(1);
        expect(viewer.timers[0].ms).toBe(120000);

        await viewer.load();
        expect(viewer.timers.length).toBe(1);

        // Run the saved rotation timer manually
        viewer.timers[0].callback();

        expect(viewer.message.textContent).toBe("Second Ad");
    });
}

test("TT-04: Both pages check for changes every 5 seconds", function() {
    const lobby = fs.readFileSync(
        path.join(__dirname, "..", "lobby.html"),
        "utf8"
    );

    const table = fs.readFileSync(
        path.join(__dirname, "..", "table.html"),
        "utf8"
    );

    expect(lobby).toContain("setInterval(loadLobbyAd, 5000)");
    expect(table).toContain("setInterval(loadTableAd, 5000)");
});
