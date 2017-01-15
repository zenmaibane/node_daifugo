var socketio = require("socket.io");
//チャット状態定義変数
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

var isPlayingDaifugo = {};
var daifugoData = {};
const playerNum = 2;
const numbers = [1,2,3,4,5,6,7,8,9,10,11,12,13];
const marks = ["Hearts", "Clubs", "Diamonds", "Spades"];
const numbersStrength = [12,13,1,2,3,4,5,6,7,8,9,10,11];//大富豪のカードの強さ順


exports.listen = function (server) {
    io = socketio.listen(server);
    io.set("log level", 1);
    io.sockets.on("connection", function (socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        console.log("join room");
        joinRoom(socket, "Lobby");
        //ユーザーのメッセージ、名前変更とルーム作成/変更の要求を処理する
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        handleHandSubmitting(socket);
        //ユーザーの要求に応じて使用されているルームのリストを提供
        socket.on("rooms", function () {
            socket.emit("rooms", io.sockets.manager.rooms);
        });

        //ユーザーが接続を断ったときのためにクリーンアップロジックを定義する
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

function assignGuestName(socket, guestNumber, nickNames, nameUsed) {
    var name = "Guest" + guestNumber;
    nickNames[socket.id] = name;
    socket.emit("nameResult", {
        success: true,
        name: name
    });
    namesUsed.push(name);

    return guestNumber + 1;
}

function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit("joinResult", {room: room});
    socket.broadcast.to(room).emit("message", {
        text: nickNames[socket.id] + " has joined " + room + "."
    });
    var usersInRoom = io.sockets.clients(room); //同じルームに他の誰かがいるかの判定
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = "Users currently in " + room + ": ";
        for (var index in usersInRoom) {
            var usersSocketId = usersInRoom[index].id;
            if (usersSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ", ";
                }
                usersInRoomSummary += nickNames[usersSocketId];
            }
        }
        usersInRoomSummary += ".";
        //同じ部屋にいる他のユーザーの概要をこのユーザーに送る
        socket.emit("message", {text: usersInRoomSummary});
        if(usersInRoom.length == playerNum) {
            startDaifugo(room);
        }
    }
}

function startDaifugo(room) {
    isPlayingDaifugo[room] = true;
    io.sockets.emit("message", {
        text: playerNum.toString() + "人集まりました．ゲームを始めます．"
    });

    //トランプ全カード生成
    var playersList = io.sockets.clients(room);
    var deck = [];
    for(var i = 0; i < numbers.length; i++){
        for (var j = 0; j<marks.length;j++){
            deck.push(new Card(numbers[i], marks[j], numbersStrength[i]));
        }
    }
    deck.push(new Card(0, "Joker", 0));
    deck = shuffle(deck);

    //プレイヤーに手札配布
    var handNum = Math.floor(deck.length / playerNum);
    playersList.forEach(function (player) {
        player.hand =  deck.slice(0, handNum);
        deck.splice(0, handNum);
    })
    playersList = shuffle(playersList);
    for (var i = 0; i < deck.length; i++){
        playersList[i].hand.push(deck[i]);
    }
    //プレイヤーの手札をソート&手札情報を投げる
    playersList.forEach(function (player) {
        player.hand.sort(cardSort);
        // player.emit("message", {text: showHand(player.hand)})
        player.emit("card", {text: showHand(player.hand)})
    })

    //ランダムに選んだユーザが順番が1番先に
    playersList = shuffle(playersList);
    var playerOrder = [];
    playersList.forEach(function (player) {
       playerOrder.push(nickNames[player.id])
    });
    io.sockets.emit("message", {text:"順番は" + playerOrder.join(",") + "です．"})
    daifugoData[room] = {order:playersList, index:0, field:null}
    callPlayerName(room)
}

function callPlayerName(room) {
    var data = daifugoData[room];
    var playerSocket  = data.order[data.index];
    playerSocket.emit("message", {text: "あなたの番です．"})
    playerSocket.broadcast.to(room).emit("message", {
        text: nickNames[playerSocket.id] + "さんの番です．お待ち下さい．"
    });
}

function turnNextPlayer(room, socket) {
    daifugoData[room].index += 1;
    if (daifugoData[room].index == daifugoData[room].order.length){
        daifugoData[room].index = 0;
    }
    callPlayerName(room);
    console.log(socket.hand)
    socket.emit("card", {text: showHand(socket.hand)});
}

function handleHandSubmitting(socket) {
    socket.on("handSubmit", function (info) {
        var playerOrder = daifugoData[info.room];
        var playerId = playerOrder.order[playerOrder.index].id;
        if (playerId !== socket.id){
            socket.emit("message", {text: "君の番ではない"})
        }else {
            if (info.submittedCardsIndex.length == 0){
                socket.emit("message", {text: "カードを選んでくれ"})
            }else {
                judgeSubmittedCard(info.room, info.submittedCardsIndex);
            }
        }
    });
    function judgeSubmittedCard(room, submittedCardsIndex) {
        var submittedCards = [];
        submittedCardsIndex.forEach(function (cardIndex) {
            submittedCards.push(socket.hand[cardIndex]);
        });
        if (!(isSequence(submittedCards) || isEqualNumbers(submittedCards))){
            socket.emit("message", {text: "そのカードの組み合わせは出来ません．"});
        }else {
            if (!daifugoData.field){
                daifugoData.field = submittedCards;
            }

            //要求されたハンドの削除
            for(var i = 0; i < submittedCards.length; i++){
                for (var j = 0; j < socket.hand.length; j++){
                    if (socket.hand[j] === submittedCards[i]){
                        console.log("OK")
                        socket.hand.splice(j,1);
                        break;
                    }
                }
            }
            turnNextPlayer(room, socket);
        }
    }
    function isEqualNumbers(submittedCards) {
        if (submittedCards.length == 1){
            return true;
        }
        var isEqual = true;
        var num = submittedCards[0].number;
        for(var i = 1; i<submittedCards.length; i++){
            if (num != submittedCards[i].number && submittedCards[i].number != 0){//ジョーカーではなく数字が同じなら
                isEqual = false;
                break;
            }
        }
        return isEqual;
    }
    function isSequence(submittedCards) {
        if (submittedCards.length == 1){
            return true;
        }
        var isSequence = true;
        var num = submittedCards[0].numberStrength;
        for(var i = 1; i<submittedCards.length; i++){
            var num2 = submittedCards[i].numberStrength;
            if (num2 != 0 && num - num2 != 1){//ジョーカーではなく差が1でないなら
                isSequence = false;
                break;
            }
            num = num2;
        }
        return isSequence;
    }
}


function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on("nameAttempt", function (name) {
        if (name.indexOf("Guest") == 0) {
            socket.emit("nameResult", {
                success: false,
                message: "Names cannot begin with \"Guest\"."
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];
                socket.emit("nameResult", {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit("message", {
                    text: previousName + " is now known as " + name + "."
                });
            } else {
                socket.emit("nameResult", {
                    success: false,
                    message: "That name is already in use."
                });
            }
        }
    });
}

function handleMessageBroadcasting(socket) {
    socket.on("message", function (message) {
        socket.broadcast.to(message.room).emit("message", {
            text: nickNames[socket.id] + ": " + message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on("join", function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    })
}

function handleClientDisconnection(socket) {
    socket.on("disconnect", function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}

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

function Card(num, mark, numberStrength) {
    this.number = num;
    this.mark = mark;
    this.numberStrength = numberStrength; //実際の数字の強さ(大富豪では2が1番強いため強さのパラメータを別途持つとする)
}

Card.prototype.getNumberString = function () {
    switch (this.number){
        case 0:
            return "Joker";
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

Card.prototype.showInfo = function () {
    if (this.number == 0){
        return "【"+ this.getNumberString() + "】"
    }
    return "【" + this.mark + "-" + this.getNumberString() + "】";
};

function cardSort(a, b) {
    return b.numberStrength - a.numberStrength;
}

function showHand(playerHand) {
    var hand = "";
    playerHand.forEach(function (card) {
        hand += card.showInfo() + ",";
    });
    return hand.substr(0, hand.length-1);
}