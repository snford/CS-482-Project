require('dotenv').config();
const dbcon = require('./DbConnection');
dbcon.connect("prod");

const ExpApp = require('./app');


const server = ExpApp.app.listen(process.env.PORT,process.env.HOSTNAME,function(){ 
    console.log(`Server running on ${process.env.HOSTNAME}:${process.env.PORT}`); 
});
