// PG-01: Tests for the deck, dealing, and a player's hand
const gameDeck = require("./gameDeck");
const gameDeal = require("./gameDeal");
const Hand = require("./gameHand");

test("A new deck has every card once", function() {
    const deck = gameDeck.createDeck();
    const names = new Set(deck.map(card => card.rank + card.suit));

    expect(deck.length).toBe(52);
    expect(names.size).toBe(52);
});

test("Drawing takes the top card off the deck", function() {
    const deck = gameDeck.createDeck();
    const top = deck[deck.length - 1];

    const drawn = gameDeck.drawCard(deck);

    expect(drawn).toBe(top);
    expect(deck.length).toBe(51);
});

test("Cannot draw from an empty deck", function() {
    expect(() => gameDeck.drawCard([])).toThrow("The deck is empty");
});

test("Dealing one card adds one card to the hand", function() {
    const deck = gameDeck.createDeck();
    const hand = new Hand("Ben");

    gameDeal.dealOneCard(deck, hand);

    expect(hand.playerHand().length).toBe(1);
});

test("A hand remembers who it belongs to", function() {
    const hand = new Hand("Ben");

    expect(hand.playerName()).toBe("Ben");
    expect(hand.playerHand()).toEqual([]);
});
