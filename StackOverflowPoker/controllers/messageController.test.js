// SF-05: Tests for messaging a friend
jest.mock("../dao/messageDaoMongoose");
jest.mock("../dao/UsersDaoMongoose");

const messageDao = require("../dao/messageDaoMongoose");
const usersDao = require("../dao/UsersDaoMongoose");
const controller = require("./messageController");

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
});

describe("SF-05 Send A Message", function() {

    test("Send a message to a friend", async function() {
        usersDao.readByUsername.mockResolvedValue({ username: "Ben", friends: ["Amy"] });
        messageDao.sendMessage.mockResolvedValue({ from: "Ben", to: "Amy", text: "Hi" });
        const res = makeResponse();

        await controller.sendMessage({ user: { username: "Ben" }, body: { to: "Amy", text: "Hi" } }, res);

        expect(messageDao.sendMessage).toHaveBeenCalledWith("Ben", "Amy", "Hi");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ from: "Ben", to: "Amy", text: "Hi" });
    });

    test("Cannot message someone who is not a friend", async function() {
        usersDao.readByUsername.mockResolvedValue({ username: "Ben", friends: [] });
        const res = makeResponse();

        await controller.sendMessage({ user: { username: "Ben" }, body: { to: "Amy", text: "Hi" } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(messageDao.sendMessage).not.toHaveBeenCalled();
    });

    test("Signed-out request fails safely", async function() {
        usersDao.readByUsername.mockResolvedValue(null);
        const res = makeResponse();

        await controller.sendMessage({ body: { to: "Amy", text: "Hi" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-05 Read A Conversation", function() {

    test("Load the conversation with a friend", async function() {
        usersDao.readByUsername.mockResolvedValue({ username: "Ben", friends: ["Amy"] });
        messageDao.getConversation.mockResolvedValue([{ text: "Hi" }]);
        const res = makeResponse();

        await controller.getConversation({ user: { username: "Ben" }, params: { friend: "Amy" } }, res);

        expect(messageDao.getConversation).toHaveBeenCalledWith("Ben", "Amy");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{ text: "Hi" }]);
    });

    test("Cannot read messages with someone who is not a friend", async function() {
        usersDao.readByUsername.mockResolvedValue({ username: "Ben", friends: [] });
        const res = makeResponse();

        await controller.getConversation({ user: { username: "Ben" }, params: { friend: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("Database error", async function() {
        usersDao.readByUsername.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getConversation({ user: { username: "Ben" }, params: { friend: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
