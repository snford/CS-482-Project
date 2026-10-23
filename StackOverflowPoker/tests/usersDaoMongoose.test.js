const dao = require('../dao/UsersDaoMongoose');
const dbcon = require('../DbConnection');

beforeAll(async function() {
    await dbcon.connect("test");
    await dao.deleteAll("test");
});

afterAll(async function() {
    await dao.deleteAll("test");
    await dbcon.disconnect();
});

afterEach(async function() {
    await dao.deleteAll("test");
});

test('Create New User With Mongoose', async function() {
    let newUser = {
        username: "BenLovesPoker"
    };

    let created = await dao.create(newUser);
    let found = await dao.readByUsername("BenLovesPoker");

    expect(created._id).toBeDefined();
    expect(found).not.toBeNull();
    expect(found.username).toEqual(created.username);
});

test('New User Starts With No Friends', async function() {
    let created = await dao.create({ username: "Dennis" });

    expect(created.friends.length).toBe(0);
});

test('Read User That Does Not Exist', async function() {
    let found = await dao.readByUsername("NoOneHasThisName");

    expect(found).toBeNull();
});

test('Update User Friends List', async function() {
    let ben = await dao.create({ username: "Ben" });
    let dennis = await dao.create({ username: "Dennis" });

    ben.friends.push("Dennis");
    dennis.friends.push("Ben");
    await dao.update(ben);
    await dao.update(dennis);

    let foundBen = await dao.readByUsername("Ben");
    let foundDennis = await dao.readByUsername("Dennis");

    expect(foundBen.friends).toContain("Dennis");
    expect(foundDennis.friends).toContain("Ben");
});

test('Save A Friend Request', async function() {
    await dao.create({ username: "Ben" });
    let dennis = await dao.create({ username: "Dennis" });

    dennis.friendRequests.push("Ben");
    await dao.update(dennis);

    let foundDennis = await dao.readByUsername("Dennis");

    expect(foundDennis.friendRequests).toContain("Ben");
    expect(foundDennis.friends.length).toBe(0);
});

test('Delete All Only Works For Test', async function() {
    await dao.create({ username: "Ben" });

    await dao.deleteAll("prod");
    let found = await dao.readByUsername("Ben");

    expect(found).not.toBeNull();
});
