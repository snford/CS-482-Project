// PG-01, PG-02, BT-01: Tests for the Seven-Card Stud game engine
const sevenStud = require("./sevenStud");

let tableId = 0;

// Each test gets its own table so rounds never mix
function newTableId() {
    tableId++;
    return "table-" + tableId;
}

function twoPlayers() {
    return [{ username: "Ben" }, { username: "Amy" }];
}

// Both players check until the round reaches the given street
function checkUntilStreet(id, street) {
    let round = sevenStud.getRound(id);
    while (round.street < street) {
        const player = round.players[round.currentPlayer];
        round = sevenStud.check(id, player.username);
    }
    return round;
}

function card(rank, suit) {
    return { rank: rank, suit: suit };
}

afterEach(function() {
    jest.restoreAllMocks();
    sevenStud.endRound("table-" + tableId);
});

describe("PG-01 Start A Round", function() {

    test("Fewer than two players is rejected", function() {
        expect(() => sevenStud.startRound(newTableId(), [{ username: "Ben" }])).toThrow("2 to 7 players");
    });

    test("More than seven players is rejected", function() {
        const players = [];
        for (let i = 0; i < 8; i++) {
            players.push({ username: "P" + i });
        }

        expect(() => sevenStud.startRound(newTableId(), players)).toThrow("2 to 7 players");
    });

    test("Players must be a list", function() {
        expect(() => sevenStud.startRound(newTableId(), null)).toThrow("2 to 7 players");
    });

    test("Each player starts with three cards", function() {
        const round = sevenStud.startRound(newTableId(), twoPlayers());

        expect(round.street).toBe(3);
        expect(round.status).toBe("betting");
        expect(round.players[0].hand.cards.length).toBe(3);
        expect(round.players[1].hand.cards.length).toBe(3);
        expect(round.deck.length).toBe(52 - 6);
    });

    test("Players are humans on easy unless told otherwise", function() {
        const round = sevenStud.startRound(newTableId(), [
            { username: "Ben" },
            { username: "Bot 1", isBot: true, difficulty: "hard" }
        ]);

        expect(round.players[0].isBot).toBe(false);
        expect(round.players[0].difficulty).toBe("easy");
        expect(round.players[1].isBot).toBe(true);
        expect(round.players[1].difficulty).toBe("hard");
    });

    test("The round can be found again by table id", function() {
        const id = newTableId();
        const round = sevenStud.startRound(id, twoPlayers());

        expect(sevenStud.getRound(id)).toBe(round);
    });

    test("No round for a table that never started", function() {
        expect(sevenStud.getRound("no-such-table")).toBeNull();
    });

    test("Ending a round removes it", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        sevenStud.endRound(id);

        expect(sevenStud.getRound(id)).toBeNull();
    });
});

describe("PG-02 Fold", function() {

    test("Last player left wins the pot", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 5);

        const round = sevenStud.fold(id, "Amy");

        expect(round.status).toBe("complete");
        expect(round.winners).toEqual([{ username: "Ben", hand: "Last Player Remaining", winnings: 5 }]);
    });

    test("Folding passes the turn and skips folded players", function() {
        const id = newTableId();
        sevenStud.startRound(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);

        // The turn moves on from Ben, skips Amy (folded), and lands on Cal
        const round = sevenStud.fold(id, "Amy");

        expect(round.status).toBe("betting");
        expect(round.players[round.currentPlayer].username).toBe("Cal");
    });

    test("Unknown player cannot fold", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        expect(() => sevenStud.fold(id, "Ghost")).toThrow("Player not found");
    });
});

describe("PG-02 Check, Call And Raise", function() {

    test("Checking passes the turn", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        const round = sevenStud.check(id, "Ben");

        expect(round.currentPlayer).toBe(1);
        expect(round.street).toBe(3);
    });

    test("When everyone checks, the next card is dealt", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        sevenStud.check(id, "Ben");
        const round = sevenStud.check(id, "Amy");

        expect(round.street).toBe(4);
        expect(round.players[0].hand.cards.length).toBe(4);
        expect(round.currentPlayer).toBe(0);
    });

    test("Cannot check when there is a bet to call", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        expect(() => sevenStud.check(id, "Amy")).toThrow("Cannot check");
    });

    test("Raising adds to the pot and the current bet", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        const round = sevenStud.raise(id, "Ben", 4);

        expect(round.pot).toBe(4);
        expect(round.currentBet).toBe(4);
        expect(round.players[0].streetBet).toBe(4);
        expect(round.currentPlayer).toBe(1);
    });

    test("Re-raising pays the call plus the raise", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        const round = sevenStud.raise(id, "Amy", 2);

        expect(round.players[1].streetBet).toBe(6);
        expect(round.currentBet).toBe(6);
        expect(round.pot).toBe(10);
        // Ben has to act again after the raise
        expect(round.players[0].acted).toBe(false);
    });

    test("Calling matches the bet and ends the betting round", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        const round = sevenStud.call(id, "Amy");

        expect(round.pot).toBe(8);
        expect(round.street).toBe(4);
        expect(round.currentBet).toBe(0);
    });

    test("Calling before everyone acted passes the turn", function() {
        const id = newTableId();
        sevenStud.startRound(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);
        sevenStud.raise(id, "Ben", 2);

        const round = sevenStud.call(id, "Amy");

        expect(round.street).toBe(3);
        expect(round.players[round.currentPlayer].username).toBe("Cal");
    });

    test("Raising at a table with no round is rejected", function() {
        expect(() => sevenStud.raise("no-such-table", "Ben", 2)).toThrow("Round not found");
    });

    test("Unknown player cannot raise", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        expect(() => sevenStud.raise(id, "Ghost", 2)).toThrow("Player not found");
    });
});

describe("PG-02 Showdown", function() {

    test("After seventh street the best hand wins", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());

        const round = checkUntilStreet(id, 8);

        expect(round.status).toBe("complete");
        expect(round.players[0].hand.cards.length).toBe(7);
        expect(round.winners.length).toBeGreaterThan(0);
        expect(typeof round.winners[0].hand).toBe("string");
    });

    test("The stronger hand takes the whole pot", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 10);
        sevenStud.call(id, "Amy");
        const round = checkUntilStreet(id, 7);

        // Four aces against a junk hand
        round.players[0].hand.cards = [
            card("A", "Hearts"), card("A", "Spades"), card("A", "Clubs"), card("A", "Diamonds"),
            card("2", "Hearts"), card("10", "Clubs"), card("K", "Spades")
        ];
        round.players[1].hand.cards = [
            card("2", "Clubs"), card("4", "Diamonds"), card("6", "Hearts"), card("8", "Spades"),
            card("9", "Clubs"), card("J", "Diamonds"), card("3", "Spades")
        ];
        sevenStud.check(id, "Ben");
        sevenStud.check(id, "Amy");

        expect(round.status).toBe("complete");
        expect(round.winners).toEqual([{ username: "Ben", hand: "Four of a Kind", winnings: 20 }]);
        expect(round.players[0].winnings).toBe(20);
    });

    test("A tie splits the pot", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        sevenStud.raise(id, "Ben", 5);
        sevenStud.call(id, "Amy");
        const round = checkUntilStreet(id, 7);

        const sameHand = function(suit) {
            return [
                card("A", suit), card("K", suit === "Hearts" ? "Clubs" : "Diamonds"),
                card("Q", suit), card("J", suit === "Hearts" ? "Clubs" : "Diamonds"),
                card("9", suit), card("7", suit === "Hearts" ? "Clubs" : "Diamonds"), card("2", "Spades")
            ];
        };
        round.players[0].hand.cards = sameHand("Hearts");
        round.players[1].hand.cards = sameHand("Spades");
        sevenStud.check(id, "Ben");
        sevenStud.check(id, "Amy");

        expect(round.winners.length).toBe(2);
        expect(round.winners[0].winnings).toBe(5);
        expect(round.winners[1].winnings).toBe(5);
    });

    test("Folded players cannot win at showdown", function() {
        const id = newTableId();
        sevenStud.startRound(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);
        sevenStud.fold(id, "Ben");

        const round = checkUntilStreet(id, 8);

        expect(round.status).toBe("complete");
        expect(round.winners.map(w => w.username)).not.toContain("Ben");
        expect(round.players[0].hand.cards.length).toBe(3);
    });

    test("Showdown with nobody left is an error", function() {
        const id = newTableId();
        sevenStud.startRound(id, twoPlayers());
        const round = checkUntilStreet(id, 7);
        round.players.forEach(p => { p.folded = true; });

        expect(() => sevenStud.check(id, "Ben")).toThrow("No players remaining.");
    });

    test("If everyone has folded, the next street starts with seat 0", function() {
        const id = newTableId();
        const round = sevenStud.startRound(id, twoPlayers());
        round.players.forEach(p => { p.folded = true; });

        sevenStud.check(id, "Ben");

        expect(round.street).toBe(4);
        expect(round.currentPlayer).toBe(0);
    });
});

describe("BT-01 Bot Turns", function() {

    test("No round means no bot turns", function() {
        expect(sevenStud.playBotTurns("no-such-table")).toBeNull();
    });

    test("Bots stop when it is a human's turn", function() {
        const id = newTableId();
        sevenStud.startRound(id, [
            { username: "Bot 1", isBot: true, difficulty: "easy" },
            { username: "Ben" }
        ]);

        const round = sevenStud.playBotTurns(id);

        expect(round.players[0].acted).toBe(true);
        expect(round.players[round.currentPlayer].username).toBe("Ben");
    });

    test("A table of bots plays itself to the end", function() {
        const id = newTableId();
        sevenStud.startRound(id, [
            { username: "Bot 1", isBot: true, difficulty: "easy" },
            { username: "Bot 2", isBot: true, difficulty: "easy" }
        ]);

        const round = sevenStud.playBotTurns(id);

        expect(round.status).toBe("complete");
    });

    test("Bots can raise and call", function() {
        const id = newTableId();
        sevenStud.startRound(id, [
            { username: "Bot 1", isBot: true, difficulty: "medium" },
            { username: "Bot 2", isBot: true, difficulty: "easy" },
            { username: "Ben" }
        ]);
        // The medium bot raises, then the easy bot calls
        jest.spyOn(Math, "random").mockReturnValue(0.9);

        const round = sevenStud.playBotTurns(id);

        expect(round.players[0].streetBet).toBe(1);
        expect(round.players[1].streetBet).toBe(1);
        expect(round.players[round.currentPlayer].username).toBe("Ben");
    });

    test("Bots can fold", function() {
        const id = newTableId();
        const round = sevenStud.startRound(id, [
            { username: "Ben" },
            { username: "Bot 1", isBot: true, difficulty: "medium" },
            { username: "Amy" }
        ]);
        sevenStud.raise(id, "Ben", 3);
        // Low random number: the medium bot folds to the raise
        jest.spyOn(Math, "random").mockReturnValue(0.1);

        sevenStud.playBotTurns(id);

        expect(round.players[1].folded).toBe(true);
        expect(round.players[round.currentPlayer].username).toBe("Amy");
    });
});
