require('dotenv').config();
const dbcon = require('./DbConnection');
const usersDao = require('./dao/UsersDaoMongoose');

// TT-03: once connected, make the user indexes match the schema
dbcon.connect("prod").then(function() {
    return usersDao.syncIndexes();
});

const ExpApp = require('./app');


const server = ExpApp.app.listen(process.env.PORT,process.env.HOSTNAME,function(){ 
    console.log(`Server running on ${process.env.HOSTNAME}:${process.env.PORT}`); 
});
