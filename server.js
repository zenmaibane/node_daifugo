var http = require("http"); //httpのサーバー/クライアント機能
var fs = require("fs"); //ファイルシステム関連の機能
var path = require("path"); //ファイルシステムのパスに関する機能
var mime = require('mime'); //ファイルの拡張子に基いてMIMEタイプを推論する機能

var cache = {};//ファイルの内容格納用

function send404(response) {
    response.writeHead(404, {"Content-Type": "text/plain"});
    response.write("Error 404: resource not found.");
    response.end();
}

function sendFile(response, filePath, fileContents) {
    response.writeHead(200, {"Content-Type": mime.lookup(path.basename(filePath))});
    response.end(fileContents);
}

function serveStatic(response, cache, absPath) {
    if (cache[absPath]) {   //ファイルがメモリにキャッシュされているか
        sendFile(response, absPath, cache[absPath]);    //メモリからファイルを供給
    } else {
        fs.exists(absPath, function (exists) {  //ファイルは存在するか
            if (exists) {
                fs.readFile(absPath, function (err, data) { //ディスクからファイルを読み込む
                    if (err) {
                        send404(response);
                    } else {
                        cache[absPath] = data;
                        sendFile(response, absPath, data);  //ディスクから読んだファイルを供給
                    }
                });
            } else {
                send404(response);
            }
        });
    }
}

var server = http.createServer(function (request, response) {
    var filePath = false;
    if (request.url == "/") {
        filePath = "public/index.html"; //デフォルトで供給するHTMLファイルの定義
    } else {
        filePath = "public" + request.url;  //URLパスをファイルの相対パスに変換
    }
    var absPath = "./" + filePath;
    serveStatic(response, cache, absPath);  //応答として静的ファイルを供給する
});

server.listen(8000, function () {
    console.log("Server listening on port 8000. localhost:8000");
});

var chatServer = require("./lib/play_room_server");
chatServer.listen(server);