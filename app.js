// Initialize variables //
var fs			= require('fs')
  , dbFile		= fs.readFileSync("db.json")
  , http		= require('http')
  , https		= require('https')
  , xmlParse	= require('xml2js').parseString
  , bot			= require('dogechat-bot')
  , util		= require('./util')
  , config		= require('./config.json')
  , data		= require('./data.json')
  , flirts		= data["flirts"]
  , insults		= data["insults"]
  , jokes		= data["jokes"]
  , admins		= config.admins;


// Read the database from file //
try {
	db = JSON.parse(dbFile);
} catch (err) {
	db = {
		"transactions"	: {},
		"balances"		: {},
		"userList"		: {},
		"masstips"		: 0
	}
}


// Create admin web page //
var server = http.createServer(function(request, response) {
	response.writeHead(200, {
		"Content-Type": "text/html"
	});
	userBals = "";
	roomList = "";
	for (user in db.bals) { userBals += "<tr><td>" + user + "</td><td>" + db.bals[user] + "</td></tr>"; }
	for (room in db.userList) { roomList += "<tr><th>" + room + "</th><td>" + db.userList[room].join(", ") + "</td></tr>"; }
	response.end(fs.readFileSync("admin.html").toString().replace("%bal%", bot.getBalance() + " - Mass tips: " + db.masstips).replace("%userbals%", userBals).replace("%roomlist%", roomList).replace("%logs%", util.getLog()));
}).listen(80);


// Connect to DogeChat //
bot.connect(config.credentials.username, config.credentials.password, function() {
	util.log("Successfully logged in.");
	bot.joinRoom("bot");
	bot.joinRoom("bot:cainy");
	bot.joinRoom("diceroll");
	bot.joinRoom("lobby");
	bot.joinRoom("plaxant");
	bot.joinRoom("dogecoin");
});


// Manage events //
bot.onTip(function(data) {
	if (data.room === "lobby" || data.message === "masstip") {
		massTip(data.amount, data.user, data.room);
	} else {
		db.bals[data.user.toLowerCase()] = (db.bals[data.user.toLowerCase()] ? db.bals[data.user.toLowerCase()] : 0) + data.amount;
		bot.chat(data.user + ": Your balance has been updated by " + data.amount + " Dogecoin. Balance: " + db.bals[data.user.toLowerCase()] + " Dogecoin.", data.room);
		util.log(data.user + " has tipped me " + data.amount + " Dogecoin.");
	}
});

bot.onChat(function(data) {
	db.userList[data.room] = (db.userList[data.room] ? db.userList[data.room] : []);
	if (db.userList[data.room].indexOf(data.user.toLowerCase()) != -1) {
		db.userList[data.room].splice(db.userList[data.room].indexOf(data.user.toLowerCase()), 1);
	}
	db.userList[data.room].unshift(data.user.toLowerCase())
});


// Add admin commands to the registry //
bot.addCommand("!join", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.joinRoom(data.messageArray[0]);
	}
});

bot.addCommand("!leave", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.quitRoom(data.messageArray[0]);
	}
});

bot.addCommand("!botbal", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.chat("Balance: " + bot.getBalance() + " Dogecoin", data.room);
	}
});

bot.addCommand("!tip", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.tip(data.messageArray[0], data.messageArray[1], data.messageArray[2], data.messageArray.slice(3).join(" "));
	}
});

bot.addCommand("!say", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		room = data.messageArray.shift();
		bot.chat(data.messageArray.join(" "), room);
	}
});

bot.addCommand("!save", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		util.save(db, function() {
			bot.chat("Saved database to file.", data.room);
		});
	}
});

bot.addCommand("!setmasstips", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		masstips = Number(data.messageArray[0]);
	}
});

bot.addCommand("!restart", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.chat("Bot is restarting, please don't tip for the next minute or so.");
		util.log("Shutting down...");
		util.save(db, function() {
			setTimeout(function() {
				process.exit(0)
			}, 3000);
		});
	}
});

bot.addCommand("!setbal", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		db.bals[data.messageArray[0].toLowerCase()] = Number(data.messageArray[1]);
		bot.chat("Updated " + data.messageArray[0] + "'s balance.", data.room);
	}
});

bot.addCommand("!setcolour", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.setColor(data.messageArray[0]);
		bot.chat("Colour set to " + data.messageArray[0], data.room);
	}
});

bot.addCommand("!setbadge", function(data) {
	if (admins.indexOf(data.user.toLowerCase()) !== -1) {
		bot.setBadge(data.messageArray[0]);
		bot.chat("Badge set to " + data.messageArray[0], data.room);
	}
});


// Add user commands to the registry //
bot.addCommand("!bal", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		bot.chat(data.user + ": Your current balance is " + (db.bals[data.user.toLowerCase()] ? db.bals[data.user.toLowerCase()] : 0) + " Dogecoin.", data.room)
	}
});

bot.addCommand("!cashout", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		bal = db.bals[data.user.toLowerCase()] ? Math.floor(db.bals[data.user.toLowerCase()]) : 0
		if (bal >= 5 && data.messageArray.length == 0) {
			bot.tip(data.user, bal, data.room, "CASHOUT");
			util.log(data.user + " has cashed out " + bal + " Dogecoin.");
			db.bals[data.user.toLowerCase()] -= bal;
		} else if (data.messageArray.length == 1 && bal >= 5 && bal >= Math.floor(Number(data.messageArray[0]))) {
			bot.tip(data.user, Math.floor(Number(data.messageArray[0])), data.room, "CASHOUT");
			util.log(data.user + " has cashed out " + Math.floor(Number(data.messageArray[0])) + " Dogecoin.");
			db.bals[data.user.toLowerCase()] -= Math.floor(Number(data.messageArray[0]));
		} else {
			util.log(Math.floor(Number(data.messageArray[0])) + " " + bal + " " + data.messageArray.length)
			bot.chat(data.user + ": Your balance must be above 5 Dogecoin and you must not specify an number greater than your balance.", data.room);
		}
	}
});

bot.addCommand("!roll", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length != 1) {
			bot.chat(data.user + ": Command usage: !roll <bet>", data.room);
		} else {
			bet = Math.floor(Number(data.messageArray[0]));
			if (bet > (db.bals[data.user.toLowerCase()] ? db.bals[data.user.toLowerCase()] : 0) || bet < 5 || bet > 500 || isNaN(bet)) {
				bot.chat(data.user + ": Please bet an amount between 5 and 500 Dogecoin inclusive and no higher than your current balance.", data.room);
			} else {
				net = 0 - bet;
				var roll1 = Math.floor(Math.random() * 6) + 1;
				var roll2 = Math.floor(Math.random() * 6) + 1;
				if (roll1 == 6 && roll2 == 6) {
					net += bet * 4
					bot.chat(data.user + ": You rolled " + roll1 + " and " + roll2 + ". Jackpot! You win 4x your bet - " + (4 * bet) + "! Balance: " + (db.bals[data.user.toLowerCase()] + net) + " Dogecoin.", data.room);
				} else if (roll1 == roll2) {
					net += bet * 2;
					bot.chat(data.user + ": You rolled " + roll1 + " and " + roll2 + ". That's a double! You win 2x your bet - " + (2 * bet) + "! Balance: " + (db.bals[data.user.toLowerCase()] + net) + " Dogecoin.", data.room);
				} else if (roll1 == 6 || roll2 == 6) {
					net += Number((bet * 1.5).toFixed(1));
					bot.chat(data.user + ": You rolled " + roll1 + " and " + roll2 + ". That's a single 6! You win 1.5x your bet - " + (1.5 * bet).toFixed(1) + "! Balance: " + (db.bals[data.user.toLowerCase()] + net).toFixed(1) + " Dogecoin.", data.room);
				} else {
					bot.chat(data.user + ": You rolled " + roll1 + " and " + roll2 + ". Unlucky, you didn't win anything. Balance: " + (db.bals[data.user.toLowerCase()] + net) + " Dogecoin.", data.room);
				}
				db.bals[data.user.toLowerCase()] += net;
			}
		}
	}
});

bot.addCommand("!donate", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		var bal = db.bals[data.user.toLowerCase()] ? db.bals[data.user.toLowerCase()] : 0;
		if (data.messageArray.length == 0) {
			if (bal > 0) {
				bot.chat(data.user + ": Thank you very much for your donation of " + bal + " Dogecoin, it is much appreciated!", data.room);
				db.bals[data.user.toLowerCase()] = 0;
			}
		} else if (data.messageArray.length == 1) {
			var amt = Number(data.messageArray[0]);
			if (isNaN(amt) == false && amt <= bal && amt > 0) {
				bot.chat(data.user + ": Thank you very much for your donation of " + amt + " Dogecoin, it is much appreciated!", data.room);
				db.bals[data.user.toLowerCase()] -= amt;
			}
		}
	}
});

bot.addCommand("!doge", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		util.getReq("http://pubapi.cryptsy.com/api.php?method=singlemarketdata&marketid=132", true, function(res) {
			var price = res.return.markets.DOGE.lasttradeprice;
			if (data.messageArray.length <= 1) {
				i = 1;
				if (isFinite(Number(data.messageArray[0]))) i = Number(data.messageArray[0]);
				bot.chat(data.user + ": " + i + " Dogecoin = " + (price * i) + " BTC", data.room);
			} else if (data.messageArray.length == 2) {
				i = 1;
				if (isFinite(Number(data.messageArray[0]))) i = Number(data.messageArray[0]);
				if(config.currencyCodes.indexOf(data.messageArray[1]) == -1) {
					bot.chat(data.user + ": Unrecognised Currency. Supported fiat currencies are: " + config.currencyCodes.join(", ") + ".", data.room);
				} else {
					util.getReq("https://api.bitcoinaverage.com/ticker/" + data.messageArray[1].toUpperCase() + "/", true, function(res) {
						bot.chat(data.user + ": " + i + " Dogecoin = " + Number((price * i * res['24h_avg']).toFixed(10)) + " " + data.messageArray[1].toUpperCase(), data.room);
					}, true);
				}
			}
		});
	}
});

bot.addCommand("!help", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.room == "diceroll") {
			bot.chat(data.user + ": Welcome to DiceRoll! Tip bot to update your balance. Type !cashout to withdraw your balance. Type !bal to check your balance. Type !roll followed by a bet in doge to gamble some of your balance on the DiceRoll game! See #bot for the fully-featured bot.", data.room);
		} else {
			bot.chat(data.user + ": Welcome to bot - the intelligent bot. Please see http://git.io/dogebot#instructions for more information. Type !commands for a list of available commands.", data.room);
		}
	}
});

bot.addCommand("!commands", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.room == "diceroll") {
			bot.chat(data.user + ": Commands are: !help, !commands, !roll, !bal, !cashout, !donate", data.room);
		} else {
			bot.chat(data.user + ": Commands are: !help, !commands, !ai, !search, !watch, !listen, !define, !flirt, !joke, !bal, !cashout, !donate, !escrow, !roll, !doge", data.room);
		}
	}
});

bot.addCommand("!search", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length >= 1) {
			util.getReq("http://ajax.googleapis.com/ajax/services/search/web?v=1.0&q=" + encodeURIComponent(data.message), true, function(res, passback) {
				var title = res.responseData.results[0].titleNoFormatting;
				var url = res.responseData.results[0].url;
				bot.chat(data.user + ": " + title + " - " + url, data.room);
			});
		} else {
			bot.chat(data.user + ": Command usage: !search <query string>", data.room);
		}
	}
});

bot.addCommand("!watch", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (msg.length >= 2) {
			util.getReq("http://gdata.youtube.com/feeds/api/videos?q=" + encodeURIComponent(data.message) + "&alt=json&max-results=1", true, function(res, passback) {
				var title = res.feed.entry[0].title.$t;
				var url = "http://youtu.be/" + res.feed.entry[0].link[0].href.split("&")[0].split("v=")[1];
				bot.chat(data.user + ": " + title + " - " + url, data.room);
			});
		} else {
			bot.chat(data.user + ": Command usage: !watch <video title>", data.room);
		}
	}
});

bot.addCommand("!define", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length >= 1) {
			util.getReq("http://api.urbandictionary.com/v0/define?term=" + encodeURIComponent(data.message), true, function(res, passback) {
				try {
					var word = res.list[0].word;
					var def = res.list[0].definition;
					if (def.length > 300) {
						def = def.slice(0, 297) + "... [ " + res.list[0].permalink = " ]";
					}
					bot.chat(data.user + ": " + word + " - " + def, data.room);
				} catch (err) {
					bot.chat(data.user + ": Sorry, no results were returned.", data.room);
				}
			});
		} else {
			bot.chat(data.user + ": Command usage: !define <word>", data.room);
		}
	}
});

bot.addCommand("!listen", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length >= 1) {
			util.getReq("http://tinysong.com/b/" + encodeURIComponent(data.message) + "?format=json&key=" + config.tinySongKey, true, function(res, passback) {
				try {
					var title = res.SongName + " by " + res.ArtistName;
					var url = res.Url;
					bot.chat(data.user + ": " + title + " - " + url, data.room);
				} catch (err) {
					bot.chat(data.user + ": Sorry, no results were returned.", data.room);
				}
			});
		} else {
			bot.chat(data.user + ": Command usage: !listen <song/artist/album>", data.room);
		}
	}
});

bot.addCommand("!joke", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		bot.chat(data.user + ": " + jokes[Math.floor(Math.random() * jokes.length)], data.room);
	}
});

bot.addCommand("!flirt", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length == 1) {
			bot.chat(data.messageArray[0] + ": " + flirts[Math.floor(Math.random() * flirts.length)] + " With love from " + data.user + ".", data.room);
		} else {
			bot.chat(data.user + ": Command usage: !flirt <user to flirt with>", data.room);
		}
	}
});

bot.addCommand("!ai", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray.length >= 1) {
			util.getReq("http://api.wolframalpha.com/v2/query?input=" + encodeURIComponent(data.message.replace("&#039;", "'")) + "&appid=" + config.wolframKey, false, function(res, passback) {
				xmlParse(res, function(err, result) {
					try {
						var answer = result.queryresult.pod[1].subpod[0].plaintext[0];
						bot.chat(data.user + ": " + answer, data.room);
					} catch (err) {
						bot.chat(data.user + ": Sorry, no results were returned.", data.room);
					}
				});
			});
		} else {
			bot.chat(data.user + ": Command usage: !ai <query string>", data.room);
		}
	}
});

bot.addCommand("!escrow", function(data) {
	if (config.roomCommands[data.room].indexOf(data.command) !== -1) {
		if (data.messageArray[0] == "init" && msg.length == 4) {
			if (db.bals[data.user.toLowerCase()] < Number(data.messageArray[2]) && isNaN(Number(data.messageArray[2])) === false) {
				bot.chat(data.user + ": Please deposit enough to initiate this transaction into your balance by tipping bot.", data.room);
			} else {
				id = Math.floor(Math.random() * 90000) + 10000
				db.transactions[id] = {sender: data.user.toLowerCase(), recipient: data.messageArray[1], amt: Number(data.messageArray[2]), status: "Pending Confirmation of Sender", updated: new Date().toJSON(), sConf: false, rConf: false, sCanc: false, sCanc: false, halt: false};
				bot.chat(data.user + ": Transaction initiated with ID of " + id + ". You will be sending " + data.messageArray[2] + " Dogecoin to the user " + data.messageArray[1] + ". To confirm this transaction type !escrow confirm " + id + " or to cancel it and try again type !escrow cancel " + id + ".", data.room);
			}
		} else if (data.messageArray[0] == "confirm" && data.messageArray.length == 2) {
			id = Number(data.messageArray[1]);
			if (typeof db.transactions[id] !== 'undefined') {
				if (db.transactions[id].sender == data.user.toLowerCase()) {
					if (db.bals[data.user.toLowerCase()] < db.transactions[id].amt) {
						bot.chat(data.user + ": Please deposit enough to confirm this transaction into your balance by tipping bot.", data.room);
					} else {
						db.bals[data.user.toLowerCase()] -= db.transactions[id].amt;
						db.transactions[id].status = "Funds taken from sender. Pending confirmation of goods/services from either party.";
						db.transactions[id].updated = new Date().toJSON();
						bot.chat(data.user + ": Transaction ID " + id + " confirmed, funds have been removed from your balance. Either party can now type !escrow complete " + id + " to confirm the goods/services have been sent/received. Once both parties mark the transaction as complete, the recipient will receive the funds.", data.room);
					}
				} else {
					bot.chat(data.user + ": You are no the sender of this transaction and so cannot confirm it.", data.room);
				}
			} else {
					bot.chat(data.user + ": Invalid ID number supplied.", data.room);
				}
		} else if (data.messageArray[0] == "complete" && data.messageArray.length == 2) {
			id = Number(data.messageArray[1]);
			if (typeof db.transactions[id] !== 'undefined') {
				if (db.transactions[id].halt) {
					bot.chat(data.user + ": This transaction cannot be updated as it is in dispute.", data.room);
				} else {
					if (db.transactions[id].sender == data.user.toLowerCase()) {
						if (db.transactions[id].sConf === false) {
							if (db.transactions[id].rCanc === true) {
								bot.chat(data.user + ": The recipient has already marked this transaction as cancelled. Ask them to mark it as complete first. To raise a dispute type !escrow dispute " + id + ".", data.room);
							} else {
								db.transactions[id].sConf = true;
								db.transactions[id].sCanc = false;
								if (db.transactions[id].rConf === true) {
									bot.chat(data.user + ": Transaction complete, now moving funds to the recipients balance.", data.room);
									db.bals[db.transactions[id].recipient] = (db.bals[db.transactions[id].recipient] ? db.bals[db.transactions[id].recipient] : 0) + db.transactions[id].amt;
									db.transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
									db.transactions[id].updated = new Date().toJSON();
									bot.chat("Transaction " + id + " complete. You have received " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].recipient, data.room);
								} else {
									bot.chat(data.user + ": You have marked this transaction as complete. Once the other party does so funds will be transferred to the recipients balance.");
									db.transactions[id].status = "Sender has marked the transaction as complete. Pending recipient confirmation.";
									db.transactions[id].updated = new Date().toJSON();
								}
							}
						} else {
							bot.chat(data.user + ": You have already marked this transaction as complete. It's current status is: " + db.transactions[id].status, data.room);
						}
					} else if (db.transactions[id].recipient == data.user.toLowerCase()) {
						if (db.transactions[id].rConf === false) {
							if (db.transactions[id].sCanc === true) {
								bot.chat(data.user + ": The recipient has already marked this transaction as cancelled. Ask them to mark it as complete first. To raise a dispute type !escrow dispute " + id + ".", data.room);
							} else {
								db.transactions[id].rConf = true;
								db.transactions[id].rCanc = false;
								if (db.transactions[id].sConf === true) {
									bot.chat(data.user + ": Transaction complete, now moving funds to the recipients balance.", data.room);
									db.bals[db.transactions[id].recipient] = (db.bals[db.transactions[id].recipient] ? db.bals[db.transactions[id].recipient] : 0) + db.transactions[id].amt;
									db.transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
									db.transactions[id].updated = new Date().toJSON();
									bot.chat("Transaction " + id + " complete. You have received " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].recipient, data.room);
								} else {
									bot.chat(data.user + ": You have marked this transaction as complete. Once the other party does so funds will be transferred to the recipients balance.", data.room);
									db.transactions[id].status = "Recipient has marked the transaction as complete. Pending sender confirmation.";
									db.transactions[id].updated = new Date().toJSON();
								}
							}
						} else {
							bot.chat(data.user + ": You have already marked this transaction as complete. It's current status is: " + db.transactions[id].status, data.room);
						}
					} else {
						bot.chat(data.user + ": Your are not involved in this transaction. Please check the ID number you supplied.", data.room);
					}
				}
			} else {
				bot.chat(data.user + ": Invalid ID number supplied.", data.room);
			}
		} else if (data.messageArray[0] == "cancel" && data.messageArray.length == 2) {
			id = Number(data.messageArray[1]);
			if (typeof db.transactions[id] !== 'undefined') {
				if (db.transactions[id].halt) {
					bot.chat(data.user + ": This transaction cannot be updated as it is in dispute.", data.room);
				} else if (db.transactions[id].status == "Pending Confirmation of Sender") {
					bot.chat(data.user + ": Your transaction has been cancelled.", data.room);
					delete db.transactions[id];
				} else {
					if (db.transactions[id].sender == data.user.toLowerCase()) {
						if (db.transactions[id].sCanc === false) {
							if (db.transactions[id].rConf === true) {
								bot.chat(data.user + ": The recipient has already marked this transaction as complete. Ask them to mark it as cancelled first. To raise a dispute type !escrow dispute " + id + ".", data.room);
							} else {
								db.transactions[id].sCanc = true;
								db.transactions[id].sConf = false;
								if (db.transactions[id].rCanc === true) {
									bot.chat(data.user + ": Transaction cancelled, now moving funds to the recipients balance.", data.room);
									db.bals[db.transactions[id].sender] = (db.bals[db.transactions[id].sender] ? db.bals[db.transactions[id].sender] : 0) + db.transactions[id].amt;
									db.transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
									db.transactions[id].updated = new Date().toJSON();
									bot.chat("Transaction " + id + " cancelled. You have been refunded " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].sender, data.room);
								} else {
									bot.chat(data.user + ": You have marked this transaction as cancelled. Once the other party does so funds will be transferred back to the senders balance.", data.room);
									db.transactions[id].status = "Sender has marked the transaction as cancelled. Pending recipient confirmation.";
									db.transactions[id].updated = new Date().toJSON();
								}
							}
						} else {
							bot.chat(data.user + ": You have already marked this transaction as complete. It's current status is: " + db.transactions[id].status, data.room);
						}
					} else if (db.transactions[id].recipient == data.user.toLowerCase()) {
						if (db.transactions[id].rConf === false) {
							if (db.transactions[id].rConf === true) {
								bot.chat(data.user + ": The sender has already marked this transaction as complete. Ask them to mark it as cancelled first. To raise a dispute type !escrow dispute " + id + ".", data.room);
							} else {
								db.transactions[id].rCanc = true;
								db.transactions[id].rConf = false;
								if (db.transactions[id].sConf === true) {
									bot.chat(data.user + ": Transaction cancelled, now moving funds to the recipients balance.", data.room);
									db.bals[db.transactions[id].sender] = (db.bals[db.transactions[id].sender] ? db.bals[db.transactions[id].sender] : 0) + db.transactions[id].amt;
									db.transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
									db.transactions[id].updated = new Date().toJSON();
									bot.chat("Transaction " + id + " cancelled. You have been refunded " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].sender, data.room);
								} else {
									bot.chat(data.user + ": You have marked this transaction as cancelled Once the other party does so funds will be transferred back to the senders balance.", data.room);
									db.transactions[id].status = "Recipient has marked the transaction as cancelled. Pending sender confirmation.";
									db.transactions[id].updated = new Date().toJSON();
								}
							}
						} else {
							bot.chat(data.user + ": You have already marked this transaction as cancelled. It's current status is: " + db.transactions[id].status, data.room);
						}
					} else {
						bot.chat(data.user + ": Your are not involved in this transaction. Please check the ID number you supplied.", data.room);
					}
				}
			} else {
				bot.chat(data.user + ": Invalid ID number supplied.", data.room);
			}
		} else if(data.messageArray[0] == "dispute" && data.messageArray.length == 2) {
			id = Number(data.messageArray[1]);
			if (typeof db.transactions[id] !== 'undefined') {
				db.transactions[id].halt = true;
				bot.chat("Dispute raised on transaction " + id + " \\ " + db.transactions[id].sender + "->" + db.transactions[id].recipient + " - " + db.transactions[id].amt + " Dogecoin \\ " + 
					"Completed: " + db.transactions[id].sConf + "->" + db.transactions[id].rConf + " \\ Cancelled: " + db.transactions[id].sCanc + "->" + db.transactions[id].rCanc, data.room)
			} else {
				bot.chat(data.user + ": Invalid ID number supplied.", data.room);
			}
		} else if(data.messageArray[0] == "admin" && admins.indexOf(data.user) !== -1) {
			id = Number(data.messageArray[2]);
			if (typeof db.transactions[id] !== 'undefined') {
				if (db.transactions[id].status == "Transaction complete. Funds have been transferred to the recipients balance." || db.transactions[id].status == "Transaction cancelled. Funds have been transferred back to the senders balance.") {
					bot.chat(data.user + ": Transaction " + id + " already complete or cancelled. No funds are being held.", data.room);
				} else {
					if (data.messageArray[1] == "complete" && db.transactions[id].status != "Transaction complete. Funds have been transferred to the recipients balance." && db.transactions[id].status != "Transaction cancelled. Funds have been transferred back to the senders balance.") {
						db.transactions[id].sConf = true;
						db.transactions[id].rConf = true;
						db.transactions[id].sCanc = false;
						db.transactions[id].rCanc = false;
						db.transactions[id].status = "Transaction complete. Funds have been transferred to the recipients balance.";
						bot.chat("Transaction " + id + " complete. You have received " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].sender + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].recipient, data.room);
					} else if (data.messageArray[1] == "cancel" && db.transactions[id].status != "Transaction complete. Funds have been transferred to the recipients balance." && db.transactions[id].status != "Transaction cancelled. Funds have been transferred back to the senders balance.") {
						db.transactions[id].sConf = false;
						db.transactions[id].rConf = false;
						db.transactions[id].sCanc = true;
						db.transactions[id].rCanc = true;
						db.transactions[id].status = "Transaction cancelled. Funds have been transferred back to the senders balance.";
						bot.chat("Transaction " + id + " cancelled. You have been refunded " + db.transactions[id].amt + " Dogecoin from " + db.transactions[id].recipient + ". Visit #bot to check/withdraw your balance.", "bot:" + db.transactions[id].sender, data.room);
					} else if (data.messageArray[1] == "halt") {
						db.transactions[id].halt = true;
					} else if (data.messageArray[1] == "delete") {
						delete db.transactions[id];
					}
				}
			} else {
				bot.chat(data.user + ": Invalid ID number supplied.", data.room);
			}
		} else if (data.messageArray[0] == "status" && data.messageArray.length == 2) {
			id = Number(data.messageArray[1]);
			if (typeof db.transactions[id] !== 'undefined') {
				if (db.transactions[id].sender == data.user.toLowerCase() || db.transactions[id].recipient == data.user.toLowerCase()) {
					bot.chat(data.user + ": Transaction " + id + " status: " + db.transactions[id].status, data.room);
				} else {
					bot.chat(data.user + ": Your are not involved in this transaction. Please check the ID number you supplied.", data.room)
				}
			} else {
				bot.chat(data.user + ": Invalid ID number supplied.", data.room);
			}
		} else {
			bot.chat(data.user + ": Command usage: !escrow <command> [par1, par2...]", data.room);
		}
	}
});


// Functions //
function massTip(amt, user, room) {
	toTip = [];
	for(usr in db.userList[room]) {
		if (db.userList[room][usr] != user && db.userList[room][usr].substr(-3) != "bot" && toTip.length < 8) {
			toTip.unshift(db.userList[room][usr]);
		}
	}
	each = Math.floor((amt * 0.9) / toTip.length);
	if (amt >= 50 && each >= 5) {
		i = 0
		tipping = setInterval(function() {
			bot.tip(toTip[i], each, room, "Mass tip!");
			i++;
			if (i >= toTip.length) {
				clearInterval(tipping);
			}
		}, 500);
		db.masstips += amt;
		bot.chat("Mass tip from " + user + ", enjoy! Amount of doge tipped so far: " + Number(db.masstips), room);
	} else {
		bot.tip(user, Math.floor(amt * 0.98), room, "Refund - Please tip at least 50 doges for a mass tip!");
	}
}