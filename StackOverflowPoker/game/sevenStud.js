const gameDeck = require("./gameDeck");
const gameDeal = require("./gameDeal");
const Hand = require("./gameHand");
const pokerBot = require("./pokerBot");
const { Hand: PokerHand } = require("pokersolver");
const chipHelper = require("./chipHelper");

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

function getRankValue(rank) {

    if (rank === "1") return 14; // Ace

    return Number(rank);
}

function getLowestUpCardPlayer(players) {

    let lowestIndex = 0;
    let lowestValue = 99;

    for (let i = 0; i < players.length; i++) {

        const player = players[i];

        if (player.folded) {
            continue;
        }

        // Third card is the up card
        const upCard = player.hand.cards[2];

        const value = getRankValue(upCard.rank);

        if (value < lowestValue) {
            lowestValue = value;
            lowestIndex = i;
        }
    }

    return lowestIndex;
}


exports.startRound = async function (
    tableId,
    players,
    ante = 0,
    bringIn = 0,
    smallBet = 0,
    bigBet = 0, 
    req
) {
    if (!Array.isArray(players) || players.length < 2 || players.length > 7) {
        throw new Error("Seven-Card Stud requires 2 to 7 players.");
    }
    ante = Number(ante) || 0;

    const deck = gameDeck.shuffleDeck(gameDeck.createDeck());

    const hands = players.map(function (player) {
        return {
            username: player.username,
            isBot: player.isBot === true,
            difficulty: player.difficulty || "easy",
            hand: new Hand(player.username),
            folded: false,
            streetBet: 0,
            totalBet: 0,
            acted: false
        };
    });
    // Chips taken so far, so they can be given back if the round can't start
    const charged = [];

    async function charge(player, amount) {
        if (player.isBot || amount <= 0) {
            return;
        }
        await chipHelper.deductChips(req, player.username, amount);
        charged.push({ username: player.username, amount: amount });
    }

    let pot = 0;
    let bringInPlayerIndex = 0;

    try {
        for (const player of hands) {
            await charge(player, ante);

            player.streetBet = 0;
            player.totalBet = ante;

            pot += ante;
        }

        // Deal the first three cards to each player.
        for (const player of hands) {
            gameDeal.firstDeal(deck, player.hand);
            gameDeal.dealOneCard(deck, player.hand);
        }

        bringInPlayerIndex =
            getLowestUpCardPlayer(hands);

        const bringInPlayer =
            hands[bringInPlayerIndex];

        if (bringIn > 0) {
            await charge(bringInPlayer, bringIn);

            bringInPlayer.streetBet =
                bringIn;

            bringInPlayer.totalBet +=
                bringIn;

            pot += bringIn;
        }
    } catch (error) {
        // Someone couldn't pay: refund everyone who already did
        for (const payment of charged) {
            await chipHelper.addChips(req, payment.username, payment.amount);
        }
        throw error;
    }

    const round = {
        tableId,
        deck,
        players: hands,
        street: 3,
        status: "betting",
        pot: pot,
        currentBet: bringIn,
        currentPlayer: bringInPlayerIndex,
        smallBet,
        bigBet,
        bettingComplete: false,
        winningsAwarded: false
    };

    activeRounds.set(String(tableId), round);

    return round;
};



exports.getRound = function (tableId) {
    return activeRounds.get(String(tableId)) || null;
};
    
// BT-01: Let bots play when it is their turn
exports.playBotTurns = function(tableId) {
    const round = activeRounds.get(String(tableId));

    if (!round) {
        return null;
    }

    let turns = 0;

    while (round.status === "betting" && turns < 100) {
        const bot = round.players[round.currentPlayer];

        // Stop when it is a human player's turn
        if (!bot || !bot.isBot) {
            break;
        }

        const action = pokerBot.chooseAction(
            bot,
            round,
            bot.difficulty
        );

        if (action === "fold") {
            exports.fold(tableId, bot.username);
        } else if (action === "raise") {
            const raiseAmount =
                round.street >= 5
                    ? round.bigBet
                    : round.smallBet;

            exports.raise(
                tableId,
                bot.username,
                raiseAmount
            );
        } else if (action === "call") {
            exports.call(tableId, bot.username);
        } else {
            exports.check(tableId, bot.username);
        }

        turns++;
    }

    return round;
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

    const activePlayers = round.players.filter(
        p => !p.folded
    );

    if (activePlayers.length === 1) {

        const winner = activePlayers[0];

        round.status = "complete";

        round.winners = [{
            username: winner.username,
            hand: "Last Player Remaining",
            winnings: round.pot
        }];

        return round;
    }

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
        "1": "A",
        "10": "T",
        "11": "J",
        "12": "Q",
        "13": "K"
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

exports.endRound = function(tableId) {
    activeRounds.delete(String(tableId));
};
