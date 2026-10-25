class Hand{
    constructor(player){
        this.player = player;
        this.cards = [];
    }   
    playerHand(){
        return this.cards;
    }
    playerName(){
        return this.player;
    }
    addCard(card){
        this.cards.push(card);
    }
}

module.exports = Hand;