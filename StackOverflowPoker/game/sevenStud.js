const gameDeck = require("./gameDeck");
const gameDeal = require("./gameDeal");
const Hand = require("./gameHand");

const activeRounds = new Map();

exports.startRound = function (tableId, players) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 7) {
        throw new Error("Seven-Card Stud requires 2 to 7 players.");
    }

    const deck = gameDeck.shuffleDeck(gameDeck.createDeck());

    const hands = players.map(function (player) {
        return {
            username: player.username,
            hand: new Hand(player.username)
        };
    });

    // Deal the first three cards to each player.
    for (const player of hands) {
        gameDeal.firstDeal(deck, player.hand);
        gameDeal.dealOneCard(deck, player.hand);
    }

    const round = {
        tableId,
        deck,
        players: hands,
        street: 3
    };

    activeRounds.set(String(tableId), round);

    return round;
};

exports.dealNextStreet = function (tableId) {
    const round = activeRounds.get(String(tableId));

    if (!round) {
        throw new Error("No active round for this table.");
    }

    if (round.street >= 7) {
        throw new Error("All seven cards have already been dealt.");
    }

    for (const player of round.players) {
        gameDeal.dealOneCard(round.deck, player.hand);
    }

    round.street++;

    return round;
};

exports.getRound = function (tableId) {
    return activeRounds.get(String(tableId)) || null;
};