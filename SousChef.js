var ConversationV1 = require('watson-developer-cloud/conversation/v1');
var RecipeClient = require('./RecipeClient');
var SlackBot = require('slackbots');

function SousChef(recipeGraph, slackToken, recipeClientApiKey, conversationUsername, conversationPassword, conversationWorkspaceId) {
	this.userStateMap = {};
	this.recipeGraph = recipeGraph;
	this.recipeClient = new RecipeClient(recipeClientApiKey);
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
			else if (response.entities && response.entities.length > 0 && response.entities[0].entity == "cuisine") {
				return this.handleCuisineMessage(state, response.entities[0].value);
			}
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
	var reply = "";
	for (var i=0; i<response.output['text'].length; i++) {
		reply += response.output['text'][i] + "\n";
	}
	if (state.lastGraphVertex) {
		return Promise.resolve(reply);
	}
	else {
		return this.recipeGraph.addUserVertex(state)
			.then(() => {
				return Promise.resolve(reply);
			});
	}
}

SousChef.prototype.handleIngredientsMessage = function(state, message) {
	// we want to get a list of recipes based on the ingredients (message)
	// first we see if we already have the ingredients in our graph
	var ingredientsStr = message;
	return this.recipeGraph.findIngredientsVertex(ingredientsStr)
		.then((vertex) => {
			if (vertex) {
				console.log(`Ingredients vertex exists for ${ingredientsStr}. Returning recipes from vertex.`);
				return Promise.resolve(vertex);
			}
			else {
				// we don't have the ingredients in our graph yet, so get list of recipes from Spoonacular
				console.log(`Ingredients vertex does not exist for ${ingredientsStr}. Querying Spoonacular for recipes.`);
				return this.recipeClient.findByIngredients(ingredientsStr)
					.then((matchingRecipes) => {
						// add vertex for the ingredients to our graph
						return this.recipeGraph.addIngredientsVertex(state, ingredientsStr, matchingRecipes)
					});
			}
		})
		.then((ingredientVertex) => {
			var matchingRecipes = JSON.parse(ingredientVertex.properties.detail[0].value);
			// update state
			state.conversationContext["recipes"] = matchingRecipes;
			state.lastGraphVertex = ingredientVertex;
			// return the response
			var response = 'Let\'s see here...\nI\'ve found these recipes: \n';
			for (var i = 0; i < matchingRecipes.length; i++) {
				response += `${(i + 1)}.${matchingRecipes[i].title}\n`;
			}
			response += '\nPlease enter the corresponding number of your choice.';
			return Promise.resolve(response);
		});
};

SousChef.prototype.handleCuisineMessage = function(state, message) {
	// we want to get a list of recipes based on the cuisine (message)
	// first we see if we already have the cuisines in our graph
	var cuisine = message;
	return this.recipeGraph.findCuisineVertex(cuisine)
		.then((vertex) => {
			if (vertex) {
				console.log(`Cuisine vertex exists for ${cuisine}. Returning recipes from vertex.`);
				return Promise.resolve(vertex);
			}
			else {
				// we don't have the cuisine in our graph yet, so get list of recipes from Spoonacular
				console.log(`Cuisine vertex does not exist for ${cuisine}. Querying Spoonacular for recipes.`);
				return this.recipeClient.findByCuisine(cuisine)
					.then((matchingRecipes) => {
						// add vertex for the cuisines to our graph
						return this.recipeGraph.addCuisineVertex(state, cuisine, matchingRecipes)
					});
			}
		})
		.then((cuisineVertex) => {
			var matchingRecipes = JSON.parse(cuisineVertex.properties.detail[0].value);
			// update state
			state.conversationContext["recipes"] = matchingRecipes;
			state.lastGraphVertex = cuisineVertex;
			// return the response
			var response = 'Let\'s see here...\nI\'ve found these recipes: \n';
			for (var i = 0; i < matchingRecipes.length; i++) {
				response += `${(i + 1)}.${matchingRecipes[i].title}\n`;
			}
			response += '\nPlease enter the corresponding number of your choice.';
			return Promise.resolve(response);
		});
};

SousChef.prototype.handleSelectionMessage = function(state, selection) {
	if (selection >= 1 && selection <= 5) {
		// we want to get a the recipe based on the selection
		// first we see if we already have the recipe in our graph
		var recipes = state.conversationContext['recipes'];
		var recipeId = `${recipes[selection - 1]["id"]}`;
		return this.recipeGraph.findRecipeVertex(recipeId)
			.then((vertex) => {
				if (vertex) {
					console.log(`Recipe vertex exists for ${recipeId}. Returning recipe steps from vertex.`);
					return Promise.resolve(vertex);
				}
				else {
					console.log(`Recipe vertex does not exist for ${recipeId}. Querying Spoonacular for details.`);
					var recipeInfo;
					var recipeSteps;
					return this.recipeClient.getInfoById(recipeId)
						.then((response) => {
							recipeInfo = response;
							return this.recipeClient.getStepsById(recipeId)
						})
						.then((response) => {
							recipeSteps = response;
							var recipeDetail = this.makeFormattedSteps(recipeInfo, recipeSteps);
							return this.recipeGraph.addRecipeVertex(state, recipeId, recipeInfo['title'], recipeDetail);
						})
				}
			})
			.then((recipeVertex) => {
				state.lastGraphVertex = null;
				state.conversationContext = null;
				var recipeDetail = recipeVertex.properties.detail[0].value;
				return Promise.resolve(recipeDetail);
			});
	}
	else {
		state.conversationContext["selection_valid"] = false;
		return Promise.resolve("Invalid selection! Say anything to see your choices again...");
	}
};

SousChef.prototype.makeFormattedSteps =  function(recipeInfo, recipeSteps) {
	var response = "Ok, it takes *";
	response += `${recipeInfo['readyInMinutes']}* minutes to make *`;
	response += `${recipeInfo['servings']}* servings of *`;
	response += `${recipeInfo['title']}*. Here are the steps:`; //\n\n
	if (recipeSteps != null && recipeSteps.length > 0) {
		// mw:TODO - add steps
	}
	else {
		response += '_No instructions available for this recipe._\n\n';
	}
	return response;
}

module.exports = SousChef;