
jest.mock("../dao/messageDaoMongoose");

const dao = require("../dao/messageDaoMongoose");
const controller = require("./chatLogsController");

const res = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

beforeEach(() => {
    jest.clearAllMocks();
});

// Test 1: Regular players cannot access logs
test("AM-03 rejects regular players", async () => {
    const response = res();

    await controller.getLogs({
        user: { role: "player" },
        query: {}
    }, response);

    expect(response.status).toHaveBeenCalledWith(403);

    expect(dao.searchChatLogs).not.toHaveBeenCalled();
});

// Test 2: Admin can retrieve paginated logs
test("AM-03 returns paginated logs to admin", async () => {
    dao.searchChatLogs.mockResolvedValue({
        messages: [],
        total: 0,
        page: 1,
        limit: 25
    });

    const response = res();

    await controller.getLogs({
        user: { role: "admin" },
        query: {
            type: "table",
            page: "1"
        }
    }, response);

    expect(dao.searchChatLogs).toHaveBeenCalledWith({
        type: "table",
        player: "",
        search: "",
        page: 1,
        limit: 25
    });

    expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
            total: 0
        })
    );
});

// Test 3: Reject invalid chat filters
test("AM-03 rejects invalid filters", async () => {
    const response = res();

    await controller.getLogs({
        user: { role: "admin" },
        query: {
            type: "invalid"
        }
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
});

// Test 4: Reject invalid page numbers
test("AM-03 rejects invalid pagination", async () => {
    const response = res();

    await controller.getLogs({
        user: { role: "admin" },
        query: {
            page: "-5"
        }
    }, response);

    expect(response.status).toHaveBeenCalledWith(400);
});

// Test 5: Handle database errors
test("AM-03 handles database errors", async () => {
    dao.searchChatLogs.mockRejectedValue(
        new Error("database offline")
    );

    const response = res();

    const spy = jest.spyOn(console, "error")
        .mockImplementation(() => {});

    await controller.getLogs({
        user: { role: "admin" },
        query: {}
    }, response);

    expect(response.status).toHaveBeenCalledWith(500);

    spy.mockRestore();
});
