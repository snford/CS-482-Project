const gameDeck = require('./gameDeck');

exports.firstDeal = function (deck, Hand) {
    Hand.addCard(gameDeck.drawCard(deck));
    Hand.addCard(gameDeck.drawCard(deck));
    return Hand;
}

exports.dealOneCard = function (deck, Hand) {
    Hand.addCard(gameDeck.drawCard(deck));
    return Hand;
}
