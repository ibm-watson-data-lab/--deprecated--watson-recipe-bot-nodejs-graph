'use strict';

const dotenv = require('dotenv');
const GDS = require('ibm-graph-client');
const GraphRecipeStore = require('./GraphRecipeStore');
const SousChef = require('./SousChef');

// load from .env
dotenv.config();

// create graph client
let config;
if (process.env.VCAP_SERVICES) {
	let vcapServices = JSON.parse(process.env.VCAP_SERVICES);
	let graphService = 'IBM Graph';
	if (vcapServices[graphService] && vcapServices[graphService].length > 0) {
		config = vcapServices[graphService][0];
	}
}
let graphUrl = process.env.GRAPH_API_URL || config.credentials.apiURL;
graphUrl = graphUrl.substring(0,graphUrl.lastIndexOf('/')+1) + process.env.GRAPH_ID;
let graphClient = new GDS({
	url: process.env.GRAPH_API_URL || config.credentials.apiURL,
	username: process.env.GRAPH_USERNAME || config.credentials.username,
	password: process.env.GRAPH_PASSWORD || config.credentials.password,
});

const sousChef = new SousChef(
	new GraphRecipeStore(graphClient),
	process.env.SLACK_BOT_TOKEN,
	process.env.SPOONACULAR_KEY,
	process.env.CONVERSATION_USERNAME,
	process.env.CONVERSATION_PASSWORD,
	process.env.CONVERSATION_WORKSPACE_ID
);
sousChef.run();