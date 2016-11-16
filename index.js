var dotenv = require('dotenv');
var GDS = require('ibm-graph-client');
var Promise = require("bluebird");
var RecipeGraph = require('./RecipeGraph');
var SousChef = require('./SousChef');

// load from .env
dotenv.config();

// create graph client
if (process.env.VCAP_SERVICES) {
	var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
	var graphService = 'IBM Graph';
	if (vcapServices[graphService] && vcapServices[graphService].length > 0) {
		var config = vcapServices[graphService][0];
	}
}
var graphClient = new GDS({
	url: process.env.GRAPH_URL || config.credentials.apiURL,
	username: process.env.GRAPH_USERNAME || config.credentials.username,
	password: process.env.GRAPH_PASSWORD || config.credentials.password,
});
var recipeGraph = new RecipeGraph(graphClient);

var slackBotToken = process.env.SLACK_BOT_TOKEN;
var slackBotId = process.env.SLACK_BOT_ID;
var recipeClientApiKey = process.env.SPOONACULAR_KEY;
var watson = process.env.CONVERSATION_USERNAME;
var sousChef = new SousChef(
	recipeGraph,
	process.env.SLACK_BOT_TOKEN,
	process.env.SPOONACULAR_KEY,
	process.env.CONVERSATION_USERNAME,
	process.env.CONVERSATION_PASSWORD,
	process.env.CONVERSATION_WORKSPACE_ID
);
sousChef.run();