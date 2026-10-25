const gameDeck = require('../game/gameDeck');
const gameDeal = require('../game/gameDeal');
const Hand = require('../game/gameHand');

test("Game rounds are executed correctly", () => {
    const deck = gameDeck.createDeck();
    const shuffledDeck = gameDeck.shuffleDeck(deck);
    expect (shuffledDeck.length).toBe(52); // Ensure the deck has 52 cards after shuffling
});

test("First deal gives two cards to the player", () => {
    const deck = gameDeck.createDeck();
    const shuffledDeck = gameDeck.shuffleDeck(deck);
    const hand = new Hand("Player1");
    gameDeal.firstDeal(shuffledDeck, hand);
    expect(hand.cards.length).toBe(2); // Ensure the player receives two cards
});

