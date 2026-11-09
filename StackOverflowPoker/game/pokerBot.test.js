// BT-01: Tests for how poker bots choose an action
const pokerBot = require("./pokerBot");

// A bot holding the given ranks, with streetBet already in the pot this street
function bot(ranks, streetBet) {
    return {
        streetBet: streetBet || 0,
        hand: { cards: ranks.map(rank => ({ rank: rank, suit: "Hearts" })) }
    };
}

// currentBet is what everyone has to match this street
function round(currentBet) {
    return { currentBet: currentBet };
}

function randomIs(value) {
    jest.spyOn(Math, "random").mockReturnValue(value);
}

afterEach(function() {
    jest.restoreAllMocks();
});

describe("Easy bots", function() {

    test("Call when there is a bet", function() {
        expect(pokerBot.chooseAction(bot(["2", "5"]), round(4), "easy")).toBe("call");
    });

    test("Check when there is no bet", function() {
        expect(pokerBot.chooseAction(bot(["2", "5"]), round(0), "easy")).toBe("check");
    });
});

describe("Medium bots", function() {

    test("Sometimes fold to a bet", function() {
        randomIs(0.1);

        expect(pokerBot.chooseAction(bot(["2", "5"]), round(4), "medium")).toBe("fold");
    });

    test("Never fold when nothing is owed", function() {
        randomIs(0.1);

        expect(pokerBot.chooseAction(bot(["2", "5"]), round(0), "medium")).toBe("check");
    });

    test("Sometimes raise", function() {
        randomIs(0.9);

        expect(pokerBot.chooseAction(bot(["2", "5"]), round(0), "medium")).toBe("raise");
    });

    test("Otherwise call", function() {
        randomIs(0.5);

        expect(pokerBot.chooseAction(bot(["2", "5"]), round(4), "medium")).toBe("call");
    });
});

describe("Hard bots", function() {

    test("Raise with a pair", function() {
        randomIs(0.7);

        expect(pokerBot.chooseAction(bot(["9", "9", "3"]), round(0), "hard")).toBe("raise");
    });

    test("Fold a weak hand to a bet", function() {
        randomIs(0.2);

        expect(pokerBot.chooseAction(bot(["2", "5", "7"]), round(4), "hard")).toBe("fold");
    });

    test("Call a bet with a high card", function() {
        randomIs(0.2);

        expect(pokerBot.chooseAction(bot(["A", "5", "7"]), round(4), "hard")).toBe("call");
    });

    test("Call a bet with a pair when not raising", function() {
        randomIs(0.2);

        expect(pokerBot.chooseAction(bot(["9", "9", "3"]), round(4), "hard")).toBe("call");
    });

    test("Check when nothing is owed", function() {
        randomIs(0.2);

        expect(pokerBot.chooseAction(bot(["2", "5", "7"]), round(0), "hard")).toBe("check");
    });

    test("Already matched the bet, so check", function() {
        randomIs(0.2);

        expect(pokerBot.chooseAction(bot(["K", "5"], 4), round(4), "hard")).toBe("check");
    });
});

describe("Unknown difficulty", function() {

    test("Plays like an easy bot", function() {
        expect(pokerBot.chooseAction(bot(["2", "5"]), round(4), "expert")).toBe("call");
        expect(pokerBot.chooseAction(bot(["2", "5"]), round(0), "expert")).toBe("check");
    });
});
