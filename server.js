var dotenv = require('dotenv');
var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var SlackBot = require('slackbots');

var slackBotId = process.env.SLACK_BOT_ID;

// load from .env
dotenv.config();

// create a bot
var bot = new SlackBot({
    token: process.env.SLACK_BOT_TOKEN, 
    name: 'souschef'
});

var conversation = new ConversationV1({
  username: process.env.CONVERSATION_USERNAME,
  password: process.env.CONVERSATION_PASSWORD,
  version_date: '2016-07-01'
});
var conversationWorkflowId = process.env.CONVERSATION_WORKSPACE_ID;

bot.on('start', function() {
});

bot.on('message', function(data) {
    // all ingoing events https://api.slack.com/rtm
    console.log(data);
	if (data.type == 'message' && data.channel.startsWith('D')) {
		if (data.user != slackBotId) {
			processSlackMessage(data);
			
		}
		else {
			console.log('Received my message.');
		}
	}
});

var processSlackMessage = function(data) {
	conversation.message({
		input: { text: data.text },
		workspace_id: conversationWorkflowId,
 	}, function(err, response) {
		if (err) {
			console.error(err);
		} else {
			reply = "";
			for (var i=0; i<response.output['text'].length; i++) {
                reply += response.output['text'][i] + "\n";
            }
			bot.postMessage(data.channel, reply, {});
		}
	});
}