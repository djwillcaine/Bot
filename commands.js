var fs = require('fs');
var http = require('http');
var xmlParse = require('xml2js').parseString;

var bals = JSON.parse(fs.readFileSync("bals.json"));
var transactions = {};
var data = JSON.parse(fs.readFileSync("data.json"));
var flirts = data["flirts"];
var insults = data["insults"];

var tinySongKey = "xxx"; // TODO: Insert API keys!
var wolframKey =  "xxx"; // TODO: Insert API keys!

var cur_codes = ["usd", "aud", "cad", "chf", "cny", "dkk", "eur", "gbp", "hkd", "jpy", "nzd", "pln", "rub", "sek", "sgd", "thb", "nok", "czk"];
var btc_codes = {
	"btc": 1,
	"cbtc": 100,
	"mbtc": 1000,
	"ubtc": 1000000,
	"sat": 100000000,
	"satoshi": 100000000,
	"satoshis": 100000000
};

var allCmds = ["!commands", "!help", "!search", "!watch", "!listen", "!define", "!ai", "!flirt", "!doge", "!botbal", "!tip", "!say", "!shutdown", "!bal", "!cashout", "!roll", "!save", "!setbal", "!userbals", "!donate"];

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
	"!donate"	: donate,
	"!escrow"	: escrow,

	"!bal"		: bal,
	"!cashout"	: cashout,
	"!roll"		: roll,

	"!join"		: function(user, room, msg, chat, emit) { if (user == "cainy") emit("joinroom", { join: msg[1] }); },
	"!leave"	: function(user, room, msg, chat, emit) { if (user == "cainy") emit("quitroom", { room: msg[1] }); },
	"!botbal"	: function(user, room, msg, chat, emit, bal) { if (user == "cainy") chat("Balance: " + bal()); },
	"!tip"		: function(user, room, msg, chat, emit) { if (user == "cainy") emit("tip", { user: msg[1], tip: msg[2], room: msg[3], message: msg.splice(4, msg.length - 4).join(" ") }); },
	"!say"		: function(user, room, msg, chat) { if (user == "cainy") chat(msg.splice(2, msg.length - 2).join(" "), msg[1]); },
	"!restart"	: restart,
	"!save"		: function(user, room, msg, chat) { if (user == "cainy") save(function() { chat("Saved user data to file.") }); },
	"!setbal"	: setBal,
	"!userbals"	: function(user, room, msg, chat) { if (user == "cainy") chat(JSON.stringify(bals).replace(/,/g, ", ")); },
	massTip		: massTip,
	incBal		: incBal,
	getBals		: function() { return bals; },
	rooms		: {
		"bot": allCmds,
		"dogecoin": ["!doge"],
		"plaxant": ["!doge"],
		"bot:cainy": allCmds,
		"diceroll": ["!help", "!roll", "!bal", "!cashout", "!setbal", "!donate"]
	}
};

function massTip(amt, msg, user, userList, room, tip) {
	each = Math.floor((amt * 0.9) / (userList.length - 1));
	if (amt >= 50 && each >= 5) {
		log("Mass tip: " + amt + " from " + user + " => " + each + " doge to " + (userList.length - 1) + " users.");
		tips = 0;
		for (i in userList) {
			setTimeout(function() {
				if(userList[i] != user.toLowerCase() && tips < 8) {
					tips++;
					tip(userList[i], each);
				}
			}, i * 500);
		}
	}
}

function restart(user, room, msg, chat) {
	if (user == "cainy") {
		chat("Bot is restarting...");
		log("Bot is shutting down...");
		chat(JSON.stringify(bals).replace(/,/g, ", "));
		setTimeout(function() {
			process.exit(0)
		}, 5000);
	}
}

function escrow(user, room, msg, chat) {
	if (msg[1] == "init" && msg.length == 4) {
		if (bals[user] < Number(msg[3]) && isNaN(Number(msg[3])) === false) {
			chat(user + ": Please deposit enough to initiate this transaction into your balance by tipping bot.");
		} else {
			id = Math.floor(Math.random() * 90000) + 10000
			transactions[id] = {sender: user.toLowerCase(), recipient: msg[2], amt: Number(msg[3]), status: "Pending Confirmation of Sender", updated: new Date().toJSON(), sConf: false, rConf: false, sCanc: false, sCanc: false, halt: false};
			chat(user + ": Transaction initiated with ID of " + id + ". You will be sending " + msg[3] + " DOGE to the user " + msg[2] + ". To confirm this transaction type !escrow confirm " + id + " or to cancel it and try again type !escrow cancel " + id + ".");
		}
	} else if (msg[1] == "confirm" && msg.length == 3) {
		id = Number(msg[2]);
		if (typeof transactions[id] !== 'undefined') {
			if (transactions[id].sender == user.toLowerCase()) {
				if (bals[user] < transactions[id].amt) {
					chat(user + ": Please deposit enough to confirm this transaction into your balance by tipping bot.");
				} else {
					bals[user] -= transactions[id].amt;
					transactions[id].status = "Funds taken from sender. Pending confirmation of goods/services from either party.";
					transactions[id].updated = new Date().toJSON();
					chat(user + ": Transaction ID " + id + " confirmed, funds have been removed from your balance. Either party can now type !escrow complete " + id + " to confirm the goods/services have been sent/received. Once both parties mark the transaction as complete, the recipient will receive the funds.");
				}
			} else {
				chat(user + ": You are no the sender of this transaction and so cannot confirm it.");
			}
		} else {
				chat(user + ": Invalid ID number supplied.");
			}
	} else if (msg[1] == "complete" && msg.length == 3) {
		id = Number(msg[2]);
		if (typeof transactions[id] !== 'undefined') {
			if (transactions[id].halt) {
				chat(user + ": This transaction cannot be updated as it is in dispute.");
			} else {
				if (transactions[id].sender == user.toLowerCase()) {
					if (transactions[id].sConf === false) {
						if (transactions[id].rCanc === true) {
							chat(user + ": The recipient has already marked this transaction as cancelled. Ask them to mark it as complete first. To raise a dispute type !escrow dispute " + id + ".");
						} else {
							transactions[id].sConf = true;
							transactions[id].sCanc = false;
							if (transactions[id].rConf === true) {
								chat(user + ": Transaction complete, now moving funds to the recipients balance.");
								bals[transactions[id].recipient] = (bals[transactions[id].recipient] ? bals[transactions[id].recipient] : 0) + transactions[id].amt;
								transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
								transactions[id].updated = new Date().toJSON();
								chat("Transaction " + id + " complete. You have received " + transactions[id].amt + " DOGE from " + transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].recipient);
							} else {
								chat(user + ": You have marked this transaction as complete. Once the other party does so funds will be transferred to the recipients balance.");
								transactions[id].status = "Sender has marked the transaction as complete. Pending recipient confirmation.";
								transactions[id].updated = new Date().toJSON();
							}
						}
					} else {
						chat(user + ": You have already marked this transaction as complete. It's current status is: " + transactions[id].status);
					}
				} else if (transactions[id].recipient == user.toLowerCase()) {
					if (transactions[id].rConf === false) {
						if (transactions[id].sCanc === true) {
							chat(user + ": The recipient has already marked this transaction as cancelled. Ask them to mark it as complete first. To raise a dispute type !escrow dispute " + id + ".");
						} else {
							transactions[id].rConf = true;
							transactions[id].rCanc = false;
							if (transactions[id].sConf === true) {
								chat(user + ": Transaction complete, now moving funds to the recipients balance.");
								bals[transactions[id].recipient] = (bals[transactions[id].recipient] ? bals[transactions[id].recipient] : 0) + transactions[id].amt;
								transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
								transactions[id].updated = new Date().toJSON();
								chat("Transaction " + id + " complete. You have received " + transactions[id].amt + " DOGE from " + transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].recipient);
							} else {
								chat(user + ": You have marked this transaction as complete. Once the other party does so funds will be transferred to the recipients balance.");
								transactions[id].status = "Recipient has marked the transaction as complete. Pending sender confirmation.";
								transactions[id].updated = new Date().toJSON();
							}
						}
					} else {
						chat(user + ": You have already marked this transaction as complete. It's current status is: " + transactions[id].status);
					}
				} else {
					chat(user + ": Your are not involved in this transaction. Please check the ID number you supplied.");
				}
			}
		} else {
			chat(user + ": Invalid ID number supplied.");
		}
	} else if (msg[1] == "cancel" && msg.length == 3) {
		id = Number(msg[2]);
		if (typeof transactions[id] !== 'undefined') {
			if (transactions[id].halt) {
				chat(user + ": This transaction cannot be updated as it is in dispute.");
			} else if (transactions[id].status == "Pending Confirmation of Sender") {
				chat(user + ": Your transaction has been cancelled.");
				delete transactions[id];
			} else {
				if (transactions[id].sender == user.toLowerCase()) {
					if (transactions[id].sCanc === false) {
						if (transactions[id].rConf === true) {
							chat(user + ": The recipient has already marked this transaction as complete. Ask them to mark it as cancelled first. To raise a dispute type !escrow dispute " + id + ".");
						} else {
							transactions[id].sCanc = true;
							transactions[id].sConf = false;
							if (transactions[id].rCanc === true) {
								chat(user + ": Transaction cancelled, now moving funds to the recipients balance.");
								bals[transactions[id].sender] = (bals[transactions[id].sender] ? bals[transactions[id].sender] : 0) + transactions[id].amt;
								transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
								transactions[id].updated = new Date().toJSON();
								chat("Transaction " + id + " cancelled. You have been refunded " + transactions[id].amt + " DOGE from " + transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].sender);
							} else {
								chat(user + ": You have marked this transaction as cancelled. Once the other party does so funds will be transferred back to the senders balance.");
								transactions[id].status = "Sender has marked the transaction as cancelled. Pending recipient confirmation.";
								transactions[id].updated = new Date().toJSON();
							}
						}
					} else {
						chat(user + ": You have already marked this transaction as complete. It's current status is: " + transactions[id].status);
					}
				} else if (transactions[id].recipient == user.toLowerCase()) {
					if (transactions[id].rConf === false) {
						if (transactions[id].rConf === true) {
							chat(user + ": The sender has already marked this transaction as complete. Ask them to mark it as cancelled first. To raise a dispute type !escrow dispute " + id + ".");
						} else {
							transactions[id].rCanc = true;
							transactions[id].rConf = false;
							if (transactions[id].sConf === true) {
								chat(user + ": Transaction cancelled, now moving funds to the recipients balance.");
								bals[transactions[id].sender] = (bals[transactions[id].sender] ? bals[transactions[id].sender] : 0) + transactions[id].amt;
								transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
								transactions[id].updated = new Date().toJSON();
								chat("Transaction " + id + " cancelled. You have been refunded " + transactions[id].amt + " DOGE from " + transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].sender);
							} else {
								chat(user + ": You have marked this transaction as cancelled Once the other party does so funds will be transferred back to the senders balance.");
								transactions[id].status = "Recipient has marked the transaction as cancelled. Pending sender confirmation.";
								transactions[id].updated = new Date().toJSON();
							}
						}
					} else {
						chat(user + ": You have already marked this transaction as cancelled. It's current status is: " + transactions[id].status);
					}
				} else {
					chat(user + ": Your are not involved in this transaction. Please check the ID number you supplied.");
				}
			}
		} else {
			chat(user + ": Invalid ID number supplied.");
		}
	} else if(msg[1] == "dispute" && msg.length == 3) {
		id = Number(msg[2]);
		if (typeof transactions[id] !== 'undefined') {
			transactions[id].halt = true;
			chat("Dispute raised on transaction " + id + " \\ " + transactions[id].sender + "->" + transactions[id].recipient + " - " + transactions[id].amt + " DOGE \\ " + 
				"Completed: " + transactions[id].sConf + "->" + transactions[id].rConf + " \\ Cancelled: " + transactions[id].sCanc + "->" + transactions[id].rCanc)
		} else {
			chat(user + ": Invalid ID number supplied.");
		}
	} else if(msg[1] == "admin" && user == "cainy") {
		id = Number(msg[3]);
		if (typeof transactions[id] !== 'undefined') {
			if (transactions[id].status == "Transaction complete. Funds have been transferred to the recipients balance." || transactions[id].status == "Transaction cancelled. Funds have been transferred back to the senders balance.") {
				chat(user + ": Transaction " + id + " already complete or cancelled. No funds are being held.");
			} else {
				if (msg[2] == "complete" && transactions[id].status != "Transaction complete. Funds have been transferred to the recipients balance." && transactions[id].status != "Transaction cancelled. Funds have been transferred back to the senders balance.") {
					transactions[id].sConf = true;
					transactions[id].rConf = true;
					transactions[id].sCanc = false;
					transactions[id].rCanc = false;
					transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
					chat("Transaction " + id + " complete. You have received " + transactions[id].amt + " DOGE from " + transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].recipient);
				} else if (msg[2] == "cancel" && transactions[id].status != "Transaction complete. Funds have been transferred to the recipients balance." && transactions[id].status != "Transaction cancelled. Funds have been transferred back to the senders balance.") {
					transactions[id].sConf = false;
					transactions[id].rConf = false;
					transactions[id].sCanc = true;
					transactions[id].rCanc = true;
					transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
					chat("Transaction " + id + " cancelled. You have been refunded " + transactions[id].amt + " DOGE from " + transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + transactions[id].sender);
				} else if (msg[2] == "halt") {
					transactions[id].halt = true;
				} else if (msg[2] == "delete") {
					delete transactions[id];
				}
			}
		} else {
			chat(user + ": Invalid ID number supplied.");
		}
	} else if (msg[1] == "status" && msg.length == 3) {
		id = Number(msg[2]);
		if (typeof transactions[id] !== 'undefined') {
			if (transactions[id].sender == user.toLowerCase() || transactions[id].recipient == user.toLowerCase()) {
				chat(user + ": Transaction " + id + " status: " + transactions[id].status);
			} else {
				chat(user + ": Your are not involved in this transaction. Please check the ID number you supplied.")
			}
		} else {
			chat(user + ": Invalid ID number supplied.");
		}
	} else {
		chat(user + ": Command usage: !escrow <command> [par1, par2...]");
	}
}

function bal(user, room, msg, chat) {
	chat(user + ": Your current balance is " + (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) + " DOGE.")
}

function cashout(user, room, msg, chat, emit) {
	bal = bals[user.toLowerCase()] ? Math.floor(bals[user.toLowerCase()]) : 0
	if (bal >= 5 && msg.length == 1) {
		emit("tip", {
			user: user,
			room: room,
			tip: Math.floor(bals[user.toLowerCase()]),
			message: "CASHOUT"
		});
		log(user + " has cashed out " + Math.floor(bals[user.toLowerCase()]) + " DOGE.");
		bals[user.toLowerCase()] = bals[user.toLowerCase()] - Math.floor(bals[user.toLowerCase()]);
	} else if (msg.length == 2 && bal >= 5 && bal <= Math.floor(Number(msg[1]))) {
		emit("tip", {
			user: user,
			room: room,
			tip: Math.floor(Number(msg[1])),
			message: "CASHOUT"
		});
		log(user + " has cashed out " + Math.floor(Number(msg[1])) + " DOGE.");
		bals[user.toLowerCase()] -= Math.floor(Number(msg[1]));
	} else {
		chat(user + ": Your balance must be above 5 DOGE and you must not specify an number greater than your balance.");
	}
}

function roll(user, room, msg, chat) {
	if (msg.length != 2) {
		chat(user + ": Command usage: !roll <bet>");
	} else {
		bet = Math.floor(Number(msg[1]));
		if (bet > (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) || bet < 5 || bet > 100 || isNaN(bet)) {
			chat(user + ": Please bet an amount between 5 and 100 DOGE and no higher than your current balance.");
		} else {
			net = 0 - bet;
			var roll1 = Math.floor(Math.random() * 6) + 1;
			var roll2 = Math.floor(Math.random() * 6) + 1;
			if (roll1 == 6 && roll2 == 6) {
				net += bet * 4
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". Jackpot! You win 4x your bet - " + (4 * bet) + "! Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			} else if (roll1 == roll2) {
				net += bet * 2;
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". That's a double! You win 2x your bet - " + (2 * bet) + "! Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			} else if (roll1 == 6 || roll2 == 6) {
				net += Number((bet * 1.5).toFixed(1));
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". That's a single 6! You win 1.5x your bet - " + (1.5 * bet).toFixed(1) + "! Balance: " + (bals[user.toLowerCase()] + net).toFixed(1) + " DOGE.");
			} else {
				chat(user + ": You rolled " + roll1 + " and " + roll2 + ". Unlucky, you didn't win anything. Balance: " + (bals[user.toLowerCase()] + net) + " DOGE.");
			}
			bals[user.toLowerCase()] += net;
		}
	}
}

function donate(user, room, msg, chat) {
	var bal = bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0;
	if (msg.length == 1) {
		if (bal > 0) {
			chat(user + ": Thank you very much for your donation of " + bal + " DOGE, it is much appreciated!");
			bals[user.toLowerCase()] = 0;
		}
	} else if (msg.legnth == 2) {
		var amt = Number(msg[1]);
		if (isNaN(amt) == false && amt <= bal && amt > 0) {
			chat(user + ": Thank you very much for your donation of " + amt + " DOGE, it is much appreciated!");
			bals[user.toLowerCase()] -= amt;
		}
	}
}

function setBal(user, room, msg, chat) {
	if (user == "cainy") {
		bals[msg[1]] = Number(msg[2]);
		chat("Updated " + msg[1] + "'s balance.");
	}
}

function incBal(user, room, amt, chat) {
	bals[user.toLowerCase()] = (bals[user.toLowerCase()] ? bals[user.toLowerCase()] : 0) + amt
	chat(user + ": Your balance has been updated by " + amt + " DOGE. Balance: " + bals[user.toLowerCase()] + " DOGE.");
	log(user + " has tipped me " + amt + " DOGE.");
}

function doge(user, room, msg, chat) {
	try {
		getReq("http://pubapi.cryptsy.com/api.php?method=singlemarketdata&marketid=132", [], true, function(res, passback) {
			var price = res.
			return .markets.DOGE.lasttradeprice;
			chat(user + ": Last price of Doge was " + Math.round(price * 100000000) + " satoshis (Cryptsy Price) | #bot");
		});
	} catch (err) {
		chat(user + ": I didn't receive a proper response from the Cryptsy API, please try again later.");
	}
}

function help(user, room, msg, chat) {
	if (room == "diceroll") {
		chat(user + ": Welcome to DiceRoll! Tip bot to update your balance. Type !cashout to withdraw your balance. Type !bal to check your balance. Type !roll followed by a bet in doge to gamble some of your balance on the DiceRoll game! See #bot for the fully-featured bot.")
	} else {
		chat(user + ": Welcome to bot - the intelligent bot. Please see http://git.io/dogebot#instructions for more information. Type !commands for a list of available commands.");
	}
}

function commands(user, room, msg, chat) {
	chat(user + ": Commands are: !help, !commands, !ai, !search, !watch, !listen, !define, !flirt, !bal, !cashout, !roll, !doge");
}

function exch(user, room, msg, chat) {
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

function search(user, room, msg, chat) {
	if (msg.length >= 2) {
		getReq("http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")), [], true, function(res, passback) {
			var title = res.responseData.results[0].titleNoFormatting;
			var url = res.responseData.results[0].url;
			chat(user + ": " + title + " - " + url);
		});
	} else {
		chat(user + ": Command usage: !search <query string>");
	}
}

function watch(user, room, msg, chat) {
	if (msg.length >= 2) {
		getReq("http://gdata.youtube.com/feeds/api/videos?q=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "&alt=json&max-results=1", [], true, function(res, passback) {
			var title = res.feed.entry[0].title.$t;
			var url = "http://youtu.be/" + res.feed.entry[0].link[0].href.split("&")[0].split("v=")[1];
			chat(user + ": " + title + " - " + url);
		});
	} else {
		chat(user + ": Command usage: !watch <video title>");
	}
}

function define(user, room, msg, chat) {
	if (msg.length >= 2) {
		getReq("http://api.urbandictionary.com/v0/define?term=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")), [], true, function(res, passback) {
			try {
				var word = res.list[0].word;
				var def = res.list[0].definition;
				chat(user + ": " + word + " - " + def);
			} catch (err) {
				chat(user + ": Sorry, no results were returned.");
			}
		});
	} else {
		chat(user + ": Command usage: !define <word>");
	}
}

function listen(user, room, msg, chat) {
	if (msg.length >= 2) {
		getReq("http://tinysong.com/b/" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "?format=json&key=" + tinySongKey, [], true, function(res, passback) {
			try {
				var title = res.SongName + " by " + res.ArtistName;
				var url = res.Url;
				chat(user + ": " + title + " - " + url);
			} catch (err) {
				chat(user + ": Sorry, no results were returned.");
			}
		});
	} else {
		chat(user + ": Command usage: !listen <song/artist/album>");
	}
}

function flirt(user, room, msg, chat) {
	if (msg.length == 2) {
		chat(msg[1] + ": " + flirts[Math.floor(Math.random() * flirts.length)] + " With love from " + user + ".");
	} else {
		chat(user + ": Command usage: !flirt <user to flirt with>");
	}
}

function ai(user, room, msg, chat) {
	if (msg.length >= 2) {
		getReq("http://api.wolframalpha.com/v2/query?input=" + encodeURIComponent(msg.splice(1, msg.length - 1).join(" ").replace("&#039;", "'")) + "&appid=" + wolframKey, [], false, function(res, passback) {
			xmlParse(res, function(err, result) {
				try {
					var answer = result.queryresult.pod[1].subpod[0].plaintext[0];
					chat(user + ": " + answer);
				} catch (err) {
					chat(user + ": Sorry, no results were returned.");
				}
			});
		});
	} else {
		chat(user + ": Command usage: !ai <query string>");
	}
}

setInterval(function(){
	save();
}, 1000 * 60 * 15);

function save(callback) {
	var stream = fs.createWriteStream("bals.json", {
		flags: 'w'
	});
	stream.end(JSON.stringify(bals));
	stream.on('finish', function() {
		log("Saved user balances.");
		if (typeof callback !== 'undefined') callback();
	});
}

function getReq(url, args, json, func) {
	http.get(url, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			var resp = body;
			if (json == true) {
				try {
					var resp = JSON.parse(body);
				} catch (err) {
					resp = null;
				}
			}
			func(resp, args);
		});
	}).on('error', function(e) {
		console.log("Got error: ", e);
	});
}

function log(msg) {
	var mins = Math.floor(Date.now() / 60000) % 1440;
	var time = Math.floor(mins / 60) + ":" + Math.floor(mins % 60);
	console.log("[" + time + "] " + msg);
	GLOBAL.log += "[" + time + "] " + msg + "\n";
}
