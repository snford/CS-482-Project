const controller = require("./controllers/usersController");
const tablesController = require("./controllers/tablesController");
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authController = require('./controllers/authController');
const { loadUser, requireLogin } = require('./middleware/auth');

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
        // Waits until mongoose has connected, then shares its connection
        clientPromise: new Promise(function (resolve) {
            if (mongoose.connection.readyState === 1) {
                resolve(mongoose.connection.getClient());
            } else {
                mongoose.connection.once("connected", function () {
                    resolve(mongoose.connection.getClient());
                });
            }
        }),
        collectionName: "sessions",
        ttl: SEVEN_DAYS
    })
}));

// TT-03: who is logged in
app.get('/api/me', controller.getMe);

// TT-03: Google sign-in (values come from .env, never committed)
const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (googleReady) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "/auth/google/callback",
        // Random "state" value kept in the session, so a login can't be forged
        state: true
    }, authController.verifyGoogle));
} else {
    console.warn("Google sign-in is off: add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.");
}

app.use(passport.initialize());

// TT-03: figure out who is signed in for every request (req.user)
app.use(loadUser);

function requireGoogleSetup(req, res, next) {
    if (!googleReady) {
        res.status(503).send("Google sign-in is not set up on this server yet.");
        return;
    }
    next();
}

// Sends the player to Google's sign-in page
app.get('/auth/google', requireGoogleSetup, passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
    session: false
}));

// Google sends the player back here
app.get('/auth/google/callback', requireGoogleSetup, function(req, res, next) {
    passport.authenticate('google', { session: false }, function(error, user) {
        if (error || !user) {
            res.redirect('/index.html?login=failed');
            return;
        }
        authController.finishGoogleLogin(req, res, user);
    })(req, res, next);
});

app.post('/logout', authController.postLogout);

// TT-03: play without an account (temporary guest name in the session)
app.post('/guest', authController.startGuest);

// TT-03: new players pick a poker name after their first Google login
app.get('/api/username-available', controller.getUsernameAvailable);
app.post('/api/me/username', controller.postChooseUsername);

app.get('/users/:username', controller.getUser);

// SF-01 to SF-04: friends. All of these act as the signed-in player.
app.post('/addfriend', requireLogin, controller.postAddFriend);
app.post('/acceptfriend', requireLogin, controller.postAcceptFriend);
app.post('/declinefriend', requireLogin, controller.postDeclineFriend);
app.post('/removefriend', requireLogin, controller.postRemoveFriend);
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

