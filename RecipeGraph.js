var Promise = require("bluebird");

function RecipeGraph(graphClient) {
    this.graphClient = graphClient; // Note: this library cannot be promisified using promisifyAll
}

RecipeGraph.prototype.initGraph = function() {
    // Set Schema
    console.log("Getting Graph Schema...");
    return new Promise((resolve, reject) => {
        this.graphClient.session((token) => {
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
                        console.log("Creating Graph Schema...");
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
                        console.log("Graph Schema exists.");
                        resolve(schema);
                    }
                };
            });
        });
    });
};

// User

RecipeGraph.prototype.addUserVertex = function(state) {
    var userVertex = { label: 'person' };
    userVertex['name'] = state.userId;
    return this.addVertexIfNotExists(userVertex, "name")
        .then((vertex) => {
            state.lastGraphVertex = vertex;
            return Promise.resolve(null);
        });
};

RecipeGraph.prototype.deleteUsers = function(userIds) {
    //for (String userId : userIds) {
    //    Element[] elements = this.graphClient.runGremlinQuery("g.V().hasLabel(\"person\").has(\"name\", \"" + userId + "\")");
    //    if (elements.length > 0) {
    //        for (Element element : elements) {
    //            boolean success = this.graphClient.deleteVertex(((Vertex) element).getId());
    //            logger.debug(String.format("Deleted user %s = %s", userId, success));
    //        }
    //    }
    //}
};

// Ingredients

RecipeGraph.prototype.getUniqueIngredientsName = function(ingredientsStr) {
    var ingredients = ingredientsStr.trim().toLowerCase().split(",");
    for (var i = 0; i<ingredients.length; i++) {
        ingredients[i] = ingredients[i].trim();
    }
    ingredients.sort();
    return ingredients.join(',');
};

RecipeGraph.prototype.findIngredientsVertex = function(ingredientsStr) {
    return this.findVertex('ingredient', 'name', this.getUniqueIngredientsName(ingredientsStr));
};

RecipeGraph.prototype.addIngredientsVertex = function(state, ingredientsStr, matchingRecipes) {
    var ingredientVertex = {label: "ingredient"};
    ingredientVertex['name'] = this.getUniqueIngredientsName(ingredientsStr);
    ingredientVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g,'\\\'');
    return this.addVertexIfNotExists(ingredientVertex, 'name')
        .then((vertex) => {
            ingredientVertex = vertex;
            var edge = {label: 'selects', outV: state.lastGraphVertex.id, inV: ingredientVertex.id};
            return this.addEdgeIfNotExists(edge);
        })
        .then(() => {
            return Promise.resolve(ingredientVertex);
        });
};

// Recipes

RecipeGraph.prototype.getUniqueRecipeName = function(recipeId) {
    return recipeId.trim().toLowerCase();
};

RecipeGraph.prototype.findRecipeVertex = function(recipeId) {
    return this.findVertex('recipe', 'name', this.getUniqueRecipeName(recipeId));
};

RecipeGraph.prototype.addRecipeVertex = function(state, recipeId, recipeTitle, recipeDetail) {
    var recipeVertex = {label: "recipe"};
    recipeVertex['name'] = this.getUniqueRecipeName(recipeId);
    recipeVertex['title'] = recipeTitle.trim().replace(/'/g,'\\\'');
    recipeVertex['detail'] = recipeDetail.replace(/'/g,'\\\''); //.replace(/\n/g,'\\\\n');
    return this.addVertexIfNotExists(recipeVertex, 'name')
        .then((vertex) => {
            recipeVertex = vertex;
            var edge = {label: 'selects', outV: state.lastGraphVertex.id, inV: recipeVertex.id};
            return this.addEdgeIfNotExists(edge);
        })
        .then(() => {
            return Promise.resolve(recipeVertex);
        });
};

//public void deleteIngredients(String[] ingredients) throws Exception {
//    for (String ingredient : ingredients) {
//        Element[] elements = this.graphClient.runGremlinQuery("g.V().hasLabel(\"ingredient\").has(\"name\", \"" + ingredient + "\")");
//        if (elements.length > 0) {
//            for (Element element : elements) {
//                boolean success = this.graphClient.deleteVertex(((Vertex) element).getId());
//                logger.debug(String.format("Deleted ingredient %s = %s", ingredient, success));
//            }
//        }
//    }
//}

// Graph Helper Methods

RecipeGraph.prototype.findVertex = function(label, propertyName, propertyValue) {
    return new Promise((resolve, reject) => {
        var query = 'g.V().hasLabel("' + label + '").has("' + propertyName + '", "' + propertyValue + '")';
        this.graphClient.gremlin('def g = graph.traversal(); ' + query, (error, response) => {
            if (error) {
                console.log('Error finding Vertex: ' + error);
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

RecipeGraph.prototype.addEdgeIfNotExists = function(edge){
    return new Promise((resolve, reject) => {
        var query = `g.V(${edge.outV}).outE().inV().hasId(${edge.inV})`;
        this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
            if (error) {
                console.log(`Error finding Edge: ${error}`);
                reject(error);
            }
            else if (response.result && response.result.data && response.result.data.length > 0) {
                console.log(`Edge from ${edge.outV} to ${edge.inV} exists.`);
                resolve(null);
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