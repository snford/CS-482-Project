
const dao = require("../dao/TablesDaoMongoose");
const rounds = require("../game/sevenStud");
const chips = require("../game/chipHelper");
const controller = require("./tablesController");

jest.mock("../dao/TablesDaoMongoose", () => ({
    readById: jest.fn(),
    updateStatus: jest.fn()
}));

jest.mock("../game/sevenStud", () => ({
    startRound: jest.fn(),
    playBotTurns: jest.fn(),
    getRound: jest.fn(),
    fold: jest.fn(),
    check: jest.fn(),
    call: jest.fn(),
    raise: jest.fn()
}));

jest.mock("../game/chipHelper", () => ({
    deductChips: jest.fn(),
    addChips: jest.fn()
}));

const tableId = "507f1f77bcf86cd799439011";

function makeRequest(username = "Dennis") {
    return {
        params: { tableId: tableId },
        user: username ? { username: username } : null,
        session: {},
        body: {}
    };
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function makeTable(changes = {}) {
    return {
        _id: tableId,
        players: ["Dennis"],
        maxPlayers: 4,
        bots: "easy",
        status: "waiting",
        ...changes
    };
}

beforeEach(function() {
    jest.resetAllMocks();

    dao.readById.mockResolvedValue(makeTable());
    dao.updateStatus.mockResolvedValue({ status: "playing" });

    rounds.startRound.mockImplementation(function(id, players) {
        return {
            street: 3,
            players: players.map(function(player) {
                return {
                    ...player,
                    hand: { cards: ["A", "2", "3"] }
                };
            })
        };
    });

    chips.deductChips.mockResolvedValue(100);
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    jest.restoreAllMocks();
});

// BT-01: Starting games with bots

test("Fill empty seats with easy bots", async function() {
    const res = makeResponse();

    await controller.startRound(makeRequest(), res);

    const players = rounds.startRound.mock.calls[0][1];

    expect(players.length).toBe(4);
    expect(players[0].isBot).toBe(false);
    expect(players[1].isBot).toBe(true);
    expect(players[1].difficulty).toBe("easy");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(rounds.playBotTurns).toHaveBeenCalledWith(tableId);
});

test("Fill seats with medium bots", async function() {
    dao.readById.mockResolvedValue(makeTable({ bots: "medium" }));

    await controller.startRound(makeRequest(), makeResponse());

    const players = rounds.startRound.mock.calls[0][1];

    expect(players[1].difficulty).toBe("medium");
});

test("Fill seats with hard bots", async function() {
    dao.readById.mockResolvedValue(makeTable({ bots: "hard" }));

    await controller.startRound(makeRequest(), makeResponse());

    const players = rounds.startRound.mock.calls[0][1];

    expect(players[1].difficulty).toBe("hard");
});

test("Do not reuse a human player's bot name", async function() {
    dao.readById.mockResolvedValue(makeTable({
        players: ["Dennis", "Bot 1"]
    }));

    await controller.startRound(makeRequest(), makeResponse());

    const players = rounds.startRound.mock.calls[0][1];

    expect(players.map(p => p.username)).toEqual([
        "Dennis", "Bot 1", "Bot 2", "Bot 3"
    ]);
    expect(players[1].isBot).toBe(false);
});

test("Do not add bots when bots are turned off", async function() {
    dao.readById.mockResolvedValue(makeTable({
        players: ["Dennis", "Amy"],
        bots: "off"
    }));

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    const players = rounds.startRound.mock.calls[0][1];

    expect(players.length).toBe(2);
    expect(players.every(p => !p.isBot)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
});

test("Reject an invalid table ID", async function() {
    const req = makeRequest();
    req.params.tableId = "invalid";

    const res = makeResponse();
    await controller.startRound(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(rounds.startRound).not.toHaveBeenCalled();
});

test("Reject a table that does not exist", async function() {
    dao.readById.mockResolvedValue(null);

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("Only seated players can start the game", async function() {
    const res = makeResponse();

    await controller.startRound(makeRequest("Amy"), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(rounds.startRound).not.toHaveBeenCalled();
});

test("Cannot start a game that is already playing", async function() {
    dao.readById.mockResolvedValue(makeTable({
        status: "playing"
    }));

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("Cannot start with only one human and no bots", async function() {
    dao.readById.mockResolvedValue(makeTable({
        bots: "off"
    }));

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("Handle failure when updating table status", async function() {
    dao.updateStatus.mockResolvedValue(null);

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("Handle database error when starting game", async function() {
    dao.readById.mockRejectedValue(new Error("Database error"));

    const res = makeResponse();
    await controller.startRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
});

// BT-01: Getting the round with bot players

function makeGameRound() {
    const cards = ["A", "2", "3", "4", "5", "6", "7"]
        .map(rank => ({ rank: rank, suit: "Hearts" }));

    return {
        status: "betting",
        street: 3,
        currentBet: 0,
        currentPlayer: 0,
        pot: 0,
        players: [
            {
                username: "Dennis",
                isBot: false,
                hand: { cards: cards }
            },
            {
                username: "Bot 1",
                isBot: true,
                hand: { cards: cards }
            }
        ]
    };
}

test("Reject invalid ID when loading a round", async function() {
    const req = makeRequest();
    req.params.tableId = "wrong";
    const res = makeResponse();

    await controller.getRound(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

test("Handle a missing round", async function() {
    rounds.getRound.mockReturnValue(null);
    const res = makeResponse();

    await controller.getRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(404);
});

test("Require a player name to view a round", async function() {
    rounds.getRound.mockReturnValue(makeGameRound());
    const res = makeResponse();

    await controller.getRound(makeRequest(null), res);

    expect(res.status).toHaveBeenCalledWith(401);
});

test("Reject a player who is not in the round", async function() {
    rounds.getRound.mockReturnValue(makeGameRound());
    const res = makeResponse();

    await controller.getRound(makeRequest("Amy"), res);

    expect(res.status).toHaveBeenCalledWith(403);
});

test("Show bot cards only when they are face up", async function() {
    rounds.getRound.mockReturnValue(makeGameRound());
    const res = makeResponse();

    await controller.getRound(makeRequest(), res);

    const result = res.json.mock.calls[0][0];

    expect(result.players[0].cards[0].hidden).toBe(false);
    expect(result.players[1].isBot).toBe(true);
    expect(result.players[1].cards[0].hidden).toBe(true);
    expect(result.players[1].cards[2].hidden).toBe(false);
    expect(result.players[1].cards[6].hidden).toBe(true);
});

test("Handle error when getting a round", async function() {
    rounds.getRound.mockImplementation(function() {
        throw new Error("Round error");
    });

    const res = makeResponse();
    await controller.getRound(makeRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
});

// BT-01: Bot turns after human actions

test("Bots play after human folds", async function() {
    rounds.fold.mockReturnValue({ status: "betting" });
    const res = makeResponse();

    await controller.fold(makeRequest(), res);

    expect(rounds.fold).toHaveBeenCalledWith(tableId, "Dennis");
    expect(rounds.playBotTurns).toHaveBeenCalledWith(tableId);
});

test("Bots play after human checks", async function() {
    rounds.check.mockReturnValue({ status: "betting" });
    const res = makeResponse();

    await controller.check(makeRequest(), res);

    expect(rounds.check).toHaveBeenCalledWith(tableId, "Dennis");
    expect(rounds.playBotTurns).toHaveBeenCalledWith(tableId);
});

test("Bots play after human calls", async function() {
    rounds.getRound.mockReturnValue({
        currentBet: 5,
        players: [{ username: "Dennis", streetBet: 2 }]
    });
    rounds.call.mockReturnValue({ status: "betting" });

    const req = makeRequest();
    const res = makeResponse();

    await controller.call(req, res);

    expect(chips.deductChips).toHaveBeenCalledWith(
        req, "Dennis", 3
    );
    expect(rounds.playBotTurns).toHaveBeenCalledWith(tableId);
});

test("Bots play after human raises", async function() {
    rounds.getRound.mockReturnValue({
        currentBet: 5,
        players: [{ username: "Dennis", streetBet: 2 }]
    });
    rounds.raise.mockReturnValue({ status: "betting" });

    const req = makeRequest();
    req.body.amount = 4;

    await controller.raise(req, makeResponse());

    expect(chips.deductChips).toHaveBeenCalledWith(
        req, "Dennis", 7
    );
    expect(rounds.raise).toHaveBeenCalledWith(
        tableId, "Dennis", 4
    );
    expect(rounds.playBotTurns).toHaveBeenCalledWith(tableId);
});
