// SF-05, SF-07, SF-08, SF-10: Tests for private messages, the inbox, new-message checks, and blocking
jest.mock("../dao/messageDaoMongoose");
jest.mock("../dao/UsersDaoMongoose");
jest.mock("../dao/blockDaoMongoose");

const messageDao = require("../dao/messageDaoMongoose");
const usersDao = require("../dao/UsersDaoMongoose");
const blockDao = require("../dao/blockDaoMongoose");
const controller = require("./messageController");

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

// A request from a signed-in player
function asPlayer(name, extra) {
    return Object.assign({ user: { username: name }, session: {}, body: {}, params: {}, query: {} }, extra);
}

// Both players exist (Ben is sending, Amy is receiving) unless a test says otherwise
function bothPlayersExist() {
    usersDao.readByUsername.mockImplementation(async name => (
        ["Ben", "Amy"].includes(name) ? { username: name, friends: [] } : null
    ));
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    blockDao.isBlocked.mockResolvedValue(false);
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
});

describe("SF-07 Send A Message", function() {

    test("Anyone can message any player, not just friends", async function() {
        bothPlayersExist();
        messageDao.sendMessage.mockResolvedValue({ from: "Ben", to: "Amy", text: "Hi" });
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Amy", text: "Hi" } }), res);

        expect(messageDao.sendMessage).toHaveBeenCalledWith("Ben", "Amy", "Hi");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ from: "Ben", to: "Amy", text: "Hi" });
    });

    test("Signed-out visitors can't send messages", async function() {
        const res = makeResponse();

        await controller.sendMessage({ body: { to: "Amy", text: "Hi" } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(messageDao.sendMessage).not.toHaveBeenCalled();
    });

    test("A message needs someone to send it to", async function() {
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Players can't message themselves", async function() {
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Ben", text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Guests have no account, so they can't send private messages", async function() {
        bothPlayersExist();
        const res = makeResponse();

        await controller.sendMessage({ session: { guestName: "Guest-1234" }, body: { to: "Amy", text: "Hi" } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(messageDao.sendMessage).not.toHaveBeenCalled();
    });

    test("The player must exist", async function() {
        bothPlayersExist();
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Ghost", text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("A signed-in name stored in the session also works", async function() {
        bothPlayersExist();
        messageDao.sendMessage.mockResolvedValue({});
        const res = makeResponse();

        await controller.sendMessage({ session: { user: { username: "Ben" } }, body: { to: "Amy", text: "Hi" } }, res);

        expect(messageDao.sendMessage).toHaveBeenCalledWith("Ben", "Amy", "Hi");
    });

    test("Database error", async function() {
        usersDao.readByUsername.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Amy", text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-10 Blocked Messages", function() {

    test("You can't message someone who blocked you", async function() {
        bothPlayersExist();
        // Amy blocked Ben
        blockDao.isBlocked.mockImplementation(async (blocker, blocked) => blocker === "Amy" && blocked === "Ben");
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Amy", text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ msg: "You can't message this user." });
        expect(messageDao.sendMessage).not.toHaveBeenCalled();
    });

    test("You can't message someone you blocked until you unblock them", async function() {
        bothPlayersExist();
        // Ben blocked Amy
        blockDao.isBlocked.mockImplementation(async (blocker, blocked) => blocker === "Ben" && blocked === "Amy");
        const res = makeResponse();

        await controller.sendMessage(asPlayer("Ben", { body: { to: "Amy", text: "Hi" } }), res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0].msg).toContain("Unblock them");
        expect(messageDao.sendMessage).not.toHaveBeenCalled();
    });
});

describe("SF-07 Read A Conversation", function() {

    test("Load the conversation with any player", async function() {
        messageDao.getConversation.mockResolvedValue([{ text: "Hi" }]);
        const res = makeResponse();

        await controller.getConversation(asPlayer("Ben", { params: { friend: "Amy" } }), res);

        expect(messageDao.getConversation).toHaveBeenCalledWith("Ben", "Amy");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{ text: "Hi" }]);
    });

    test("Signed-out visitors can't read messages", async function() {
        const res = makeResponse();

        await controller.getConversation({ params: { friend: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(messageDao.getConversation).not.toHaveBeenCalled();
    });

    test("Database error", async function() {
        messageDao.getConversation.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getConversation(asPlayer("Ben", { params: { friend: "Amy" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-08 New Message Notifications", function() {

    test("Returns messages sent to you since the last check", async function() {
        messageDao.getNewMessagesFor.mockResolvedValue([{ from: "Amy", text: "Hi" }]);
        const res = makeResponse();

        await controller.getNew(asPlayer("Ben", { query: { since: "1000" } }), res);

        expect(messageDao.getNewMessagesFor).toHaveBeenCalledWith("Ben", new Date(1000));
        const body = res.json.mock.calls[0][0];
        expect(body.messages).toEqual([{ from: "Amy", text: "Hi" }]);
        expect(typeof body.now).toBe("number");
    });

    test("The first check just returns the current time", async function() {
        const res = makeResponse();

        await controller.getNew(asPlayer("Ben", { query: {} }), res);

        expect(res.json.mock.calls[0][0].messages).toEqual([]);
        expect(messageDao.getNewMessagesFor).not.toHaveBeenCalled();
    });

    test("Signed-out visitors get no notifications", async function() {
        const res = makeResponse();

        await controller.getNew({ query: { since: "1000" } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("Database error", async function() {
        messageDao.getNewMessagesFor.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getNew(asPlayer("Ben", { query: { since: "1000" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-07 Inbox", function() {

    test("Lists each conversation with its latest message", async function() {
        const sentAt = new Date(5000);
        messageDao.getInbox.mockResolvedValue([
            { _id: "Amy", last: { from: "Amy", text: "See you at the table", sentAt: sentAt } }
        ]);
        const res = makeResponse();

        await controller.getInbox(asPlayer("Ben"), res);

        expect(messageDao.getInbox).toHaveBeenCalledWith("Ben");
        expect(res.json).toHaveBeenCalledWith([
            { user: "Amy", from: "Amy", text: "See you at the table", sentAt: sentAt }
        ]);
    });

    test("Signed-out visitors have no inbox", async function() {
        const res = makeResponse();

        await controller.getInbox({}, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("Database error", async function() {
        messageDao.getInbox.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getInbox(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
