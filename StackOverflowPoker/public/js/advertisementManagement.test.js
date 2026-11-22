
const fs = require("fs");
const path = require("path");

// TT-04: Test the advertisement controller without a database
jest.mock("../../dao/UsersDaoMongoose");
jest.mock("../../dao/AdsDaoMongoose");

const adsDao = require("../../dao/AdsDaoMongoose");
const adminController = require("../../controllers/adminController");

const adId = "507f1f77bcf86cd799439011";

function validAd(changes = {}) {
    return Object.assign({
        name: " Chip Sale ",
        imageUrl: " /images/sale.png ",
        linkUrl: " https://example.com ",
        placement: "lobby",
        intervalMinutes: 5,
        active: true
    }, changes);
}

function response() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

beforeEach(function() {
    jest.clearAllMocks();
});

test("TT-04: Updates an advertisement", async function() {
    const res = response();

    adsDao.updateAd.mockResolvedValue({
        _id: adId,
        name: "Chip Sale"
    });

    await adminController.updateAd({
        params: { adId: adId },
        body: validAd()
    }, res);

    expect(adsDao.updateAd).toHaveBeenCalledWith(adId, {
        name: "Chip Sale",
        imageUrl: "/images/sale.png",
        linkUrl: "https://example.com",
        placement: "lobby",
        intervalMinutes: 5,
        active: true
    });

    expect(res.status).toHaveBeenCalledWith(200);
});

test.each([true, false])(
    "TT-04: Can set active to %s",
    async function(active) {
        const res = response();

        adsDao.updateAd.mockResolvedValue({
            _id: adId,
            active: active
        });

        await adminController.updateAd({
            params: { adId: adId },
            body: validAd({ active: active })
        }, res);

        expect(adsDao.updateAd.mock.calls[0][1].active)
            .toBe(active);

        expect(res.status).toHaveBeenCalledWith(200);
    }
);

test("TT-04: Rejects an invalid advertisement ID", async function() {
    const res = response();

    await adminController.updateAd({
        params: { adId: "bad" },
        body: validAd()
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(adsDao.updateAd).not.toHaveBeenCalled();
});

test.each([
    ["empty name", { name: " " }],
    ["invalid placement", { placement: "home" }],
    ["invalid interval", { intervalMinutes: 0 }],
    ["invalid active field", { active: "yes" }]
])("TT-04: Rejects %s", async function(label, change) {
    const res = response();

    await adminController.updateAd({
        params: { adId: adId },
        body: validAd(change)
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(adsDao.updateAd).not.toHaveBeenCalled();
});

test("TT-04: Returns 404 when updating a missing ad", async function() {
    const res = response();

    adsDao.updateAd.mockResolvedValue(null);

    await adminController.updateAd({
        params: { adId: adId },
        body: validAd()
    }, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("TT-04: Deletes an advertisement", async function() {
    const res = response();

    adsDao.deleteAd.mockResolvedValue({
        _id: adId
    });

    await adminController.deleteAd({
        params: { adId: adId }
    }, res);

    expect(adsDao.deleteAd).toHaveBeenCalledWith(adId);
    expect(res.status).toHaveBeenCalledWith(200);
});

test("TT-04: Rejects a bad ID when deleting", async function() {
    const res = response();

    await adminController.deleteAd({
        params: { adId: "bad" }
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(adsDao.deleteAd).not.toHaveBeenCalled();
});

test("TT-04: Returns 404 when deleting a missing ad", async function() {
    const res = response();

    adsDao.deleteAd.mockResolvedValue(null);

    await adminController.deleteAd({
        params: { adId: adId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("TT-04: Edit and delete routes require an administrator", function() {
    const app = fs.readFileSync(
        path.join(__dirname, "..", "..", "app.js"),
        "utf8"
    );

    expect(app).toMatch(
        /app\.put\(\s*"\/api\/admin\/ads\/:adId",\s*requireAdmin,\s*adminController\.updateAd/
    );

    expect(app).toMatch(
        /app\.delete\(\s*"\/api\/admin\/ads\/:adId",\s*requireAdmin,\s*adminController\.deleteAd/
    );
});
