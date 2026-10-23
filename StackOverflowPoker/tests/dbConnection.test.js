const mongoose = require("mongoose");
const dbcon = require('../DbConnection');

beforeAll(async function() {
    await dbcon.connect("test");
});

afterAll(async function() {
    await dbcon.disconnect();
});

test('Connect to test database', async function() {
    expect(mongoose.connection.readyState).toBe(1);
});
