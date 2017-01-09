# Watson Recipe Bot + IBM Graph

This project is based on the [Watson Recipe Bot example](https://medium.com/ibm-watson-developer-cloud/how-to-build-a-recipe-slack-bot-using-watson-conversation-and-spoonacular-api-487eacaf01d4#.i0q8fnhuu).
The Watson Recipe Bot is a Slack bot that recommends recipes based on ingredients or cuisines.
This project is essentially a fork of the Watson Recipe Bot with some additional features, including:

1. Multi-user support - the original application supported only a single user interacting with the bot at a time. This application supports multiple users interacting with the bot at the same time.
2. IBM Graph integration - this application adds IBM Graph integration for caching 3rd party API calls and storing each user's chat history (the ingredients, cuisines, and recipes they have selected).
3. Additional Watson Conversation intent - this application adds a "favorites" intent which allows a user to request their favorite recipes based on the history stored in Graph.
4. Recommendations - this application uses the Gremlin query language, supported by IBM Graph, to recommend recipes to users based on selected ingredients or cuisines.
 
## Getting Started

Before you get started [read the original blog post](https://medium.com/ibm-watson-developer-cloud/how-to-build-a-recipe-slack-bot-using-watson-conversation-and-spoonacular-api-487eacaf01d4#.i0q8fnhuu)
to understand how the Watson Recipe Bot works, or [the new blog post](https://medium.com/ibm-watson-data-lab/persisting-data-for-a-smarter-chatbot-be599480f7b2) which talks about improving the bot by adding persistence with IBM Cloudant.
You __do not__ need to follow the instructions in these blog posts. All the instructions required to run the bot are below.
After cloning this repo follow the steps below.

### Quick Reference

The following environment variables are required to run the application:

```
SLACK_BOT_TOKEN=xxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_BOT_ID=UXXXXXXXX
SPOONACULAR_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CONVERSATION_USERNAME=xxxxxxx-xxxx-xxxx-xxxxx-xxxxxxxxxxxxx
CONVERSATION_PASSWORD=xxxxxxxxxxxx
CONVERSATION_WORKSPACE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GRAPH_API_URL=https://ibmgraph-alpha.ng.bluemix.net/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/g
GRAPH_USERNAME=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GRAPH_PASSWORD=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
GRAPH_ID=watson_recipe_bot
```

We will show you how to configure the necessary services and retrieve these values in the instructions below:

### Prerequisites

The following prerequisites are required to run the application.

1. A [Bluemix](https://www.ibm.com/cloud-computing/bluemix/) account.
2. A [Watson Conversation](https://www.ibm.com/watson/developercloud/conversation.html) service provisioned in your Bluemix account.
3. A [Graph](http://www.ibm.com/analytics/us/en/technology/cloud-data-services/graph/) service provisioned in your Bluemix account.
4. A [Spoonacular](https://spoonacular.com/food-api) API key. A free tier is available, however a credit card is required.
5. A [Slack](https://slack.com) account and permission in your Slack team to register a Slack bot. 

To run locally you will need Node.js 4.3.2 or greater.

To push your application to Bluemix from your local development environment you will need the [Bluemix CLI and Dev Tools](https://console.ng.bluemix.net/docs/starters/install_cli.html).

### Local Development Environment

We'll start by getting your local development environment set up. If you haven't already installed Node.js
you can install it by following the instructions [here](https://nodejs.org/en/).

From the command-line cd into the watson-recipe-bot-nodejs-cloudant directory:

```
git clone https://github.com/ibm-cds-labs/watson-recipe-bot-nodejs-graph
cd watson-recipe-bot-nodejs-graph
```
 
Install dependencies:

```
npm install
```

Copy the .env.template file included in the project to .env. This file will contain the environment variable definitions:

```
cp .env.template .env
```

### Slack

In this next step we'll create a new Slack bot in your Slack team.
 
In your web browser go to [https://my.slack.com/services/new/bot](https://my.slack.com/services/new/bot). Make sure you sign into the appropriate Slack team.
You can also change the Slack team from the pulldown in the top right.

1. You'll start by choosing a username for your bot. In the field provided enter **sous-chef**.

    ![Slack](screenshots/slack1.png?rev=2&raw=true)

2. Click the **Add bot integration** button.
3. On the following screen you will find the API Token. Copy this value to your clipboard.

    ![Slack](screenshots/slack2.png?rev=2&raw=true)
    
4. Open the .env file in a text editor.
5. Paste the copied token from your clipboard as the SLACK_BOT_TOKEN value:

    ```
    SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
    ```

6. Save the .env file

Next, we need to get the Slack ID of the bot.

1. From the command-line run the following command:

    ```
    node GetBotId.js
    ```

2. The script should print out the bot ID. The output should be similar to the following:

    ```
    Bot ID for 'sous-chef' is U3XXXXXXX
    ```

3. Copy and paste the bot ID into your .env file:

    ```
    SLACK_BOT_ID=U3XXXXXXX
    ```

### Spoonacular

In this next step we'll set up your Spoonacular account. Spoonacular is a Food and Recipe API.
The application uses Spoonacular to find recipes based on ingredient or cuisines requested by the user.
  
*Note: If you have previously configured Spoonacular to work with the [Watson Recipe Bot Cloudant example](https://github.com/ibm-cds-labs/watson-recipe-bot-python-cloudant),
or any other Watson Recipe Bot example, you can copy the SPOONACULAR_KEY value from your .env file for that example into the .env file for this example and move onto the next step.*  

1. In your web browser go to [https://spoonacular.com/food-api](https://spoonacular.com/food-api).
2. Click the **Get Access** button.

    ![Spoonacular](screenshots/spoonacular1.png?rev=1&raw=true)

3. Click the appropriate button to gain access (i.e. **Get Regular Access**)

    ![Spoonacular](screenshots/spoonacular2.png?rev=2&raw=true)

4. Choose the appropriate Pricing plan (i.e. **Basic**) and click the **Subscribe** button.
5. Follow the instructions to sign into or sign up for a Mashape account.
6. After you have subscribed to Spoonacular in the Documentation tab find a curl example on the right. It should look similar to this:

    ![Spoonacular](screenshots/spoonacular3.png?rev=2&raw=true)

7. Copy the value of the X-Mashape-Key and paste it into your .env file:

    ```
    SPOONACULAR_KEY=vxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    ```

### Bluemix

If you do not already have a Bluemix account [click here](https://console.ng.bluemix.net/registration/) to sign up.

Login to your Bluemix account.

### Watson Conversation

First, we'll walk you through provisioning a Watson Conversation service in your Bluemix account:

*Note: If you have previously configured Watson Conversation to work with the [Watson Recipe Bot Cloudant example](https://github.com/ibm-cds-labs/watson-recipe-bot-python-cloudant),
or any other Watson Recipe Bot example, you can copy the CONVERSATION_USERNAME, CONVERSATION_PASSWORD, and CONVERSATION_WORKSPACE_ID values from your .env file for that example into the .env file for this example and move onto the next step.*  

1. From your Bluemix Applications or Services Dashboard click the **Create Service** button.

    ![Bluemix](screenshots/bluemix1.png?rev=3&raw=true)

2. In the IBM Bluemix Catalog search for **Watson Conversation**.
3. Select the **Conversation** service.

    ![Watson Conversation](screenshots/conversation1.png?rev=1&raw=true)
    
4. Click the **Create** button on the Conversation detail page.
5. On your newly created Conversation service page click the **Service Credentials** tab.

    ![Watson Conversation](screenshots/conversation2.png?rev=1&raw=true)

6. Find your newly created Credentials and click **View Credentials**

    ![Watson Conversation](screenshots/conversation3.png?rev=1&raw=true)

7. Copy the username and password into your .env file:

    ```
    CONVERSATION_USERNAME=xxxxxxx-xxxx-xxxx-xxxxx-xxxxxxxxxxxxx
    CONVERSATION_PASSWORD=xxxxxxxxxxxx
    ```

Next, let's launch the Watson Conversation tool and import our conversation workspace.

1. Go back to the **Manage** tab.
2. Click the **Launch tool** button.

    ![Watson Conversation](screenshots/conversation4.png?rev=1&raw=true)

3. Log in to Watson Conversation with your Bluemix credentials if prompted to do so.
4. On the **Create workspace** page click the **Import** button.

    ![Watson Conversation](screenshots/conversation5.png?rev=1&raw=true)
    
5. Choose the workspace.json file in the application directory (*watson-recipe-bot-nodejs-graph/workspace.json*).
6. Click the **Import** button.

    ![Watson Conversation](screenshots/conversation6.png?rev=1&raw=true)

7. Under Workspaces you should now see the Recipe Bot.
8. Click the menu button (3 vertical dots) and click **View Details**

    ![Watson Conversation](screenshots/conversation7.png?rev=1&raw=true)
    
9. Copy the Workspace ID and paste it into your .env file:

    ```
    CONVERSATION_WORKSPACE_ID=40xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ```

### IBM Graph

We're almost there! Next, we'll provision an instance of IBM Graph in our Bluemix account. After this step we will be able to run our bot locally.

1. From your Bluemix Applications or Services Dashboard click the **Create Service** button.
2. In the IBM Bluemix Catalog search for **IBM Graph**.
3. Select the **IBM Graph** service.

    ![Watson Conversation](screenshots/ibmgraph1.png?rev=1&raw=true)
    
4. Click the **Create** button on the Graph detail page.
5. On your newly created Graph service page click the **Service Credentials** tab.
6. Find your newly created Credentials and click **View Credentials**
7. Copy the apiURL, username, and password into your .env file:

    ```
    GRAPH_API_URL=https://ibmgraph-alpha.ng.bluemix.net/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/g
    GRAPH_USER_NAME=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    GRAPH_PASSWORD=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ```

### Run Locally

We're now ready to test our bot. From the command-line run the following command:

```
node index.js
```

If all is well you should see output similar to the following:

```
Getting graphs...
Creating graph watson_recipe_bot...
Getting graph schema...
Creating graph schema...
sous-chef is connected and running!
```

To interact with the bot open Slack, go to the Slack team where you installed the bot, start a direct conversation with
sous-chef, and say "hi".

![sous-chef](screenshots/local1.png?rev=2&raw=true)

### IBM Graph Dashboard Quick Start

To learn more about IBM Graph and how the Watson Recipe Bot uses IBM Graph to store users, ingredients, cuisines, and recipes
launch the IBM Graph dashboard from Bluemix by clicking the **Open** button on the IBM Graph Service Details page.
Select the watson-recipe-bot graph:

![IBM Graph](screenshots/ibmgraph-dashboard1.png?rev=1&raw=true)

Once you have interacted with the Slack bot a Vertex for your Slack user should have been stored in Graph.
You can find your Slack ID in `node index.js` output. Look for the following:
 
```
Creating person vertex where name=UXXXXXXXX
```

Run the following Gremlin query in the IBM Dashboard. Replace UXXXXXXXX with your Slack ID:

```
def g = graph.traversal();
g.V().hasLabel("person").has("name","UXXXXXXXX").outE().inV().outE().inV().path();
```

The screenshot below shows a sample of what you might see in the IBM Graph Dashboard.
In this case the user has selected a single cuisine and a single recipe:

![IBM Graph](screenshots/ibmgraph-dashboard2.png?rev=1&raw=true)

You can find more information about IBM Graph and the Gremlin query language [here](https://ibm-graph-docs.ng.bluemix.net/).
 
### Sample Conversations

Here are some sample conversations you can have with sous-chef:

![sous-chef](screenshots/sous-chef-convo1.png?rev=4&raw=true)

![sous-chef](screenshots/sous-chef-convo2.png?rev=4&raw=true)

![sous-chef](screenshots/sous-chef-convo3.png?rev=4&raw=true)

## Next Steps

For more information on how the sous-chef bot works [read the original blog post](https://medium.com/ibm-watson-developer-cloud/how-to-build-a-recipe-slack-bot-using-watson-conversation-and-spoonacular-api-487eacaf01d4#.i0q8fnhuu)
and [the new blog post](https://medium.com/ibm-watson-data-lab/persisting-data-for-a-smarter-chatbot-be599480f7b2) which talks about improving the bot by adding persistence with IBM Cloudant. 

## License

Licensed under the [Apache License, Version 2.0](LICENSE.txt).

