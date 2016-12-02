'use strict';

var https = require('https');
var host = 'spoonacular-recipe-food-nutrition-v1.p.mashape.com';

class RecipeClient {

    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    findByIngredients(ingredients) {
        return new Promise((resolve, reject) => {
            var queryStr = `?fillIngredients=false&ingredients=${ingredients}&limitLicense=false&number=5&ranking=1`;
            var options = {
                hostname: host,
                port: 443,
                path: `/recipes/findByIngredients${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            var req = https.get(options, (res) => {
                var json = null;
                res.on('data', function (chunk) {
                    if (json == null) {
                        json = '';
                    }
                    json += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(json));
                    }
                    else {
                        reject(res.statusCode);
                    }
                })
            });
            req.on('error', (e) => {
                reject(e);
            });
        });
    }

    findByCuisine(cuisine) {
        return new Promise((resolve, reject) => {
            var queryStr = `?number=5&query=+&cuisine=${cuisine}`;
            var options = {
                hostname: host,
                port: 443,
                path: `/recipes/search${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            var req = https.get(options, (res) => {
                var json = null;
                res.on('data', function (chunk) {
                    if (json == null) {
                        json = '';
                    }
                    json += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(json).results);
                    }
                    else {
                        reject(res.statusCode);
                    }
                })
            });
            req.on('error', (e) => {
                reject(e);
            });
        });
    }

    getInfoById(id) {
        return new Promise((resolve, reject) => {
            var queryStr = `?includeNutrition=false`;
            var options = {
                hostname: host,
                port: 443,
                path: `/recipes/${id}/information${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            var req = https.get(options, (res) => {
                var json = null;
                res.on('data', function (chunk) {
                    if (json == null) {
                        json = '';
                    }
                    json += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(json));
                    }
                    else {
                        reject(res.statusCode);
                    }
                })
            });
            req.on('error', (e) => {
                reject(e);
            });
        });
    }

    getStepsById(id) {
        return new Promise((resolve, reject) => {
            var options = {
                hostname: host,
                port: 443,
                path: `/recipes/${id}/analyzedInstructions`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            var req = https.get(options, (res) => {
                var json = null;
                res.on('data', function (chunk) {
                    if (json == null) {
                        json = '';
                    }
                    json += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(json)[0].steps);
                    }
                    else {
                        reject(res.statusCode);
                    }
                })
            });
            req.on('error', (e) => {
                reject(e);
            });
        });
    }
}

module.exports = RecipeClient;