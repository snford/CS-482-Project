const dao = require('../dao/UsersDaoMongoose');

// TT-03: rules for a poker name. Returns an error message, or null if it's fine.
const RESERVED_NAMES = ["guest", "admin", "bot", "dealer", "system"];

function checkPokerName(name) {
    if (name.length < 3 || name.length > 20) {
        return "Poker names must be 3 to 20 characters long.";
    }
    if (!/^[A-Za-z0-9 _-]+$/.test(name)) {
        return "Use only letters, numbers, spaces, _ and -.";
    }
    if (/\s{2,}/.test(name)) {
        return "Don't use more than one space in a row.";
    }
    // Guests are called "Guest-1234", so nobody can pretend to be one
    if (RESERVED_NAMES.includes(name.toLowerCase()) || /^guest/i.test(name)) {
        return "That name is reserved. Please pick another one.";
    }
    return null;
}

exports.checkPokerName = checkPokerName;

// TT-03: lets the choose-name page check a name while the player types
exports.getUsernameAvailable = async function(req, res) {
    let name = String(req.query.name || "").trim();

    let problem = checkPokerName(name);
    if (problem != null) {
        res.status(200);
        res.send({ available: false, message: problem });
        res.end();
        return;
    }

    let existing = await dao.readByUsernameIgnoreCase(name);
    res.status(200);
    if (existing != null) {
        res.send({ available: false, message: "That name is already taken." });
    } else {
        res.send({ available: true, message: "That name is available!" });
    }
    res.end();
};

// TT-03: saves the poker name a new player picked after their first Google login
exports.postChooseUsername = async function(req, res) {
    let userId = req.session ? req.session.userId : null;
    let user = userId ? await dao.readById(userId) : null;

    if (user == null) {
        res.status(401);
        res.send({ msg: "Please sign in first." });
        res.end();
        return;
    }

    if (!user.needsUsername) {
        res.status(409);
        res.send({ msg: "You already have a poker name." });
        res.end();
        return;
    }

    let name = String((req.body && req.body.username) || "").trim();
    let problem = checkPokerName(name);
    if (problem != null) {
        res.status(400);
        res.send({ msg: problem });
        res.end();
        return;
    }

    if (await dao.readByUsernameIgnoreCase(name) != null) {
        res.status(409);
        res.send({ msg: "That name is already taken." });
        res.end();
        return;
    }

    try {
        let updated = await dao.setUsername(user._id, name);
        if (updated == null) {
            res.status(409);
            res.send({ msg: "You already have a poker name." });
            res.end();
            return;
        }
        res.status(200);
        res.send({ ok: true, username: updated.username });
        res.end();
    } catch (error) {
        // Two players grabbed the same name at the same moment
        if (error && error.code === 11000) {
            res.status(409);
            res.send({ msg: "That name is already taken." });
            res.end();
            return;
        }
        throw error;
    }
};

// TT-03: tells the page who is logged in (401 if nobody is).
// Guests get their temporary guest name so they can still join tables.
exports.getMe = async function(req, res) {
    let userId = req.session ? req.session.userId : null;

    let user = null;
    if (userId) {
        user = await dao.readById(userId);
    }

    if (user == null) {
        res.status(401);
        res.send({ loggedIn: false, guestName: (req.session && req.session.guestName) || null });
        res.end();
        return;
    }

    res.status(200);
    res.send({
        loggedIn: true,
        username: user.username || null,
        email: user.email || null,
        needsUsername: user.needsUsername === true,
        friends: user.friends || [],
        friendRequests: user.friendRequests || []
    });
    res.end();
};

// Public information about a player (no email, Google id, or friend lists)
exports.getUser = async function(req, res) {
    let uname = req.params.username;

    let user = await dao.readByUsername(uname);

    if (user != null) {
        res.status(200);
        res.send({
            username: user.username,
            wins: user.wins || 0,
            losses: user.losses || 0
        });
    } else {
        res.status(404);
        res.send({msg: 'User with this username does not exist'});
    }

    res.end();
};

// The signed-in player's name (requireLogin makes sure there is one)
function myName(req) {
    return req.user ? req.user.username : null;
}

// SF-01: Sends a friend request from the signed-in player
// The other player's name goes into their friendRequests list until they accept
exports.postAddFriend = async function(req, res) {
    let fromName = myName(req);
    let toName = String((req.body && req.body.txt_to) || "").trim();

    if (!fromName) {
        res.redirect('/index.html');
        return;
    }

    let fromUser = await dao.readByUsername(fromName);
    let toUser = await dao.readByUsername(toName);

    // Only send the request if both users exist, it is not the same person,
    // they are not already friends, and the request was not already sent
    if (fromUser != null && toUser != null && fromName != toName
        && !fromUser.friends.includes(toName) && !toUser.friendRequests.includes(fromName)) {

        if (fromUser.friendRequests.includes(toName)) {
            // The other player already sent us a request, so just accept it
            await makeFriends(toUser, fromUser);
        } else {
            toUser.friendRequests.push(fromName);
            await dao.update(toUser);
        }
    }

    res.redirect('/friends.html');
};

// SF-03: The signed-in player accepts a friend request from txt_from
exports.postAcceptFriend = async function(req, res) {
    let fromName = req.body ? req.body.txt_from : null;
    let toName = myName(req);

    if (!toName) {
        res.redirect('/index.html');
        return;
    }

    let fromUser = await dao.readByUsername(fromName);
    let toUser = await dao.readByUsername(toName);

    // Only accept if the request is really there
    if (fromUser != null && toUser != null && toUser.friendRequests.includes(fromName)) {
        await makeFriends(fromUser, toUser);
    }

    res.redirect('/friends.html');
};

// SF-03: The signed-in player declines a friend request from txt_from
exports.postDeclineFriend = async function(req, res) {
    let fromName = req.body ? req.body.txt_from : null;
    let toName = myName(req);

    if (!toName) {
        res.redirect('/index.html');
        return;
    }

    let toUser = await dao.readByUsername(toName);

    if (toUser != null) {
        toUser.friendRequests = toUser.friendRequests.filter(function(name) {
            return name != fromName;
        });
        await dao.update(toUser);
    }

    res.redirect('/friends.html');
};

// SF-04: The signed-in player removes txt_friend from both friends lists
exports.postRemoveFriend = async function(req, res) {
    let userName = myName(req);
    let friendName = req.body ? req.body.txt_friend : null;

    if (!userName) {
        res.redirect('/index.html');
        return;
    }

    let user = await dao.readByUsername(userName);
    let friend = await dao.readByUsername(friendName);

    // Only remove if both players exist and they really are friends
    if (user != null && friend != null && user.friends.includes(friendName)) {
        user.friends = user.friends.filter(function(name) {
            return name != friendName;
        });
        friend.friends = friend.friends.filter(function(name) {
            return name != userName;
        });

        await dao.update(user);
        await dao.update(friend);

        res.redirect('/friends.html?removed=' + encodeURIComponent(friendName));
        return;
    }

    res.redirect('/friends.html');
};

// Removes the request and adds both players to each other's friends list
async function makeFriends(fromUser, toUser) {
    toUser.friendRequests = toUser.friendRequests.filter(function(name) {
        return name != fromUser.username;
    });

    fromUser.friends.push(toUser.username);
    toUser.friends.push(fromUser.username);

    await dao.update(fromUser);
    await dao.update(toUser);
}

// ST-01: Get a player's statistics
exports.getPlayerStats = async function(req, res) {
    try {
        
        let username = req.params.username;

        
        let user = await dao.readByUsername(username);

        // if the player exists
        if (user == null) {
            return res.status(404).json({
                msg: "Player not found"
            });
        }

        // Get the player's wins and losses
        let wins = user.wins ?? 0;
        let losses = user.losses ?? 0;

        
        let totalGames = wins + losses;

        // Start the win percentage at 0
        let winPercentage = 0;

        // Calculate only if the player has played games
        if (totalGames > 0) {
            winPercentage = (wins / totalGames) * 100;
        }

        // Send the statistics back to the website
        return res.status(200).json({
            username: user.username,
            wins: wins,
            losses: losses,
            totalGames: totalGames,
            winPercentage: Number(winPercentage.toFixed(2))
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            msg: "Error getting player statistics"
        });
    }
};

// ST-02: Retrieve the leaderboard
exports.getLeaderboard = async function(req, res) {

    try {

        // Get the top players from MongoDB
        const players = await dao.getLeaderboard();

        // Add ranking numbers
        const leaderboard = players.map(function(player, index) {

            return {
                rank: index + 1,
                username: player.username,
                wins: player.wins,
                losses: player.losses,
                totalGames: player.totalGames,
                winPercentage: player.winPercentage
            };

        });

        // Return the leaderboard as JSON
        return res.status(200).json(leaderboard);

    } catch (error) {

        console.error("Error retrieving leaderboard:", error);

        return res.status(500).json({
            msg: "Error retrieving leaderboard"
        });

    }
};

// PG-02: Sets chips to a user's account.
exports.setChips = async function(req, res) {
    try {
        const username = req.params.username;
        const { amount } = req.body;

        if (!Number.isSafeInteger(amount) || amount < 0) {
            return res.status(400).json({
                msg: "Chip amount must be a non-negative integer"
            });
        }

        const chips = await dao.setChips(username, amount);

        return res.status(200).json({
            msg: "Chip balance updated successfully",
            chips: chips
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            msg: "Failed to update chip balance"
        });
    }
};

//PG-02: Gets chips from a user's account.
exports.getChips = async function(req, res) {
try {
const username = req.params.username;

    // Guests store their chips in the session, not MongoDB.
    if (req.session && req.session.guestName === username) {
        return res.status(200).json({
            chips: req.session.guestChips
        });
    }

    // Registered users retrieve their chips from MongoDB.
    const chips = await dao.getChips(username);

    return res.status(200).json({ chips: chips });

} catch (error) {
    console.error("getChips controller error:", error);

    return res.status(500).json({
        msg: "Failed to retrieve chips."
    });
}
};

//PG-02: Adds chips to a user's account.
exports.addChips = async function(req, res) {
    try {
        const username = req.user.username;
        const { amount } = req.body;

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return res.status(400).json({
                msg: "Amount must be a positive integer"
            });
        }

        const chips = await dao.addChips(username, amount);

        return res.status(200).json({
            msg: "Chips added successfully",
            chips: chips
        });

    } catch (error) {
        console.error("Error adding chips:", error);

        if (error.message === "User not found") {
            return res.status(404).json({
                msg: "User not found"
            });
        }

        return res.status(500).json({
            msg: "Failed to add chips"
        });
    }
};

//PG-02: Removes chips from a user's account.
exports.removeChips = async function(req, res) {
    try {
        const username = req.user.username;
        const { amount } = req.body;

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return res.status(400).json({
                msg: "Amount must be a positive integer"
            });
        }

        const chips = await dao.removeChips(username, amount);

        return res.status(200).json({
            msg: "Chips removed successfully",
            chips: chips
        });

    } catch (error) {
        console.error("Error removing chips:", error);

        if (error.message === "User not found or insufficient chips") {
            return res.status(400).json({
                msg: error.message
            });
        }

        return res.status(500).json({
            msg: "Failed to remove chips"
        });
    }
};

exports.placeBet = async function(req, res) {
    try {
        const username = req.params.username;
        const { amount } = req.body;

        // Validate the bet amount.
        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return res.status(400).json({
                msg: "Bet must be a positive integer."
            });
        }

        // Handle guests using their session balance.
        if (
            req.session &&
            req.session.guestName === username
        ) {
            // Make sure the guest has a valid balance.
            if (!Number.isSafeInteger(req.session.guestChips)) {
                return res.status(500).json({
                    msg: "Guest chip balance is unavailable."
                });
            }

            // Check whether the guest can afford the bet.
            if (req.session.guestChips < amount) {
                return res.status(400).json({
                    msg: "Not enough chips to place this bet."
                });
            }

            // Subtract the bet exactly once.
            req.session.guestChips -= amount;

            return res.status(200).json({
                msg: "Bet placed successfully.",
                bet: amount,
                remainingChips: req.session.guestChips
            });
        }

        // Handle registered users using MongoDB.
        const remainingChips = await dao.removeChips(username, amount);

        return res.status(200).json({
            msg: "Bet placed successfully.",
            bet: amount,
            remainingChips: remainingChips
        });

    } catch (error) {
        console.error("Error placing bet:", error);

        if (error.message === "User not found") {
            return res.status(404).json({
                msg: "User not found."
            });
        }

        if (error.message === "User not found or insufficient chips") {
            return res.status(400).json({
                msg: "Not enough chips to place this bet."
            });
        }

        return res.status(500).json({
            msg: "An error occurred while placing the bet."
        });
    }
};


exports.awardWinnings = async function(req, res) {
    try {
        const username = req.params.username;
        const { amount } = req.body;

        if (!Number.isSafeInteger(amount) || amount <= 0) {
            return res.status(400).json({
                msg: "Winnings must be a positive integer."
            });
        }

        const currentChips = await dao.getChips(username);

        if (currentChips == null) {
            return res.status(404).json({
                msg: "User not found."
            });
        }

        const updatedChips = await dao.addChips(
            username,
            amount
        );

        if (updatedChips == null) {
            return res.status(400).json({
                msg: "Unable to award winnings."
            });
        }

        return res.status(200).json({
            msg: "Winnings awarded successfully.",
            winnings: amount,
            totalChips: updatedChips
        });

    } catch (error) {
        console.error("Error awarding winnings:", error);

        return res.status(500).json({
            msg: "An error occurred while awarding winnings."
        });
    }
};

// UP-01: Get the logged-in player's profile
exports.getMyProfile = async function(req, res) {

    try {
        // The authentication middleware identifies the player
        const user = req.user;

        // Only registered users can view a saved profile
        if (!user || !user.googleId) {
            return res.status(401).json({
                msg: "Please sign in with Google."
            });
        }

        // Calculate statistics
        const wins = user.wins ?? 0;
        const losses = user.losses ?? 0;
        const totalGames = wins + losses;

        let winPercentage = 0;

        if (totalGames > 0) {
            winPercentage = (wins / totalGames) * 100;
        }

        // Return only information needed by the profile page
        return res.status(200).json({
            username: user.username,
            avatar: user.avatar || "spade",
            chips: user.chips ?? 1000,
            wins: wins,
            losses: losses,
            totalGames: totalGames,
            winPercentage: Number(winPercentage.toFixed(2))
        });

    } catch (error) {

        console.error("Error loading profile:", error);

        return res.status(500).json({
            msg: "Unable to load profile."
        });
    }
};


// UP-01: Update the logged-in player's profile
exports.updateMyProfile = async function(req, res) {

    try {
        // Identify the player using the login session
        const user = req.user;

        if (!user || !user.googleId) {
            return res.status(401).json({
                msg: "Please sign in with Google."
            });
        }

        // Get submitted information
        const username = String(
            req.body.username || ""
        ).trim();

        const avatar = req.body.avatar;

        // Reuse the project's existing username rules
        const nameError = checkPokerName(username);

        if (nameError) {
            return res.status(400).json({
                msg: nameError
            });
        }

        // Only allow the five approved avatars
        const allowedAvatars = [
            "spade",
            "diamond",
            "club",
            "heart",
            "star"
        ];

        if (!allowedAvatars.includes(avatar)) {
            return res.status(400).json({
                msg: "Please select a valid avatar."
            });
        }

        // Check whether another account uses this username
        const existingUser =
            await dao.readByUsernameIgnoreCase(username);

        // Allow the current player to keep their own username
        if (
            existingUser &&
            String(existingUser._id) !== String(user._id)
        ) {
            return res.status(409).json({
                msg: "That username is already taken."
            });
        }

        // Save the updated profile
        const updatedUser = await dao.updateProfile(
            user._id,
            username,
            avatar
        );

        if (!updatedUser) {
            return res.status(404).json({
                msg: "User not found."
            });
        }

        // Send confirmation to the website
        return res.status(200).json({
            msg: "Profile updated successfully!",
            username: updatedUser.username,
            avatar: updatedUser.avatar
        });

    } catch (error) {

        // MongoDB duplicate username error
        if (error.code === 11000) {
            return res.status(409).json({
                msg: "That username is already taken."
            });
        }

        console.error("Error updating profile:", error);

        return res.status(500).json({
            msg: "Unable to update profile."
        });
    }
};