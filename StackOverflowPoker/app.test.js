// TT-03: Tests that run the real app (routes, sessions, page protection) over HTTP
const dbcon = require("./DbConnection");
const usersDao = require("./dao/UsersDaoMongoose");
const messageDao = require("./dao/messageDaoMongoose");
const { app } = require("./app");

let server;
let baseUrl;

// Sends a request to the running app; redirects are returned, not followed
async function request(path, options) {
    return await fetch(baseUrl + path, Object.assign({ redirect: "manual" }, options));
}

// The login cookie from a response, ready to send back
function cookieFrom(response) {
    return response.headers.get("set-cookie").split(";")[0];
}

beforeAll(async function() {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await dbcon.connect("test");
    await usersDao.deleteAll("test");
    await new Promise(function(resolve) {
        server = app.listen(0, resolve);
    });
    baseUrl = "http://localhost:" + server.address().port;
});

afterAll(async function() {
    await new Promise(resolve => server.close(resolve));
    await usersDao.deleteAll("test");
    await dbcon.disconnect();
    jest.restoreAllMocks();
});

test("Nobody is signed in at first", async function() {
    const response = await request("/api/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ loggedIn: false, guestName: null });
});

test("Play as guest starts a session that is remembered", async function() {
    const start = await request("/guest", { method: "POST" });
    const cookie = cookieFrom(start);

    const me = await request("/api/me", { headers: { cookie: cookie } });
    const body = await me.json();

    expect(start.status).toBe(302);
    expect(start.headers.get("location")).toBe("/lobby.html");
    expect(body.guestName).toMatch(/^Guest-\d{4}$/);
});

test("Logging out ends the session", async function() {
    const cookie = cookieFrom(await request("/guest", { method: "POST" }));

    await request("/logout", { method: "POST", headers: { cookie: cookie } });
    const me = await request("/api/me", { headers: { cookie: cookie } });

    expect((await me.json()).guestName).toBeNull();
});

test("Friend actions need a signed-in player", async function() {
    const response = await request("/addfriend", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "txt_to=Amy"
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/index.html");
});

test("Admin pages are blocked for everyone else", async function() {
    const response = await request("/admin.html");

    expect(response.status).toBe(401);
});

test("Regular pages are served", async function() {
    const response = await request("/index.html");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
});

test("Table invite links open the table page", async function() {
    const response = await request("/table/507f1f77bcf86cd799439011");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("<html");
});

test("Google sign-in sends the player to Google, or explains it is not set up", async function() {
    const response = await request("/auth/google");

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toContain("accounts.google.com");
    } else {
        expect(response.status).toBe(503);
    }
});

test("A forged Google callback does not sign anyone in", async function() {
    const response = await request("/auth/google/callback?code=fake&state=fake");

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        expect(response.status).toBe(302);
        expect(response.headers.get("location")).toBe("/index.html?login=failed");
    } else {
        expect(response.status).toBe(503);
    }
});

describe("SF-06 Table Chat", function() {

    const tableId = "507f1f77bcf86cd799439033";

    async function sendChat(cookie, text) {
        return await request("/messages/table/send", {
            method: "POST",
            headers: Object.assign({ "content-type": "application/json" }, cookie ? { cookie: cookie } : {}),
            body: JSON.stringify({ tableId: tableId, text: text })
        });
    }

    async function readChat() {
        return await (await request("/messages/table/" + tableId)).json();
    }

    beforeEach(async function() {
        await messageDao.deleteAll("test");
    });

    afterAll(async function() {
        await messageDao.deleteAll("test");
    });

    test("A guest's message shows up in the table chat under their name", async function() {
        const cookie = cookieFrom(await request("/guest", { method: "POST" }));
        const guestName = (await (await request("/api/me", { headers: { cookie: cookie } })).json()).guestName;

        const sent = await sendChat(cookie, "Nice hand!");
        const chat = await readChat();

        expect(sent.status).toBe(200);
        expect(chat.length).toBe(1);
        expect(chat[0].from).toBe(guestName);
        expect(chat[0].text).toBe("Nice hand!");
    });

    test("Someone who isn't signed in or a guest can't post", async function() {
        const sent = await sendChat(null, "spam");

        expect(sent.status).not.toBe(200);
        expect(await readChat()).toEqual([]);
    });
});
