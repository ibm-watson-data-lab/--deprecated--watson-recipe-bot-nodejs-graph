var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var RecipeClient = require('./RecipeClient');
var SlackBot = require('slackbots');

function SousChef(recipeGraph, slackToken, recipeClientApiKey, conversationUsername, conversationPassword, conversationWorkspaceId) {
	this.userStateMap = {};
	this.recipeGraph = recipeGraph;
	this.slackToken = slackToken;
	this.conversationService = new ConversationV1({
		username: conversationUsername,
		password: conversationPassword,
		version_date: '2016-07-01'
	});
	this.conversationWorkspaceId = conversationWorkspaceId;
}

SousChef.prototype.run = function() {
	this.recipeGraph.initGraph()
		.then(() => {
			this.slackBot = new SlackBot({
				token: this.slackToken,
				name: 'souschef'
			});
			this.slackBot.on('start', () => {});
			this.slackBot.on('message', (data) => {
				if (data.type == 'message' && data.channel.startsWith('D')) {
					if (! data.bot_id) {
						this.processSlackMessage(data);
					}
					else {
						console.log('Received my message.');
					}
				}
			});
		})
		.catch((error) => {
			console.log("Error: " + error);
			process.exit();
		});
}

SousChef.prototype.processSlackMessage = function(data) {
	// get or create state for the user
	var message = data.text;
	var messageSender = data.user;
	var state = this.userStateMap[messageSender];
	if (! state) {
		state = {
			userId: messageSender
		};
		this.userStateMap[messageSender] = state;
	}
	// make call to conversation service
	var request = {
		input: { text: data.text },
		context: state.conversationContext,
		workspace_id: this.conversationWorkspaceId,
	};
	this.sendRequestToConversation(request)
		.then((response) => {
			state.conversationContext = response.context;
			if (state.conversationContext["is_ingredients"]) {
				return this.handleIngredientsMessage(state, message);
			}
			else if (state.conversationContext["is_selection"]) {
				var selection = -1;
				if (state.conversationContext["selection"]) {
					selection = parseInt(state.conversationContext["selection"]);
				}
				return this.handleSelectionMessage(state, selection);
			}
			//else if (response.getEntities() != null && response.getEntities().size() > 0 && response.getEntities().get(0).getEntity() == "cuisine") {
			//	String cuisine = response.getEntities().get(0).getValue();
			//	reply = this.handleCuisineMessage(state, cuisine);
			//}
			else {
				return this.handleStartMessage(state, response);
			}
		})
		.then((reply) => {
			this.slackBot.postMessage(data.channel, reply, {});
		})
		.catch((error) => {
			console.log(`Error: ${error}`);
		});
};

SousChef.prototype.sendRequestToConversation = function(request) {
	return new Promise((resolve, reject) => {
		this.conversationService.message(request, (error, response) => {
			if (error) {
				reject(error);
			}
			else {
				resolve(response);
			}
		});
	});
};

SousChef.prototype.handleStartMessage = function(state, response) {
	return this.recipeGraph.addUserVertex(state)
		.then(() => {
			var reply = "";
			for (var i=0; i<response.output['text'].length; i++) {
				reply += response.output['text'][i] + "\n";
			}
			return Promise.resolve(reply);
		});
}

SousChef.prototype.handleIngredientsMessage = function(state, message) {
	return Promise.resolve("TODO");
};

SousChef.prototype.handleSelectionMessage = function(state, selection) {
	if (selection >= 1 && selection <= 5) {
		state.conversationContext["selection_valid"] = true;
		return Promise.resolve("TODO");
	}
	else {
		state.conversationContext["selection_valid"] = false;
		return Promise.resolve("Invalid selection! Say anything to see your choices again...");
	}
};

module.exports = SousChef;