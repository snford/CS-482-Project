// PG-01, PG-02, BT-01: Tests for the Seven-Card Stud game engine
const sevenStud = require("./sevenStud");
const chipHelper = require("./chipHelper");

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

// Starts a round with no ante, then gives seat 0 the first turn.
// (The real first turn goes to the lowest face-up card, which is random;
// starting at seat 0 keeps the turn-order tests predictable.)
async function start(id, players) {
    const round = await sevenStud.startRound(id, players);
    round.currentPlayer = 0;
    return round;
}

afterEach(function() {
    jest.restoreAllMocks();
    sevenStud.endRound("table-" + tableId);
});

describe("PG-01 Start A Round", function() {

    test("Fewer than two players is rejected", async function() {
        await expect(sevenStud.startRound(newTableId(), [{ username: "Ben" }])).rejects.toThrow("2 to 7 players");
    });

    test("More than seven players is rejected", async function() {
        const players = [];
        for (let i = 0; i < 8; i++) {
            players.push({ username: "P" + i });
        }

        await expect(sevenStud.startRound(newTableId(), players)).rejects.toThrow("2 to 7 players");
    });

    test("Players must be a list", async function() {
        await expect(sevenStud.startRound(newTableId(), null)).rejects.toThrow("2 to 7 players");
    });

    test("Each player starts with three cards", async function() {
        const round = await start(newTableId(), twoPlayers());

        expect(round.street).toBe(3);
        expect(round.status).toBe("betting");
        expect(round.players[0].hand.cards.length).toBe(3);
        expect(round.players[1].hand.cards.length).toBe(3);
        expect(round.deck.length).toBe(52 - 6);
    });

    test("Players are humans on easy unless told otherwise", async function() {
        const round = await start(newTableId(), [
            { username: "Ben" },
            { username: "Bot 1", isBot: true, difficulty: "hard" }
        ]);

        expect(round.players[0].isBot).toBe(false);
        expect(round.players[0].difficulty).toBe("easy");
        expect(round.players[1].isBot).toBe(true);
        expect(round.players[1].difficulty).toBe("hard");
    });

    test("The round can be found again by table id", async function() {
        const id = newTableId();
        const round = await start(id, twoPlayers());

        expect(sevenStud.getRound(id)).toBe(round);
    });

    test("No round for a table that never started", async function() {
        expect(sevenStud.getRound("no-such-table")).toBeNull();
    });

    test("Ending a round removes it", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        sevenStud.endRound(id);

        expect(sevenStud.getRound(id)).toBeNull();
    });
});

describe("PG-02 Fold", function() {

    test("Last player left wins the pot", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
        sevenStud.raise(id, "Ben", 5);

        const round = sevenStud.fold(id, "Amy");

        expect(round.status).toBe("complete");
        expect(round.winners).toEqual([{ username: "Ben", hand: "Last Player Remaining", winnings: 5 }]);
    });

    test("Folding passes the turn and skips folded players", async function() {
        const id = newTableId();
        await start(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);

        // The turn moves on from Ben, skips Amy (folded), and lands on Cal
        const round = sevenStud.fold(id, "Amy");

        expect(round.status).toBe("betting");
        expect(round.players[round.currentPlayer].username).toBe("Cal");
    });

    test("Unknown player cannot fold", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        expect(() => sevenStud.fold(id, "Ghost")).toThrow("Player not found");
    });
});

describe("PG-02 Check, Call And Raise", function() {

    test("Checking passes the turn", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        const round = sevenStud.check(id, "Ben");

        expect(round.currentPlayer).toBe(1);
        expect(round.street).toBe(3);
    });

    test("When everyone checks, the next card is dealt", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        sevenStud.check(id, "Ben");
        const round = sevenStud.check(id, "Amy");

        expect(round.street).toBe(4);
        expect(round.players[0].hand.cards.length).toBe(4);
        expect(round.currentPlayer).toBe(0);
    });

    test("Cannot check when there is a bet to call", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        expect(() => sevenStud.check(id, "Amy")).toThrow("Cannot check");
    });

    test("Raising adds to the pot and the current bet", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        const round = sevenStud.raise(id, "Ben", 4);

        expect(round.pot).toBe(4);
        expect(round.currentBet).toBe(4);
        expect(round.players[0].streetBet).toBe(4);
        expect(round.currentPlayer).toBe(1);
    });

    test("Re-raising pays the call plus the raise", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        const round = sevenStud.raise(id, "Amy", 2);

        expect(round.players[1].streetBet).toBe(6);
        expect(round.currentBet).toBe(6);
        expect(round.pot).toBe(10);
        // Ben has to act again after the raise
        expect(round.players[0].acted).toBe(false);
    });

    test("Calling matches the bet and ends the betting round", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
        sevenStud.raise(id, "Ben", 4);

        const round = sevenStud.call(id, "Amy");

        expect(round.pot).toBe(8);
        expect(round.street).toBe(4);
        expect(round.currentBet).toBe(0);
    });

    test("Calling before everyone acted passes the turn", async function() {
        const id = newTableId();
        await start(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);
        sevenStud.raise(id, "Ben", 2);

        const round = sevenStud.call(id, "Amy");

        expect(round.street).toBe(3);
        expect(round.players[round.currentPlayer].username).toBe("Cal");
    });

    test("Raising at a table with no round is rejected", async function() {
        expect(() => sevenStud.raise("no-such-table", "Ben", 2)).toThrow("Round not found");
    });

    test("Unknown player cannot raise", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        expect(() => sevenStud.raise(id, "Ghost", 2)).toThrow("Player not found");
    });
});

describe("PG-02 Showdown", function() {

    test("After seventh street the best hand wins", async function() {
        const id = newTableId();
        await start(id, twoPlayers());

        const round = checkUntilStreet(id, 8);

        expect(round.status).toBe("complete");
        expect(round.players[0].hand.cards.length).toBe(7);
        expect(round.winners.length).toBeGreaterThan(0);
        expect(typeof round.winners[0].hand).toBe("string");
    });

    test("The stronger hand takes the whole pot", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
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

    test("A tie splits the pot", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
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

    test("Folded players cannot win at showdown", async function() {
        const id = newTableId();
        await start(id, [{ username: "Ben" }, { username: "Amy" }, { username: "Cal" }]);
        sevenStud.fold(id, "Ben");

        const round = checkUntilStreet(id, 8);

        expect(round.status).toBe("complete");
        expect(round.winners.map(w => w.username)).not.toContain("Ben");
        expect(round.players[0].hand.cards.length).toBe(3);
    });

    test("Showdown with nobody left is an error", async function() {
        const id = newTableId();
        await start(id, twoPlayers());
        const round = checkUntilStreet(id, 7);
        round.players.forEach(p => { p.folded = true; });

        expect(() => sevenStud.check(id, "Ben")).toThrow("No players remaining.");
    });

    test("If everyone has folded, the next street starts with seat 0", async function() {
        const id = newTableId();
        const round = await start(id, twoPlayers());
        round.players.forEach(p => { p.folded = true; });

        sevenStud.check(id, "Ben");

        expect(round.street).toBe(4);
        expect(round.currentPlayer).toBe(0);
    });
});

describe("BT-01 Bot Turns", function() {

    test("No round means no bot turns", async function() {
        expect(sevenStud.playBotTurns("no-such-table")).toBeNull();
    });

    test("Bots stop when it is a human's turn", async function() {
        const id = newTableId();
        await start(id, [
            { username: "Bot 1", isBot: true, difficulty: "easy" },
            { username: "Ben" }
        ]);

        const round = sevenStud.playBotTurns(id);

        expect(round.players[0].acted).toBe(true);
        expect(round.players[round.currentPlayer].username).toBe("Ben");
    });

    test("A table of bots plays itself to the end", async function() {
        const id = newTableId();
        await start(id, [
            { username: "Bot 1", isBot: true, difficulty: "easy" },
            { username: "Bot 2", isBot: true, difficulty: "easy" }
        ]);

        const round = sevenStud.playBotTurns(id);

        expect(round.status).toBe("complete");
    });

    test("Bots raise by the table's bet size, and call", async function() {
        const id = newTableId();
        // No ante or bring-in; small bet 2, big bet 4
        const round = await sevenStud.startRound(id, [
            { username: "Bot 1", isBot: true, difficulty: "medium" },
            { username: "Bot 2", isBot: true, difficulty: "easy" },
            { username: "Ben" }
        ], 0, 0, 2, 4);
        round.currentPlayer = 0;
        // The medium bot raises, then the easy bot calls
        jest.spyOn(Math, "random").mockReturnValue(0.9);

        sevenStud.playBotTurns(id);

        expect(round.players[0].streetBet).toBe(2);
        expect(round.players[1].streetBet).toBe(2);
        expect(round.players[round.currentPlayer].username).toBe("Ben");
    });

    test("From fifth street on, bots raise by the big bet", async function() {
        const id = newTableId();
        const round = await sevenStud.startRound(id, [
            { username: "Bot 1", isBot: true, difficulty: "medium" },
            { username: "Ben" }
        ], 0, 0, 2, 4);
        round.street = 5;
        round.currentPlayer = 0;
        jest.spyOn(Math, "random").mockReturnValue(0.9);

        sevenStud.playBotTurns(id);

        expect(round.players[0].streetBet).toBe(4);
    });

    test("Bots can fold", async function() {
        const id = newTableId();
        const round = await start(id, [
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

describe("PG-02 Antes And Bring-In", function() {

    // Guests keep their chips on the server, so no database is needed here
    function guests(names) {
        names.forEach(name => chipHelper.startGuest(name));
        return names.map(name => ({ username: name }));
    }

    // Leaves a guest with exactly this many chips
    async function leaveGuestWith(name, chips) {
        await chipHelper.deductChips({}, name, chipHelper.getGuestChips(name) - chips);
    }

    test("Antes and the bring-in go into the pot", async function() {
        const id = newTableId();

        const round = await sevenStud.startRound(id, guests(["Guest-101", "Guest-102"]), 5, 10, 20, 40, {});
        const bringIn = round.players[round.currentPlayer];
        const other = round.players.find(p => p !== bringIn);

        expect(round.pot).toBe(20);
        expect(round.currentBet).toBe(10);
        expect(round.smallBet).toBe(20);
        expect(round.bigBet).toBe(40);
        expect(bringIn.streetBet).toBe(10);
        expect(bringIn.totalBet).toBe(15);
        expect(chipHelper.getGuestChips(bringIn.username)).toBe(985);
        expect(chipHelper.getGuestChips(other.username)).toBe(995);
    });

    test("Two guests can start a round together", async function() {
        // This used to fail: the second guest's ante couldn't be charged
        const id = newTableId();

        await sevenStud.startRound(id, guests(["Guest-201", "Guest-202"]), 5, 0, 10, 20, {});

        expect(sevenStud.getRound(id).status).toBe("betting");
        expect(chipHelper.getGuestChips("Guest-201")).toBe(995);
        expect(chipHelper.getGuestChips("Guest-202")).toBe(995);
    });

    test("Bots don't pay chips, but their ante still counts", async function() {
        const id = newTableId();
        const players = guests(["Guest-301"]).concat([{ username: "Bot 1", isBot: true }]);

        const round = await sevenStud.startRound(id, players, 5, 0, 10, 20, {});

        expect(round.pot).toBe(10);
        expect(chipHelper.getGuestChips("Guest-301")).toBe(995);
    });

    test("If a player can't afford the ante, nobody is charged", async function() {
        const id = newTableId();
        const players = guests(["Guest-401", "Guest-402"]);
        await leaveGuestWith("Guest-402", 2);

        await expect(sevenStud.startRound(id, players, 5, 10, 20, 40, {})).rejects.toThrow("Not enough chips.");

        // Guest-401 paid first, and got the ante back
        expect(chipHelper.getGuestChips("Guest-401")).toBe(1000);
        expect(chipHelper.getGuestChips("Guest-402")).toBe(2);
        expect(sevenStud.getRound(id)).toBeNull();
    });

    test("If the bring-in can't be paid, every ante is refunded", async function() {
        const id = newTableId();
        const players = guests(["Guest-501", "Guest-502"]);
        // Both can pay the 5 ante, but whoever brings in can't pay 10 more
        await leaveGuestWith("Guest-501", 5);
        await leaveGuestWith("Guest-502", 5);

        await expect(sevenStud.startRound(id, players, 5, 10, 20, 40, {})).rejects.toThrow("Not enough chips.");

        expect(chipHelper.getGuestChips("Guest-501")).toBe(5);
        expect(chipHelper.getGuestChips("Guest-502")).toBe(5);
    });
});
