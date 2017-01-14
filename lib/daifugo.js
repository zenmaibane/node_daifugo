const numbers = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const marks = ["Hearts", "Clubs", "Diamonds", "Spades"];

function shuffle(array) {
    var n = array.length, t, i;
    while (n) {
        i = Math.floor(Math.random() * n--);
        t = array[n];
        array[n] = array[i];
        array[i] = t;
    }
    return array;
}

function Card(num, mark) {
    this.number = num;
    this.mark = mark;
}

Card.prototype.getNumberString = function () {
    switch (this.number){
        case 0:
            return "Joker"
        case 1:
            return "A";
        case 11:
            return "J";
        case 12:
            return "Q";
        case 13:
            return "K";
        default:
            return this.number.toString();
    }
};

function Daifugo() {
    var tempDeck = [];
    for(var i = 0; i < marks.length; i++){
        for (var j = 0; j<numbers.length;j++){
            tempDeck.push(new Card(numbers[j], marks[i]));
        }
    }
    tempDeck.push(new Card(0, "Joker"))
    shuffle(tempDeck);
    this.deck = tempDeck;
}

exports.Daifugo = Daifugo;
exports.shuffle = shuffle;
