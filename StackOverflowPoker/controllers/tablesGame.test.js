// PG-01, PG-02, BT-01: Tests for the game routes (start, view, fold, check, call, raise)
jest.mock("../dao/TablesDaoMongoose", () => ({
    readById: jest.fn(),
    updateStatus: jest.fn()
}));
jest.mock("../game/sevenStud");
jest.mock("../game/chipHelper");

const dao = require("../dao/TablesDaoMongoose");
const sevenStud = require("../game/sevenStud");
const chipHelper = require("../game/chipHelper");
const controller = require("./tablesController");

const tableId = "507f1f77bcf86cd799439011";

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

// A request from a signed-in player
function asPlayer(name, extra) {
    return Object.assign({ user: { username: name }, session: {}, params: { tableId }, body: {} }, extra);
}

function waitingTable(players, bots, maxPlayers) {
    return { _id: tableId, players: players, bots: bots || "off", maxPlayers: maxPlayers || 7, status: "waiting" };
}

// A round as the game engine would return it
function roundWith(players, extra) {
    return Object.assign({
        street: 3,
        status: "betting",
        pot: 0,
        currentBet: 0,
        currentPlayer: 0,
        players: players.map(p => Object.assign({
            isBot: false,
            streetBet: 0,
            hand: { cards: [] }
        }, p))
    }, extra);
}

function cards(n) {
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({ rank: String(i + 2), suit: "Hearts" });
    }
    return list;
}

let errorLog;

beforeEach(function() {
    jest.resetAllMocks();
    errorLog = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(function() {
    errorLog.mockRestore();
    jest.useRealTimers();
});

describe("PG-01 Start A Round", function() {

    test("Invalid table id", async function() {
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben", { params: { tableId: "nope" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Table not found", async function() {
        dao.readById.mockResolvedValue(null);
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Only players seated at the table can start", async function() {
        dao.readById.mockResolvedValue(waitingTable(["Amy", "Cal"]));
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("Signed-out visitors cannot start", async function() {
        dao.readById.mockResolvedValue(waitingTable(["Amy", "Cal"]));
        const res = makeResponse();

        await controller.startRound({ session: {}, params: { tableId } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("A game already playing cannot start again", async function() {
        const table = waitingTable(["Ben", "Amy"]);
        table.status = "playing";
        dao.readById.mockResolvedValue(table);
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("One player and no bots is not enough", async function() {
        dao.readById.mockResolvedValue(waitingTable(["Ben"]));
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(sevenStud.startRound).not.toHaveBeenCalled();
    });

    test("Two players start a round with the table's ante and bet sizes", async function() {
        const table = waitingTable(["Ben", "Amy"]);
        table.ante = "5/10/20/40";
        dao.readById.mockResolvedValue(table);
        dao.updateStatus.mockResolvedValue({ status: "playing" });
        sevenStud.startRound.mockResolvedValue(roundWith([
            { username: "Ben", hand: { cards: cards(3) } },
            { username: "Amy", hand: { cards: cards(3) } }
        ]));
        const res = makeResponse();
        const req = asPlayer("Ben");

        await controller.startRound(req, res);

        // ante 5, bring-in 10, small bet 20, big bet 40
        expect(sevenStud.startRound).toHaveBeenCalledWith(tableId, [
            { username: "Ben", isBot: false },
            { username: "Amy", isBot: false }
        ], 5, 10, 20, 40, req);
        expect(dao.updateStatus).toHaveBeenCalledWith(tableId, "playing");
        expect(sevenStud.playBotTurns).toHaveBeenCalledWith(tableId);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json.mock.calls[0][0].players).toEqual([
            { username: "Ben", cardCount: 3 },
            { username: "Amy", cardCount: 3 }
        ]);
    });

    test("BT-01: Empty seats are filled with bots", async function() {
        // A human already called "Bot 1", so the bots skip that name
        dao.readById.mockResolvedValue(waitingTable(["Ben", "Bot 1"], "hard", 4));
        dao.updateStatus.mockResolvedValue({ status: "playing" });
        sevenStud.startRound.mockReturnValue(roundWith([]));
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(sevenStud.startRound.mock.calls[0][1]).toEqual([
            { username: "Ben", isBot: false },
            { username: "Bot 1", isBot: false },
            { username: "Bot 2", isBot: true, difficulty: "hard" },
            { username: "Bot 3", isBot: true, difficulty: "hard" }
        ]);
    });

    test("Table disappears while starting", async function() {
        dao.readById.mockResolvedValue(waitingTable(["Ben", "Amy"]));
        dao.updateStatus.mockResolvedValue(null);
        sevenStud.startRound.mockReturnValue(roundWith([]));
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Database error while starting", async function() {
        dao.readById.mockRejectedValue(new Error("Database error"));
        const res = makeResponse();

        await controller.startRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PG-01 View The Round", function() {

    test("Invalid table id", async function() {
        const res = makeResponse();

        await controller.getRound(asPlayer("Ben", { params: { tableId: "nope" } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("No round at this table", async function() {
        sevenStud.getRound.mockReturnValue(null);
        const res = makeResponse();

        await controller.getRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Signed-out visitors cannot see the round", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Ben" }]));
        const res = makeResponse();

        await controller.getRound({ session: {}, params: { tableId } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
    });

    test("Players not in the round cannot see it", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Amy" }]));
        const res = makeResponse();

        await controller.getRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(403);
    });

    test("Other players' hole cards stay hidden", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([
            { username: "Ben", hand: { cards: cards(3) } },
            { username: "Amy", hand: { cards: cards(3) } }
        ], { pot: 12 }));
        const res = makeResponse();

        await controller.getRound(asPlayer("Ben"), res);
        const view = res.json.mock.calls[0][0];

        expect(view.pot).toBe(12);
        expect(view.currentPlayer).toBe("Ben");
        expect(view.winners).toEqual([]);
        // Ben sees all of his own cards
        expect(view.players[0].cards.every(c => c.hidden === false)).toBe(true);
        // Ben only sees Amy's face-up third card
        expect(view.players[1].cards[0]).toEqual({ hidden: true });
        expect(view.players[1].cards[1]).toEqual({ hidden: true });
        expect(view.players[1].cards[2]).toEqual({ rank: "4", suit: "Hearts", hidden: false });
    });

    test("BT-01: A finished round pays real winners once, then resets the table", async function() {
        jest.useFakeTimers();
        const round = roundWith([
            { username: "Ben" },
            { username: "Bot 1", isBot: true },
            { username: "Amy" }
        ], {
            status: "complete",
            winners: [
                { username: "Ben", winnings: 30 },
                { username: "Bot 1", winnings: 30 },
                { username: "Amy", winnings: 0 }
            ]
        });
        sevenStud.getRound.mockReturnValue(round);
        const req = asPlayer("Ben");

        await controller.getRound(req, makeResponse());
        await controller.getRound(req, makeResponse());

        // Only Ben gets paid: bots and empty winnings are skipped, and only once
        expect(chipHelper.addChips).toHaveBeenCalledTimes(1);
        expect(chipHelper.addChips).toHaveBeenCalledWith(req, "Ben", 30);
        expect(round.winningsAwarded).toBe(true);

        // Ten seconds later the table goes back to waiting
        await jest.advanceTimersByTimeAsync(10000);
        expect(dao.updateStatus).toHaveBeenCalledWith(tableId, "waiting");
        expect(sevenStud.endRound).toHaveBeenCalledWith(tableId);
    });

    test("Error while loading the round", async function() {
        sevenStud.getRound.mockImplementation(() => { throw new Error("broken"); });
        const res = makeResponse();

        await controller.getRound(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});

describe("PG-02 Betting Actions", function() {

    test("Fold, then the bots take their turns", async function() {
        sevenStud.fold.mockReturnValue({ status: "betting" });
        const res = makeResponse();

        await controller.fold(asPlayer("Ben"), res);

        expect(sevenStud.fold).toHaveBeenCalledWith(tableId, "Ben");
        expect(sevenStud.playBotTurns).toHaveBeenCalledWith(tableId);
        expect(res.json).toHaveBeenCalledWith({ status: "betting" });
    });

    test("Fold error", async function() {
        sevenStud.fold.mockImplementation(() => { throw new Error("Player not found"); });
        const res = makeResponse();

        await controller.fold(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ msg: "Player not found" });
    });

    test("Check, then the bots take their turns", async function() {
        sevenStud.check.mockReturnValue({ status: "betting" });
        const res = makeResponse();

        await controller.check(asPlayer("Ben"), res);

        expect(sevenStud.check).toHaveBeenCalledWith(tableId, "Ben");
        expect(sevenStud.playBotTurns).toHaveBeenCalled();
    });

    test("Check error", async function() {
        sevenStud.check.mockImplementation(() => { throw new Error("Cannot check"); });
        const res = makeResponse();

        await controller.check(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Call pays what is owed", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Ben", streetBet: 2 }], { currentBet: 6 }));
        sevenStud.call.mockReturnValue({ pot: 10 });
        const res = makeResponse();
        const req = asPlayer("Ben");

        await controller.call(req, res);

        expect(chipHelper.deductChips).toHaveBeenCalledWith(req, "Ben", 4);
        expect(sevenStud.call).toHaveBeenCalledWith(tableId, "Ben");
        expect(res.json).toHaveBeenCalledWith({ pot: 10 });
    });

    test("Call without enough chips", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Ben" }], { currentBet: 6 }));
        chipHelper.deductChips.mockRejectedValue(new Error("Not enough chips."));
        const res = makeResponse();

        await controller.call(asPlayer("Ben"), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(sevenStud.call).not.toHaveBeenCalled();
    });

    test("Early streets raise by the small bet, plus what is owed", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Ben", streetBet: 1 }],
            { currentBet: 3, street: 4, smallBet: 20, bigBet: 40 }));
        sevenStud.raise.mockReturnValue({ currentBet: 23 });
        const res = makeResponse();
        const req = asPlayer("Ben");

        await controller.raise(req, res);

        expect(chipHelper.deductChips).toHaveBeenCalledWith(req, "Ben", 22);
        expect(sevenStud.raise).toHaveBeenCalledWith(tableId, "Ben", 20);
        expect(res.json).toHaveBeenCalledWith({ currentBet: 23 });
    });

    test("From fifth street on, raises use the big bet", async function() {
        sevenStud.getRound.mockReturnValue(roundWith([{ username: "Ben" }],
            { currentBet: 0, street: 5, smallBet: 20, bigBet: 40 }));
        const req = asPlayer("Ben");

        await controller.raise(req, makeResponse());

        expect(sevenStud.raise).toHaveBeenCalledWith(tableId, "Ben", 40);
    });

    test("Raise with no round", async function() {
        sevenStud.getRound.mockReturnValue(null);
        const res = makeResponse();

        await controller.raise(asPlayer("Ben", { body: { amount: 5 } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});

test("LT-03: Database error while loading a table", async function() {
    dao.readById.mockRejectedValue(new Error("Database error"));
    const res = makeResponse();

    await controller.getTable({ params: { tableId } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
});
