var SlackBot = require('slackbots');
var dotenv = require('dotenv');

var slackBotId = process.env.SLACK_BOT_ID;

// load from .env
dotenv.config();

// create a bot
var bot = new SlackBot({
    token: process.env.SLACK_BOT_TOKEN, 
    name: 'souschef'
});

bot.on('start', function() {
    // // more information about additional params https://api.slack.com/methods/chat.postMessage
    // var params = {
    //     icon_emoji: ':cat:'
    // };

    // // define channel, where bot exist. You can adjust it there https://my.slack.com/services 
    // bot.postMessageToChannel('general', 'meow!', params);

    // // define existing username instead of 'user_name'
    // bot.postMessageToUser('user_name', 'meow!', params); 

    // // If you add a 'slackbot' property, 
    // // you will post to another user's slackbot channel instead of a direct message
    // bot.postMessageToUser('user_name', 'meow!', { 'slackbot': true, icon_emoji: ':cat:' }); 

    // // define private group instead of 'private_group', where bot exist
    // bot.postMessageToGroup('private_group', 'meow!', params); 
});

bot.on('message', function(data) {
    // all ingoing events https://api.slack.com/rtm
    console.log(data);
	if (data.type == 'message' && data.channel.startsWith('D')) {
		if (data.user != slackBotId) {
			console.log("Posting to channel " + data.channel);
			bot.postMessage(data.channel, 'Hi from node', {});
		}
		else {
			console.log('Received my message.');
		}
	}
});