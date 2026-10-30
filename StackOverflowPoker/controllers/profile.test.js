// UP-01: Profile Creation and Management Tests

jest.mock("../dao/UsersDaoMongoose");

const dao = require("../dao/UsersDaoMongoose");
const controller = require("../controllers/usersController");

// Create a fake Express response
function createResponse() {

    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };

}

// Create a fake registered user
function createUser() {

    return {
        _id: "user123",
        googleId: "google123",
        username: "Shane",
        avatar: "spade",
        chips: 1500,
        wins: 6,
        losses: 4
    };

}

// Clear mocks between tests
beforeEach(function() {
    jest.clearAllMocks();
});


// Test 1: View profile
test("UP-01: Registered user can view profile", async function() {

    const req = {
        user: createUser()
    };

    const res = createResponse();

    await controller.getMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({
        username: "Shane",
        avatar: "spade",
        chips: 1500,
        wins: 6,
        losses: 4,
        totalGames: 10,
        winPercentage: 60
    });

});


// Test 2: Save profile changes
test("UP-01: Registered user can update profile", async function() {

    const req = {
        user: createUser(),
        body: {
            username: "Shane",
            avatar: "diamond"
        }
    };

    const res = createResponse();

    // The current player already owns this username
    dao.readByUsernameIgnoreCase.mockResolvedValue(
        createUser()
    );

    dao.updateProfile.mockResolvedValue({
        username: "Shane",
        avatar: "diamond"
    });

    await controller.updateMyProfile(req, res);

    expect(dao.updateProfile).toHaveBeenCalledWith(
        "user123",
        "Shane",
        "diamond"
    );

    expect(res.status).toHaveBeenCalledWith(200);

});


// Test 3: Invalid avatar
test("UP-01: Invalid avatar is rejected", async function() {

    const req = {
        user: createUser(),
        body: {
            username: "Shane",
            avatar: "invalid-avatar"
        }
    };

    const res = createResponse();

    await controller.updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(400);

    expect(dao.updateProfile).not.toHaveBeenCalled();

});


// Test 4: Duplicate username
test("UP-01: Duplicate username is rejected", async function() {

    const req = {
        user: createUser(),
        body: {
            username: "Ben",
            avatar: "spade"
        }
    };

    const res = createResponse();

    dao.readByUsernameIgnoreCase.mockResolvedValue({
        _id: "anotherUser",
        username: "Ben"
    });

    await controller.updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(dao.updateProfile).not.toHaveBeenCalled();

});


// Test 5: Missing authentication
test("UP-01: Signed-out user cannot edit profile", async function() {

    const req = {
        user: null,
        body: {
            username: "Shane",
            avatar: "star"
        }
    };

    const res = createResponse();

    await controller.updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(401);

    expect(dao.updateProfile).not.toHaveBeenCalled();

});


// Test 6: Users cannot edit chips or wins
test("UP-01: Profile update ignores chips and wins", async function() {

    const req = {
        user: createUser(),
        body: {
            username: "Shane",
            avatar: "heart",
            chips: 999999,
            wins: 999
        }
    };

    const res = createResponse();

    dao.readByUsernameIgnoreCase.mockResolvedValue(
        createUser()
    );

    dao.updateProfile.mockResolvedValue({
        username: "Shane",
        avatar: "heart"
    });

    await controller.updateMyProfile(req, res);

    // Only username and avatar should be passed to the DAO
    expect(dao.updateProfile).toHaveBeenCalledWith(
        "user123",
        "Shane",
        "heart"
    );

    expect(res.status).toHaveBeenCalledWith(200);

});


// Test 7: New player statistics
test("UP-01: New player has zero statistics", async function() {

    const req = {
        user: {
            _id: "newUser",
            googleId: "google456",
            username: "NewPlayer",
            chips: 1000
        }
    };

    const res = createResponse();

    await controller.getMyProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            wins: 0,
            losses: 0,
            totalGames: 0,
            winPercentage: 0
        })
    );

});