const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    username: { type: String, required: true, unique: true },

    friends: { type: [String], default: [] },
    friendRequests: { type: [String], default: [] },

    //ST-01: Player Statistics
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },

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

exports.update = async function(user) {
    const updated = await userModel.findByIdAndUpdate(
        user._id,
        {
            friends: user.friends,
            friendRequests: user.friendRequests
        },
        { new: true }
    );

    return updated;
}

// ST-01: Record game result for a user (win or loss)
exports.recordGameResult = async function(username, result) {
    if(result !== "win" && result !== "loss") {
        throw new Error("Invalid result. Must be 'win' or 'loss'.");
    }

    let field = result === "win" ? "wins" : "losses";

    //+1 Counter
    let updateUser = await userModel.findOneAndUpdate(
        { username: username },
        { $inc: { [field]: 1 } },
        { new: true }
    );
    return updateUser;
}

exports.deleteAll = async function(check) {
    if (check === "test") {
        await userModel.deleteMany();
    }
}