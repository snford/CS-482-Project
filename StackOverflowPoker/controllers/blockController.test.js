// SF-10: Tests for blocking and unblocking players
jest.mock("../dao/blockDaoMongoose");
jest.mock("../dao/UsersDaoMongoose");

const blockDao = require("../dao/blockDaoMongoose");
const usersDao = require("../dao/UsersDaoMongoose");
const controller = require("./blockController");

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

// A request from a signed-in player
function asPlayer(name, extra) {
    return Object.assign({ user: { username: name }, session: {}, body: {}, params: {} }, extra);
}

// Ben and Amy have accounts; anyone else doesn't
function playersExist() {
    usersDao.readByUsername.mockImplementation(async name => (
        ["Ben", "Amy"].includes(name) ? { username: name } : null
    ));
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
});

describe("SF-10 Block A Player", function() {

    test("Block another player", async function() {
        playersExist();
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: { username: "Amy" } }), res);

        expect(blockDao.block).toHaveBeenCalledWith("Ben", "Amy");
        expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("Extra spaces around the name are ignored", async function() {
        playersExist();
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: { username: "  Amy " } }), res);

        expect(blockDao.block).toHaveBeenCalledWith("Ben", "Amy");
    });

    test("Signed-out visitors can't block anyone", async function() {
        const res = makeResponse();

        await controller.block({ body: { username: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(blockDao.block).not.toHaveBeenCalled();
    });

    test("A name is needed", async function() {
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: {} }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("You can't block yourself", async function() {
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: { username: "Ben" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(blockDao.block).not.toHaveBeenCalled();
    });

    test("Guests have no account, so they can't block", async function() {
        playersExist();
        const res = makeResponse();

        await controller.block({ session: { guestName: "Guest-1234" }, body: { username: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(blockDao.block).not.toHaveBeenCalled();
    });

    test("The player must exist", async function() {
        playersExist();
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: { username: "Ghost" } }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(blockDao.block).not.toHaveBeenCalled();
    });

    test("Database error", async function() {
        playersExist();
        blockDao.block.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.block(asPlayer("Ben", { body: { username: "Amy" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-10 Unblock A Player", function() {

    test("Unblock a player", async function() {
        const res = makeResponse();

        await controller.unblock(asPlayer("Ben", { params: { username: "Amy" } }), res);

        expect(blockDao.unblock).toHaveBeenCalledWith("Ben", "Amy");
        expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test("Signed-out visitors can't unblock anyone", async function() {
        const res = makeResponse();

        await controller.unblock({ params: { username: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(blockDao.unblock).not.toHaveBeenCalled();
    });

    test("Database error", async function() {
        blockDao.unblock.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.unblock(asPlayer("Ben", { params: { username: "Amy" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("SF-10 List Blocked Players", function() {

    test("Shows who you have blocked", async function() {
        blockDao.listBlocked.mockResolvedValue(["Amy", "Cal"]);
        const res = makeResponse();

        await controller.list(asPlayer("Ben"), res);

        expect(blockDao.listBlocked).toHaveBeenCalledWith("Ben");
        expect(res.json).toHaveBeenCalledWith(["Amy", "Cal"]);
    });

    test("Signed-out visitors have no list", async function() {
        const res = makeResponse();

        await controller.list({}, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("Database error", async function() {
        blockDao.listBlocked.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.list(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
