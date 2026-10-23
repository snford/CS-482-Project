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
