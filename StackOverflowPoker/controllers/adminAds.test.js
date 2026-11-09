// AM-04, AM-05, AV-01: Tests for the admin user list, user removal errors, and ads
jest.mock("../dao/UsersDaoMongoose");
jest.mock("../dao/AdsDaoMongoose");

const usersDao = require("../dao/UsersDaoMongoose");
const adsDao = require("../dao/AdsDaoMongoose");
const adminController = require("./adminController");

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function adminRequest(extra) {
    return Object.assign({ user: { username: "Shane", role: "admin" }, params: {}, body: {} }, extra);
}

// A valid new advertisement
function adBody(changes) {
    return Object.assign({
        name: " Chip Sale ",
        imageUrl: " /images/sale.png ",
        linkUrl: " https://example.com ",
        placement: "lobby",
        intervalMinutes: "5",
        active: true
    }, changes);
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
});

describe("AM-05 Registered User List", function() {

    test("Only dashboard fields are returned, with defaults filled in", async function() {
        usersDao.getAllRegisteredUsers.mockResolvedValue([
            { username: "Ben", role: "admin", chips: 50, wins: 2, losses: 1, avatar: "heart", email: "secret@example.com" },
            { username: "Amy" }
        ]);
        const res = createResponse();

        await adminController.getAllUsers(adminRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            users: [
                { username: "Ben", role: "admin", chips: 50, wins: 2, losses: 1, avatar: "heart" },
                { username: "Amy", role: "player", chips: 1000, wins: 0, losses: 0, avatar: "spade" }
            ]
        });
    });

    test("Database error", async function() {
        usersDao.getAllRegisteredUsers.mockRejectedValue(new Error("Database error"));
        const res = createResponse();

        await adminController.getAllUsers(adminRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("AM-04 Remove User Errors", function() {

    test("Database error while removing", async function() {
        usersDao.deleteRegisteredUser.mockRejectedValue(new Error("Database error"));
        const res = createResponse();

        await adminController.removeUser(adminRequest({ params: { username: "Ben" } }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("AV-01 Advertisements", function() {

    test("Admin sees every saved ad", async function() {
        adsDao.readAll.mockResolvedValue([{ name: "Chip Sale" }]);
        const res = createResponse();

        await adminController.getAds(adminRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith([{ name: "Chip Sale" }]);
    });

    test("Database error while loading ads", async function() {
        adsDao.readAll.mockRejectedValue(new Error("Database error"));
        const res = createResponse();

        await adminController.getAds(adminRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test("Create an ad with cleaned-up fields", async function() {
        adsDao.createAd.mockImplementation(async data => data);
        const res = createResponse();

        await adminController.createAd(adminRequest({ body: adBody() }), res);

        expect(adsDao.createAd).toHaveBeenCalledWith({
            name: "Chip Sale",
            imageUrl: "/images/sale.png",
            linkUrl: "https://example.com",
            placement: "lobby",
            intervalMinutes: 5,
            active: true
        });
        expect(res.status).toHaveBeenCalledWith(201);
    });

    test.each([
        ["a missing name", { name: "  " }],
        ["a missing image", { imageUrl: undefined }],
        ["a missing link", { linkUrl: "" }],
        ["an unknown placement", { placement: "home" }],
        ["an interval that is not a whole number", { intervalMinutes: "2.5" }],
        ["an interval under one minute", { intervalMinutes: "0" }],
        ["active that is not true or false", { active: "yes" }]
    ])("Reject an ad with %s", async function(label, changes) {
        const res = createResponse();

        await adminController.createAd(adminRequest({ body: adBody(changes) }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(adsDao.createAd).not.toHaveBeenCalled();
    });

    test("Database error while creating an ad", async function() {
        adsDao.createAd.mockRejectedValue(new Error("Database error"));
        const res = createResponse();

        await adminController.createAd(adminRequest({ body: adBody() }), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test("Active ads for the table page", async function() {
        adsDao.readActive.mockResolvedValue([{ name: "Table Ad" }]);
        const res = createResponse();

        await adminController.getActiveAds({ params: { placement: "table" } }, res);

        expect(adsDao.readActive).toHaveBeenCalledWith("table");
        expect(res.json).toHaveBeenCalledWith([{ name: "Table Ad" }]);
    });

    test("Unknown ad placement", async function() {
        const res = createResponse();

        await adminController.getActiveAds({ params: { placement: "home" } }, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Database error while loading active ads", async function() {
        adsDao.readActive.mockRejectedValue(new Error("Database error"));
        const res = createResponse();

        await adminController.getActiveAds({ params: { placement: "lobby" } }, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
