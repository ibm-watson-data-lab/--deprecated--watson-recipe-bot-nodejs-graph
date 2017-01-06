'use strict';

class SnsClient {

    constructor(apiUrl, apiKey) {
        if (! apiUrl) {
            this.enabled = false;
        }
        else {
            this.enabled = true;
            this.apiUrl = apiUrl;
            this.apiKey = apiKey;
            let https = (this.apiUrl.toLowerCase().indexOf("https") >= 0);
            this.httpClient = https ? require('https') : require('http');
            let url = this.apiUrl;
            let index = this.apiUrl.indexOf('://');
            if (index > 0) {
                url = this.apiUrl.substring(index + 3);
            }
            index = url.indexOf('/');
            if (index > 0) {
                this.hostname = url.substring(0, index);
            }
            else {
                this.hostname = url;
            }
            index = url.indexOf(':');
            if (index > 0) {
                this.port = this.hostname.substring(index+1);
                this.hostname = this.hostname.substring(0, index);
            }
            else {
                this.port = this.https ? 443 : 80;
            }
        }
    }

    postStartMessage(state) {
        this.postMessage('start', state, `${state.userId} started a new conversation.`);
    }

    postFavoritesMessage(state) {
        this.postMessage('favorites', state, `${state.userId} requested their favorite recipes.`);
    }

    postIngredientMessage(state, ingredientStr) {
        this.postMessage('ingredient', state, `${state.userId} requested recipes for ingredient \'${ingredientStr}\'.`);
    }

    postCuisineMessage(state, cuisineStr) {
        this.postMessage('ingredient', state, `${state.userId} requested recipes for cuisine \'${cuisineStr}\'.`);
    }

    postRecipeMessage(state, recipeId, recipeTitle) {
        this.postMessage('ingredient', state, `${state.userId} selected recipe \'${recipeTitle}\'.`, recipeId);
    }

    postMessage(action, state, message, recipeId) {
        if (!this.enabled) {
            return;
        }
        let ingredient;
        let cuisine;
        if (state.ingredientCuisine) {
            if (state.ingredientCuisine['label'] == 'ingredient') {
                ingredient = state.ingredientCuisine.properties['name'][0].value;
            }
            else {
                cuisine = state.ingredientCuisine.properties['name'][0].value;
            }
        }
        let body = JSON.stringify({
            userQuery: {
                type: 'action'
            },
            notification: {
                action: action,
                message: message,
                state: {
                    user: state.userId,
                    ingredient: ingredient,
                    cuisine: cuisine,
                    recipe: recipeId
                }
            }
        });
        this.doHttpPost(`/${this.apiKey}/notification`, body);
    }

    doHttpPost(path, body) {
        let postData = body || '';
        let options = {
            hostname: this.hostname,
            port: this.port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            rejectUnauthorized: false
        };
        let req = this.httpClient.request(options, (res) => {
        });
        req.on('error', (e) => {
            console.log("Error posting message: " + e);
        });
        req.write(postData);
        req.end();
    }
}

module.exports = SnsClient;