const gameDeck = require('./gameDeck');
const gameDeal = require('./gameDeal');
const Hand = require('./gameHand');

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

test('Add One Card To Hand', function() {
    let hand = new Hand("Tom");

    let card = {
        rank: "A",
        suit: "Spades"
    };

    hand.addCard(card);

    expect(hand.playerHand().length).toBe(1);
    expect(hand.playerHand()[0]).toEqual(card);
});

test('Cannot Draw Card From Empty Deck', function() {
    let deck = [];

    expect(function() {
        gameDeck.drawCard(deck);
    }).toThrow(
        "The deck is empty. Cannot draw a card."
    );
});