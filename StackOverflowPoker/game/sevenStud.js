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
            hand: new Hand(player.username),
            folded: false,
            streetBet: 0,
            totalBet: 0,
            acted: false
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
        street: 3,
        status: "betting",
        pot: 0,
        currentBet: 0,
        currentPlayer: 0,
        bettingComplete: false
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
        if (!player.folded) {
            gameDeal.dealOneCard(round.deck, player.hand);
        }
    }

    round.street++;
    round.currentBet = 0;
    round.currentPlayer = 0;

    for (const player of round.players) {
        player.streetBet = 0;
        player.acted = false;
    }

    round.status = "betting";

    return round;
};

exports.getRound = function (tableId) {
    return activeRounds.get(String(tableId)) || null;
};