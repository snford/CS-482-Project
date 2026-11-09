// ST-01, PG-02, UP-01, AM-04, AM-05: Database tests for stats, chips, profiles, and admin tools
const mongoose = require("mongoose");
const dao = require("./UsersDaoMongoose");
const dbcon = require("../DbConnection");

const User = mongoose.model("user");

// A player who signed in with Google and picked a poker name
async function googlePlayer(username, extra) {
    return await dao.create(Object.assign({ username: username, googleId: "g-" + username }, extra));
}

beforeAll(async function() {
    await dbcon.connect("test");
    await dao.syncIndexes();
});

beforeEach(async function() {
    await dao.deleteAll("test");
});

afterEach(function() {
    jest.restoreAllMocks();
});

afterAll(async function() {
    await dao.deleteAll("test");
    await dbcon.disconnect();
});

describe("ST-01 Record Game Results", function() {

    test("A win and a loss are counted", async function() {
        await googlePlayer("Ben");

        await dao.recordGameResult("Ben", "win");
        const updated = await dao.recordGameResult("Ben", "loss");

        expect(updated.wins).toBe(1);
        expect(updated.losses).toBe(1);
    });

    test("Only win or loss is allowed", async function() {
        await expect(dao.recordGameResult("Ben", "draw")).rejects.toThrow("Invalid result");
    });
});

describe("PG-02 Chips", function() {

    test("New players start with 1000 chips", async function() {
        await googlePlayer("Ben");

        expect(await dao.getChips("Ben")).toBe(1000);
    });

    test("Reading chips for a missing player", async function() {
        jest.spyOn(console, "log").mockImplementation(() => {});

        await expect(dao.getChips("Ghost")).rejects.toThrow("User not found.");
    });

    test("Set chips", async function() {
        await googlePlayer("Ben");

        const updated = await dao.setChips("Ben", 250);

        expect(updated.chips).toBe(250);
    });

    test("Chips cannot be set below zero", async function() {
        await expect(dao.setChips("Ben", -1)).rejects.toThrow("negative");
    });

    test("Setting chips for a missing player", async function() {
        await expect(dao.setChips("Ghost", 10)).rejects.toThrow("User not found");
    });

    test("Add chips", async function() {
        await googlePlayer("Ben");

        expect(await dao.addChips("Ben", 50)).toBe(1050);
    });

    test("Added amount must be a positive whole number", async function() {
        await expect(dao.addChips("Ben", 0)).rejects.toThrow("positive integer");
    });

    test("Adding chips for a missing player", async function() {
        await expect(dao.addChips("Ghost", 5)).rejects.toThrow("User not found");
    });

    test("Remove chips", async function() {
        await googlePlayer("Ben");

        expect(await dao.removeChips("Ben", 300)).toBe(700);
    });

    test("Removed amount must be a positive whole number", async function() {
        await expect(dao.removeChips("Ben", 1.5)).rejects.toThrow("positive integer");
    });

    test("Cannot remove more chips than the player has", async function() {
        await googlePlayer("Ben");

        await expect(dao.removeChips("Ben", 5000)).rejects.toThrow("insufficient chips");
        expect(await dao.getChips("Ben")).toBe(1000);
    });

    test("Removing chips from a missing player", async function() {
        await expect(dao.removeChips("Ghost", 5)).rejects.toThrow(/^User not found$/);
    });
});

describe("UP-01 Update Profile", function() {

    test("Change username and avatar", async function() {
        const ben = await googlePlayer("Ben");

        const updated = await dao.updateProfile(ben._id, "BigBen", "star");

        expect(updated.username).toBe("BigBen");
        expect(updated.avatar).toBe("star");
    });

    test("Unknown avatars are rejected", async function() {
        const ben = await googlePlayer("Ben");

        await expect(dao.updateProfile(ben._id, "Ben", "dragon")).rejects.toThrow();
    });
});

describe("AM-05 Admin Dashboard Data", function() {

    test("Count registered players and admins", async function() {
        await googlePlayer("Ben");
        await googlePlayer("Shane", { role: "admin" });
        // Not counted: still choosing a name, and an old account without Google
        await dao.create({ googleId: "g-new", needsUsername: true });
        await dao.create({ username: "OldAccount" });

        expect(await dao.countRegisteredUsers()).toBe(2);
        expect(await dao.countAdmins()).toBe(1);
    });

    test("List registered players by name", async function() {
        await googlePlayer("Zed");
        await googlePlayer("Amy", { email: "amy@example.com" });
        await dao.create({ googleId: "g-new", needsUsername: true });

        const users = await dao.getAllRegisteredUsers();

        expect(users.map(u => u.username)).toEqual(["Amy", "Zed"]);
        // Private fields are not loaded
        expect(users[0].email).toBeUndefined();
    });

    test("Promote a Google account to admin", async function() {
        await googlePlayer("Shane");

        const admin = await dao.promoteAdminByGoogleId("g-Shane");

        expect(admin.role).toBe("admin");
    });

    test("Accounts still choosing a name cannot be promoted", async function() {
        await dao.create({ googleId: "g-new", needsUsername: true });

        expect(await dao.promoteAdminByGoogleId("g-new")).toBeNull();
    });
});

describe("AM-04 Delete A Registered User", function() {

    test("Deleting a player also removes them from friend lists", async function() {
        await googlePlayer("Ben", { friends: ["Amy"] });
        await googlePlayer("Amy", { friends: ["Ben"], friendRequests: ["Cal"] });
        await googlePlayer("Cal", { friendRequests: ["Ben"] });

        const result = await dao.deleteRegisteredUser("Ben");

        expect(result).toEqual({ status: "deleted" });
        expect(await dao.readByUsername("Ben")).toBeNull();
        expect((await dao.readByUsername("Amy")).friends).toEqual([]);
        expect((await dao.readByUsername("Cal")).friendRequests).toEqual([]);
    });

    test("Missing player", async function() {
        expect(await dao.deleteRegisteredUser("Ghost")).toEqual({ status: "not_found" });
    });

    test("Admins cannot be deleted", async function() {
        await googlePlayer("Shane", { role: "admin" });

        expect(await dao.deleteRegisteredUser("Shane")).toEqual({ status: "admin_protected" });
        expect(await dao.readByUsername("Shane")).not.toBeNull();
    });

    test("Player deleted by someone else at the same moment", async function() {
        await googlePlayer("Ben");
        jest.spyOn(User, "deleteOne").mockResolvedValueOnce({ deletedCount: 0 });

        expect(await dao.deleteRegisteredUser("Ben")).toEqual({ status: "not_found" });
    });
});

describe("TT-03 Index Updates", function() {

    test("A failed index update is logged, not thrown", async function() {
        jest.spyOn(User, "syncIndexes").mockRejectedValueOnce(new Error("no permission"));
        const log = jest.spyOn(console, "log").mockImplementation(() => {});

        await dao.syncIndexes();

        expect(log).toHaveBeenCalledWith("Could not update user indexes: no permission");
    });
});
