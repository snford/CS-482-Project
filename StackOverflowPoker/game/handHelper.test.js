// UP-04: Tests for the hand helper
const handHelper = require("./handHelper");

// "A♥" style shorthand: card("A", "Hearts")
function card(rank, suit) {
    return { rank: rank, suit: suit };
}

describe("UP-04 Naming The Hand", function() {

    test("No cards means nothing to describe", function() {
        expect(handHelper.describeHand([])).toBeNull();
        expect(handHelper.describeHand(undefined)).toBeNull();
    });

    test("High card on third street", function() {
        const hand = handHelper.describeHand([card("A", "Hearts"), card("9", "Clubs"), card("4", "Spades")]);

        expect(hand.name).toBe("High Card");
        expect(hand.description).toBe("A High");
        expect(hand.strength).toBe(1);
        expect(hand.maxStrength).toBe(9);
        expect(hand.tip).toContain("No pair yet");
    });

    test("A pair", function() {
        const hand = handHelper.describeHand([card("K", "Hearts"), card("K", "Clubs"), card("4", "Spades")]);

        expect(hand.description).toBe("Pair, K's");
        expect(hand.strength).toBe(2);
    });

    test("Tens are read correctly", function() {
        const hand = handHelper.describeHand([card("10", "Hearts"), card("10", "Clubs"), card("2", "Spades")]);

        expect(hand.description).toBe("Pair, 10's");
    });

    test("Two pair", function() {
        const hand = handHelper.describeHand([
            card("Q", "Hearts"), card("Q", "Clubs"), card("5", "Spades"), card("5", "Hearts")
        ]);

        expect(hand.name).toBe("Two Pair");
        expect(hand.tip).toContain("solid");
    });

    test("A full house gets the right tip", function() {
        const hand = handHelper.describeHand([
            card("3", "Hearts"), card("3", "Clubs"), card("3", "Spades"), card("J", "Hearts"), card("J", "Clubs")
        ]);

        expect(hand.name).toBe("Full House");
        expect(hand.strength).toBe(7);
        expect(hand.tip).toContain("full house");
    });
});

describe("UP-04 Draws", function() {

    test("Four cards of one suit is a flush draw", function() {
        const hand = handHelper.describeHand([
            card("2", "Hearts"), card("7", "Hearts"), card("9", "Hearts"), card("K", "Hearts"), card("4", "Clubs")
        ]);

        expect(hand.draw).toContain("Flush draw");
    });

    test("Four cards in a row is a straight draw", function() {
        const hand = handHelper.describeHand([
            card("5", "Hearts"), card("6", "Clubs"), card("7", "Spades"), card("8", "Diamonds")
        ]);

        expect(hand.draw).toContain("Straight draw");
    });

    test("An ace counts low for a straight draw", function() {
        const hand = handHelper.describeHand([
            card("A", "Hearts"), card("2", "Clubs"), card("3", "Spades"), card("4", "Diamonds")
        ]);

        expect(hand.draw).toContain("Straight draw");
    });

    test("A flush draw is shown before a straight draw", function() {
        const hand = handHelper.describeHand([
            card("5", "Hearts"), card("6", "Hearts"), card("7", "Hearts"), card("8", "Hearts")
        ]);

        expect(hand.draw).toContain("Flush draw");
    });

    test("No draw with mixed cards", function() {
        const hand = handHelper.describeHand([
            card("2", "Hearts"), card("7", "Clubs"), card("9", "Spades"), card("K", "Diamonds")
        ]);

        expect(hand.draw).toBeNull();
    });

    test("No draw after the last card, since no more cards are coming", function() {
        const hand = handHelper.describeHand([
            card("2", "Hearts"), card("7", "Hearts"), card("9", "Hearts"), card("K", "Hearts"),
            card("4", "Clubs"), card("J", "Spades"), card("3", "Diamonds")
        ]);

        expect(hand.draw).toBeNull();
    });

    test("No flush draw once you already have a flush", function() {
        const hand = handHelper.describeHand([
            card("2", "Hearts"), card("7", "Hearts"), card("9", "Hearts"), card("K", "Hearts"), card("4", "Hearts")
        ]);

        expect(hand.name).toBe("Flush");
        expect(hand.draw).toBeNull();
    });

    test("No straight draw once you already have a straight", function() {
        const hand = handHelper.describeHand([
            card("5", "Hearts"), card("6", "Clubs"), card("7", "Spades"), card("8", "Diamonds"), card("9", "Clubs")
        ]);

        expect(hand.name).toBe("Straight");
        expect(hand.draw).toBeNull();
    });
});
