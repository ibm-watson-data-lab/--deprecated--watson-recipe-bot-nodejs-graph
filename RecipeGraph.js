var Promise = require('bluebird');

function RecipeGraph(graphClient) {
    this.graphClient = graphClient; // Note: this library cannot be promisified using promisifyAll
}

RecipeGraph.prototype.initGraph = function() {
    // Set Schema
    console.log('Getting Graph Schema...');
    return new Promise((resolve, reject) => {
        this.graphClient.session((error, token) => {
            this.graphClient.config.session = token;
            this.graphClient.schema().get(function (error, body) {
                if (error) {
                    reject(error);
                }
                else {
                    var schema;
                    if (body.result && body.result.data && body.result.data.length > 0) {
                        schema = body.result.data[0];
                    }
                    var schemaExists = (schema && schema.propertyKeys && schema.propertyKeys.length > 0);
                    if (!schemaExists) {
                        schema = {
                            propertyKeys: [
                                {name: 'name', dataType: 'String', cardinality: 'SINGLE'},
                                {name: 'title', dataType: 'String', cardinality: 'SINGLE'},
                                {name: 'detail', dataType: 'String', cardinality: 'SINGLE'}
                            ],
                            vertexLabels: [
                                {name: 'person'},
                                {name: 'ingredient'},
                                {name: 'cuisine'},
                                {name: 'recipe'}
                            ],
                            edgeLabels: [
                                {name: 'selects'}
                            ],
                            vertexIndexes: [
                                {name: 'vertexByName', propertyKeys: ['name'], composite: true, unique: true}
                            ],
                            edgeIndexes: []
                        };
                        console.log('Creating Graph Schema...');
                        this.graphClient.schema().set(schema, (error, body) => {
                            if (error) {
                                reject(error);
                            }
                            else {
                                resolve(schema);
                            }
                        });
                    }
                    else {
                        console.log('Graph Schema exists.');
                        resolve(schema);
                    }
                };
            });
        });
    });
};

// User

RecipeGraph.prototype.addUserVertex = function(userId) {
    var userVertex = { label: 'person' };
    userVertex['name'] = userId;
    return this.addVertexIfNotExists(userVertex,'name')
        .then((vertex) => {
            return Promise.resolve(vertex);
        });
};

// Ingredients

RecipeGraph.prototype.getUniqueIngredientsName = function(ingredientsStr) {
    var ingredients = ingredientsStr.trim().toLowerCase().split(',');
    for (var i = 0; i<ingredients.length; i++) {
        ingredients[i] = ingredients[i].trim();
    }
    ingredients.sort();
    return ingredients.join(',');
};

RecipeGraph.prototype.findIngredientsVertex = function(ingredientsStr) {
    return this.findVertex('ingredient', 'name', this.getUniqueIngredientsName(ingredientsStr));
};

RecipeGraph.prototype.addIngredientsVertex = function(ingredientsStr, matchingRecipes, userVertex) {
    var ingredientVertex = {label: 'ingredient'};
    ingredientVertex['name'] = this.getUniqueIngredientsName(ingredientsStr);
    ingredientVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g,'\\\'');
    return this.addVertexIfNotExists(ingredientVertex, 'name')
        .then((vertex) => {
            return this.incrementIngredientsEdge(vertex, userVertex)
                .then(() => {
                    Promise.resolve(vertex);
                });
        });
};

RecipeGraph.prototype.incrementIngredientsEdge = function(ingredientVertex, userVertex) {
    var edge = {
        label: 'selects',
        outV: userVertex.id,
        inV: ingredientVertex.id,
        properties: {'count': 1}
    };
    return this.addUpdateEdge(edge);
};

// Cuisine

RecipeGraph.prototype.getUniqueCuisineName = function(cuisine) {
    return cuisine.trim().toLowerCase();
};

RecipeGraph.prototype.findCuisineVertex = function(cuisine) {
    return this.findVertex('cuisine', 'name', this.getUniqueCuisineName(cuisine));
};

RecipeGraph.prototype.addCuisineVertex = function(cuisine, matchingRecipes, userVertex) {
    var cuisineVertex = {label: 'cuisine'};
    cuisineVertex['name'] = this.getUniqueCuisineName(cuisine);
    cuisineVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g,'\\\'');
    return this.addVertexIfNotExists(cuisineVertex, 'name')
        .then((vertex) => {
            return this.incrementCuisineEdge(vertex, userVertex)
                .then(() => {
                    Promise.resolve(vertex);
                });
        });
};

RecipeGraph.prototype.incrementCuisineEdge = function(cuisineVertex, userVertex) {
    var edge = {
        label: 'selects',
        outV: userVertex.id,
        inV: cuisineVertex.id,
        properties: {'count': 1}
    };
    return this.addUpdateEdge(edge);
};

// Recipe

RecipeGraph.prototype.getUniqueRecipeName = function(recipeId) {
    return `${recipeId}`.trim().toLowerCase();
};

RecipeGraph.prototype.findRecipeVertex = function(recipeId) {
    return this.findVertex('recipe', 'name', this.getUniqueRecipeName(recipeId));
};

RecipeGraph.prototype.findRecipesForUser = function(userId) {
    return new Promise((resolve, reject) => {
        var query = `g.V().hasLabel("person").has("name", "${userId}").outE().inV().hasLabel("recipe").path()`;
        this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
            if (error) {
                console.log(`Error finding Vertexes: ${error}`);
                reject(error);
            }
            else if (response.result && response.result.data && response.result.data.length > 0) {
                resolve(response.result.data);
            }
            else {
                resolve(null);
            }
        });
    });
};

RecipeGraph.prototype.addRecipeVertex = function(recipeId, recipeTitle, recipeDetail, ingredientCuisineVertex, userVertex) {
    var recipeVertex = {label: 'recipe'};
    recipeVertex['name'] = this.getUniqueRecipeName(recipeId);
    recipeVertex['title'] = recipeTitle.trim().replace(/'/g,'\\\'');
    recipeVertex['detail'] = recipeDetail.replace(/'/g,'\\\'').replace(/\n/g,'\\\\n');
    return this.addVertexIfNotExists(recipeVertex, 'name')
        .then((vertex) => {
            // add one edge from the ingredient/cuisine to the recipe
            recipeVertex = vertex;
            return this.incrementRecipeEdges(recipeVertex, ingredientCuisineVertex, userVertex);
        })
        .then(() => {
            return Promise.resolve(recipeVertex);
        });
};

RecipeGraph.prototype.incrementRecipeEdges = function(recipeVertex, ingredientCuisineVertex, userVertex) {
    // add one edge from the user to the recipe (this will let us find a user's favorite recipes, etc)
    var edge = {
        label: 'selects',
        outV: userVertex.id,
        inV: recipeVertex.id,
        properties: {'count': 1}
    };
    return this.addUpdateEdge(edge)
        .then(() => {
            if (ingredientCuisineVertex) {
                // add one edge from the ingredient/cuisine to the recipe
                var edge = {
                    label: 'selects',
                    outV: ingredientCuisineVertex.id,
                    inV: recipeVertex.id,
                    properties: {'count': 1}
                };
                return this.addUpdateEdge(edge);
            }
            else {
                return Promise.resolve(null);
            }
        });
};

// Graph Helper Methods

RecipeGraph.prototype.findVertex = function(label, propertyName, propertyValue) {
    return new Promise((resolve, reject) => {
        var query = `g.V().hasLabel("${label}").has("${propertyName}", "${propertyValue}")`;
        this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
            if (error) {
                console.log(`Error finding Vertex: ${error}`);
                reject(error);
            }
            else if (response.result && response.result.data && response.result.data.length > 0) {
                resolve(response.result.data[0]);
            }
            else {
                resolve(null);
            }
        });
    });
};

RecipeGraph.prototype.addVertexIfNotExists = function(vertex, uniquePropertyName) {
    return new Promise((resolve, reject) => {
        var propertyValue = `${vertex[uniquePropertyName]}`;
        var query = `g.V().hasLabel("${vertex.label}").has("${uniquePropertyName}", "${propertyValue}")`;
        this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
            if (error) {
                console.log(`Error finding Vertex: ${error}`);
                reject(error);
            }
            else if (response.result && response.result.data && response.result.data.length > 0) {
                console.log(`Returning ${vertex.label} vertex where ${uniquePropertyName}=${propertyValue}`);
                resolve(response.result.data[0]);
            }
            else {
                console.log(`Creating ${vertex.label} vertex where ${uniquePropertyName}=${propertyValue}`);
                this.graphClient.vertices().create(vertex, (error,body) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(body.result.data[0]);
                    }
                });
            }
        });
    });
};

RecipeGraph.prototype.addUpdateEdge = function(edge){
    return new Promise((resolve, reject) => {
        var query = `g.V(${edge.outV}).outE().inV().hasId(${edge.inV}).path()`;
        this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
            if (error) {
                console.log(`Error finding Edge: ${error}`);
                reject(error);
            }
            else if (response.result && response.result.data && response.result.data.length > 0) {
                console.log(`Edge from ${edge.outV} to ${edge.inV} exists.`);
                edge = response.result.data[0].objects[1];
                var count = 0;
                if (! edge.properties) {
                    edge.properties = {};
                }
                if (edge.properties.count) {
                     count = edge.properties.count;
                }
                edge.properties['count'] = count + 1;
                this.graphClient.edges().update(edge.id, edge, (error,body) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(null);
                    }
                });
            }
            else {
                console.log(`Creating edge from ${edge.outV} to ${edge.inV}`);
                this.graphClient.edges().create(edge.label, edge.outV, edge.inV, edge.properties, (error,body) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(null);
                    }
                });
            }
        });
    });
}

module.exports = RecipeGraph;