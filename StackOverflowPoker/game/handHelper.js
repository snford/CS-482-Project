// UP-04: Hand helper. Tells a beginner how strong their own hand is right now.
const { Hand: PokerHand } = require("pokersolver");

// Seven-Card Stud deals 7 cards, so draws only matter before the last card
const LAST_CARD = 7;

// Beginner tips for each pokersolver hand rank (1 = High Card ... 9 = Straight Flush)
const TIPS = {
    1: "No pair yet. Be careful betting big with only a high card.",
    2: "One pair. A decent start, but often not enough to win against several players.",
    3: "Two pair. A solid hand in Seven-Card Stud.",
    4: "Three of a kind. A strong hand, so betting is usually a good idea.",
    5: "A straight! A very strong hand. Bet to build the pot.",
    6: "A flush! A very strong hand. Bet to build the pot.",
    7: "A full house! Very few hands can beat this.",
    8: "Four of a kind! Almost unbeatable.",
    9: "A straight flush! The best hand in poker."
};

const SUITS = { Hearts: "h", Diamonds: "d", Clubs: "c", Spades: "s" };
const VALUES = { J: 11, Q: 12, K: 13, A: 14 };

// "10" of "Hearts" -> "Th", the format pokersolver reads
function toSolverCard(card) {
    const rank = card.rank === "10" ? "T" : card.rank;
    return rank + SUITS[card.suit];
}

function cardValue(card) {
    return VALUES[card.rank] || Number(card.rank);
}

// Four cards of the same suit: one more makes a flush
function hasFlushDraw(cards) {
    const counts = {};
    for (const card of cards) {
        counts[card.suit] = (counts[card.suit] || 0) + 1;
    }
    return Object.values(counts).some(count => count === 4);
}

// Four cards in a row (an Ace also counts as 1): one more makes a straight
function hasStraightDraw(cards) {
    const values = new Set(cards.map(cardValue));
    if (values.has(14)) {
        values.add(1);
    }
    for (const low of values) {
        if (values.has(low + 1) && values.has(low + 2) && values.has(low + 3)) {
            return true;
        }
    }
    return false;
}

// Describes the best hand in these cards, plus a draw to watch for and a tip.
// Returns null when there are no cards yet.
exports.describeHand = function(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return null;
    }

    const best = PokerHand.solve(cards.map(toSolverCard));
    const moreCardsComing = cards.length < LAST_CARD;

    let draw = null;
    if (moreCardsComing && best.rank < 6 && hasFlushDraw(cards)) {
        draw = "Flush draw: one more card of the same suit makes a flush.";
    } else if (moreCardsComing && best.rank < 5 && hasStraightDraw(cards)) {
        draw = "Straight draw: one more card in a row makes a straight.";
    }

    return {
        name: best.name,
        description: best.descr,
        strength: best.rank,
        maxStrength: 9,
        draw: draw,
        tip: TIPS[best.rank]
    };
};
