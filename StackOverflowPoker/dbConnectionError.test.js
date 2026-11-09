// A bad database address is logged instead of crashing the server
const dbcon = require("./DbConnection");

test("Connecting with a bad address logs the error", async function() {
    const savedUri = process.env.TESTDB_URI;
    process.env.TESTDB_URI = "not-a-database-address";
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
        await dbcon.connect("test");

        expect(log).toHaveBeenCalledWith(expect.any(Error));
    } finally {
        process.env.TESTDB_URI = savedUri;
        log.mockRestore();
    }
});
