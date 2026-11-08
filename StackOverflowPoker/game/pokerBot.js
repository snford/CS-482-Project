// BT-01: Decide what action a poker bot should take
exports.chooseAction = function(player, round, difficulty) {
    const amountToCall = round.currentBet - player.streetBet;

    const ranks = player.hand.cards.map(card => card.rank);
    const hasPair = new Set(ranks).size < ranks.length;
    const hasHighCard = ranks.includes("A") || ranks.includes("K");

    const random = Math.random();

    // Easy bots usually check or call
    if (difficulty === "easy") {
        return amountToCall > 0 ? "call" : "check";
    }

    // Medium bots sometimes fold or raise
    if (difficulty === "medium") {
        if (amountToCall > 0 && random < 0.15) {
            return "fold";
        }

        if (random > 0.85) {
            return "raise";
        }

        return amountToCall > 0 ? "call" : "check";
    }

    // Hard bootes make a decision based on their cards
    if (difficulty === "hard") {
        if (hasPair && random > 0.55) {
            return "raise";
        }

        if (amountToCall > 0 && !hasPair &&
            !hasHighCard && random < 0.5) {
            return "fold";
        }

        return amountToCall > 0 ? "call" : "check";
    }

    return amountToCall > 0 ? "call" : "check";
};
