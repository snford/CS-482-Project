// SF-09: Database tests for last seen times and finding friends' tables
const mongoose = require("mongoose");
const usersDao = require("./UsersDaoMongoose");
const tablesDao = require("./TablesDaoMongoose");
const dbcon = require("../DbConnection");

const Table = mongoose.model("table");

beforeAll(async function() {
    await dbcon.connect("test");
    await usersDao.syncIndexes();
});

beforeEach(async function() {
    await usersDao.deleteAll("test");
    await Table.deleteMany({});
});

afterAll(async function() {
    await usersDao.deleteAll("test");
    await Table.deleteMany({});
    await dbcon.disconnect();
});

describe("SF-09 Last Seen", function() {

    test("Marking a player as seen saves the current time", async function() {
        const ben = await usersDao.create({ username: "Ben" });
        const before = Date.now();

        await usersDao.markSeen(ben._id);
        const saved = await usersDao.readByUsername("Ben");

        expect(saved.lastSeenAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    test("New players have never been seen", async function() {
        const ben = await usersDao.create({ username: "Ben" });

        expect(ben.lastSeenAt).toBeUndefined();
    });

    test("Read last seen times for a list of players", async function() {
        const amy = await usersDao.create({ username: "Amy", email: "amy@example.com" });
        await usersDao.create({ username: "Cal" });
        await usersDao.create({ username: "NotAFriend" });
        await usersDao.markSeen(amy._id);

        const seen = await usersDao.readLastSeen(["Amy", "Cal", "Ghost"]);
        const byName = Object.fromEntries(seen.map(u => [u.username, u]));

        expect(Object.keys(byName).sort()).toEqual(["Amy", "Cal"]);
        expect(byName.Amy.lastSeenAt).toBeInstanceOf(Date);
        expect(byName.Cal.lastSeenAt).toBeUndefined();
        // Only the name and time are loaded, nothing private
        expect(byName.Amy.email).toBeUndefined();
    });
});

describe("SF-09 Friends' Tables", function() {

    test("Find open tables where friends are seated, public or private", async function() {
        await Table.create({ name: "Public", players: ["Amy"] });
        await Table.create({ name: "Private", players: ["Cal"], privacy: "private", status: "playing" });
        await Table.create({ name: "Strangers", players: ["Zed"] });

        const tables = await tablesDao.readTablesWithPlayers(["Amy", "Cal"]);

        expect(tables.map(t => t.name).sort()).toEqual(["Private", "Public"]);
    });

    test("Closed tables are not included", async function() {
        await Table.create({ name: "Old", players: ["Amy"], status: "closed" });

        expect(await tablesDao.readTablesWithPlayers(["Amy"])).toEqual([]);
    });
});
