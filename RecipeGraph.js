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
                console.log(`Adding ${vertex.label} vertex where ${uniquePropertyName}=${propertyValue}`);
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

//private void addEdgeIfNotExists(Edge edge) throws Exception {
//    String query = "g.V(" + edge.getOutV() + ").outE().inV().hasId(" + edge.getInV() + ")";
//    Element[] elements = this.graphClient.runGremlinQuery(query);
//    if (elements.length == 0 || !(elements[0] instanceof Vertex)) {
//        this.graphClient.addEdge(edge);
//    }
//}

module.exports = RecipeGraph;