const mongoose = require("mongoose");
const dao = require("./AdsDaoMongoose");
const Ad = mongoose.model("Ad");

// AV-01 and AV-02: Test advertisement database functions
const sampleAd = {
    name: "Test Advertisement",
    imageUrl: "/images/test.png",
    linkUrl: "https://example.com",
    placement: "lobby",
    intervalMinutes: 5,
    active: true
};

afterEach(function() {
    jest.restoreAllMocks();
});

test("AV-01: Create an advertisement", async function() {
    const save = jest.spyOn(Ad.prototype, "save")
        .mockResolvedValue();

    const ad = await dao.createAd(sampleAd);

    expect(save).toHaveBeenCalled();
    expect(ad.name).toBe("Test Advertisement");
    expect(ad.placement).toBe("lobby");
    expect(ad.active).toBe(true);
});

test("AV-01: Get all advertisements", async function() {
    jest.spyOn(Ad, "find").mockResolvedValue([sampleAd]);

    const ads = await dao.readAll();

    expect(ads).toEqual([sampleAd]);
    expect(Ad.find).toHaveBeenCalled();
});

test("AV-01: Return empty list when there are no ads", async function() {
    jest.spyOn(Ad, "find").mockResolvedValue([]);

    const ads = await dao.readAll();

    expect(ads).toEqual([]);
});

test("AV-01: Get active lobby advertisements", async function() {
    jest.spyOn(Ad, "find").mockResolvedValue([sampleAd]);

    const ads = await dao.readActive("lobby");

    expect(Ad.find).toHaveBeenCalledWith({
        placement: "lobby",
        active: true
    });
    expect(ads).toEqual([sampleAd]);
});

test("AV-01: Get active table advertisements", async function() {
    jest.spyOn(Ad, "find").mockResolvedValue([]);

    await dao.readActive("table");

    expect(Ad.find).toHaveBeenCalledWith({
        placement: "table",
        active: true
    });
});

test("AV-01: No active ads available", async function() {
    jest.spyOn(Ad, "find").mockResolvedValue([]);

    const ads = await dao.readActive("lobby");

    expect(ads).toEqual([]);
});

test("AV-02: New ad uses default rotation interval", function() {
    const ad = new Ad({
        name: "Test",
        imageUrl: "/images/test.png",
        linkUrl: "https://example.com",
        placement: "lobby"
    });

    expect(ad.intervalMinutes).toBe(5);
    expect(ad.active).toBe(true);
});

test("AV-02: Reject rotation interval below one minute", function() {
    const ad = new Ad({
        ...sampleAd,
        intervalMinutes: 0
    });

    const error = ad.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.intervalMinutes).toBeDefined();
});

test("AV-01: Reject an invalid advertisement placement", function() {
    const ad = new Ad({
        ...sampleAd,
        placement: "home"
    });

    const error = ad.validateSync();

    expect(error).toBeDefined();
    expect(error.errors.placement).toBeDefined();
});

test("AV-01: Handle database error when saving", async function() {
    jest.spyOn(Ad.prototype, "save")
        .mockRejectedValue(new Error("Save failed"));

    await expect(dao.createAd(sampleAd))
        .rejects.toThrow("Save failed");
});
