
const pokerBot = require("./pokerBot");

// BT-01: Test bot decisions
function makePlayer(ranks, streetBet = 0) {
    return {
        streetBet: streetBet,
        hand: {
            cards: ranks.map(rank => ({ rank: rank }))
        }
    };
}

afterEach(function() {
    jest.restoreAllMocks();
});

test("Easy bot checks when there is no bet", function() {
    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 0 };

    expect(pokerBot.chooseAction(player, round, "easy")).toBe("check");
});

test("Easy bot calls when there is a bet", function() {
    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "easy")).toBe("call");
});

test("Medium bot sometimes folds", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.1);

    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "medium")).toBe("fold");
});

test("Medium bot sometimes raises", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.9);

    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 0 };

    expect(pokerBot.chooseAction(player, round, "medium")).toBe("raise");
});

test("Medium bot calls when there is a bet", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.5);

    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "medium")).toBe("call");
});

test("Hard bot raises with a pair", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.8);

    const player = makePlayer(["7", "7", "K"]);
    const round = { currentBet: 0 };

    expect(pokerBot.chooseAction(player, round, "hard")).toBe("raise");
});

test("Hard bot sometimes folds with weak cards", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.2);

    const player = makePlayer(["3", "5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "hard")).toBe("fold");
});

test("Hard bot calls with a high card", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.2);

    const player = makePlayer(["A", "5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "hard")).toBe("call");
});

test("Hard bot checks when there is no bet", function() {
    jest.spyOn(Math, "random").mockReturnValue(0.2);

    const player = makePlayer(["3", "5", "9"]);
    const round = { currentBet: 0 };

    expect(pokerBot.chooseAction(player, round, "hard")).toBe("check");
});

test("Bot uses basic action for unknown difficulty", function() {
    const player = makePlayer(["5", "9"]);
    const round = { currentBet: 5 };

    expect(pokerBot.chooseAction(player, round, "unknown")).toBe("call");
});
