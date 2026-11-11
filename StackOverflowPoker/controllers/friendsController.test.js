// SF-09: Tests for seeing which friends are online or at a table
jest.mock("../dao/UsersDaoMongoose");
jest.mock("../dao/TablesDaoMongoose");

const usersDao = require("../dao/UsersDaoMongoose");
const tablesDao = require("../dao/TablesDaoMongoose");
const controller = require("./friendsController");

const MINUTE = 60 * 1000;

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

// Ben is signed in with these friends
function benWith(friends) {
    return { user: { username: "Ben", friends: friends } };
}

function seenMinutesAgo(username, minutes) {
    return { username: username, lastSeenAt: new Date(Date.now() - minutes * MINUTE) };
}

function table(changes) {
    return Object.assign({
        _id: "507f1f77bcf86cd799439011",
        name: "Friday Stud",
        status: "waiting",
        privacy: "public",
        players: ["Amy"],
        maxPlayers: 4
    }, changes);
}

// Runs the route and returns the status list it sent
async function statusFor(req) {
    const res = makeResponse();
    await controller.getFriendStatus(req, res);
    return res.json.mock.calls[0][0];
}

beforeEach(function() {
    jest.resetAllMocks();
    usersDao.readLastSeen.mockResolvedValue([]);
    tablesDao.readTablesWithPlayers.mockResolvedValue([]);
});

describe("SF-09 Online Status", function() {

    test("No friends means an empty list, without asking the database", async function() {
        const res = makeResponse();

        await controller.getFriendStatus(benWith([]), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([]);
        expect(usersDao.readLastSeen).not.toHaveBeenCalled();
    });

    test("An account with no friends list at all also gets an empty list", async function() {
        const res = makeResponse();

        await controller.getFriendStatus({ user: { username: "Ben" } }, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    test("A friend seen in the last few minutes is online", async function() {
        usersDao.readLastSeen.mockResolvedValue([seenMinutesAgo("Amy", 1)]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status).toEqual([{ username: "Amy", online: true, table: null }]);
    });

    test("A friend not seen for a while is offline", async function() {
        usersDao.readLastSeen.mockResolvedValue([seenMinutesAgo("Amy", 10)]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status[0].online).toBe(false);
    });

    test("A friend who has never been seen is offline", async function() {
        usersDao.readLastSeen.mockResolvedValue([{ username: "Amy" }]);

        const status = await statusFor(benWith(["Amy", "Cal"]));

        // Cal isn't in the database at all (for example a deleted account)
        expect(status.map(f => f.online)).toEqual([false, false]);
    });

    test("Friends are listed in the same order as the friends list", async function() {
        usersDao.readLastSeen.mockResolvedValue([seenMinutesAgo("Cal", 1), seenMinutesAgo("Amy", 1)]);

        const status = await statusFor(benWith(["Amy", "Cal"]));

        expect(status.map(f => f.username)).toEqual(["Amy", "Cal"]);
    });
});

describe("SF-09 Friends At Tables", function() {

    test("A friend at a waiting table with an open seat can be joined", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([table()]);

        const status = await statusFor(benWith(["Amy"]));

        expect(tablesDao.readTablesWithPlayers).toHaveBeenCalledWith(["Amy"]);
        expect(status[0].table).toEqual({
            id: "507f1f77bcf86cd799439011",
            name: "Friday Stud",
            status: "waiting",
            privacy: "public",
            players: 1,
            maxPlayers: 4,
            canJoin: true
        });
    });

    test("Friends can join each other's private tables", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([table({ privacy: "private" })]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status[0].table.canJoin).toBe(true);
    });

    test("A game already playing can be viewed but not joined", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([table({ status: "playing" })]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status[0].table.canJoin).toBe(false);
    });

    test("A full table can't be joined", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([table({ players: ["Amy", "Cal"], maxPlayers: 2 })]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status[0].table.canJoin).toBe(false);
    });

    test("You can't join a table you're already sitting at", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([table({ players: ["Amy", "Ben"] })]);

        const status = await statusFor(benWith(["Amy"]));

        expect(status[0].table.canJoin).toBe(false);
    });

    test("Each friend gets their own table", async function() {
        tablesDao.readTablesWithPlayers.mockResolvedValue([
            table({ _id: "a1", name: "Amy's Table", players: ["Amy"] }),
            table({ _id: "c1", name: "Cal's Table", players: ["Cal"] })
        ]);

        const status = await statusFor(benWith(["Amy", "Cal", "Dee"]));

        expect(status.map(f => f.table && f.table.name)).toEqual(["Amy's Table", "Cal's Table", null]);
    });

    test("Database error", async function() {
        const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
        usersDao.readLastSeen.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getFriendStatus(benWith(["Amy"]), res);

        expect(res.status).toHaveBeenCalledWith(500);
        errorLog.mockRestore();
    });
});
