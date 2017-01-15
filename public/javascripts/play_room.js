var PlayRoom = function (socket) {
    this.socket = socket
};

PlayRoom.prototype.sendMessage = function (room, text) {
    var message = {
        room: room,
        text: text
    };
    this.socket.emit("message", message);
};

PlayRoom.prototype.changeRoom = function (room) {
    this.socket.emit("join", {
        newRoom: room
    });
};

PlayRoom.prototype.handSubmit = function (room, submittedCardsIndex) {
    var info = {
        room: room,
        submittedCardsIndex: submittedCardsIndex
    };
    this.socket.emit("handSubmit", info);
};

PlayRoom.prototype.processCommand = function (command) {
    //コマンドの最初のワードから解析
    var words = command.split(" ");
    var command = words[0].substring(1, words[0].length).toLowerCase();

    var message = false;

    switch (command) {
        case "join":
            words.shift();
            var room = words.join(" ");
            this.changeRoom(room);
            break;

        case "nick":
            words.shift();
            var name = words.join(" ");
            this.socket.emit("nameAttempt", name);
            break;

        default:
            message = "Unrecognized command.";  //コマンドが認識不能ならエラーを返す
            break;
    }
    return message;
};