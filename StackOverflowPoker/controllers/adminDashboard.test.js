
// AM-05: Admin Console Dashboard Tests

jest.mock("../dao/UsersDaoMongoose");

const usersDao = require("../dao/UsersDaoMongoose");

const adminController = require("./adminController");

const { requireAdmin } = require("../middleware/auth");


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


// Test 1: Administrators can access protected features
test("AM-05: Administrator is allowed access", function() {

    const req = {
        user: {
            username: "Shane",
            role: "admin"
        }
    };

    const res = createResponse();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

});


// Test 2: Regular players cannot access admin features
test("AM-05: Regular player is denied access", function() {

    const req = {
        user: {
            username: "Ben",
            role: "player"
        }
    };

    const res = createResponse();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

});


// Test 3: Guests cannot access admin features
test("AM-05: Guest is denied access", function() {

    const req = {
        user: null
    };

    const res = createResponse();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();

});


// Test 4: Administrators can load dashboard statistics
test("AM-05: Dashboard returns user statistics", async function() {

    usersDao.countRegisteredUsers.mockResolvedValue(12);
    usersDao.countAdmins.mockResolvedValue(2);

    const req = {
        user: {
            username: "Shane",
            role: "admin"
        }
    };

    const res = createResponse();

    await adminController.getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith({

        message: "Admin dashboard loaded successfully.",

        admin: {
            username: "Shane",
            role: "admin"
        },

        statistics: {
            totalUsers: 12,
            totalAdmins: 2
        }

    });

});


// Test 5: Dashboard handles database errors
test("AM-05: Dashboard handles database errors", async function() {

    usersDao.countRegisteredUsers.mockRejectedValue(
        new Error("Database unavailable")
    );

    const req = {
        user: {
            username: "Shane",
            role: "admin"
        }
    };

    const res = createResponse();

    const consoleSpy = jest.spyOn(console, "error")
        .mockImplementation(() => {});

    try {

        await adminController.getDashboard(req, res);

        expect(res.status).toHaveBeenCalledWith(500);

    } finally {

        consoleSpy.mockRestore();

    }

});
