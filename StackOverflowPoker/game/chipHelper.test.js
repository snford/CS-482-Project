// PG-02: Tests for taking and giving chips during a game
jest.mock("../dao/UsersDaoMongoose", () => ({
    addChips: jest.fn(),
    removeChips: jest.fn()
}));
const dao = require("../dao/UsersDaoMongoose");
const chipHelper = require("./chipHelper");

// A guest's chips live in their session
function guestRequest(chips) {
    return { session: { guestName: "Guest-1234", guestChips: chips } };
}

beforeEach(function() {
    jest.clearAllMocks();
});

describe("PG-02 Deduct Chips", function() {

    test("Amount must be a positive whole number", async function() {
        await expect(chipHelper.deductChips({}, "Ben", 0)).rejects.toThrow("positive integer");
        await expect(chipHelper.deductChips({}, "Ben", 2.5)).rejects.toThrow("positive integer");
    });

    test("Guest pays from their session", async function() {
        const req = guestRequest(100);

        const left = await chipHelper.deductChips(req, "Guest-1234", 30);

        expect(left).toBe(70);
        expect(req.session.guestChips).toBe(70);
        expect(dao.removeChips).not.toHaveBeenCalled();
    });

    test("Guest without a chip balance cannot pay", async function() {
        await expect(chipHelper.deductChips(guestRequest(undefined), "Guest-1234", 5))
            .rejects.toThrow("Guest chip balance is unavailable.");
    });

    test("Guest without enough chips cannot pay", async function() {
        await expect(chipHelper.deductChips(guestRequest(10), "Guest-1234", 50))
            .rejects.toThrow("Not enough chips.");
    });

    test("Registered player pays from the database", async function() {
        dao.removeChips.mockResolvedValue(900);

        const left = await chipHelper.deductChips({ session: {} }, "Ben", 100);

        expect(dao.removeChips).toHaveBeenCalledWith("Ben", 100);
        expect(left).toBe(900);
    });

    test("Request without a session uses the database", async function() {
        dao.removeChips.mockResolvedValue(990);

        await chipHelper.deductChips({}, "Ben", 10);

        expect(dao.removeChips).toHaveBeenCalledWith("Ben", 10);
    });
});

describe("PG-02 Add Chips", function() {

    test("Amount must be a positive whole number", async function() {
        await expect(chipHelper.addChips({}, "Ben", -5)).rejects.toThrow("positive integer");
    });

    test("Guest winnings go into their session", async function() {
        const req = guestRequest(100);

        const total = await chipHelper.addChips(req, "Guest-1234", 25);

        expect(total).toBe(125);
        expect(dao.addChips).not.toHaveBeenCalled();
    });

    test("Guest without a balance starts from zero", async function() {
        const req = guestRequest(undefined);

        const total = await chipHelper.addChips(req, "Guest-1234", 40);

        expect(total).toBe(40);
    });

    test("Registered player winnings go into the database", async function() {
        dao.addChips.mockResolvedValue(1200);

        const total = await chipHelper.addChips({ session: { guestName: "Guest-1" } }, "Ben", 200);

        expect(dao.addChips).toHaveBeenCalledWith("Ben", 200);
        expect(total).toBe(1200);
    });

    test("Request without a session uses the database", async function() {
        dao.addChips.mockResolvedValue(1010);

        await chipHelper.addChips({}, "Ben", 10);

        expect(dao.addChips).toHaveBeenCalledWith("Ben", 10);
    });
});
