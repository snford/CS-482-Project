
const gameRounds = require("./sevenStud");
const pokerBot = require("./pokerBot");

// BT-01: Test bot gameplay
const tableId = "bot-test";

// startRound is async (it takes antes), and the human goes first in these tests
async function startGame() {
    const round = await gameRounds.startRound(tableId, [
        { username: "Human" },
        {
            username: "Bot 1",
            isBot: true,
            difficulty: "easy"
        }
    ]);
    round.currentPlayer = 0;
    return round;
}

afterEach(function() {
    gameRounds.endRound(tableId);
    jest.restoreAllMocks();
});

test("Bot checks after the human checks", async function() {
    const round = await startGame();

    gameRounds.check(tableId, "Human");
    gameRounds.playBotTurns(tableId);

    expect(round.street).toBe(4);
    expect(round.currentPlayer).toBe(0);
    expect(round.players[1].hand.cards.length).toBe(4);
});

test("Bot calls a human player's raise", async function() {
    const round = await startGame();

    gameRounds.raise(tableId, "Human", 5);
    gameRounds.playBotTurns(tableId);

    expect(round.pot).toBe(10);
    expect(round.players[1].totalBet).toBe(5);
    expect(round.street).toBe(4);
});

test("Human and bot can finish a full round", async function() {
    const round = await startGame();

    for (let i = 0; i < 10 && round.status === "betting"; i++) {
        gameRounds.check(tableId, "Human");
        gameRounds.playBotTurns(tableId);
    }

    expect(round.status).toBe("complete");
    expect(round.winners.length).toBeGreaterThan(0);
    expect(round.players[0].hand.cards.length).toBe(7);
    expect(round.players[1].hand.cards.length).toBe(7);
});

