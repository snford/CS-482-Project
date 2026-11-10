// PG-02: Tests for taking and giving chips during a game
jest.mock("../dao/UsersDaoMongoose", () => ({
    addChips: jest.fn(),
    removeChips: jest.fn()
}));
const dao = require("../dao/UsersDaoMongoose");
const chipHelper = require("./chipHelper");

// Any request works: chips are found by the player's name
const anyRequest = { session: {} };

beforeEach(function() {
    jest.clearAllMocks();
    chipHelper.startGuest("Guest-1234");
});

describe("Guest names", function() {

    test("Guest-1234 is a guest", function() {
        expect(chipHelper.isGuestName("Guest-1234")).toBe(true);
    });

    test("Registered names are not guests", function() {
        expect(chipHelper.isGuestName("Ben")).toBe(false);
        expect(chipHelper.isGuestName("Guest-")).toBe(false);
        expect(chipHelper.isGuestName(undefined)).toBe(false);
    });

    test("A new guest starts with 1000 chips", function() {
        expect(chipHelper.getGuestChips("Guest-1234")).toBe(1000);
    });

    test("A guest the server hasn't seen (after a restart) also gets 1000", function() {
        expect(chipHelper.getGuestChips("Guest-9" + Date.now())).toBe(chipHelper.STARTING_GUEST_CHIPS);
    });
});

describe("PG-02 Deduct Chips", function() {

    test("Amount must be a positive whole number", async function() {
        await expect(chipHelper.deductChips(anyRequest, "Ben", 0)).rejects.toThrow("positive integer");
        await expect(chipHelper.deductChips(anyRequest, "Ben", 2.5)).rejects.toThrow("positive integer");
    });

    test("Guest pays from their server-side balance", async function() {
        const left = await chipHelper.deductChips(anyRequest, "Guest-1234", 30);

        expect(left).toBe(970);
        expect(chipHelper.getGuestChips("Guest-1234")).toBe(970);
        expect(dao.removeChips).not.toHaveBeenCalled();
    });

    test("Another player's request can charge a guest", async function() {
        // Ben starts the round, so it is Ben's request that charges the guest's ante
        const bensRequest = { user: { username: "Ben" }, session: {} };

        await chipHelper.deductChips(bensRequest, "Guest-1234", 5);

        expect(chipHelper.getGuestChips("Guest-1234")).toBe(995);
    });

    test("Guest without enough chips cannot pay", async function() {
        await expect(chipHelper.deductChips(anyRequest, "Guest-1234", 5000))
            .rejects.toThrow("Not enough chips.");
        expect(chipHelper.getGuestChips("Guest-1234")).toBe(1000);
    });

    test("Registered player pays from the database", async function() {
        dao.removeChips.mockResolvedValue(900);

        const left = await chipHelper.deductChips(anyRequest, "Ben", 100);

        expect(dao.removeChips).toHaveBeenCalledWith("Ben", 100);
        expect(left).toBe(900);
    });
});

describe("PG-02 Add Chips", function() {

    test("Amount must be a positive whole number", async function() {
        await expect(chipHelper.addChips(anyRequest, "Ben", -5)).rejects.toThrow("positive integer");
    });

    test("Guest winnings go into their server-side balance", async function() {
        const total = await chipHelper.addChips(anyRequest, "Guest-1234", 25);

        expect(total).toBe(1025);
        expect(chipHelper.getGuestChips("Guest-1234")).toBe(1025);
        expect(dao.addChips).not.toHaveBeenCalled();
    });

    test("Registered player winnings go into the database", async function() {
        dao.addChips.mockResolvedValue(1200);

        const total = await chipHelper.addChips(anyRequest, "Ben", 200);

        expect(dao.addChips).toHaveBeenCalledWith("Ben", 200);
        expect(total).toBe(1200);
    });
});
