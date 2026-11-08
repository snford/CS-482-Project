
const adsDao = require("../dao/AdsDaoMongoose");
const controller = require("./adminController");

jest.mock("../dao/AdsDaoMongoose", () => ({
    readAll: jest.fn(),
    createAd: jest.fn(),
    readActive: jest.fn()
}));

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

const sampleAd = {
    name: "Test Ad",
    imageUrl: "/images/test.png",
    linkUrl: "https://example.com",
    placement: "lobby",
    intervalMinutes: 5,
    active: true
};

beforeEach(function() {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    jest.restoreAllMocks();
});

// AV-01: Advertisement placement and creation

test("AV-01: Get all advertisements", async function() {
    adsDao.readAll.mockResolvedValue([sampleAd]);
    const res = makeResponse();

    await controller.getAds({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([sampleAd]);
});

test("AV-01: Get an empty advertisement list", async function() {
    adsDao.readAll.mockResolvedValue([]);
    const res = makeResponse();

    await controller.getAds({}, res);

    expect(res.json).toHaveBeenCalledWith([]);
});

test("AV-01: Create an advertisement", async function() {
    adsDao.createAd.mockResolvedValue(sampleAd);
    const res = makeResponse();

    await controller.createAd({ body: sampleAd }, res);

    expect(adsDao.createAd).toHaveBeenCalledWith(sampleAd);
    expect(res.status).toHaveBeenCalledWith(201);
});

test("AV-01: Reject an empty advertisement name", async function() {
    const res = makeResponse();
    const ad = { ...sampleAd, name: "" };

    await controller.createAd({ body: ad }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(adsDao.createAd).not.toHaveBeenCalled();
});

test("AV-01: Reject an invalid placement", async function() {
    const res = makeResponse();
    const ad = { ...sampleAd, placement: "home" };

    await controller.createAd({ body: ad }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("AV-02: Reject an invalid rotation interval", async function() {
    const res = makeResponse();
    const ad = { ...sampleAd, intervalMinutes: 0 };

    await controller.createAd({ body: ad }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("AV-02: Accept a valid rotation interval", async function() {
    const res = makeResponse();
    const ad = { ...sampleAd, intervalMinutes: 2 };
    adsDao.createAd.mockResolvedValue(ad);

    await controller.createAd({ body: ad }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(adsDao.createAd).toHaveBeenCalledWith(ad);
});

test("AV-01: Handle database error when loading ads", async function() {
    const res = makeResponse();
    adsDao.readAll.mockRejectedValue(new Error("Database error"));

    await controller.getAds({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
});

test("AV-01: Handle database error when saving an ad", async function() {
    const res = makeResponse();
    adsDao.createAd.mockRejectedValue(new Error("Database error"));

    await controller.createAd({ body: sampleAd }, res);

    expect(res.status).toHaveBeenCalledWith(500);
});

// AV-01 and AV-02: Active advertisements

test("Get active lobby advertisements", async function() {
    const res = makeResponse();
    adsDao.readActive.mockResolvedValue([sampleAd]);

    await controller.getActiveAds(
        { params: { placement: "lobby" } },
        res
    );

    expect(adsDao.readActive).toHaveBeenCalledWith("lobby");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([sampleAd]);
});

test("Get active table advertisements", async function() {
    const res = makeResponse();
    adsDao.readActive.mockResolvedValue([]);

    await controller.getActiveAds(
        { params: { placement: "table" } },
        res
    );

    expect(adsDao.readActive).toHaveBeenCalledWith("table");
    expect(res.status).toHaveBeenCalledWith(200);
});

test("Reject an invalid advertisement location", async function() {
    const res = makeResponse();

    await controller.getActiveAds(
        { params: { placement: "other" } },
        res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(adsDao.readActive).not.toHaveBeenCalled();
});

test("Handle database error when loading active ads", async function() {
    const res = makeResponse();
    adsDao.readActive.mockRejectedValue(new Error("Database error"));

    await controller.getActiveAds(
        { params: { placement: "lobby" } },
        res
    );

    expect(res.status).toHaveBeenCalledWith(500);
});
