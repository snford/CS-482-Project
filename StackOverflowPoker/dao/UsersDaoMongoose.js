const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    username: { type: String, required: true, unique: true },

    // TT-03: Google account this user signs in with (unique, but older
    // accounts may not have one yet, hence sparse)
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String },

    friends: { type: [String], default: [] },
    friendRequests: { type: [String], default: [] },

    //ST-01: Player Statistics
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },

});

const userModel = mongoose.model('user', userSchema);

// TT-03: read a user by their database id (what the login session stores)
exports.readById = async function(id) {
    if (!mongoose.isValidObjectId(id)) {
        return null;
    }
    const user = await userModel.findById(id);
    return user;
}

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

// ST-02 T1: Get the top 10 players for the leaderboard
exports.getLeaderboard = async function() {

    // Get players from MongoDB, sorted by wins
    const players = await userModel.aggregate([
        {
            $project: {
                username: 1,

                // Default missing statistics to zero
                wins: { $ifNull: ["$wins", 0] },
                losses: { $ifNull: ["$losses", 0] }
            }
        },
        {
            // Most wins first, then fewest losses
            $sort: {
                wins: -1,
                losses: 1,
                username: 1
            }
        },
        {
            // Only return the top 10 players
            $limit: 10
        }
    ]);

    // Calculate additional statistics
    return players.map(function(player) {

        const wins = player.wins;
        const losses = player.losses;

        const totalGames = wins + losses;

        let winPercentage = 0;

        if (totalGames > 0) {
            winPercentage = (wins / totalGames) * 100;
        }

        return {
            username: player.username,
            wins: wins,
            losses: losses,
            totalGames: totalGames,
            winPercentage: Number(winPercentage.toFixed(2))
        };
    });
};

exports.deleteAll = async function(check) {
    if (check === "test") {
        await userModel.deleteMany();
    }
}