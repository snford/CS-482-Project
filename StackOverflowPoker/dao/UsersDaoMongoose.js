const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
    // Poker name everyone sees. New Google accounts don't have one until they
    // pick it (needsUsername), so it is unique but not required (sparse).
    username: { type: String, unique: true, sparse: true },
    needsUsername: { type: Boolean, default: false },

    // TT-03: Google account this user signs in with (unique, but older
    // accounts may not have one yet, hence sparse)
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String },

    friends: { type: [String], default: [] },
    friendRequests: { type: [String], default: [] },

    //ST-01: Player Statistics
    wins: { type: Number, default: 0, min: 0 },
    losses: { type: Number, default: 0, min: 0 },

    chips: { type: Number, default: 1000, min: 0 }

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

// TT-03: find the account that belongs to a Google login
exports.readByGoogleId = async function(googleId) {
    if (!googleId) {
        return null;
    }
    const user = await userModel.findOne({ googleId: googleId });
    return user;
}

// TT-03: update the database indexes to match the schema (the username index
// changed to allow accounts that haven't picked a name yet)
exports.syncIndexes = async function() {
    try {
        await userModel.syncIndexes();
    } catch (error) {
        console.log("Could not update user indexes: " + error.message);
    }
}

// TT-03: find a user by name ignoring capitals ("ben" finds "Ben"),
// so two players can't pick names that only differ by capitals
exports.readByUsernameIgnoreCase = async function(username) {
    if (!username) {
        return null;
    }
    // Escape regex symbols so the name is matched literally
    const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await userModel.findOne({ username: { $regex: "^" + escaped + "$", $options: "i" } });
    return user;
}

// TT-03: save the poker name a new player picked. Only works once, while the
// account still needs a name. Returns null if there was nothing to update.
exports.setUsername = async function(id, username) {
    const updated = await userModel.findOneAndUpdate(
        { _id: id, needsUsername: true },
        { username: username, needsUsername: false },
        { new: true }
    );
    return updated;
}

exports.readByUsername = async function(username) {
    // Without this, a missing name would match any user
    if (!username) {
        return null;
    }
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
            // TT-03: skip accounts that haven't picked a poker name yet
            $match: { username: { $type: "string" } }
        },
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

//PG-02: Set the chips for a user.
exports.setChips = async function(username, chips) {
    if (chips < 0) {
        throw new Error("Chips cannot be negative.");
    }

    const updated = await userModel.findOneAndUpdate(
        { username: username },
        { $set: { chips: chips } },
        { new: true }
    );
    if (!updated) {
        throw new Error("User not found");
    }
    return updated;
};

//PG-02: Get the chips for a user.
exports.getChips = async function(username) {
    const user = await userModel.findOne({ username: username });
    if (!user) {
        throw new Error("User not found.");
    }
    return user.chips;
};

//PG-02: Add chips to a user's account.
exports.addChips = async function(username, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive integer");
    }

    const updated = await userModel.findOneAndUpdate(
        { username: username },
        { $inc: { chips: amount } },
        { new: true }
    );

    if (!updated) {
        throw new Error("User not found");
    }

    return updated.chips;
};

//PG-02: Remove chips from a user's account.
exports.removeChips = async function(username, amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Amount must be a positive integer");
    }

    const updated = await userModel.findOneAndUpdate(
        {
            username: username,
            chips: { $gte: amount }
        },
        {
            $inc: { chips: -amount }
        },
        { new: true }
    );

    if (updated) {
        return updated.chips;
    }

    const userExists = await userModel.exists({ username: username });

    if (!userExists) {
        throw new Error("User not found");
    }

    throw new Error("User not found or insufficient chips");
};

exports.deleteAll = async function(check) {
    if (check === "test") {
        await userModel.deleteMany();
    }
}