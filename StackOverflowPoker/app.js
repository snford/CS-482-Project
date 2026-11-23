const controller = require("./controllers/usersController");
const tablesController = require("./controllers/tablesController");
const messageController = require("./controllers/messageController");
const friendsController = require("./controllers/friendsController");
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authController = require('./controllers/authController');
const {
    loadUser,
    requireLogin,
    requireAdmin
} = require('./middleware/auth');

// AM-05: Administrator dashboard controller
const adminController = require('./controllers/adminController');
// AM-01: Player reports and administrator conversations
const reportsController = require("./controllers/reportsController");
const chatLogsController = require("./controllers/chatLogsController");
const app = express();

app.use(morgan('dev'));

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

// TT-03: who is logged in (after loadUser, so it also counts as being online for SF-09)
app.get('/api/me', controller.getMe);

// AM-05: Protect administrator webpages
const adminPages = [
    "/admin-dashboard.html",
    "/admin.html",
    "/adminads.html",
    "/admin-chat-logs.html"
];

// Only administrators can access these pages
app.use(adminPages, requireAdmin);

// Serve regular website files after checking admin access
app.use(express.static('public'));

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
// SF-09: which friends are online or at a table
app.get('/api/friends/status', requireLogin, friendsController.getFriendStatus);
// ST-01: Player Statistics
app.get('/stats/:username', controller.getPlayerStats);
// ST-02: Leaderboard API
app.get('/api/leaderboard', controller.getLeaderboard);
// AM-05: Protected administrator dashboard API
app.get(
    "/api/admin/dashboard",
    requireAdmin,
    adminController.getDashboard
);

// AM-05: Protected registered-user list
app.get(
    "/api/admin/users",
    requireAdmin,
    adminController.getAllUsers
);

// AM-04: Administrator removes a registered user
app.delete(
    "/api/admin/users/:username",
    requireAdmin,
    adminController.removeUser
);

// AV-01: Administrator views saved advertisements
app.get(
    "/api/admin/ads",
    requireAdmin,
    adminController.getAds
);

// AV-01: Administrator creates an advertisement
app.post(
    "/api/admin/ads",
    requireAdmin,
    adminController.createAd
);

// TT-04: Administrator updates an advertisement
app.put(
    "/api/admin/ads/:adId",
    requireAdmin,
    adminController.updateAd
);

// TT-04: Administrator deletes an advertisement
app.delete(
    "/api/admin/ads/:adId",
    requireAdmin,
    adminController.deleteAd
);

// AV-01: Get active ads for the Lobby or Table
app.get(
    "/api/ads/:placement",
    adminController.getActiveAds
);

// UP-02: Public player profile
app.get(
    '/api/players/:username/profile',
    controller.getPublicProfile
);

// UP-01 T4: Registered player profile
app.get(
    '/api/profile/me',
    requireLogin,
    controller.getMyProfile
);

app.put(
    '/api/profile/me',
    requireLogin,
    controller.updateMyProfile
);

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
// PG-02: Retrieve chip balance
app.get('/users/:username/chips', controller.getChips);
// PG-02: Add, remove, or set a player's chips.
// TT-05: administrators only. Players' chips only change by playing.
app.post('/users/:username/chips/add', requireAdmin, controller.addChips);
app.post('/users/:username/chips/remove', requireAdmin, controller.removeChips);
app.put('/users/:username/chips', requireAdmin, controller.setChips);
//PG-01: Start a new round of Seven-Card Stud
app.post("/api/tables/:tableId/start-round",tablesController.startRound);   
//PG-01: Start the game
app.get("/api/tables/:tableId/game", tablesController.getRound);
//PG-02: Fold
app.post("/api/tables/:tableId/fold",tablesController.fold);
//PG-02: Check
app.post("/api/tables/:tableId/check",tablesController.check);
//PG-02: Call
app.post("/api/tables/:tableId/call",tablesController.call);
//PG-02: Raise
app.post("/api/tables/:tableId/raise",tablesController.raise);
//SF-05: Send a message to a friend
app.post("/messages/send",requireLogin,messageController.sendMessage);
//SF-05: Get the conversation with a friend
app.get("/messages/:friend",requireLogin,messageController.getConversation);
//SF-06: Send a message to a table
app.post("/messages/table/send",messageController.sendTableChat);
//SF-06: Get the messages for a table
app.get("/messages/table/:tableId",messageController.getTableChat);

// AM-01: Submit and manage player reports

app.post(
    "/api/reports",
    requireLogin,
    reportsController.createReport
);

app.get(
    "/api/reports/mine",
    requireLogin,
    reportsController.getMine
);

app.get(
    "/api/admin/reports",
    requireAdmin,
    reportsController.getAll
);

app.get(
    "/api/reports/:id",
    requireLogin,
    reportsController.getOne
);

app.post(
    "/api/reports/:id/messages",
    requireLogin,
    reportsController.sendMessage
);

app.patch(
    "/api/admin/reports/:id/resolve",
    requireAdmin,
    reportsController.resolve
);

// AM-03: Protected access to private and table chat history
app.get(
    "/api/admin/chat-logs",
    requireAdmin,
    chatLogsController.getLogs
);

exports.app = app;

