const controller = require("./controllers/usersController");

const express = require('express');
const morgan = require('morgan');

const app = express();

app.use(morgan('dev'));

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/login', controller.postLogin);
app.get('/users/:username', controller.getUser);
app.post('/addfriend', controller.postAddFriend);
app.get('/acceptfriend/:from/:to', controller.getAcceptFriend);
app.get('/declinefriend/:from/:to', controller.getDeclineFriend);
// ST-01: Player Statistics
app.get('/stats/:username', controller.getPlayerStats);
// ST-02: Leaderboard API
app.get('/api/leaderboard', controller.getLeaderboard);

exports.app = app;