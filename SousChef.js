'use strict';

const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const RecipeClient = require('./RecipeClient');
const SlackBot = require('slackbots');

class SousChef {

    constructor(recipeStore, slackToken, recipeClientApiKey, conversationUsername, conversationPassword, conversationWorkspaceId) {
        this.userStateMap = {};
        this.recipeStore = recipeStore;
        this.recipeClient = new RecipeClient(recipeClientApiKey);
        this.slackToken = slackToken;
        this.conversationService = new ConversationV1({
            username: conversationUsername,
            password: conversationPassword,
            version_date: '2016-07-01'
        });
        this.conversationWorkspaceId = conversationWorkspaceId;
    }

    run() {
        this.recipeStore.init()
            .then(() => {
                this.slackBot = new SlackBot({
                    token: this.slackToken,
                    name: 'souschef'
                });
                this.slackBot.on('start', () => {
                });
                this.slackBot.on('message', (data) => {
                    if (data.type == 'message' && data.channel.startsWith('D')) {
                        if (!data.bot_id) {
                            this.processSlackMessage(data);
                        }
                        else {
                            // ignore messages from the bot (messages we sent)
                        }
                    }
                });
            })
            .catch((error) => {
                console.log(`Error: ${error}`);
                process.exit();
            });
    }

    processSlackMessage(data) {
        // get or create state for the user
        let message = data.text;
        let messageSender = data.user;
        let state = this.userStateMap[messageSender];
        if (!state) {
            state = {
                userId: messageSender
            };
            this.userStateMap[messageSender] = state;
        }
        // make call to conversation service
        let request = {
            input: {text: data.text},
            context: state.conversationContext,
            workspace_id: this.conversationWorkspaceId,
        };
        this.sendRequestToConversation(request)
            .then((response) => {
                state.conversationContext = response.context;
                if (state.conversationContext['is_favorites']) {
                    return this.handleFavoritesMessage(state);
                }
                else if (state.conversationContext['is_ingredients']) {
                    return this.handleIngredientsMessage(state, message);
                }
                else if (response.entities && response.entities.length > 0 && response.entities[0].entity == 'cuisine') {
                    return this.handleCuisineMessage(state, response.entities[0].value);
                }
                else if (state.conversationContext['is_selection']) {
                    let selection = -1;
                    if (state.conversationContext['selection']) {
                        selection = parseInt(state.conversationContext['selection']);
                    }
                    return this.handleSelectionMessage(state, selection);
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
    }

    sendRequestToConversation(request) {
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
    }

    handleStartMessage(state, response) {
        let reply = '';
        for (let i = 0; i < response.output['text'].length; i++) {
            reply += response.output['text'][i] + '\n';
        }
        if (state.user) {
            return Promise.resolve(reply);
        }
        else {
            return this.recipeStore.addUser(state.userId)
                .then((user) => {
                    state.user = user;
                    return Promise.resolve(reply);
                });
        }
    }

    handleFavoritesMessage(state) {
        return this.recipeStore.findFavoriteRecipesForUser(state.user, 5)
            .then(function (recipes) {
                // update state
                state.conversationContext['recipes'] = recipes;
                state.ingredientCuisine = null;
                // return the response
                let response = 'Let\'s see here...\nI\'ve found these recipes: \n';
                for (let i = 0; i < recipes.length; i++) {
                    response += `${(i + 1)}.${recipes[i].title}\n`;
                }
                response += '\nPlease enter the corresponding number of your choice.';
                return Promise.resolve(response);
            });
    }

    handleIngredientsMessage(state, message) {
        // we want to get a list of recipes based on the ingredients (message)
        // first we see if we already have the ingredients in our datastore
        let ingredientsStr = message;
        return this.recipeStore.findIngredient(ingredientsStr)
            .then((ingredient) => {
                if (ingredient) {
                    console.log(`Ingredient exists for ${ingredientsStr}. Returning recipes from datastore.`);
                    // increment the count on the user-ingredient
                    return this.recipeStore.recordIngredientRequestForUser(ingredient, state.user)
                        .then(() => {
                            return Promise.resolve(ingredient);
                        });
                }
                else {
                    // we don't have the ingredients in our datastore yet, so get list of recipes from Spoonacular
                    console.log(`Ingredient does not exist for ${ingredientsStr}. Querying Spoonacular for recipes.`);
                    return this.recipeClient.findByIngredients(ingredientsStr)
                        .then((matchingRecipes) => {
                            // add ingredient to datastore
                            return this.recipeStore.addIngredient(ingredientsStr, matchingRecipes, state.user)
                        });
                }
            })
            .then((ingredient) => {
                let matchingRecipes = JSON.parse(ingredient.properties.detail[0].value);
                // update state
                state.conversationContext['recipes'] = matchingRecipes;
                state.ingredientCuisine = ingredient;
                // return the response
                let response = 'Let\'s see here...\nI\'ve found these recipes: \n';
                for (let i = 0; i < matchingRecipes.length; i++) {
                    response += `${(i + 1)}.${matchingRecipes[i].title}\n`;
                }
                response += '\nPlease enter the corresponding number of your choice.';
                return Promise.resolve(response);
            });
    }

    handleCuisineMessage(state, message) {
        // we want to get a list of recipes based on the cuisine (message)
        // first we see if we already have the cuisines in our datastore
        let cuisineStr = message;
        return this.recipeStore.findCuisine(cuisineStr)
            .then((cuisine) => {
                if (cuisine) {
                    console.log(`Cuisine exists for ${cuisineStr}. Returning recipes from datastore.`);
                    // increment the count on the user-cuisine
                    return this.recipeStore.recordCuisineRequestForUser(cuisine, state.user)
                        .then(() => {
                            return Promise.resolve(cuisine);
                        });
                }
                else {
                    // we don't have the cuisine in our datastore yet, so get list of recipes from Spoonacular
                    console.log(`Cuisine does not exist for ${cuisineStr}. Querying Spoonacular for recipes.`);
                    return this.recipeClient.findByCuisine(cuisineStr)
                        .then((matchingRecipes) => {
                            // add cuisine to datastore
                            return this.recipeStore.addCuisine(cuisineStr, matchingRecipes, state.user)
                        });
                }
            })
            .then((cuisine) => {
                let matchingRecipes = JSON.parse(cuisine.properties.detail[0].value);
                // update state
                state.conversationContext['recipes'] = matchingRecipes;
                state.ingredientCuisine = cuisine;
                // return the response
                let response = 'Let\'s see here...\nI\'ve found these recipes: \n';
                for (let i = 0; i < matchingRecipes.length; i++) {
                    response += `${(i + 1)}.${matchingRecipes[i].title}\n`;
                }
                response += '\nPlease enter the corresponding number of your choice.';
                return Promise.resolve(response);
            });
    }

    handleSelectionMessage(state, selection) {
        if (selection >= 1 && selection <= 5) {
            // we want to get a the recipe based on the selection
            // first we see if we already have the recipe in our datastore
            let recipes = state.conversationContext['recipes'];
            let recipeId = `${recipes[selection - 1]["id"]}`;
            return this.recipeStore.findRecipe(recipeId)
                .then((recipe) => {
                    if (recipe) {
                        console.log(`Recipe exists for ${recipeId}. Returning recipe steps from datastore.`);
                        // increment the count on the ingredient/cuisine-recipe and the user-recipe
                        return this.recipeStore.recordRecipeRequestForUser(recipe, state.ingredientCuisine, state.user)
                            .then(() => {
                                return Promise.resolve(recipe);
                            });
                    }
                    else {
                        console.log(`Recipe does not exist for ${recipeId}. Querying Spoonacular for details.`);
                        let recipeInfo;
                        let recipeSteps;
                        return this.recipeClient.getInfoById(recipeId)
                            .then((response) => {
                                recipeInfo = response;
                                return this.recipeClient.getStepsById(recipeId)
                            })
                            .then((response) => {
                                recipeSteps = response;
                                let recipeDetail = this.makeFormattedSteps(recipeInfo, recipeSteps);
                                // add recipe to datastore
                                return this.recipeStore.addRecipe(recipeId, recipeInfo['title'], recipeDetail, state.ingredientCuisine, state.user);
                            })
                    }
                })
                .then((recipe) => {
                    state.ingredientCuisine = null;
                    state.conversationContext = null;
                    let recipeDetail = recipe.properties.detail[0].value.replace(/\\n/g, '\n');
                    return Promise.resolve(recipeDetail);
                });
        }
        else {
            state.conversationContext['selection_valid'] = false;
            return Promise.resolve('Invalid selection! Say anything to see your choices again...');
        }
    }

    makeFormattedSteps(recipeInfo, recipeSteps) {
        let response = 'Ok, it takes *';
        response += `${recipeInfo['readyInMinutes']}* minutes to make *`;
        response += `${recipeInfo['servings']}* servings of *`;
        response += `${recipeInfo['title']}*. Here are the steps:\n\n`;
        if (recipeSteps != null && recipeSteps.length > 0) {
            for (let i = 0; i < recipeSteps.length; i++) {
                let equipStr = '';
                for (let e of recipeSteps[i]['equipment']) {
                    equipStr += `${e['name']},`;
                }
                if (equipStr.length == 0) {
                    equipStr = 'None';
                }
                else {
                    equipStr = equipStr.substring(0, equipStr.length - 1);
                }
                response += `*Step ${i + 1}*:\n`;
                response += `_Equipment_: ${equipStr}\n`;
                response += `_Action_: ${recipeSteps[i]['step']}\n\n`;
            }
        }
        else {
            response += '_No instructions available for this recipe._\n\n';
        }
        response += '*Say anything to me to start over...*';
        return response;
    }
}

module.exports = SousChef;