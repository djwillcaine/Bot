var fs = require('fs');
var http = require('http');
var xmlParse = require('xml2js').parseString;

var bals = JSON.parse(fs.readFileSync("bals.json"));
var data = JSON.parse(fs.readFileSync("data.json"));
var flirts = data["flirts"];
var insults = data["insults"];
var logs = "";

var tinySongKey = "xxx"; // TODO: Add in API keys!
var wolframKey = "xxx";  // TODO: Add in API keys!

var cur_codes = ["usd", "aud", "cad", "chf", "cny", "dkk", "eur", "gbp", "hkd", "jpy", "nzd", "pln", "rub", "sek", "sgd", "thb", "nok", "czk"];
var btc_codes = {"btc" : 1,  "cbtc" : 100, "mbtc" : 1000, "ubtc" : 1000000, "sat" : 100000000, "satoshi" : 100000000, "satoshis" : 100000000};

var allCmds = ["!commands", "!help", "!search", "!watch", "!listen", "!define", "!ai", "!flirt", "!doge", "!botbal", "!tip", "!say", "!shutdown", "!bal", "!cashout", "!roll", "!save", "!setbal", "!userbals"]

module.exports = {
	"!commands"	: commands,
	"!help"		: help,
	"!ex"		: exch,
	"!search"	: search,
	"!watch"	: watch,
	"!listen"	: listen,
	"!define"	: define,
	"!ai"		: ai,
	"!flirt"	: flirt,
	"!doge"		: doge,
	
	"!bal"		: bal,
	"!cashout"	: cashout,
	"!roll"		: roll,
	
	"!join"		: function(user, room, msg, chat, emit){ if(user == "cainy") emit("joinroom", {room: msg[1]}); },
	"!leave"	: function(user, room, msg, chat, emit){ if(user == "cainy") emit("quitroom", {room: msg[1]}); },
	"!botbal"	: function(user, room, msg, chat, emit){ if(user == "cainy") emit("getbalance", {}); },
	"!tip"		: function(user, room, msg, chat, emit){ if(user == "cainy") emit("tip", {user: msg[1], tip: msg[2], room: msg[3], message: msg.splice(4, msg.length - 4).join(" ")}); },
	"!say"		: function(user, room, msg, chat, emit){ if(user == "cainy") chat(msg.splice(2, msg.length - 2).join(" ")); },
	"!restart"	: function(user, room, msg, chat, emit){ if(user == "cainy") chat("Bot is restarting..."); log("Bot is shutting down..."); save(function(){ setTimeout(function(){ process.exit(0) }, 2000); }); },
	"!save"		: function(user, room, msg, chat, emit){ if(user == "cainy") save(function(){ chat("Saved user data to file.") }); },
	"!setbal"	: setBal,
	"!userbals"	: function(user, room, msg, chat, emit){ if(user == "cainy") chat(JSON.stringify(bals).replace(",", ", ")); },
	incBal		: incBal,
	getLogs		: function(){ return logs; },
	rooms		:	{
						"bot"			: allCmds,
						"dogecoin"		: ["!doge"],
						"plaxant"		: ["!doge"],
						"bot:cainy"		: allCmds
					}
};



function bal(user, room, msg, chat, emit){
	log("!bal");
	chat(user + ": Your current balance is " + (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) + " DOGE.")
}

function cashout(user, room, msg, chat, emit){
	bal = bals[user.toLowerCase()] ? Math.floor(bals[user.toLowerCase()]) : 0
	if(bal >= 5 && msg.length == 1){
		emit("tip", {user: user, room: room, tip: Math.floor(bals[user.toLowerCase()]), message: "CASHOUT"});
		bals[user.toLowerCase()] = bals[user.toLowerCase()] - Math.floor(bals[user.toLowerCase()]);
	}else if(msg.length == 2 && bal >= 5 && bal <= Math.floor(Number(msg[1]))){
		emit("tip", {user: user, room: room, tip: Math.floor(Number(msg[1])), message: "CASHOUT"});
		bals[user.toLowerCase()] -= Math.floor(Number(msg[1]));
	}else{
		chat(user + ": Your balance must be above 5 DOGE and you must not specify an number greater than your balance.");
	}
}

function roll(user, room, msg, chat, emit){
	if(msg.length != 2){
		chat(user + ": Command usage: !roll <bet>");
	}else{
		bet = Math.floor(Number(msg[1]));
		if(bet > (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) || bet < 5 || bet > 100 || isNan(bet)){
			chat(user + ": Please bet an amount between 5 and 100 DOGE and no higher than your current balance.");
		}else{
			net = 0 - bet;
			var roll1 = Math.floor(Math.random() * 6) + 1;
			var roll2 = Math.floor(Math.random() * 6) + 1;
			if(roll1 == 6 && roll2 == 6){
				net += bet * 4
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". Jackpot! You win 4x your bet - " + (4 * bet) + "! Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			}else if(roll1 == roll2){
				net += bet * 2;
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". That's a double! You win 2x your bet - " + (2 * bet) + "! Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			}else if(roll1 == 6 || roll2 == 6){
				net += Number((bet * 1.5).toFixed(1));
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". That's a single 6! You win 1.5x your bet - " + (1.5 * bet).toFixed(1) + "! Balance: " + (bals[user.toLowerCase()] + net).toFixed(1) + " DOGE.");
			}else{
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". Unlucky, you didn't win anything. Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			}
			bals[user.toLowerCase()] += net;
			log("Updated " + user + "'s balance by " + net + " DOGE.");
		}
	}
}

function setBal(user, room, msg, chat, emit){
	if(user == "cainy"){
		bals[msg[1]] = Number(msg[2]);
		chat("Updated " + msg[1] + "'s balance.");
	}
}

function incBal(user, room, amt, chat){
	bals[user.toLowerCase()] = (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) + amt
	chat(user + ": Your balance has been updated by " + amt + " DOGE. Balance: " + bals[user.toLowerCase()] + " DOGE.");
	log("Updated " + user + "'s balance by " + amt + " DOGE.");
}

function doge(user, room, msg, chat, emit){
	try{
		getReq("http://pubapi.cryptsy.com/api.php?method=singlemarketdata&marketid=132", [], true, function(res, passback){
			var price = res.return.markets.DOGE.lasttradeprice;
			chat(user + ": Last price of Doge was " + (price * 100000000) + " satoshis (Cryptsy Price) | #bot");
		});
	}catch(err){
		chat(user + ": I didn't receive a proper response from the Cryptsy API, please try again later.");
	}
}

function help(user, room, msg, chat, emit){
	chat(user + ": Welcome to bot - the intelligent bot. Please see http://bitbin.it/"
		+ helplink + " for more information. Type !commands for a list of available commands.");
}

function commands(user, room, msg, chat, emit){
	chat(user + ": Commands are: !help, !commands, !ai, !search, !watch, !listen, !define, !flirt, !bal, !cashout, !roll, !doge");
}

function exch(user, room, msg, chat, emit) {
	chat(user + ": This bot is undergoing some changes due to MtGox closing and the new site. We hope to bring you a new, better than ever exchange command very soon!");
/*
	if(msg.length == 2 && cur_codes.indexOf(msg[1]) != -1){
		getReq("http://data.mtgox.com/api/1/BTC" + msg[1] + "/ticker_fast", [msg[1]], true, function(res, args){
			var val = res.return.last.value;
			chat(user + ": 1 BTC = " + val + " " + args[0].toUpperCase());
		});
	}else if(msg.length == 4){
		if(cur_codes.indexOf(msg[2]) != -1 && btc_codes[msg[3]]){
			getReq("http://data.mtgox.com/api/1/BTC" + msg[2] + "/ticker_fast", [msg[2], msg[3], Number(msg[1])], true, function(res, args){
				var val = 1 / Number(res.return.last.value) * args[2] * btc_codes[args[1]];
				chat(user + ": " + args[2] + " " + args[0].toUpperCase() + " = " + val.toFixed(5) + " " + args[1].toUpperCase());
			});
		}else if(cur_codes.indexOf(msg[3]) != -1 && btc_codes[msg[2]]){
			getReq("http://data.mtgox.com/api/1/BTC" + msg[3] + "/ticker_fast", [msg[2], msg[3], msg[1]], true, function(res, args){
				var val = Number(res.return.last.value) * args[2] / btc_codes[args[0]];
				chat(user + ": " + args[2] + " " + args[0].toUpperCase() + " = " + val.toFixed(5) + " " + args[1].toUpperCase());
			});
		}else if(btc_codes[msg[2]] && btc_codes[msg[3]]){
			var val = Number(msg[1]) / btc_codes[msg[2]] * btc_codes[msg[3]];
			chat(user + ": " + msg[1] + " " + msg[2].toUpperCase() + " = " + val.toFixed(10) + " " + msg[3].toUpperCase());
		}
	}
*/
}

function search(user, room, msg, chat, emit){
	if(msg.length >= 2){
		getReq("http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")), [], true, function(res, passback){
			var title = res.responseData.results[0].titleNoFormatting;
			var url = res.responseData.results[0].url;
			chat(user + ": " + title + " - " + url);
		});
	}else{
		chat(user + ": Command usage: !search <query string>");
	}
}

function watch(user, room, msg, chat, emit){
	if(msg.length >= 2){
		getReq("http://gdata.youtube.com/feeds/api/videos?q=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "&alt=json&max-results=1", [], true, function(res, passback){
			var title = res.feed.entry[0].title.$t;
			var url = "http://youtu.be/" + res.feed.entry[0].link[0].href.split("&")[0].split("v=")[1];
			chat(user + ": " + title + " - " + url);
		});
	}else{
		chat(user + ": Command usage: !watch <video title>");
	}
}

function define(user, room, msg, chat, emit){
	if(msg.length >= 2){
		getReq("http://api.urbandictionary.com/v0/define?term=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")), [], true, function(res, passback){
			try{
				var word = res.list[0].word;
				var def = res.list[0].definition;
				chat(user + ": " + word + " - " + def);
			}catch(err){
				chat(user + ": Sorry, no results were returned.");
			}
		});
	}else{
		chat(user + ": Command usage: !define <word>");
	}
}

function listen(user, room, msg, chat, emit){
	if(msg.length >= 2){
		getReq("http://tinysong.com/b/" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "?format=json&key=" + tinySongKey, [], true, function(res, passback){
			try{
				var title = res.SongName + " by " + res.ArtistName;
				var url = res.Url;
				chat(user + ": " + title + " - " + url);
			}catch(err){
				chat(user + ": Sorry, no results were returned.");
			}
		});
	}else{
		chat(user + ": Command usage: !listen <song/artist/album>");
	}
}

function flirt(user, room, msg, chat, emit){
	if(msg.length == 2){
		chat(msg[1] + ": " + flirts[Math.floor(Math.random() * flirts.length)] + " With love from " + user + ".");
	}else{
		chat(user + ": Command usage: !flirt <user to flirt with>");
	}
}

function ai(user, room, msg, chat, emit){
	if(msg.length >= 2){
		getReq("http://api.wolframalpha.com/v2/query?input=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "&appid=" + wolframKey, [], false, function(res, passback){
			xmlParse(res, function (err, result) {
				try{
					var answer = result.queryresult.pod[1].subpod[0].plaintext[0];
					chat(user + ": " + answer);
				}catch(err){
					chat(user + ": Sorry, no results were returned.");
				}
			});
		});
	}else{
		chat(user + ": Command usage: !ai <query string>");
	}
}



function save(callback){
	var stream = fs.createWriteStream("bals.json", {flags: 'w'});
	stream.end(JSON.stringify(bals));
	stream.on('finish', function(){
		log("Saved user balances.");
		if(typeof callback !== 'undefined') callback();
	});
}

function getReq(url, args, json, func){
	http.get(url, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			var resp = body;
			if(json == true) {
                try{
				    var resp = JSON.parse(body);
                }catch(err){
                    resp = null;
                }
			}
			func(resp, args);
		});
	}).on('error', function(e) {
			console.log("Got error: ", e);
	});
}

function query(query, callback){
	pool.getConnection(function(err, con){
		if(err){
			console.log(err);
		}else{
			con.query(query, function(err, rows) {
				if (err){
					console.log(err);
				}else{
					con.release();
					callback(rows);
				}
			});
		}
	});
}

function log(msg){
	var mins = Math.floor(Date.now() / 60000) % 1440;
	var time = Math.floor(mins / 60) + ":" + Math.floor(mins % 60);
	console.log("[" + time + "] " + msg);
	logs += "[" + time + "] " + msg + "\n";
}