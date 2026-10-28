const controller = require('../controllers/usersController');
const dao = require('../dao/UsersDaoMongoose');
const dbcon = require('../DbConnection');

let res = null;

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
    // Fake response so we can check what the controller sends back
    res = {
        redirect: jest.fn(),
        status: jest.fn(),
        send: jest.fn(),
        end: jest.fn()
    };
});

afterEach(async function() {
    await dao.deleteAll("test");
});

// A request from a signed-in player (loadUser puts them in req.user)
function signedIn(name, body) {
    return { user: { username: name }, body: body };
}

describe("Get User", function() {

    test('Get User That Exists', async function() {
        await dao.create({ username: "Ben" });
        let req = { params: { username: "Ben" } };

        await controller.getUser(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('Get User Only Shows Public Information', async function() {
        await dao.create({ username: "Ben", email: "ben@example.com", googleId: "g-1", friends: ["Dennis"], wins: 3 });
        let req = { params: { username: "Ben" } };

        await controller.getUser(req, res);

        expect(res.send).toHaveBeenCalledWith({ username: "Ben", wins: 3, losses: 0 });
    });

    test('Get User That Does Not Exist', async function() {
        let req = { params: { username: "Ghost" } };

        await controller.getUser(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe("SF-01 Send Friend Request", function() {

    test('Send Friend Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests).toContain("Ben");
        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Send Friend Request Ignores Extra Spaces', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_to: "  Dennis " });

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests).toContain("Ben");
    });

    test('Send Friend Request Does Not Add Friend Yet', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends.length).toBe(0);
    });

    test('Send Friend Request Twice', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(1);
    });

    test('Send Friend Request To User That Does Not Exist', async function() {
        await dao.create({ username: "Ben" });
        let req = signedIn("Ben", { txt_to: "Ghost" });

        await controller.postAddFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Send Friend Request From User That Does Not Exist', async function() {
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ghost", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
    });

    test('Send Friend Request To Yourself', async function() {
        await dao.create({ username: "Ben" });
        let req = signedIn("Ben", { txt_to: "Ben" });

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friendRequests.length).toBe(0);
    });

    test('Send Friend Request To A Friend', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = signedIn("Ben", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
    });

    test('Send Friend Request Back Makes Friends', async function() {
        await dao.create({ username: "Ben", friendRequests: ["Dennis"] });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_to: "Dennis" });

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toContain("Dennis");
        expect(dennis.friends).toContain("Ben");
    });

    test('Send Friend Request When Not Signed In', async function() {
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });
});

describe("SF-03 Accept And Decline", function() {

    test('Accept Friend Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = signedIn("Dennis", { txt_from: "Ben" });

        await controller.postAcceptFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toContain("Dennis");
        expect(dennis.friends).toContain("Ben");
    });

    test('Accept Friend Request Removes The Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = signedIn("Dennis", { txt_from: "Ben" });

        await controller.postAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Accept When There Is No Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Dennis", { txt_from: "Ben" });

        await controller.postAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friends.length).toBe(0);
    });

    test('Accept From User That Does Not Exist', async function() {
        await dao.create({ username: "Dennis", friendRequests: ["Ghost"] });
        let req = signedIn("Dennis", { txt_from: "Ghost" });

        await controller.postAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friends.length).toBe(0);
    });

    test('Cannot Accept A Request For Someone Else', async function() {
        // Shane is signed in and tries to accept the request Ben sent to Dennis
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        await dao.create({ username: "Shane" });
        let req = signedIn("Shane", { txt_from: "Ben" });

        await controller.postAcceptFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends.length).toBe(0);
        expect(dennis.friendRequests).toEqual(["Ben"]);
    });

    test('Accept When Not Signed In', async function() {
        let req = { body: { txt_from: "Ben" } };

        await controller.postAcceptFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });

    test('Decline Friend Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = signedIn("Dennis", { txt_from: "Ben" });

        await controller.postDeclineFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
        expect(dennis.friends.length).toBe(0);
        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Decline For User That Does Not Exist', async function() {
        let req = signedIn("Ghost", { txt_from: "Ben" });

        await controller.postDeclineFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Decline When Not Signed In', async function() {
        let req = { body: { txt_from: "Ben" } };

        await controller.postDeclineFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });
});

describe("SF-04 Remove Friend", function() {

    test('Remove Friend From Both Lists', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis", "Shane"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = signedIn("Ben", { txt_friend: "Dennis" });

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toEqual(["Shane"]);
        expect(dennis.friends.length).toBe(0);
    });

    test('Remove Friend Goes Back To Friends Page', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = signedIn("Ben", { txt_friend: "Dennis" });

        await controller.postRemoveFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html?removed=Dennis');
    });

    test('Remove Someone Who Is Not A Friend', async function() {
        await dao.create({ username: "Ben", friends: ["Shane"] });
        await dao.create({ username: "Dennis" });
        let req = signedIn("Ben", { txt_friend: "Dennis" });

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends).toEqual(["Shane"]);
        expect(res.redirect).toHaveBeenCalledWith('/friends.html');
    });

    test('Remove Friend Who Does Not Exist', async function() {
        await dao.create({ username: "Ben", friends: ["Ghost"] });
        let req = signedIn("Ben", { txt_friend: "Ghost" });

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends).toEqual(["Ghost"]);
    });

    test('Remove Friend When Not Logged In', async function() {
        let req = { body: {} };

        await controller.postRemoveFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/index.html');
    });
});

describe("TT-03 Get Me", function() {

    test('Get Me When Logged In', async function() {
        let ben = await dao.create({ username: "Ben", email: "ben@example.com", friends: ["Dennis"], friendRequests: ["Shane"] });
        let req = { session: { userId: ben._id.toString() } };

        await controller.getMe(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith({
            loggedIn: true, username: "Ben", email: "ben@example.com", needsUsername: false,
            friends: ["Dennis"], friendRequests: ["Shane"]
        });
    });

    test('Get Me When Not Logged In', async function() {
        let req = { session: {} };

        await controller.getMe(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith({ loggedIn: false, guestName: null });
    });

    test('Get Me For A Guest', async function() {
        let req = { session: { guestName: "Guest-1234" } };

        await controller.getMe(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.send).toHaveBeenCalledWith({ loggedIn: false, guestName: "Guest-1234" });
    });

    test('Get Me With No Session At All', async function() {
        let req = {};

        await controller.getMe(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Get Me When The Account Was Deleted', async function() {
        let ben = await dao.create({ username: "Ben" });
        let req = { session: { userId: ben._id.toString() } };
        await dao.deleteAll("test");

        await controller.getMe(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Get Me Shows No Email When There Is None', async function() {
        let ben = await dao.create({ username: "Ben" });
        let req = { session: { userId: ben._id.toString() } };

        await controller.getMe(req, res);

        expect(res.send.mock.calls[0][0].email).toBeNull();
    });

    test('Get Me Says A Poker Name Is Still Needed', async function() {
        let user = await dao.create({ googleId: "g-1", email: "new@example.com", needsUsername: true });
        let req = { session: { userId: user._id.toString() } };

        await controller.getMe(req, res);

        expect(res.send).toHaveBeenCalledWith({
            loggedIn: true, username: null, email: "new@example.com", needsUsername: true,
            friends: [], friendRequests: []
        });
    });
});

describe("TT-03 Poker Name Rules", function() {

    test('A Normal Name Is Fine', function() {
        expect(controller.checkPokerName("Big Al_99")).toBeNull();
    });

    test('Too Short Or Too Long', function() {
        expect(controller.checkPokerName("ab")).not.toBeNull();
        expect(controller.checkPokerName("a".repeat(21))).not.toBeNull();
    });

    test('Symbols Are Not Allowed', function() {
        expect(controller.checkPokerName("bad!name")).not.toBeNull();
    });

    test('Double Spaces Are Not Allowed', function() {
        expect(controller.checkPokerName("Big  Al")).not.toBeNull();
    });

    test('Reserved Names Are Not Allowed', function() {
        expect(controller.checkPokerName("Admin")).not.toBeNull();
    });
});

describe("TT-03 Check If A Name Is Available", function() {

    test('Free Name Is Available', async function() {
        let req = { query: { name: "AceOfStacks" } };

        await controller.getUsernameAvailable(req, res);

        expect(res.send).toHaveBeenCalledWith({ available: true, message: "That name is available!" });
    });

    test('Taken Name With Different Capitals Is Not Available', async function() {
        await dao.create({ username: "Ben" });
        let req = { query: { name: "bEN" } };

        await controller.getUsernameAvailable(req, res);

        expect(res.send).toHaveBeenCalledWith({ available: false, message: "That name is already taken." });
    });

    test('Invalid Name Is Not Available', async function() {
        let req = { query: { name: "x" } };

        await controller.getUsernameAvailable(req, res);

        expect(res.send.mock.calls[0][0].available).toBe(false);
    });

    test('No Name Given', async function() {
        let req = { query: {} };

        await controller.getUsernameAvailable(req, res);

        expect(res.send.mock.calls[0][0].available).toBe(false);
    });
});

describe("TT-03 Choose A Poker Name", function() {

    async function newGooglePlayer() {
        return await dao.create({ googleId: "g-new", email: "new@example.com", needsUsername: true });
    }

    test('New Player Saves Their Name', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "  AceOfStacks " } };

        await controller.postChooseUsername(req, res);
        let saved = await dao.readById(user._id.toString());

        expect(res.status).toHaveBeenCalledWith(200);
        expect(saved.username).toEqual("AceOfStacks");
        expect(saved.needsUsername).toBe(false);
    });

    test('Choosing A Name When Not Signed In', async function() {
        let req = { body: { username: "AceOfStacks" } };

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Choosing A Name For A Deleted Account', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "AceOfStacks" } };
        await dao.deleteAll("test");

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Player Who Already Has A Name Cannot Change It', async function() {
        let user = await dao.create({ username: "Ben", googleId: "g-1" });
        let req = { session: { userId: user._id.toString() }, body: { username: "NewName" } };

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('Invalid Name Is Rejected', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "no!" } };

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Missing Name Is Rejected', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() } };

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Name Taken With Different Capitals Is Rejected', async function() {
        await dao.create({ username: "Ben" });
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "BEN" } };

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('Two Players Grabbing The Same Name At Once', async function() {
        await dao.create({ username: "Ben" });
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "Ben" } };
        // Pretend the name looked free, like when two players submit at the same moment
        jest.spyOn(dao, "readByUsernameIgnoreCase").mockResolvedValueOnce(null);

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('Name Already Set By Another Tab', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "AceOfStacks" } };
        jest.spyOn(dao, "setUsername").mockResolvedValueOnce(null);

        await controller.postChooseUsername(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('Unexpected Database Errors Are Not Hidden', async function() {
        let user = await newGooglePlayer();
        let req = { session: { userId: user._id.toString() }, body: { username: "AceOfStacks" } };
        jest.spyOn(dao, "setUsername").mockRejectedValueOnce(new Error("database down"));

        await expect(controller.postChooseUsername(req, res)).rejects.toThrow("database down");
    });
});
