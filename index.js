const request = require("request")
, Twitter = require("twitter");

// load env-vars for local deploys
require("dotenv").config();

const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_TOKEN_SECRET
});

const WEBHOOK_REQUEST_DEFAULT_OPTIONS = {
    url: process.env.TWEETER_CHANNEL_WEBHOOK,
    method: "POST",
    json: true
}

const twitterFollowIdFilter = new Map();
populateTwitterUserIds().then(function()
{
    twitterClient.stream("statuses/filter", { follow: Array.from(twitterFollowIdFilter.keys()).join(",") }, function(stream)
    {
        console.log("Now streaming `statuses/filter` for the following accounts:\n" + Array.from(twitterFollowIdFilter.values()).join(", "));

        stream.on("data", function(tweet)
        {
            if (!tweet)
                return;

            if (tweet.in_reply_to_status_id || tweet.in_reply_to_user_id)
                return;

            if (!tweet.user)
                return;

            // hard-code exclusive ESO filter for Bethesda Support
            if (tweet.user.id_str === "718475378751381504" && !tweet.entities.hashtags.includes("ESO"))
                return;

            console.log(`\nSending POST request to WEBHOOK for a new tweet from ${tweet.user.name}...`);

            request.post(Object.assign({
                body: {
                    content: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
                    username: tweet.user.name,
                    avatar_url: tweet.user.profile_image_url_https
                }
            }, WEBHOOK_REQUEST_DEFAULT_OPTIONS), function(res)
            {
                if (res.statusCode.toString().startsWith('2'))
                    console.log(`Successfully sent ${tweet.user.name}'s tweet to WEBHOOK.`);
            });
        });

        stream.on("error", console.error);
    });
}).catch(console.error);

function populateTwitterUserIds()
{
    return new Promise(function(resolve, reject)
    {
        let usersToFetch = process.env.TWITTER_FETCH_USER_TWEETS.split(",")
        , usersProcessed = 0;

        for (const screenName of usersToFetch)
        {
            twitterClient.get("/users/show", { screen_name: screenName }, function(err, user)
            {
                usersProcessed++;

                if (err)
                    return console.error(err);

                twitterFollowIdFilter.set(user.id_str, screenName);

                if (usersProcessed === usersToFetch.length)
                    resolve();
            });
        }
    });
}
