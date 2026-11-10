// SF-06: Database tests for table chat messages
const dao = require("./messageDaoMongoose");
const dbcon = require("../DbConnection");

const tableA = "507f1f77bcf86cd799439011";
const tableB = "507f1f77bcf86cd799439022";

beforeAll(async function() {
    await dbcon.connect("test");
});

beforeEach(async function() {
    await dao.deleteAll("test");
});

afterAll(async function() {
    await dao.deleteAll("test");
    await dbcon.disconnect();
});

test("SF-06: Save a table message", async function() {
    const message = await dao.sendTableMessage("Ben", tableA, "Good luck!");

    expect(message.from).toBe("Ben");
    expect(String(message.tableId)).toBe(tableA);
    expect(message.to).toBeNull();
    expect(message.sentAt).toBeInstanceOf(Date);
});

test("SF-06: A table's chat has only that table's messages, oldest first", async function() {
    await dao.sendTableMessage("Ben", tableA, "first");
    await dao.sendTableMessage("Amy", tableB, "other table");
    await dao.sendTableMessage("Amy", tableA, "second");

    const messages = await dao.getTableMessages(tableA);

    expect(messages.map(m => m.text)).toEqual(["first", "second"]);
});

test("SF-06: A new table has no messages", async function() {
    expect(await dao.getTableMessages(tableA)).toEqual([]);
});

test("SF-06: Table chat is not mixed into private messages", async function() {
    await dao.sendMessage("Ben", "Amy", "private");
    await dao.sendTableMessage("Ben", tableA, "public");

    const conversation = await dao.getConversation("Ben", "Amy");
    const tableChat = await dao.getTableMessages(tableA);

    expect(conversation.map(m => m.text)).toEqual(["private"]);
    expect(tableChat.map(m => m.text)).toEqual(["public"]);
});

test("SF-06: Every message needs a sender", async function() {
    await expect(dao.sendTableMessage(null, tableA, "hi")).rejects.toThrow();
});

test("SF-06: Empty messages are rejected", async function() {
    await expect(dao.sendTableMessage("Ben", tableA, "")).rejects.toThrow();
});

test("SF-06: Messages cannot be longer than 500 characters", async function() {
    await expect(dao.sendTableMessage("Ben", tableA, "x".repeat(501))).rejects.toThrow();
});

test("SF-06: An invalid table id is rejected", async function() {
    await expect(dao.sendTableMessage("Ben", "not-a-table", "hi")).rejects.toThrow();
});

test("SF-06: At most 100 messages are loaded at once", async function() {
    const messages = [];
    for (let i = 0; i < 105; i++) {
        messages.push({ from: "Ben", tableId: tableA, text: "message " + i, sentAt: new Date(Date.now() + i) });
    }
    await require("mongoose").model("Message").insertMany(messages);

    const loaded = await dao.getTableMessages(tableA);

    expect(loaded.length).toBe(100);
});
