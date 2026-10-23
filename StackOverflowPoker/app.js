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

exports.app = app;