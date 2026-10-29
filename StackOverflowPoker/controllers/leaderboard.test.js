// ST-02: Leaderboard Controller Tests

const dao = require("../dao/UsersDaoMongoose");
const controller = require("./usersController");

// Mock database functions
jest.mock("../dao/UsersDaoMongoose");

// Create fake Express response
function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

// Test 1: Correct rankings
test("ST-02: Players receive correct ranks", async function() {

    dao.getLeaderboard.mockResolvedValue([
        {
            username: "Ben",
            wins: 10,
            losses: 2,
            totalGames: 12,
            winPercentage: 83.33
        },
        {
            username: "Shane",
            wins: 5,
            losses: 3,
            totalGames: 8,
            winPercentage: 62.5
        }
    ]);

    const req = {};
    const res = createResponse();

    await controller.getLeaderboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith([
        {
            rank: 1,
            username: "Ben",
            wins: 10,
            losses: 2,
            totalGames: 12,
            winPercentage: 83.33
        },
        {
            rank: 2,
            username: "Shane",
            wins: 5,
            losses: 3,
            totalGames: 8,
            winPercentage: 62.5
        }
    ]);
});

// Test 2: Empty leaderboard
test("ST-02: Empty leaderboard returns empty array", async function() {

    dao.getLeaderboard.mockResolvedValue([]);

    const req = {};
    const res = createResponse();

    await controller.getLeaderboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
});

// Test 3: Database error
test("ST-02: Database errors return 500", async function() {

    dao.getLeaderboard.mockRejectedValue(
        new Error("Database error")
    );

    const req = {};
    const res = createResponse();

    // Suppress expected error output during this test
    const consoleSpy = jest.spyOn(console, "error")
        .mockImplementation(() => {});

    try {
        await controller.getLeaderboard(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

        expect(res.json).toHaveBeenCalledWith({
            msg: "Error retrieving leaderboard"
        });
    } finally {
        consoleSpy.mockRestore();
    }
});