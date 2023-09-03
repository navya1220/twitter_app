const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(4000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//user Register API-1
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getRegisterQuery = `
    select * 
    from user 
    where username = '${username}'`;
  const dbUser = await db.get(getRegisterQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else if (password.length < 6) {
    response.status(400);
    response.send("Password is too short");
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    const createAccountQuery = `
       insert into user(name, username, password, gender) 
       values (
            '${name}',
           '${username}',
           '${hashedPassword}',
          
           '${gender}'
        );`;
    await db.run(createAccountQuery);
    response.status(200);
    response.send("User created successfully");
  }
});

//user login API-2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    select *
    from user
    where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authorization = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
//user tweet API-3
app.get("/user/tweets/feed/", authorization, async (request, response) => {
  const username = request.username;
  const userQuery = `
  select * from user where username='${username}';`;
  const userDetails = await db.get(userQuery);
  const getTweetQuery = `
    select 
    user.username,
    tweet.tweet,
   tweet.date_time as dataTime
    from follower 
    INNER join tweet 
    on follower.following_user_id = tweet.user_id
    inner join user 
    on tweet.user_id = user.user_id 
    where 
    follower.follower_user_id = ${userDetails.user_id}
    order by 
    tweet.date_time desc 
    limit 4;`;
  const tweetFeed = await db.all(getTweetQuery);
  response.send(tweetFeed);
});
//user follows API-4
app.get("/user/following/", authorization, async (request, response) => {
  const username = request.username;
  const userQuery = `
  select * from user where username='${username}';`;
  const userDetails = await db.get(userQuery);
  const userFollowerQuery = `
     select user.name from
     follower inner join user on  user.user_id = follower.following_user_id 
     where follower.follower_user_id = ${userDetails.user_id}`;
  const userFollowing = await db.all(userFollowerQuery);
  response.send(userFollowing);
});
//user follows API-5
app.get("/user/following/", authorization, async (request, response) => {
  const username = request.username;
  const userQuery = `
  select * from user where username='${username}';`;
  const userDetails = await db.get(userQuery);
  const userFollowerQuery = `
     select user.name from
     follower inner join user on follower.follower_user_id = user.user_id
     where follower.following_user_id = ${userDetails.user_id}`;
  const userFollowing = await db.all(userFollowerQuery);
  response.send(userFollowing);
});
//API-6
app.get("/tweets/:tweetId/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const userQuery = `
    select * from user where username = '${username}';`;
  const userDetails = await db.get(userQuery);
  const tweetQuery = `
    select 
    tweet.tweet,
    count(like.like_id) as likes,
    count(reply) as replies,
    tweet.data_time 
    from follower inner join tweet
    on follower.following_user_id = tweet.user_id
    inner join like on tweet.tweet_id = like.tweet_id inner join 
    reply on reply.tweet_id = tweet.tweet_id 
    where follower.follower_user_id = ${userDetails.user_id}
    and tweet.tweet_id = ${tweetId}
    group by tweet.tweet_id; `;
  const result = await db.all(tweetQuery);
  if (result[0].tweet === null) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(result);
  }
});
//API-7
app.get("/tweets/:tweetId/likes/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const userQuery = `
    select * from user where username = '${username}';`;
  const userDetails = await db.get(userQuery);
  const likesQuery = `
    select user.name
    from follower inner join tweet on follower.following_user_id = tweet.user_id
    inner join like on tweet.tweet_id = like.tweet_id inner join user on like.user_id = user.user_id
    where follower.follower_user_id = ${userDetails.user_id}
    and tweet.tweet_id = ${tweetId}
    group by tweet.tweet_id;`;
  const result = await db.all(likesQuery);
  if (result.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const l = result.length;
    const list = [];
    for (let i = 0; i < l; i++) {
      list.push(result[i].name);
    }
    response.send({ likes: list });
  }
});
//API-8
app.get(
  "/tweets/:tweetId/replies/",
  authorization,
  async (request, response) => {
    const { tweetId } = request.params;
    const username = request.username;
    const userQuery = `
    select * from user where username = '${username}';`;
    const userDetails = await db.get(userQuery);
    const tweetQuery = `
    select user.name,
    reply.reply
    from follower inner join tweet on follower.following_user_id = tweet.user_id
    inner join reply on tweet.tweet_id = reply.tweet_id inner join user on
    reply.user_id = user.user_id 
    where follower.follower_user_id = ${userDetails.user_id}
    and tweet.tweet_id = ${tweetId};`;
    const result = await db.all(tweetQuery);
    if (result.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send({ replies: result });
    }
  }
);
//API-9
app.get("/user/tweets/", authorization, async (request, response) => {
  const username = request.username;
  const userQuery = `
    select * from user where username = '${username}';`;
  const userDetails = await db.get(userQuery);
  const tweetQuery = `
    select 
    tweet.tweet,
    count(like.like_id) as likes,
    count(reply.reply) as replies,
    tweet.date_time as dateTime
    from user inner join tweet on user.user_id = tweet.user_id
    inner join like on like.tweet_id = tweet.tweet_id 
    inner join reply on reply.tweet_id = tweet.tweet_id
    where tweet.user_id = ${userDetails.user_id}
    group by tweet.tweet_id;`;
  const result = await db.all(tweetQuery);
  response.send(result);
});
//API-10
app.post("/user/tweets/", authorization, async (request, response) => {
  const { tweet } = request.body;
  const username = request.username;
  const userQuery = `
    select * from user where username = '${username}';`;
  const userDetails = await db.get(userQuery);
  const date = new Date();
  const tweetQuery = `
  insert into tweet (tweet, user_id, date_time)
  values (
      '${tweet}',
      '${userDetails.user_id}',
      '${userDetails.date_time}'
    );`;
  await db.run(tweetQuery);
  response.send("Created a Tweet");
});
//API-11
app.delete("/tweets/:tweetId/", authorization, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const userQuery = `
    select * from user where username = '${username}';`;
  const userDetails = await db.get(userQuery);
  const deleteQuery = `
  delete from tweet 
  where tweet_id = ${tweetId}
  and user_id = ${userDetails.user_id};`;
  const result = await db.run(deleteQuery);
  if (result.changes === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send("Tweet Removed");
  }
});
module.exports = app;
