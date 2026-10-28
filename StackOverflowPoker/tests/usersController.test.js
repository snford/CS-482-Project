const controller = require('../controllers/usersController');
const dao = require('../dao/UsersDaoMongoose');
const dbcon = require('../DbConnection');

let res = null;

beforeAll(async function() {
    await dbcon.connect("test");
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

describe("Login", function() {

    test('Login Creates A New User', async function() {
        let req = { body: { txt_username: "Ben" } };

        await controller.postLogin(req, res);
        let found = await dao.readByUsername("Ben");

        expect(found).not.toBeNull();
        expect(res.redirect).toHaveBeenCalledWith('home.html?username=Ben');
    });

    test('Login With Same Username Uses Same Account', async function() {
        let req = { body: { txt_username: "Ben" } };

        await controller.postLogin(req, res);
        let firstLogin = await dao.readByUsername("Ben");
        await controller.postLogin(req, res);
        let secondLogin = await dao.readByUsername("Ben");

        expect(secondLogin._id).toEqual(firstLogin._id);
    });

    test('Login With Empty Username', async function() {
        let req = { body: { txt_username: "   " } };

        await controller.postLogin(req, res);

        expect(res.redirect).toHaveBeenCalledWith('index.html');
    });
});

describe("Get User", function() {

    test('Get User That Exists', async function() {
        await dao.create({ username: "Ben" });
        let req = { params: { username: "Ben" } };

        await controller.getUser(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
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
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests).toContain("Ben");
        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Ben');
    });

    test('Send Friend Request Does Not Add Friend Yet', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends.length).toBe(0);
    });

    test('Send Friend Request Twice', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(1);
    });

    test('Send Friend Request To User That Does Not Exist', async function() {
        await dao.create({ username: "Ben" });
        let req = { body: { txt_from: "Ben", txt_to: "Ghost" } };

        await controller.postAddFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Ben');
    });

    test('Send Friend Request From User That Does Not Exist', async function() {
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_from: "Ghost", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
    });

    test('Send Friend Request To Yourself', async function() {
        await dao.create({ username: "Ben" });
        let req = { body: { txt_from: "Ben", txt_to: "Ben" } };

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friendRequests.length).toBe(0);
    });

    test('Send Friend Request To A Friend', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
    });

    test('Send Friend Request Back Makes Friends', async function() {
        await dao.create({ username: "Ben", friendRequests: ["Dennis"] });
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_from: "Ben", txt_to: "Dennis" } };

        await controller.postAddFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toContain("Dennis");
        expect(dennis.friends).toContain("Ben");
    });
});

describe("SF-03 Accept And Decline", function() {

    test('Accept Friend Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = { params: { from: "Ben", to: "Dennis" } };

        await controller.getAcceptFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toContain("Dennis");
        expect(dennis.friends).toContain("Ben");
    });

    test('Accept Friend Request Removes The Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = { params: { from: "Ben", to: "Dennis" } };

        await controller.getAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Dennis');
    });

    test('Accept When There Is No Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis" });
        let req = { params: { from: "Ben", to: "Dennis" } };

        await controller.getAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friends.length).toBe(0);
    });

    test('Accept From User That Does Not Exist', async function() {
        await dao.create({ username: "Dennis", friendRequests: ["Ghost"] });
        let req = { params: { from: "Ghost", to: "Dennis" } };

        await controller.getAcceptFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friends.length).toBe(0);
    });

    test('Decline Friend Request', async function() {
        await dao.create({ username: "Ben" });
        await dao.create({ username: "Dennis", friendRequests: ["Ben"] });
        let req = { params: { from: "Ben", to: "Dennis" } };

        await controller.getDeclineFriend(req, res);
        let dennis = await dao.readByUsername("Dennis");

        expect(dennis.friendRequests.length).toBe(0);
        expect(dennis.friends.length).toBe(0);
    });

    test('Decline For User That Does Not Exist', async function() {
        let req = { params: { from: "Ben", to: "Ghost" } };

        await controller.getDeclineFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Ghost');
    });
});

describe("SF-04 Remove Friend", function() {

    test('Remove Friend From Both Lists', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis", "Shane"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = { body: { txt_user: "Ben", txt_friend: "Dennis" } };

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");
        let dennis = await dao.readByUsername("Dennis");

        expect(ben.friends).toEqual(["Shane"]);
        expect(dennis.friends.length).toBe(0);
    });

    test('Remove Friend Goes Back To Friends Page', async function() {
        await dao.create({ username: "Ben", friends: ["Dennis"] });
        await dao.create({ username: "Dennis", friends: ["Ben"] });
        let req = { body: { txt_user: "Ben", txt_friend: "Dennis" } };

        await controller.postRemoveFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Ben&removed=Dennis');
    });

    test('Remove Someone Who Is Not A Friend', async function() {
        await dao.create({ username: "Ben", friends: ["Shane"] });
        await dao.create({ username: "Dennis" });
        let req = { body: { txt_user: "Ben", txt_friend: "Dennis" } };

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends).toEqual(["Shane"]);
        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=Ben');
    });

    test('Remove Friend Who Does Not Exist', async function() {
        await dao.create({ username: "Ben", friends: ["Ghost"] });
        let req = { body: { txt_user: "Ben", txt_friend: "Ghost" } };

        await controller.postRemoveFriend(req, res);
        let ben = await dao.readByUsername("Ben");

        expect(ben.friends).toEqual(["Ghost"]);
    });

    test('Remove Friend When Not Logged In', async function() {
        let req = { body: {} };

        await controller.postRemoveFriend(req, res);

        expect(res.redirect).toHaveBeenCalledWith('/friends.html?username=');
    });
});
