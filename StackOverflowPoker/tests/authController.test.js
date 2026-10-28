const auth = require('../controllers/authController');
const dao = require('../dao/UsersDaoMongoose');
const dbcon = require('../DbConnection');

let res = null;

// A Google profile shaped like the one passport-google-oauth20 gives us
function googleProfile(id, email) {
    let profile = { id: id, displayName: "Test Player" };
    if (email) {
        profile.emails = [{ value: email }];
    }
    return profile;
}

// A fake express-session object; the callbacks can be told to fail
function fakeSession(failRegenerate, failSave) {
    let session = {
        regenerate: jest.fn(function(callback) {
            callback(failRegenerate ? new Error("regenerate failed") : null);
        }),
        save: jest.fn(function(callback) {
            callback(failSave ? new Error("save failed") : null);
        }),
        destroy: jest.fn(function(callback) {
            callback();
        })
    };
    return session;
}

beforeAll(async function() {
    await dbcon.connect("test");
    await dao.syncIndexes();
    await dao.deleteAll("test");
});

afterAll(async function() {
    await dao.deleteAll("test");
    await dbcon.disconnect();
});

beforeEach(function() {
    res = {
        redirect: jest.fn(),
        clearCookie: jest.fn()
    };
});

afterEach(async function() {
    await dao.deleteAll("test");
});

describe("TT-03 Find Or Create Google User", function() {

    test('New Google Player Gets A New Account', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));

        expect(user.googleId).toEqual("g-1");
        expect(user.email).toEqual("ben@example.com");
    });

    test('New Google Player Still Needs A Poker Name', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));

        expect(user.needsUsername).toBe(true);
        expect(user.username).toBeUndefined();
    });

    test('Returning Google Player Gets The Same Account', async function() {
        let first = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));
        let second = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));

        expect(second._id).toEqual(first._id);
    });

    test('Google Player Without An Email', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-2"));

        expect(user.email).toBeNull();
    });

    test('Two New Players Can Both Be Waiting For A Name', async function() {
        await auth.findOrCreateGoogleUser(googleProfile("g-1", "a@example.com"));
        let second = await auth.findOrCreateGoogleUser(googleProfile("g-2", "b@example.com"));

        expect(second.googleId).toEqual("g-2");
    });

    test('Profile Without An Id Is Rejected', async function() {
        await expect(auth.findOrCreateGoogleUser({})).rejects.toThrow();
    });
});

describe("TT-03 Passport Verify Callback", function() {

    test('Verify Passes The User To Passport', async function() {
        let done = jest.fn();

        await auth.verifyGoogle("token", "refresh", googleProfile("g-1", "ben@example.com"), done);

        expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ googleId: "g-1" }));
    });

    test('Verify Passes Errors To Passport', async function() {
        let done = jest.fn();

        await auth.verifyGoogle("token", "refresh", null, done);

        expect(done.mock.calls[0][0]).toBeInstanceOf(Error);
    });
});

describe("TT-03 Finish Google Login", function() {

    test('Login Starts A Fresh Session With The User', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));
        let req = { session: fakeSession(false, false) };

        auth.finishGoogleLogin(req, res, user);

        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session.userId).toEqual(user._id.toString());
        expect(res.redirect).toHaveBeenCalledWith('/choosename.html');
    });

    test('Returning Player With A Name Goes Home', async function() {
        let user = await dao.create({ username: "Ben", googleId: "g-9" });
        let req = { session: fakeSession(false, false) };

        auth.finishGoogleLogin(req, res, user);

        expect(res.redirect).toHaveBeenCalledWith('/home.html?username=Ben');
    });

    test('Login Fails If A New Session Cannot Be Made', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));
        let req = { session: fakeSession(true, false) };

        auth.finishGoogleLogin(req, res, user);

        expect(res.redirect).toHaveBeenCalledWith('/index.html?login=failed');
    });

    test('Login Fails If The Session Cannot Be Saved', async function() {
        let user = await auth.findOrCreateGoogleUser(googleProfile("g-1", "ben@example.com"));
        let req = { session: fakeSession(false, true) };

        auth.finishGoogleLogin(req, res, user);

        expect(res.redirect).toHaveBeenCalledWith('/index.html?login=failed');
    });
});

describe("TT-03 Logout", function() {

    test('Logout Ends The Session', function() {
        let req = { session: fakeSession(false, false) };

        auth.postLogout(req, res);

        expect(req.session.destroy).toHaveBeenCalled();
        expect(res.clearCookie).toHaveBeenCalledWith('sop.sid');
        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });

    test('Logout Without A Session', function() {
        let req = {};

        auth.postLogout(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });
});
