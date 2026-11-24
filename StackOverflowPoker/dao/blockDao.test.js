// SF-10: Database tests for blocking players
const mongoose = require("mongoose");
const dao = require("./blockDaoMongoose");
const dbcon = require("../DbConnection");

const Block = mongoose.model("Block");

beforeAll(async function() {
    await dbcon.connect("test");
    await Block.syncIndexes();
});

beforeEach(async function() {
    await Block.deleteMany({});
});

afterAll(async function() {
    await Block.deleteMany({});
    await dbcon.disconnect();
});

test("SF-10: Block a player", async function() {
    await dao.block("Ben", "Amy");

    expect(await dao.isBlocked("Ben", "Amy")).toBe(true);
});

test("SF-10: Blocking only works one way", async function() {
    await dao.block("Ben", "Amy");

    // Amy didn't block Ben
    expect(await dao.isBlocked("Amy", "Ben")).toBe(false);
});

test("SF-10: Blocking the same player twice keeps one block", async function() {
    await dao.block("Ben", "Amy");
    await dao.block("Ben", "Amy");

    expect(await Block.countDocuments({ blocker: "Ben", blocked: "Amy" })).toBe(1);
});

test("SF-10: Unblock a player", async function() {
    await dao.block("Ben", "Amy");

    await dao.unblock("Ben", "Amy");

    expect(await dao.isBlocked("Ben", "Amy")).toBe(false);
});

test("SF-10: Unblocking someone who wasn't blocked does nothing", async function() {
    await expect(dao.unblock("Ben", "Ghost")).resolves.toBeUndefined();
});

test("SF-10: List the players you blocked, newest first", async function() {
    await Block.create({ blocker: "Ben", blocked: "Amy", createdAt: new Date(1000) });
    await Block.create({ blocker: "Ben", blocked: "Cal", createdAt: new Date(2000) });
    await Block.create({ blocker: "Dee", blocked: "Ben", createdAt: new Date(3000) });

    expect(await dao.listBlocked("Ben")).toEqual(["Cal", "Amy"]);
});

test("SF-10: Nobody blocked means an empty list", async function() {
    expect(await dao.listBlocked("Ben")).toEqual([]);
});
