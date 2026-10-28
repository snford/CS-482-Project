// Tests for LT-01, LT-02, and LT-03 controllers
jest.mock("../dao/TablesDaoMongoose", () => ({
    readAll: jest.fn(),
    joinTable: jest.fn(),
    createTable: jest.fn()
}));
jest.mock("../dao/TablesDaoMongoose", () => ({
    readAll: jest.fn(),
    joinTable: jest.fn(),
    createTable: jest.fn(),
    readById: jest.fn(),
    leaveTable: jest.fn()
}));
const dao = require("../dao/TablesDaoMongoose");
const controller = require("../controllers/tablesController");

const tableId = "507f1f77bcf86cd799439011";

// TT-03: the player comes from the login session, not from the request body
function asPlayer(name, body) {
    return { user: { username: name }, session: {}, body: body };
}

function asGuest(guestName, body) {
    return { user: null, session: { guestName: guestName }, body: body };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

test("LT-01: Get available tables", async function() {
    const tables = [{ name: "Table 1", status: "waiting" }];
    dao.readAll.mockResolvedValue(tables);
    const res = makeResponse();

    await controller.getTables({}, res);

    expect(dao.readAll).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(tables);
});

test("LT-01: Empty lobby", async function() {
    dao.readAll.mockResolvedValue([]);
    const res = makeResponse();

    await controller.getTables({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
});

test("LT-01: Database error", async function() {
    dao.readAll.mockRejectedValue(new Error("Database error"));
    const res = makeResponse();
    const errorLog = jest.spyOn(console, "error").mockImplementation(() => {});

    await controller.getTables({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: "Error retrieving tables" });
    errorLog.mockRestore();
});

test("LT-02: Join a table", async function() {
    const table = { _id: tableId, players: ["Dennis"] };
    dao.joinTable.mockResolvedValue(table);
    const res = makeResponse();

    await controller.joinTable(asPlayer("Dennis", { tableId }), res);

    expect(dao.joinTable).toHaveBeenCalledWith(tableId, "Dennis");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        msg: "Joined table successfully",
        table: table,
        username: "Dennis"
    });
});

test("TT-03: A guest joins with their guest name", async function() {
    dao.joinTable.mockResolvedValue({ _id: tableId, players: ["Guest-1234"] });
    const res = makeResponse();

    await controller.joinTable(asGuest("Guest-1234", { tableId }), res);

    expect(dao.joinTable).toHaveBeenCalledWith(tableId, "Guest-1234");
    expect(res.status).toHaveBeenCalledWith(200);
});

test("TT-03: Username in the body is ignored", async function() {
    dao.joinTable.mockResolvedValue({ _id: tableId, players: ["Dennis"] });
    const res = makeResponse();

    await controller.joinTable(asPlayer("Dennis", { tableId, username: "Shane" }), res);

    expect(dao.joinTable).toHaveBeenCalledWith(tableId, "Dennis");
});

test("LT-02: Invalid table ID", async function() {
    const res = makeResponse();

    await controller.joinTable(asPlayer("Dennis", { tableId: "wrong" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dao.joinTable).not.toHaveBeenCalled();
});

test("TT-03: Not signed in and not a guest", async function() {
    const res = makeResponse();

    await controller.joinTable({ session: {}, body: { tableId, username: "Dennis" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(dao.joinTable).not.toHaveBeenCalled();
});

test("LT-02: Cannot join table", async function() {
    dao.joinTable.mockResolvedValue(null);
    const res = makeResponse();

    await controller.joinTable(asPlayer("Dennis", { tableId }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ msg: "Unable to join table" });
});

test("LT-02: Database error while joining", async function() {
    dao.joinTable.mockRejectedValue(new Error("Database error"));
    const res = makeResponse();

    await controller.joinTable(asPlayer("Dennis", { tableId }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: "Error joining table" });
});

test("LT-03: Create a public table", async function() {
    const body = {
        name: "  Friday Poker  ",
        maxPlayers: "7",
        privacy: "public",
        ante: "  5 / 10 / 20 / 40  ",
        bots: "off"
    };
    const table = { name: "Friday Poker", maxPlayers: 7 };
    dao.createTable.mockResolvedValue(table);
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(dao.createTable).toHaveBeenCalledWith(
        "Friday Poker", 7, "public", "5 / 10 / 20 / 40", "off"
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
        msg: "Table created successfully",
        table: table
    });
});

test("LT-03: Create a private table", async function() {
    const body = {
        name: "Friends Table",
        maxPlayers: 4,
        privacy: "private",
        ante: "5 / 10 / 20 / 40",
        bots: "easy"
    };
    dao.createTable.mockResolvedValue(body);
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(dao.createTable).toHaveBeenCalledWith(
        "Friends Table", 4, "private", "5 / 10 / 20 / 40", "easy"
    );
    expect(res.status).toHaveBeenCalledWith(201);
});

test("LT-03: Missing table name", async function() {
    const body = { name: " ", maxPlayers: 6, privacy: "public", ante: "5/10", bots: "off" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dao.createTable).not.toHaveBeenCalled();
});

test("LT-03: Too many players", async function() {
    const body = { name: "Test", maxPlayers: 8, privacy: "public", ante: "5/10", bots: "off" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dao.createTable).not.toHaveBeenCalled();
});

test("LT-03: Invalid privacy", async function() {
    const body = { name: "Test", maxPlayers: 6, privacy: "hidden", ante: "5/10", bots: "off" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("LT-03: Missing ante", async function() {
    const body = { name: "Test", maxPlayers: 6, privacy: "public", ante: "", bots: "off" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("LT-03: Invalid bots setting", async function() {
    const body = { name: "Test", maxPlayers: 6, privacy: "public", ante: "5/10", bots: "expert" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("LT-03: Table name is too long", async function() {
    const body = { name: "a".repeat(41), maxPlayers: 6, privacy: "public", ante: "5/10", bots: "off" };
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("LT-03: Database error while creating", async function() {
    const body = { name: "Test", maxPlayers: 6, privacy: "public", ante: "5/10", bots: "off" };
    dao.createTable.mockRejectedValue(new Error("Database error"));
    const res = makeResponse();

    await controller.createTable({ body }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ msg: "Error creating table" });
});


test("LT-03: Get table information", async function() {
    const table = {
        _id: tableId,
        name: "Friends Table",
        privacy: "private",
        status: "waiting",
        players: ["Dennis"]
    };

    dao.readById.mockResolvedValue(table);
    const res = makeResponse();

    await controller.getTable({ params: { tableId } }, res);

    expect(dao.readById).toHaveBeenCalledWith(tableId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(table);
});

test("LT-03: Invalid table ID", async function() {
    const res = makeResponse();

    await controller.getTable(
        { params: { tableId: "wrong" } }, res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dao.readById).not.toHaveBeenCalled();
});

test("LT-03: Table not found", async function() {
    dao.readById.mockResolvedValue(null);
    const res = makeResponse();

    await controller.getTable({ params: { tableId } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("TT-03: Leave a table as the signed-in player", async function() {
    dao.leaveTable.mockResolvedValue({ _id: tableId, players: [] });
    const res = makeResponse();

    await controller.leaveTable(asPlayer("Dennis", { tableId, username: "Shane" }), res);

    expect(dao.leaveTable).toHaveBeenCalledWith(tableId, "Dennis");
    expect(res.status).toHaveBeenCalledWith(200);
});

test("TT-03: Leave a table when not signed in", async function() {
    const res = makeResponse();

    await controller.leaveTable({ session: {}, body: { tableId } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(dao.leaveTable).not.toHaveBeenCalled();
});

test("TT-03: Database error while leaving", async function() {
    dao.leaveTable.mockRejectedValue(new Error("Database error"));
    const res = makeResponse();

    await controller.leaveTable(asGuest("Guest-1234", { tableId }), res);

    expect(res.status).toHaveBeenCalledWith(500);
});
