const dao = require('../dao/UsersDaoMongoose');

// Temporary login until Google sign in is added:
// logs in to the account with this username, or creates it if it is new
exports.postLogin = async function(req, res) {
    let uname = req.body.txt_username.trim();

    if (uname === "") {
        res.redirect('index.html');
        return;
    }

    let user = await dao.readByUsername(uname);

    if (user == null) {
        user = await dao.create({ username: uname });
    }

    // TT-03: remember who is logged in
    if (req.session) {
        req.session.userId = user._id.toString();
    }

    res.redirect('home.html?username=' + encodeURIComponent(user.username));
};

// TT-03: tells the page who is logged in (401 if nobody is)
exports.getMe = async function(req, res) {
    let userId = req.session ? req.session.userId : null;

    let user = null;
    if (userId) {
        user = await dao.readById(userId);
    }

    if (user == null) {
        res.status(401);
        res.send({ loggedIn: false });
        res.end();
        return;
    }

    res.status(200);
    res.send({
        loggedIn: true,
        username: user.username || null,
        email: user.email || null,
        needsUsername: user.needsUsername === true
    });
    res.end();
};

exports.getUser = async function(req, res) {
    let uname = req.params.username;

    let user = await dao.readByUsername(uname);

    if (user != null) {
        res.status(200);
        res.send(user);
    } else {
        res.status(404);
        res.send({msg: 'User with this username does not exist'});
    }

    res.end();
};

// SF-01: Sends a friend request
// The other player's name goes into their friendRequests list until they accept
exports.postAddFriend = async function(req, res) {
    let fromName = req.body.txt_from;
    let toName = req.body.txt_to.trim();

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

    res.redirect('/friends.html?username=' + encodeURIComponent(fromName));
};

// SF-03: Accepts a friend request
exports.getAcceptFriend = async function(req, res) {
    let fromName = req.params.from;
    let toName = req.params.to;

    let fromUser = await dao.readByUsername(fromName);
    let toUser = await dao.readByUsername(toName);

    // Only accept if the request is really there
    if (fromUser != null && toUser != null && toUser.friendRequests.includes(fromName)) {
        await makeFriends(fromUser, toUser);
    }

    res.redirect('/friends.html?username=' + encodeURIComponent(toName));
};

// SF-03: Declines a friend request
exports.getDeclineFriend = async function(req, res) {
    let fromName = req.params.from;
    let toName = req.params.to;

    let toUser = await dao.readByUsername(toName);

    if (toUser != null) {
        toUser.friendRequests = toUser.friendRequests.filter(function(name) {
            return name != fromName;
        });
        await dao.update(toUser);
    }

    res.redirect('/friends.html?username=' + encodeURIComponent(toName));
};

// SF-04: Removes a friend from both players' friends lists
exports.postRemoveFriend = async function(req, res) {
    let userName = req.body.txt_user;
    let friendName = req.body.txt_friend;

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

        res.redirect('/friends.html?username=' + encodeURIComponent(userName) +
            '&removed=' + encodeURIComponent(friendName));
        return;
    }

    res.redirect('/friends.html?username=' + encodeURIComponent(userName || ""));
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