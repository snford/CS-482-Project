require('dotenv').config();
const mongoose = require("mongoose");

exports.connect = async function(where){
    let uri = process.env.DB_URI;
    if(where === 'test') uri = process.env.TESTDB_URI;
    if(process.env.CI) uri = "mongodb://adm:secret@localhost:27017"; //CI test

    try{
        await mongoose.connect(uri);
        console.log("Connected to MongoDB database: " + mongoose.connection.name);
    }catch(error){
        console.log(error);
    }
}

exports.disconnect = async function(){
    await mongoose.connection.close();
}
