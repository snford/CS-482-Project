
jest.mock("../dao/TablesDaoMongoose");
jest.mock("../game/sevenStud");

const mongoose = require("mongoose");

const dao = require("../dao/TablesDaoMongoose");
const gameRounds = require("../game/sevenStud");
const controller = require("./adminGamesController");

const tableId = new mongoose.Types.ObjectId().toString();

const admin = {
    username: "Admin",
    role: "admin"
};

const player = {
    username: "Player1",
    role: "player"
};

const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

const table = {
    _id: tableId,
    name: "Test Table",
    players: ["Player1", "Player2"],
    maxPlayers: 6,
    status: "waiting",
    privacy: "public",
    ante: "10/20/40/80",
    bots: "off"
};

beforeEach(() => {
    jest.resetAllMocks();
});

// Test 1: Administrator can retrieve tables

test("AM-06 administrator can view all tables", async () => {

    dao.readAllAdmin.mockResolvedValue([table]);

    gameRounds.getRound.mockReturnValue(null);

    const res = response();

    await controller.getGames({
        user: admin
    }, res);

    expect(res.status).toHaveBeenCalledWith(200);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            summary: expect.objectContaining({
                totalTables: 1,
                waitingTables: 1
            })
        })
    );
});

// Test 2: Regular players cannot retrieve games

test("AM-06 regular players cannot view admin games", async () => {

    const res = response();

    await controller.getGames({
        user: player
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(dao.readAllAdmin).not.toHaveBeenCalled();
});

// Test 3: Administrator can end an active game

test("AM-06 administrator can end a game", async () => {

    dao.readAdminById.mockResolvedValue({
        ...table,
        status: "playing"
    });

    dao.closeTable.mockResolvedValue({
        ...table,
        status: "closed"
    });

    gameRounds.getRound.mockReturnValue({
        status: "betting"
    });

    gameRounds.cancelRound.mockResolvedValue(true);

    const res = response();

    await controller.endGame({
        user: admin,
        params: { tableId }
    }, res);

    expect(gameRounds.cancelRound)
        .toHaveBeenCalled();

    expect(dao.closeTable)
        .toHaveBeenCalledWith(tableId);

    expect(res.status)
        .toHaveBeenCalledWith(200);
});

// Test 4: Regular players cannot end games

test("AM-06 regular players cannot end games", async () => {

    const res = response();

    await controller.endGame({
        user: player,
        params: { tableId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(gameRounds.cancelRound)
        .not.toHaveBeenCalled();
});

// Test 5: Administrator can remove waiting tables

test("AM-06 administrator can remove a table", async () => {

    dao.readAdminById.mockResolvedValue(table);

    gameRounds.getRound.mockReturnValue(null);

    dao.closeTable.mockResolvedValue({
        ...table,
        status: "closed"
    });

    dao.removeTable.mockResolvedValue(table);

    const res = response();

    await controller.removeTable({
        user: admin,
        params: { tableId }
    }, res);

    expect(dao.removeTable)
        .toHaveBeenCalledWith(tableId);

    expect(res.status)
        .toHaveBeenCalledWith(200);
});

// Test 6: Active games must be ended before removal

test("AM-06 cannot remove an active game directly", async () => {

    dao.readAdminById.mockResolvedValue({
        ...table,
        status: "playing"
    });

    gameRounds.getRound.mockReturnValue({
        status: "betting"
    });

    const res = response();

    await controller.removeTable({
        user: admin,
        params: { tableId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(dao.removeTable).not.toHaveBeenCalled();
});

// Test 7: Regular players cannot remove tables

test("AM-06 regular players cannot remove tables", async () => {

    const res = response();

    await controller.removeTable({
        user: player,
        params: { tableId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);

    expect(dao.removeTable).not.toHaveBeenCalled();
});

// Test 8: Invalid table IDs are rejected

test("AM-06 rejects invalid table IDs", async () => {

    const res = response();

    await controller.removeTable({
        user: admin,
        params: {
            tableId: "invalid"
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

// Test 9: Missing tables return 404

test("AM-06 handles missing tables", async () => {

    dao.readAdminById.mockResolvedValue(null);

    const res = response();

    await controller.removeTable({
        user: admin,
        params: { tableId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(404);
});

// Test 10: Completed games must finish payouts

test("AM-06 does not cancel completed games", async () => {

    dao.readAdminById.mockResolvedValue({
        ...table,
        status: "playing"
    });

    gameRounds.getRound.mockReturnValue({
        status: "complete"
    });

    const res = response();

    await controller.endGame({
        user: admin,
        params: { tableId }
    }, res);

    expect(res.status).toHaveBeenCalledWith(409);

    expect(gameRounds.cancelRound)
        .not.toHaveBeenCalled();
});
