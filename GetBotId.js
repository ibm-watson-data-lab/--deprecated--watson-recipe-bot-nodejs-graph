const dotenv = require('dotenv');
const SlackBot = require('slackbots');

// load from .env
dotenv.config();

const BOT_NAME = 'sous-chef';
const slackBot = new SlackBot({
    token: process.env.SLACK_BOT_TOKEN,
    name: 'sous-chef'
});

slackBot.getUserId(BOT_NAME)
    .then((userId) => {
        console.log(`Bot ID for '${BOT_NAME}' is ${userId}`);
    })
    .catch(() => {
        console.log(`Could not find bot user with the name ${BOT_NAME}`);
    })
    .then(() => {
        process.exit()
    });