// AV-01: Database tests for advertisements
const mongoose = require("mongoose");
const dao = require("./AdsDaoMongoose");
const dbcon = require("../DbConnection");

const Ad = mongoose.model("Ad");

function ad(changes) {
    return Object.assign({
        name: "Chip Sale",
        imageUrl: "/images/sale.png",
        linkUrl: "https://example.com",
        placement: "lobby"
    }, changes);
}

beforeAll(async function() {
    await dbcon.connect("test");
});

beforeEach(async function() {
    await Ad.deleteMany({});
});

afterAll(async function() {
    await Ad.deleteMany({});
    await dbcon.disconnect();
});

test("AV-01: Save an ad with default settings", async function() {
    const saved = await dao.createAd(ad());

    expect(saved._id).toBeDefined();
    expect(saved.intervalMinutes).toBe(5);
    expect(saved.active).toBe(true);
});

test("AV-01: Ads need a valid placement", async function() {
    await expect(dao.createAd(ad({ placement: "home" }))).rejects.toThrow();
});

test("AV-01: Read every ad", async function() {
    await dao.createAd(ad());
    await dao.createAd(ad({ name: "Table Ad", placement: "table", active: false }));

    const ads = await dao.readAll();

    expect(ads.length).toBe(2);
});

test("AV-01: Only active ads for the requested page", async function() {
    await dao.createAd(ad({ name: "Lobby On" }));
    await dao.createAd(ad({ name: "Lobby Off", active: false }));
    await dao.createAd(ad({ name: "Table On", placement: "table" }));

    const ads = await dao.readActive("lobby");

    expect(ads.map(a => a.name)).toEqual(["Lobby On"]);
});
