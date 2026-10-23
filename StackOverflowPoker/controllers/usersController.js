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

    res.redirect('home.html?username=' + encodeURIComponent(user.username));
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
 