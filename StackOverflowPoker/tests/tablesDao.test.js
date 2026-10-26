// Tests for LT-01, LT-02, and LT-03 database functions
const mongoose = require("mongoose");
const dao = require("../dao/TablesDaoMongoose");
const Table = mongoose.model("table");

const tableId = "507f1f77bcf86cd799439011";

afterEach(function() {
    jest.restoreAllMocks();
});

test("LT-01: Find public tables in the lobby", async function() {
    const tables = [{ name: "Table 1", privacy: "public" }];
    const sort = jest.fn().mockResolvedValue(tables);
    const find = jest.spyOn(Table, "find").mockReturnValue({ sort: sort });

    const result = await dao.readAll();

    expect(find).toHaveBeenCalledWith({
        status: { $in: ["waiting", "playing"] },
        privacy: { $ne: "private" }
    });
    expect(sort).toHaveBeenCalledWith({ name: 1 });
    expect(result).toEqual(tables);
});

test("LT-01: No public tables found", async function() {
    const sort = jest.fn().mockResolvedValue([]);
    jest.spyOn(Table, "find").mockReturnValue({ sort: sort });

    const result = await dao.readAll();

    expect(result).toEqual([]);
});

test("LT-02: Table does not exist", async function() {
    jest.spyOn(Table, "findById").mockResolvedValue(null);

    const result = await dao.joinTable(tableId, "Dennis");

    expect(result).toBeNull();
});

test("LT-02: Cannot join a game already playing", async function() {
    const table = {
        status: "playing", players: [], maxPlayers: 6,
        save: jest.fn()
    };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.joinTable(tableId, "Dennis");

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
});

test("LT-02: Cannot join a full table", async function() {
    const table = {
        status: "waiting", players: ["Amy", "Ben"], maxPlayers: 2,
        save: jest.fn()
    };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.joinTable(tableId, "Dennis");

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
});

test("LT-02: Cannot join the same table twice", async function() {
    const table = {
        status: "waiting", players: ["Dennis"], maxPlayers: 6,
        save: jest.fn()
    };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.joinTable(tableId, "Dennis");

    expect(result).toBeNull();
    expect(table.save).not.toHaveBeenCalled();
});

test("LT-02: Successfully join a waiting table", async function() {
    const table = {
        status: "waiting", players: ["Amy"], maxPlayers: 6,
        save: jest.fn().mockResolvedValue()
    };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.joinTable(tableId, "Dennis");

    expect(table.players).toEqual(["Amy", "Dennis"]);
    expect(table.save).toHaveBeenCalled();
    expect(result).toBe(table);
});

test("LT-03: Save a new table", async function() {
    const save = jest.spyOn(Table.prototype, "save").mockResolvedValue();

    const table = await dao.createTable(
        "Friday Poker", 7, "private", "5 / 10 / 20 / 40", "easy"
    );

    expect(save).toHaveBeenCalled();
    expect(table.name).toBe("Friday Poker");
    expect(table.maxPlayers).toBe(7);
    expect(table.privacy).toBe("private");
    expect(table.ante).toBe("5 / 10 / 20 / 40");
    expect(table.bots).toBe("easy");
    expect(table.status).toBe("waiting");
    expect(table.players).toEqual([]);
});

test("LT-03: New table uses default settings", async function() {
    const table = new Table({ name: "Test Table" });

    expect(table.maxPlayers).toBe(6);
    expect(table.privacy).toBe("public");
    expect(table.bots).toBe("off");
    expect(table.status).toBe("waiting");
});

test("LT-03: Database error while saving", async function() {
    jest.spyOn(Table.prototype, "save").mockRejectedValue(new Error("Save failed"));

    await expect(dao.createTable(
        "Friday Poker", 6, "public", "5/10", "off"
    )).rejects.toThrow("Save failed");
});

test("LT-03: Load a private table by ID", async function() {
    const table = {
        name: "Friends Table",
        privacy: "private",
        status: "waiting",
        players: ["Dennis"]
    };

    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.readById(tableId);

    expect(result).toBe(table);
});

test("LT-03: Do not load a closed table", async function() {
    const table = {
        name: "Old Table",
        status: "closed"
    };

    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.readById(tableId);

    expect(result).toBeNull();
});
