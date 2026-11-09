// SF-05: Database tests for friend messages
const dao = require("./messageDaoMongoose");
const dbcon = require("../DbConnection");

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

test("SF-05: Save a message", async function() {
    const message = await dao.sendMessage("Ben", "Amy", "Want to play?");

    expect(message.from).toBe("Ben");
    expect(message.to).toBe("Amy");
    expect(message.sentAt).toBeInstanceOf(Date);
});

test("SF-05: Messages cannot be longer than 500 characters", async function() {
    await expect(dao.sendMessage("Ben", "Amy", "x".repeat(501))).rejects.toThrow();
});

test("SF-05: A conversation has both players' messages, oldest first", async function() {
    await dao.sendMessage("Ben", "Amy", "first");
    await dao.sendMessage("Amy", "Ben", "second");
    await dao.sendMessage("Ben", "Cal", "not in this conversation");

    const messages = await dao.getConversation("Amy", "Ben");

    expect(messages.map(m => m.text)).toEqual(["first", "second"]);
});

test("SF-05: Delete all only works for tests", async function() {
    await dao.sendMessage("Ben", "Amy", "keep me");

    await dao.deleteAll("prod");

    expect((await dao.getConversation("Ben", "Amy")).length).toBe(1);
});
