'use strict';

const https = require('https');
const host = 'spoonacular-recipe-food-nutrition-v1.p.mashape.com';

class RecipeClient {

    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    findByIngredients(ingredients) {
        return new Promise((resolve, reject) => {
            let queryStr = `?fillIngredients=false&ingredients=${encodeURIComponent(ingredients)}&limitLicense=false&number=5&ranking=1`;
            let options = {
                hostname: host,
                port: 443,
                path: `/recipes/findByIngredients${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            let req = https.get(options, (res) => {
                let json = null;
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
            let queryStr = `?number=5&query=+&cuisine=${encodeURIComponent(cuisine)}`;
            let options = {
                hostname: host,
                port: 443,
                path: `/recipes/search${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            let req = https.get(options, (res) => {
                let json = null;
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
            let queryStr = `?includeNutrition=false`;
            let options = {
                hostname: host,
                port: 443,
                path: `/recipes/${id}/information${queryStr}`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            let req = https.get(options, (res) => {
                let json = null;
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
            let options = {
                hostname: host,
                port: 443,
                path: `/recipes/${id}/analyzedInstructions`,
                rejectUnauthorized: false,
                headers: {
                    'X-Mashape-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            };
            let req = https.get(options, (res) => {
                let json = null;
                res.on('data', function (chunk) {
                    if (json == null) {
                        json = '';
                    }
                    json += chunk;
                });
                res.on('end', function () {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            let steps = JSON.parse(json)[0].steps;
                            resolve(steps);
                        }
                        catch (err) {
                            resolve([]);
                        }
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