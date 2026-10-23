
const dao = require("../dao/UsersDaoMongoose");
const controller = require("../controllers/usersController");

// Mock the database so these tests do not
// change any real player records
jest.mock("../dao/UsersDaoMongoose");

// Create a fake Express response
function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

// ST-01 Test 1: Check wins and losses
test("Player statistics show correct wins and losses", async function() {

    dao.readByUsername.mockResolvedValue({
        username: "Shane",
        wins: 6,
        losses: 4
    });

    const req = { params: { username: "Shane" } };
    const res = createResponse();

    await controller.getPlayerStats(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
        username: "Shane",
        wins: 6,
        losses: 4,
        totalGames: 10,
        winPercentage: 60
    });
});

// ST-01 Test 2: Player with no games
test("New player has zero statistics", async function() {

    dao.readByUsername.mockResolvedValue({
        username: "NewPlayer",
        wins: 0,
        losses: 0
    });

    const req = { params: { username: "NewPlayer" } };
    const res = createResponse();

    await controller.getPlayerStats(req, res);

    expect(res.json).toHaveBeenCalledWith({
        username: "NewPlayer",
        wins: 0,
        losses: 0,
        totalGames: 0,
        winPercentage: 0
    });
});

// ST-01 Test 3: Missing player
test("Missing player returns 404", async function() {

    dao.readByUsername.mockResolvedValue(null);

    const req = { params: { username: "Unknown" } };
    const res = createResponse();

    await controller.getPlayerStats(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

// ST-01 Test 4: Win percentage calculation
test("Three wins and one loss gives 75 percent", async function() {

    dao.readByUsername.mockResolvedValue({
        username: "Player2",
        wins: 3,
        losses: 1
    });

    const req = { params: { username: "Player2" } };
    const res = createResponse();

    await controller.getPlayerStats(req, res);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            winPercentage: 75
        })
    );
});

// ST-01 Test 5: player with missing stats
test("Older player without statistics shows zeros", async function() {

    dao.readByUsername.mockResolvedValue({
        username: "OldPlayer"
    });

    const req = { params: { username: "OldPlayer" } };
    const res = createResponse();

    await controller.getPlayerStats(req, res);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            wins: 0,
            losses: 0,
            winPercentage: 0
        })
    );
});
