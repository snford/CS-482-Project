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

test("SF-08: New messages are only the ones sent to you after the last check", async function() {
    // The last check was a second ago; "too old" was sent a minute before that
    const since = new Date(Date.now() - 1000);
    await dao.sendMessage("Amy", "Ben", "too old");
    await require("mongoose").model("Message").updateOne({ text: "too old" }, { sentAt: new Date(since.getTime() - 60000) });
    await dao.sendMessage("Amy", "Ben", "new one");
    await dao.sendMessage("Ben", "Amy", "sent by Ben");

    const messages = await dao.getNewMessagesFor("Ben", since);

    expect(messages.map(m => m.text)).toEqual(["new one"]);
});

test("SF-07: The inbox shows each conversation once, with its latest message, newest first", async function() {
    await dao.sendMessage("Amy", "Ben", "first from Amy");
    await dao.sendMessage("Cal", "Ben", "hi from Cal");
    await dao.sendMessage("Ben", "Amy", "latest with Amy");
    await dao.sendTableMessage("Dee", "507f1f77bcf86cd799439011", "table chat is not in the inbox");
    await dao.sendMessage("Dee", "Eve", "not Ben's conversation");

    const inbox = await dao.getInbox("Ben");

    expect(inbox.map(row => row._id)).toEqual(["Amy", "Cal"]);
    expect(inbox[0].last.text).toBe("latest with Amy");
    expect(inbox[1].last.text).toBe("hi from Cal");
});

test("SF-07: An empty inbox", async function() {
    expect(await dao.getInbox("Ben")).toEqual([]);
});
