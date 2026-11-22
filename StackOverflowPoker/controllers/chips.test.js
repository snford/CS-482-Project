// PG-02, ST-01, UP-01, UP-02: Tests for chip balances and the profile error cases
jest.mock("../dao/UsersDaoMongoose");

const dao = require("../dao/UsersDaoMongoose");
const controller = require("./usersController");
const chipHelper = require("../game/chipHelper");

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

// A signed-in Google player
function player(extra) {
    return Object.assign({ _id: "user1", googleId: "g-1", username: "Ben" }, extra);
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
});

describe("PG-02 Set Chips", function() {

    test("Set a player's chips", async function() {
        dao.setChips.mockResolvedValue(500);
        const res = makeResponse();

        await controller.setChips({ params: { username: "Ben" }, body: { amount: 500 } }, res);

        expect(dao.setChips).toHaveBeenCalledWith("Ben", 500);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Negative or non-whole amounts are rejected", async function() {
        const res = makeResponse();

        await controller.setChips({ params: { username: "Ben" }, body: { amount: -1 } }, res);
        await controller.setChips({ params: { username: "Ben" }, body: { amount: "50" } }, res);

        expect(res.status).toHaveBeenNthCalledWith(1, 400);
        expect(res.status).toHaveBeenNthCalledWith(2, 400);
        expect(dao.setChips).not.toHaveBeenCalled();
    });

    test("Database error", async function() {
        dao.setChips.mockRejectedValue(new Error("User not found"));
        const res = makeResponse();

        await controller.setChips({ params: { username: "Ghost" }, body: { amount: 5 } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PG-02 Get Chips", function() {

    test("A guest's chips come from the server-side guest balance", async function() {
        chipHelper.startGuest("Guest-1234");
        await chipHelper.deductChips({}, "Guest-1234", 250);
        const res = makeResponse();

        // Anyone at the table can see the guest's chips, not just the guest
        await controller.getChips({ params: { username: "Guest-1234" }, session: {} }, res);

        expect(res.json).toHaveBeenCalledWith({ chips: 750 });
        expect(dao.getChips).not.toHaveBeenCalled();
    });

    test("A registered player's chips come from the database", async function() {
        dao.getChips.mockResolvedValue(1200);
        const res = makeResponse();

        await controller.getChips({ params: { username: "Ben" }, session: {} }, res);

        expect(dao.getChips).toHaveBeenCalledWith("Ben");
        expect(res.json).toHaveBeenCalledWith({ chips: 1200 });
    });

    test("Database error", async function() {
        dao.getChips.mockRejectedValue(new Error("User not found."));
        const res = makeResponse();

        await controller.getChips({ params: { username: "Ghost" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// TT-05: only admins can add or remove chips, and they change the player in the URL
function adminChanging(username, amount) {
    return { user: { username: "Shane", role: "admin" }, params: { username: username }, body: { amount: amount } };
}

describe("PG-02 Add Chips", function() {

    test("Admin adds chips to the player in the URL", async function() {
        dao.addChips.mockResolvedValue(1100);
        const res = makeResponse();

        await controller.addChips(adminChanging("Ben", 100), res);

        // Ben's chips change, not the admin's
        expect(dao.addChips).toHaveBeenCalledWith("Ben", 100);
        expect(res.json).toHaveBeenCalledWith({ msg: "Chips added successfully", chips: 1100 });
    });

    test("Amount must be positive", async function() {
        const res = makeResponse();

        await controller.addChips(adminChanging("Ben", 0), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Missing player", async function() {
        dao.addChips.mockRejectedValue(new Error("User not found"));
        const res = makeResponse();

        await controller.addChips(adminChanging("Ghost", 10), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Other database error", async function() {
        dao.addChips.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.addChips(adminChanging("Ben", 10), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PG-02 Remove Chips", function() {

    test("Admin removes chips from the player in the URL", async function() {
        dao.removeChips.mockResolvedValue(900);
        const res = makeResponse();

        await controller.removeChips(adminChanging("Ben", 100), res);

        expect(dao.removeChips).toHaveBeenCalledWith("Ben", 100);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Amount must be positive", async function() {
        const res = makeResponse();

        await controller.removeChips(adminChanging("Ben", -3), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Not enough chips", async function() {
        dao.removeChips.mockRejectedValue(new Error("User not found or insufficient chips"));
        const res = makeResponse();

        await controller.removeChips(adminChanging("Ben", 5000), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ msg: "User not found or insufficient chips" });
    });

    test("Other database error", async function() {
        dao.removeChips.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.removeChips(adminChanging("Ben", 5), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("ST-01 Statistics Errors", function() {

    test("Database error while loading statistics", async function() {
        dao.readByUsername.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getPlayerStats({ params: { username: "Ben" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("UP-01 Profile Edge Cases", function() {

    test("Player with games played sees their win percentage", async function() {
        const res = makeResponse();

        await controller.getMyProfile({ user: player({ wins: 1, losses: 2 }) }, res);

        expect(res.json.mock.calls[0][0].winPercentage).toBe(33.33);
    });

    test("Error while building the profile", async function() {
        const brokenUser = player();
        Object.defineProperty(brokenUser, "wins", { get() { throw new Error("broken"); } });
        const res = makeResponse();

        await controller.getMyProfile({ user: brokenUser }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test("Invalid new username is rejected", async function() {
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { username: "x", avatar: "spade" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(dao.updateProfile).not.toHaveBeenCalled();
    });

    test("Missing username is rejected", async function() {
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { avatar: "spade" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Keeping your own username is allowed", async function() {
        dao.readByUsernameIgnoreCase.mockResolvedValue(player());
        dao.updateProfile.mockResolvedValue({ username: "Ben", avatar: "star" });
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { username: "Ben", avatar: "star" } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Account deleted while saving", async function() {
        dao.readByUsernameIgnoreCase.mockResolvedValue(null);
        dao.updateProfile.mockResolvedValue(null);
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { username: "NewName", avatar: "club" } }, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Two players saving the same name at once", async function() {
        dao.readByUsernameIgnoreCase.mockResolvedValue(null);
        const duplicate = new Error("duplicate key");
        duplicate.code = 11000;
        dao.updateProfile.mockRejectedValue(duplicate);
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { username: "NewName", avatar: "club" } }, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test("Other database error while saving", async function() {
        dao.readByUsernameIgnoreCase.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.updateMyProfile({ user: player(), body: { username: "NewName", avatar: "club" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("UP-02 Public Profile Errors", function() {

    test("Database error while loading another player", async function() {
        dao.readByUsernameIgnoreCase.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.getPublicProfile({ params: { username: "Amy" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
