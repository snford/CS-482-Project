// ST-02: Leaderboard DAO Tests

// Mock the Mongoose model before loading the DAO
const mockAggregate = jest.fn();

jest.mock("mongoose", () => ({
    Schema: jest.fn(),
    model: jest.fn(() => ({
        aggregate: mockAggregate
    }))
}));

const dao = require("../dao/UsersDaoMongoose");

beforeEach(function() {
    jest.clearAllMocks();
});

// Test 1: Correct statistics and percentage
test("ST-02: DAO calculates win percentage correctly", async function() {

    mockAggregate.mockResolvedValue([
        {
            username: "Ben",
            wins: 8,
            losses: 2
        },
        {
            username: "Shane",
            wins: 3,
            losses: 1
        }
    ]);

    const leaderboard = await dao.getLeaderboard();

    expect(leaderboard).toEqual([
        {
            username: "Ben",
            wins: 8,
            losses: 2,
            totalGames: 10,
            winPercentage: 80
        },
        {
            username: "Shane",
            wins: 3,
            losses: 1,
            totalGames: 4,
            winPercentage: 75
        }
    ]);
});

// Test 2: DAO uses the correct MongoDB ranking pipeline
test("ST-02: DAO sorts and limits players", async function() {

    mockAggregate.mockResolvedValue([]);

    await dao.getLeaderboard();

    expect(mockAggregate).toHaveBeenCalledWith([
        {
            $project: {
                username: 1,
                wins: { $ifNull: ["$wins", 0] },
                losses: { $ifNull: ["$losses", 0] }
            }
        },
        {
            $sort: {
                wins: -1,
                losses: 1,
                username: 1
            }
        },
        {
            $limit: 10
        }
    ]);
});

// Test 3: Zero games
test("ST-02: Players with no games have zero win percentage", async function() {

    mockAggregate.mockResolvedValue([
        {
            username: "NewPlayer",
            wins: 0,
            losses: 0
        }
    ]);

    const leaderboard = await dao.getLeaderboard();

    expect(leaderboard[0].winPercentage).toBe(0);
    expect(leaderboard[0].totalGames).toBe(0);
});