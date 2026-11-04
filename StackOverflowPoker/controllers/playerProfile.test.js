// UP-02: View Other Players' Profiles Tests

// Mock MongoDB so tests don't change real accounts
jest.mock("../dao/UsersDaoMongoose");

const dao = require("../dao/UsersDaoMongoose");

const controller = require("./usersController");


// Create a fake Express response
function createResponse() {

    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };

}


// Reset mocks before every test
beforeEach(function() {
    jest.clearAllMocks();
});


// Test 1: Retrieve a player's profile
test("UP-02: Get another player's public profile", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue({

        username: "Ben",

        avatar: "diamond",

        chips: 2500,

        wins: 15,

        losses: 5

    });

    const req = {
        params: {
            username: "Ben"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({

        username: "Ben",

        avatar: "diamond",

        chips: 2500,

        wins: 15,

        losses: 5,

        totalGames: 20,

        winPercentage: 75

    });

});


// Test 2: Player with no games
test("UP-02: New player has zero statistics", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue({

        username: "NewPlayer",

        avatar: "spade",

        chips: 1000,

        wins: 0,

        losses: 0

    });

    const req = {
        params: {
            username: "NewPlayer"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({

            wins: 0,

            losses: 0,

            totalGames: 0,

            winPercentage: 0

        })
    );

});


// Test 3: Missing player
test("UP-02: Missing player returns 404", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue(null);

    const req = {
        params: {
            username: "Unknown"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

});


// Test 4: Do not expose private account information
test("UP-02: Public profile hides private information", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue({

        username: "Ben",

        googleId: "secretGoogleId",

        email: "private@example.com",

        avatar: "club",

        chips: 1000,

        wins: 4,

        losses: 1

    });

    const req = {
        params: {
            username: "Ben"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    const result = res.json.mock.calls[0][0];

    expect(result.username).toBe("Ben");

    expect(result).not.toHaveProperty("googleId");

    expect(result).not.toHaveProperty("email");

    expect(result).not.toHaveProperty("_id");

});


// Test 5: Default avatar
test("UP-02: Player without avatar gets default avatar", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue({

        username: "Shane",

        chips: 1000,

        wins: 2,

        losses: 2

    });

    const req = {
        params: {
            username: "Shane"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({

            avatar: "spade",

            winPercentage: 50

        })
    );

});


// Test 6: Reject incomplete registered accounts
test("UP-02: Account without username setup is hidden", async function() {

    dao.readByUsernameIgnoreCase.mockResolvedValue({

        username: null,

        needsUsername: true

    });

    const req = {
        params: {
            username: "Unknown"
        }
    };

    const res = createResponse();

    await controller.getPublicProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);

});