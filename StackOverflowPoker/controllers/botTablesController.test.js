const dao = require("../dao/TablesDaoMongoose");
const rounds = require("../game/sevenStud");
const controller = require("./tablesController");

jest.mock("../dao/TablesDaoMongoose", () => ({
    readById: jest.fn(),
    updateStatus: jest.fn()
}));

jest.mock("../game/sevenStud", () => ({
    startRound: jest.fn(),
    playBotTurns: jest.fn(),
    getRound: jest.fn()
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

    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    jest.restoreAllMocks();
});

// BT-01: Test bot table integration

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
