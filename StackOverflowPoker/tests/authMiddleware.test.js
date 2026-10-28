// TT-03: tests for middleware/auth.js (who is signed in, and protected routes)
jest.mock("../dao/UsersDaoMongoose", () => ({
    readById: jest.fn()
}));
const usersDao = require("../dao/UsersDaoMongoose");
const auth = require("../middleware/auth");

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        redirect: jest.fn()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

describe("TT-03 Load User", function() {

    test('Signed-In Player Is Put In req.user', async function() {
        usersDao.readById.mockResolvedValue({ username: "Ben", needsUsername: false });
        let req = { session: { userId: "abc" } };
        let next = jest.fn();

        await auth.loadUser(req, makeResponse(), next);

        expect(usersDao.readById).toHaveBeenCalledWith("abc");
        expect(req.user.username).toEqual("Ben");
        expect(next).toHaveBeenCalled();
    });

    test('Nobody Signed In', async function() {
        let req = { session: {} };
        let next = jest.fn();

        await auth.loadUser(req, makeResponse(), next);

        expect(req.user).toBeNull();
        expect(usersDao.readById).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    test('No Session At All', async function() {
        let req = {};
        let next = jest.fn();

        await auth.loadUser(req, makeResponse(), next);

        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
    });

    test('Player Without A Poker Name Is Not Signed In Yet', async function() {
        usersDao.readById.mockResolvedValue({ googleId: "g-1", needsUsername: true });
        let req = { session: { userId: "abc" } };

        await auth.loadUser(req, makeResponse(), jest.fn());

        expect(req.user).toBeNull();
    });

    test('Deleted Account Is Not Signed In', async function() {
        usersDao.readById.mockResolvedValue(null);
        let req = { session: { userId: "abc" } };

        await auth.loadUser(req, makeResponse(), jest.fn());

        expect(req.user).toBeNull();
    });
});

describe("TT-03 Require Login", function() {

    test('Signed-In Player Can Continue', function() {
        let req = { user: { username: "Ben" }, headers: {} };
        let res = makeResponse();
        let next = jest.fn();

        auth.requireLogin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirect).not.toHaveBeenCalled();
    });

    test('Form Post When Signed Out Goes To Sign In', function() {
        let req = { user: null, headers: { "content-type": "application/x-www-form-urlencoded" } };
        let res = makeResponse();
        let next = jest.fn();

        auth.requireLogin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });

    test('Fetch When Signed Out Gets A 401', function() {
        let req = { user: null, headers: { accept: "application/json" } };
        let res = makeResponse();
        let next = jest.fn();

        auth.requireLogin(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('JSON Body When Signed Out Gets A 401', function() {
        let req = { headers: { "content-type": "application/json" } };
        let res = makeResponse();

        auth.requireLogin(req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Request With No Headers', function() {
        let req = {};

        expect(auth.wantsJson(req)).toBe(false);
    });
});
