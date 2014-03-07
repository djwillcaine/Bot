GLOBAL.log = "";

var io = require('socket.io-client');
var cmd = require('./commands');
var http = require('http');
var socket = io.connect("https://dogechat.net", {secure: true});

var server = http.createServer(function (request, response) {
	response.writeHead(200, {"Content-Type": "text/plain"});
	response.end("Botbot is online!\nCurrent Balance: " + total + " DOGE\n" + JSON.stringify(cmd.getBals()).replace(",", ", ") + "\n" + GLOBAL.log);
}).listen(80);

var username = "bot";
var sessionKey = "xxx" // TODO: Insert session key.
var outputBuffer = [];
var total = 0;
var loggedIn = false;
var logs = ""

socket.on('connect', function(){
	socket.emit('login', {session: sessionKey});
});

socket.on('loggedin', function(data){
	username = data.username;
	console.log("Logged in!");
    loggedIn = true;
	setTimeout(function() {
		socket.emit("getcolors", {});
	}, 1000);
	setInterval(function(){
		if(outputBuffer.length > 0){
			var out = outputBuffer.splice(0,1)[0];
			socket.emit("chat", {room: out.room, message: out.message, color: "#000"});
		}
	}, 600);
});

setTimeout(function(){
	socket.on('chat', function(data){
		if(data.user != "!Topic" && data.user != "*System" && loggedIn){
			if(contains(data.message, ["<span style=\"color: #"])){
				data.message = data.message.split("\">")[1];
				data.message = data.message.replace("</span>", "");
			}
			var msg = data.message.toLowerCase().trim().split(" ");
			var command = msg[0];
			if(cmd[command] && cmd.rooms[data.room]){
				if(cmd.rooms[data.room].indexOf(command) > -1){
					cmd[command](data.user, data.room, msg, function(out){
						outputBuffer.push({room: data.room, message: out});
					}, function(type, args){
						socket.emit(type, args);
					});
				}
			}else if(contains(data.message, ["<span class='label label-success'>has tipped " + username])){
				var tiptext = data.message.split("<span class='label label-success'>has tipped ")[1];
				var amt = tiptext.split(" ")[1];
				cmd.incBal(data.user, data.room, Number(amt), function(out){
					outputBuffer.push({room: data.room, message: out});
				});
			}
		}
	});
}, 1000);

socket.on('balance', function(data){
	if(typeof data.credits != 'undefined'){
		total = data.credits;
		outputBuffer.push({room: "bot:cainy", message: "Balance: " + data.credits + " DOGE"})
	}
});

socket.on('disconnect', function(){
	var socket = io.connect("https://dogechat.net", {secure: true});
});

function contains(string, terms){
	for(var i=0; i<terms.length; i++){
		if(string.toLowerCase().indexOf(terms[i].toLowerCase()) == -1){
			return false;
		}
	}
	return true;
}