// LT-02, PG-01: Tests for leaving a table and changing a table's status
const mongoose = require("mongoose");
const dao = require("./TablesDaoMongoose");
const Table = mongoose.model("table");

const tableId = "507f1f77bcf86cd799439011";

afterEach(function() {
    jest.restoreAllMocks();
});

test("Leave a table", async function() {
    const table = { players: ["Ben", "Amy"], save: jest.fn() };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    const result = await dao.leaveTable(tableId, "Ben");

    expect(result.players).toEqual(["Amy"]);
    expect(table.save).toHaveBeenCalled();
});

test("Cannot leave a table that does not exist", async function() {
    jest.spyOn(Table, "findById").mockResolvedValue(null);

    await expect(dao.leaveTable(tableId, "Ben")).rejects.toThrow("Table not found");
});

test("Cannot leave a table you are not sitting at", async function() {
    const table = { players: ["Amy"], save: jest.fn() };
    jest.spyOn(Table, "findById").mockResolvedValue(table);

    await expect(dao.leaveTable(tableId, "Ben")).rejects.toThrow("Player is not at this table");
    expect(table.save).not.toHaveBeenCalled();
});

test("Change a table's status", async function() {
    const update = jest.spyOn(Table, "findByIdAndUpdate").mockResolvedValue({ status: "playing" });

    const result = await dao.updateStatus(tableId, "playing");

    expect(update).toHaveBeenCalledWith(tableId, { status: "playing" }, { new: true, runValidators: true });
    expect(result.status).toBe("playing");
});
