const controller = require("./controllers/usersController");
const tablesController = require("./controllers/tablesController");
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');

const app = express();

app.use(morgan('dev'));

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// TT-03: login sessions. The session only stores the user's id; it is saved
// in MongoDB (reusing mongoose's connection) so logins survive a restart.
const SEVEN_DAYS = 7 * 24 * 60 * 60;
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    console.warn("SESSION_SECRET is not set in .env - using an insecure development secret.");
    sessionSecret = "dev-only-insecure-secret";
}

app.use(session({
    name: "sop.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SEVEN_DAYS * 1000
    },
    store: MongoStore.create({
        clientPromise: mongoose.connection.asPromise().then(function (connection) {
            return connection.getClient();
        }),
        collectionName: "sessions",
        ttl: SEVEN_DAYS
    })
}));

// TT-03: who is logged in
app.get('/api/me', controller.getMe);

app.post('/login', controller.postLogin);
app.get('/users/:username', controller.getUser);
app.post('/addfriend', controller.postAddFriend);
app.get('/acceptfriend/:from/:to', controller.getAcceptFriend);
app.get('/declinefriend/:from/:to', controller.getDeclineFriend);
// SF-04: Remove Friend
app.post('/removefriend', controller.postRemoveFriend);
// ST-01: Player Statistics
app.get('/stats/:username', controller.getPlayerStats);
// ST-02: Leaderboard API
app.get('/api/leaderboard', controller.getLeaderboard);

// LT-01: View Lobby
app.get("/api/tables", tablesController.getTables);

// LT-03 table screen
app.get("/api/tables/:tableId", tablesController.getTable);

// LT-02: Join Table
app.post("/api/tables/join", tablesController.joinTable);

// LT-03: Create Table
app.post("/api/tables/create", tablesController.createTable);

app.get("/table/:tableId", (req, res) => {
    res.sendFile(
        require("path").join(__dirname, "public", "table.html")
    );
});

app.post("/api/tables/leave", tablesController.leaveTable);

exports.app = app;

