// AM-04: Remove User Tests

jest.mock("../dao/UsersDaoMongoose");

const usersDao = require("../dao/UsersDaoMongoose");
const adminController = require("./adminController");
const { requireAdmin } = require("../middleware/auth");

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

test("AM-04: Admin can remove a player", async function() {

    usersDao.deleteRegisteredUser.mockResolvedValue({
        status: "deleted"
    });

    const req = {
        user: { username: "Admin1", role: "admin" },
        params: { username: "Player1" }
    };

    const res = createResponse();

    await adminController.removeUser(req, res);

    expect(usersDao.deleteRegisteredUser)
        .toHaveBeenCalledWith("Player1");

    expect(res.status).toHaveBeenCalledWith(200);
});

test("AM-04: Admin cannot remove themselves", async function() {

    const req = {
        user: { username: "Admin1", role: "admin" },
        params: { username: "Admin1" }
    };

    const res = createResponse();

    await adminController.removeUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(usersDao.deleteRegisteredUser).not.toHaveBeenCalled();
});

test("AM-04: Administrator accounts are protected", async function() {

    usersDao.deleteRegisteredUser.mockResolvedValue({
        status: "admin_protected"
    });

    const req = {
        user: { username: "Admin1", role: "admin" },
        params: { username: "Admin2" }
    };

    const res = createResponse();

    await adminController.removeUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
});

test("AM-04: Missing users return 404", async function() {

    usersDao.deleteRegisteredUser.mockResolvedValue({
        status: "not_found"
    });

    const req = {
        user: { username: "Admin1", role: "admin" },
        params: { username: "MissingPlayer" }
    };

    const res = createResponse();

    await adminController.removeUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("AM-04: Regular players cannot access deletion", function() {

    const req = {
        user: { username: "Player1", role: "player" }
    };

    const res = createResponse();
    const next = jest.fn();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
});