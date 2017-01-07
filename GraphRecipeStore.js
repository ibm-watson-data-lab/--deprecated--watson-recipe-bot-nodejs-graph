'use strict';

class GraphRecipeStore {

    /**
     * Creates a new instance of GraphRecipeStore.
     * @param {Object} graphClient - The instance of the IBM Graph Client to use
     * @param {String} graphId - The id of the graph to use
     */
    constructor(graphClient, graphId) {
        this.graphClient = graphClient; // Note: this library cannot be promisified using promisifyAll
        this.graphId = graphId;
    }

    /**
     * Creates and initializes the Graph and Graph schema.
     * @returns {Promise.<TResult>}
     */
    init() {
        return new Promise((resolve, reject) => {
            this.graphClient.session((error, token) => {
                this.graphClient.config.session = token;
                this.initGraph()
                    .then(() => {
                        return this.initGraphSchema();
                    })
                    .then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        });
    }

    initGraph() {
        return new Promise((resolve, reject) => {
            this.graphClient.graphs().get((err, graphIds) => {
                let graphExists = (graphIds.indexOf(this.graphId) >= 0);
                if (graphExists) {
                    this.updateGraphUrl();
                    resolve();
                }
                else {
                    this.graphClient.graphs().create(this.graphId, (err, response) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            this.updateGraphUrl();
                            resolve();
                        }
                    });
                }
            });
        });
    }

    updateGraphUrl() {
        let url = this.graphClient.config.url;
        this.graphClient.config.url = url.substring(0,url.lastIndexOf('/')+1) + this.graphId
    }

    initGraphSchema() {
        return new Promise((resolve, reject) => {
            // Set the schema
            console.log('Getting graph schema...');
            this.graphClient.schema().get((error, body) => {
                if (error) {
                    reject(error);
                }
                else {
                    let schema;
                    if (body.result && body.result.data && body.result.data.length > 0) {
                        schema = body.result.data[0];
                    }
                    let schemaExists = (schema && schema.propertyKeys && schema.propertyKeys.length > 0);
                    if (!schemaExists) {
                        console.log('Creating graph schema...');
                        this.graphClient.schema().set(this.getGraphSchema(), (error, body) => {
                            if (error) {
                                reject(error);
                            }
                            else {
                                resolve(schema);
                            }
                        });
                    }
                    else {
                        console.log('Graph schema exists.');
                        resolve(schema);
                    }
                };
            });
        });
    }

    getGraphSchema() {
        return {
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
    }

    // User

    /**
     * Adds a new user to Graph if a user with the specified ID does not already exist.
     * @param userId - The ID of the user (typically the ID returned from Slack)
     * @returns {Promise.<TResult>}
     */
    addUser(userId) {
        let userVertex = {label: 'person'};
        userVertex['name'] = userId;
        return this.addVertexIfNotExists(userVertex, 'name')
            .then((vertex) => {
                return Promise.resolve(vertex);
            });
    }

    // Ingredients

    /**
     * Gets the unique name for the ingredient to be stored in Graph.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @returns {string}
     */
    getUniqueIngredientsName(ingredientsStr) {
        let ingredients = ingredientsStr.trim().toLowerCase().split(',');
        for (let i = 0; i < ingredients.length; i++) {
            ingredients[i] = ingredients[i].trim();
        }
        ingredients.sort();
        return ingredients.join(',');
    }

    /**
     * Finds the ingredient based on the specified ingredientsStr in Graph.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @returns {Promise.<TResult>}
     */
    findIngredient(ingredientsStr) {
        return this.findVertex('ingredient', 'name', this.getUniqueIngredientsName(ingredientsStr));
    }

    /**
     * Adds a new ingredient to Graph if an ingredient based on the specified ingredientsStr does not already exist.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @param matchingRecipes - The recipes that match the specified ingredientsStr
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addIngredient(ingredientsStr, matchingRecipes, userVertex) {
        let ingredientVertex = {label: 'ingredient'};
        ingredientVertex['name'] = this.getUniqueIngredientsName(ingredientsStr);
        ingredientVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g, '\\\'');
        return this.addVertexIfNotExists(ingredientVertex, 'name')
            .then((vertex) => {
                return this.recordIngredientRequestForUser(vertex, userVertex)
                    .then(() => {
                        return Promise.resolve(vertex);
                    });
            });
    }

    /**
     * Creates or updates an edge between the specified user and ingredient.
     * Stores the number of times the ingredient has been accessed by the user in the edge.
     * @param ingredientVertex - The existing Graph vertex for the ingredient
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordIngredientRequestForUser(ingredientVertex, userVertex) {
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: ingredientVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge);
    }

    // Cuisine

    /**
     * Gets the unique name for the cuisine to be stored in Graph.
     * @param cuisine - The cuisine specified by the user
     * @returns {string}
     */
    getUniqueCuisineName(cuisine) {
        return cuisine.trim().toLowerCase();
    }

    /**
     * Finds the cuisine with the specified name in Graph.
     * @param cuisine - The cuisine specified by the user
     * @returns {Promise.<TResult>}
     */
    findCuisine(cuisine) {
        return this.findVertex('cuisine', 'name', this.getUniqueCuisineName(cuisine));
    }

    /**
     * Adds a new cuisine to Graph if a cuisine with the specified name does not already exist.
     * @param cuisine - The cuisine specified by the user
     * @param matchingRecipes - The recipes that match the specified cuisine
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addCuisine(cuisine, matchingRecipes, userVertex) {
        let cuisineVertex = {label: 'cuisine'};
        cuisineVertex['name'] = this.getUniqueCuisineName(cuisine);
        cuisineVertex['detail'] = JSON.stringify(matchingRecipes).replace(/'/g, '\\\'');
        return this.addVertexIfNotExists(cuisineVertex, 'name')
            .then((vertex) => {
                return this.recordCuisineRequestForUser(vertex, userVertex)
                    .then(() => {
                        return Promise.resolve(vertex);
                    });
            });
    }

    /**
     * Creates or updates an edge between the specified user and cuisine.
     * Stores the number of times the cuisine has been accessed by the user in the edge.
     * @param cuisineVertex - The existing Graph vertex for the cuisine
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordCuisineRequestForUser(cuisineVertex, userVertex) {
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: cuisineVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge);
    }

    // Recipe

    /**
     * Gets the unique name for the recipe to be stored in Graph.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @returns {string}
     */
    getUniqueRecipeName(recipeId) {
        return `${recipeId}`.trim().toLowerCase();
    }

    /**
     * Finds the recipe with the specified ID in Graph.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @returns {Promise.<TResult>}
     */
    findRecipe(recipeId) {
        return this.findVertex('recipe', 'name', this.getUniqueRecipeName(recipeId));
    }

    /**
     * Adds a new recipe to Graph if a recipe with the specified name does not already exist.
     * @param recipeId - The ID of the recipe (typically the ID of the recipe returned from Spoonacular)
     * @param recipeTitle - The title of the recipe
     * @param recipeDetail - The detailed instructions for making the recipe
     * @param ingredientCuisineVertex - The existing Graph vertex for either the ingredient or cuisine selected before the recipe
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    addRecipe(recipeId, recipeTitle, recipeDetail, ingredientCuisineVertex, userVertex) {
        let recipeVertex = {label: 'recipe'};
        recipeVertex['name'] = this.getUniqueRecipeName(recipeId);
        recipeVertex['title'] = recipeTitle.trim().replace(/'/g, '\\\'');
        recipeVertex['detail'] = recipeDetail.replace(/'/g, '\\\'').replace(/\n/g, '\\\\n');
        return this.addVertexIfNotExists(recipeVertex, 'name')
            .then((vertex) => {
                // add one edge from the ingredient/cuisine to the recipe
                recipeVertex = vertex;
                return this.recordRecipeRequestForUser(recipeVertex, ingredientCuisineVertex, userVertex);
            })
            .then(() => {
                return Promise.resolve(recipeVertex);
            });
    }

    /**
     * Finds the user's favorite recipes in Graph.
     * @param userVertex - The existing Graph vertex for the user
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findFavoriteRecipesForUser(userVertex, count) {
        return new Promise((resolve, reject) => {
            let query = `g.V().hasLabel("person").has("name", "${userVertex.properties['name'][0]['value']}").outE().order().by("count", decr).inV().hasLabel("recipe").limit(${count})`;
            this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
                if (error) {
                    console.log(`Error finding Vertexes: ${error}`);
                    reject(error);
                }
                else if (response.result && response.result.data && response.result.data.length > 0) {
                    let recipes = [];
                    let recipeVertices = response.result.data;
                    for (let recipeVertex of recipeVertices) {
                        let recipe = {
                            id: recipeVertex.properties.name[0].value,
                            title: recipeVertex.properties.title[0].value,
                        }
                        recipes.push(recipe);
                    }
                    resolve(recipes);
                }
                else {
                    resolve([]);
                }
            });
        });
    }

    /**
     * Finds popular recipes using the specified ingredient.
     * @param ingredientsStr - The ingredient or comma-separated list of ingredients specified by the user
     * @param userVertex - The Graph vertex for the user requesting recommended recipes
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findRecommendedRecipesForIngredient(ingredientsStr, userVertex, count) {
        ingredientsStr = this.getUniqueIngredientsName(ingredientsStr);
        let query = `g.V().hasLabel("ingredient").has("name","${ingredientsStr}")`;
        query += `.inE().outV().hasLabel("person").has("name",neq("${userVertex.properties.name[0].value}"))`;
        query += `.outE().has("count",gt(1)).order().by("count", decr).inV().hasLabel("recipe")`;
        query += `.inE().outV().hasLabel("ingredient").has("name","${ingredientsStr}").path()`;
        return this.getRecommendedRecipes(query, count);
    }

    /**
     * Finds popular recipes using the specified cuisine.
     * @param cuisine - The cuisine specified by the user
     * @param userVertex - The Graph vertex for the user requesting recommended recipes
     * @param count - The max number of recipes to return
     * @returns {Promise.<TResult>}
     */
    findRecommendedRecipesForCuisine(cuisine, userVertex, count) {
        cuisine = this.getUniqueCuisineName(cuisine);
        let query = `g.V().hasLabel("cuisine").has("name","${cuisine}")`;
        query += `.inE().outV().hasLabel("person").has("name",neq("${userVertex.properties.name[0].value}"))`;
        query += `.outE().has("count",gt(1)).order().by("count", decr).inV().hasLabel("recipe")`;
        query += `.inE().outV().hasLabel("cuisine").has("name","${cuisine}").path()`;
        return this.getRecommendedRecipes(query, count);
    }

    getRecommendedRecipes(query, count) {
        return new Promise((resolve, reject) => {
            this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
                if (error) {
                    console.log(`Error finding Vertexes: ${error}`);
                    reject(error);
                }
                else if (response.result && response.result.data && response.result.data.length > 0) {
                    let recipes = [];
                    let recipeHash = {};
                    let paths = response.result.data;
                    for (let path of paths) {
                        let recipeVertex = path.objects[4];
                        let recipeId = recipeVertex.properties.name[0].value;
                        let recipe = recipeHash[recipeId];
                        if (! recipe) {
                            if (recipes.length >= count) {
                                continue;
                            }
                            recipe = {
                                id: recipeId,
                                title: recipeVertex.properties.title[0].value,
                                recommendedUserCount: 1
                            };
                            recipes.push(recipe);
                            recipeHash[recipeId] = recipe;
                        }
                        else {
                            recipe.recommendedUserCount += 1;
                        }
                    }
                    resolve(recipes);
                }
                else {
                    resolve([]);
                }
            });
        });
    }
    

    /**
     * Creates or updates an edge between the specified user and recipe.
     * Stores the number of times the recipe has been accessed by the user in the edge.
     * Creates or updates an edge between the specified ingredient/cuisine (if not None) and recipe.
     * Stores the number of times the recipe has been accessed by the ingredient/cuisine in the edge.
     * @param recipeVertex - The existing Graph vertex for the recipe
     * @param ingredientCuisineVertex - The existing Graph vertex for either the ingredient or cuisine selected before the recipe
     * @param userVertex - The existing Graph vertex for the user
     * @returns {Promise.<TResult>}
     */
    recordRecipeRequestForUser(recipeVertex, ingredientCuisineVertex, userVertex) {
        // add one edge from the user to the recipe (this will let us find a user's favorite recipes, etc)
        let edge = {
            label: 'selects',
            outV: userVertex.id,
            inV: recipeVertex.id,
            properties: {'count': 1}
        };
        return this.addUpdateEdge(edge)
            .then(() => {
                if (ingredientCuisineVertex) {
                    // add one edge from the ingredient/cuisine to the recipe
                    let edge = {
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
    }

    // Graph Helper Methods

    /**
     * Finds a vertex based on the specified label, propertyName, and propertyValue.
     * @param label - The label value of the vertex stored in Graph
     * @param propertyName - The property name to search for
     * @param propertyValue - The value that should match for the specified property name
     * @returns {Promise.<TResult>}
     */
    findVertex(label, propertyName, propertyValue) {
        return new Promise((resolve, reject) => {
            let query = `g.V().hasLabel("${label}").has("${propertyName}", "${propertyValue}")`;
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
    }

    /**
     * Adds a new vertex to Graph if a vertex with the same value for uniquePropertyName does not exist.
     * @param vertex - The vertex to add
     * @param uniquePropertyName - The name of the property used to search for an existing vertex (the value will be extracted from the vertex provided)
     * @returns {Promise.<TResult>}
     */
    addVertexIfNotExists(vertex, uniquePropertyName) {
        return new Promise((resolve, reject) => {
            let propertyValue = `${vertex[uniquePropertyName]}`;
            let query = `g.V().hasLabel("${vertex.label}").has("${uniquePropertyName}", "${propertyValue}")`;
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
                    this.graphClient.vertices().create(vertex, (error, body) => {
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
    }

    /**
     * Adds a new edge to Graph if an edge with the same out_v and in_v does not exist.
     * Increments the count property on the edge.
     * @param edge - The edge to add
     * @returns {Promise}
     */
    addUpdateEdge(edge) {
        return new Promise((resolve, reject) => {
            let query = `g.V(${edge.outV}).outE().inV().hasId(${edge.inV}).path()`;
            this.graphClient.gremlin(`def g = graph.traversal(); ${query}`, (error, response) => {
                if (error) {
                    console.log(`Error finding Edge: ${error}`);
                    reject(error);
                }
                else if (response.result && response.result.data && response.result.data.length > 0) {
                    console.log(`Edge from ${edge.outV} to ${edge.inV} exists.`);
                    edge = response.result.data[0].objects[1];
                    let count = 0;
                    if (!edge.properties) {
                        edge.properties = {};
                    }
                    if (edge.properties.count) {
                        count = edge.properties.count;
                    }
                    edge.properties['count'] = count + 1;
                    this.graphClient.edges().update(edge.id, edge, (error, body) => {
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
                    this.graphClient.edges().create(edge.label, edge.outV, edge.inV, edge.properties, (error, body) => {
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
}

module.exports = GraphRecipeStore;