
const gameRounds = require("./sevenStud");
const pokerBot = require("./pokerBot");

// BT-01: Test bot gameplay
const tableId = "bot-test";

function startGame() {
    return gameRounds.startRound(tableId, [
        { username: "Human" },
        {
            username: "Bot 1",
            isBot: true,
            difficulty: "easy"
        }
    ]);
}

afterEach(function() {
    gameRounds.endRound(tableId);
    jest.restoreAllMocks();
});

test("Game starts with a human and a bot", function() {
    const round = startGame();

    expect(round.players.length).toBe(2);
    expect(round.players[0].isBot).toBe(false);
    expect(round.players[1].isBot).toBe(true);
    expect(round.players[1].difficulty).toBe("easy");
});

test("Bots wait for the human player", function() {
    const round = startGame();

    gameRounds.playBotTurns(tableId);

    expect(round.currentPlayer).toBe(0);
    expect(round.street).toBe(3);
});

test("Bot checks after the human checks", function() {
    const round = startGame();

    gameRounds.check(tableId, "Human");
    gameRounds.playBotTurns(tableId);

    expect(round.street).toBe(4);
    expect(round.currentPlayer).toBe(0);
    expect(round.players[1].hand.cards.length).toBe(4);
});

test("Bot calls a human player's raise", function() {
    const round = startGame();

    gameRounds.raise(tableId, "Human", 5);
    gameRounds.playBotTurns(tableId);

    expect(round.pot).toBe(10);
    expect(round.players[1].totalBet).toBe(5);
    expect(round.street).toBe(4);
});

test("Bot can fold", function() {
    const round = startGame();

    jest.spyOn(pokerBot, "chooseAction")
        .mockReturnValue("fold");

    gameRounds.check(tableId, "Human");
    gameRounds.playBotTurns(tableId);

    expect(round.players[1].folded).toBe(true);
    expect(round.status).toBe("complete");
    expect(round.winners[0].username).toBe("Human");
});

test("Bot can raise", function() {
    const round = startGame();

    jest.spyOn(pokerBot, "chooseAction")
        .mockReturnValue("raise");

    gameRounds.check(tableId, "Human");
    gameRounds.playBotTurns(tableId);

    expect(round.currentBet).toBe(1);
    expect(round.pot).toBe(1);
    expect(round.currentPlayer).toBe(0);
});

test("Human and bot can finish a full round", function() {
    const round = startGame();

    while (round.status === "betting") {
        gameRounds.check(tableId, "Human");
        gameRounds.playBotTurns(tableId);
    }

    expect(round.status).toBe("complete");
    expect(round.winners.length).toBeGreaterThan(0);
    expect(round.players[0].hand.cards.length).toBe(7);
    expect(round.players[1].hand.cards.length).toBe(7);
});

test("No bot turns when round does not exist", function() {
    expect(gameRounds.playBotTurns("missing-table")).toBe(null);
});
