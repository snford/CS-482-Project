const gameDeck = require("./gameDeck");
const gameDeal = require("./gameDeal");
const Hand = require("./gameHand");
const { Hand: PokerHand } = require("pokersolver");

const activeRounds = new Map();

function nextPlayer(round) {
    let attempts = 0;

    do {
        round.currentPlayer =
            (round.currentPlayer + 1) %
            round.players.length;

        attempts++;
    } while (
        round.players[round.currentPlayer].folded &&
        attempts < round.players.length
    );
}

function bettingRoundComplete(round) {

    return round.players.every(player =>
        player.folded ||
        (
            player.acted &&
            player.streetBet === round.currentBet
        )
    );
}

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
        bettingComplete: false,
        winningsAwarded: false
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

exports.fold = function(tableId, username) {
    const round = activeRounds.get(String(tableId));

    const player = round.players.find(
        p => p.username === username
    );

    if (!player) {
        throw new Error("Player not found");
    }

    player.folded = true;

    nextPlayer(round);

    return round;
};

exports.check = function(tableId, username) {
    const round = activeRounds.get(String(tableId));

    const player = round.players.find(
        p => p.username === username
    );

    if (player.streetBet !== round.currentBet) {
        throw new Error("Cannot check");
    }

    player.acted = true;

    if (bettingRoundComplete(round)) {
        advanceStreet(round);
    } else {
        nextPlayer(round);
    }

    return round;
};

exports.call = function(tableId, username) {
    const round = activeRounds.get(String(tableId));

    const player = round.players.find(
        p => p.username === username
    );

    const amountToCall =
        round.currentBet - player.streetBet;

        player.streetBet += amountToCall;
        player.totalBet += amountToCall;

        round.pot += amountToCall;

        player.acted = true;


    if (bettingRoundComplete(round)) {
        advanceStreet(round);
    } else {
        nextPlayer(round);
    }

    return round;
};

exports.raise = function (
    tableId,
    username,
    raiseAmount
) {
    const round =
        activeRounds.get(String(tableId));

    if (!round) {
        throw new Error("Round not found");
    }

    const player =
        round.players.find(
            p => p.username === username
        );

    if (!player) {
        throw new Error("Player not found");
    }

    const amountToCall =
        round.currentBet - player.streetBet;

    const total =
        amountToCall + raiseAmount;

    player.streetBet += total;
    player.totalBet += total;

    round.currentBet += raiseAmount;
    round.pot += total;

    round.players.forEach(p => {
        if (!p.folded) {
            p.acted = false;
        }
    });

    player.acted = true;

    nextPlayer(round);

    return round;
};

function advanceStreet(round) {

    round.street++;

    // Reset betting
    round.currentBet = 0;

    round.players.forEach(player => {

        player.streetBet = 0;
        player.acted = false;

        if (player.folded) {
            return;
        }

        // Deal one new card each street
        if (round.street <= 7) {

            gameDeal.dealOneCard(
                round.deck,
                player.hand
            );
        }
    });

    // Showdown after 7th street betting
    if (round.street > 7) {
        showdown(round);
        return;
    }

    // Set first active player
    round.currentPlayer =
        round.players.findIndex(
            player => !player.folded
        );

    if (round.currentPlayer < 0) {
        round.currentPlayer = 0;
    }
}

function toPokerSolverCard(card) {
    const suitMap = {
        Hearts: "h",
        Diamonds: "d",
        Clubs: "c",
        Spades: "s"
    };

    const rankMap = {
        "10": "T"
    };

    return (
        (rankMap[card.rank] || card.rank) +
        suitMap[card.suit]
    );
}

function showdown(round) {
    // Only players who have not folded can win.
    const activePlayers = round.players.filter(
        player => !player.folded
    );

    if (activePlayers.length === 0) {
        throw new Error("No players remaining.");
    }

    // Convert each player's cards into poker cards.
    const evaluatedPlayers = activePlayers.map(player => {
        const cards = player.hand.cards.map(toPokerSolverCard);
        return {
            username: player.username,
            hand: PokerHand.solve(cards),
            player
        };
    });

    // Find the highest-ranking hand.
    const winningHand = PokerHand.winners(
        evaluatedPlayers.map(p => p.hand)
    );

    // Find every player who tied for the winning hand.
    const winners = evaluatedPlayers.filter(player =>
        winningHand.includes(player.hand)
    );

    // Divide the pot between winners.
    const winnings = Math.floor(
        round.pot / winners.length
    );

    winners.forEach(winner => {
        winner.player.winnings = winnings;
    });

    round.status = "complete";
    round.winners = winners.map(winner => ({
        username: winner.username,
        hand: winner.hand.name,
        winnings
    }));

    return round;
}
exports.showdown = showdown;