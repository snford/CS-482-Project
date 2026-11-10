// SF-06: Tests for the table chat routes
jest.mock("../dao/messageDaoMongoose");
jest.mock("../dao/UsersDaoMongoose");

const messageDao = require("../dao/messageDaoMongoose");
const controller = require("./messageController");

const tableId = "507f1f77bcf86cd799439011";

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.resetAllMocks();
});

describe("SF-06 Send A Table Message", function() {

    test("A signed-in player's message is saved under their name", async function() {
        messageDao.sendTableMessage.mockResolvedValue({ from: "Ben", tableId: tableId, text: "Good luck!" });
        const res = makeResponse();

        await controller.sendTableChat({ user: { username: "Ben" }, session: {}, body: { tableId: tableId, text: "Good luck!" } }, res);

        expect(messageDao.sendTableMessage).toHaveBeenCalledWith("Ben", tableId, "Good luck!");
        expect(res.json).toHaveBeenCalledWith({ from: "Ben", tableId: tableId, text: "Good luck!" });
    });

    test("Guests can chat using their guest name", async function() {
        messageDao.sendTableMessage.mockResolvedValue({ from: "Guest-1234" });
        const res = makeResponse();

        await controller.sendTableChat({ session: { guestName: "Guest-1234" }, body: { tableId: tableId, text: "hi" } }, res);

        expect(messageDao.sendTableMessage).toHaveBeenCalledWith("Guest-1234", tableId, "hi");
    });

    test("The name comes from the login, not the message", async function() {
        messageDao.sendTableMessage.mockResolvedValue({});
        const res = makeResponse();

        await controller.sendTableChat({ user: { username: "Ben" }, session: {}, body: { tableId: tableId, text: "hi", from: "Admin" } }, res);

        expect(messageDao.sendTableMessage).toHaveBeenCalledWith("Ben", tableId, "hi");
    });

    test("A message that can't be saved returns an error", async function() {
        messageDao.sendTableMessage.mockRejectedValue(new Error("Message validation failed"));
        const res = makeResponse();

        await controller.sendTableChat({ user: { username: "Ben" }, session: {}, body: { tableId: tableId, text: "" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ msg: "Message validation failed" });
    });

    test("Someone not signed in sends no name", async function() {
        messageDao.sendTableMessage.mockResolvedValue({});
        const res = makeResponse();

        await controller.sendTableChat({ body: { tableId: tableId, text: "hi" } }, res);

        // The database then refuses it, because every message needs a sender
        expect(messageDao.sendTableMessage).toHaveBeenCalledWith(null, tableId, "hi");
    });
});

describe("SF-06 Read The Table Chat", function() {

    test("Returns the table's messages", async function() {
        const messages = [{ from: "Ben", text: "hi" }, { from: "Amy", text: "hey" }];
        messageDao.getTableMessages.mockResolvedValue(messages);
        const res = makeResponse();

        await controller.getTableChat({ params: { tableId: tableId } }, res);

        expect(messageDao.getTableMessages).toHaveBeenCalledWith(tableId);
        expect(res.json).toHaveBeenCalledWith(messages);
    });

    test("A table with no messages returns an empty list", async function() {
        messageDao.getTableMessages.mockResolvedValue([]);
        const res = makeResponse();

        await controller.getTableChat({ params: { tableId: tableId } }, res);

        expect(res.json).toHaveBeenCalledWith([]);
    });

    test("Database errors are passed on to the server", async function() {
        messageDao.getTableMessages.mockRejectedValue(new Error("Database error"));

        await expect(controller.getTableChat({ params: { tableId: tableId } }, makeResponse()))
            .rejects.toThrow("Database error");
    });
});
