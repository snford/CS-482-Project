const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    username: { type: String, required: true, unique: true },
    friends: { type: [String], default: [] }
});

const userModel = mongoose.model('user', userSchema);

exports.readByUsername = async function(username) {
    const user = await userModel.findOne({ username: username });
    return user;
}

exports.create = async function(user) {
    const mongoUser = new userModel(user);
    await mongoUser.save();
    return mongoUser;
}

exports.deleteAll = async function(check) {
    if (check === "test") {
        await userModel.deleteMany();
    }
}
