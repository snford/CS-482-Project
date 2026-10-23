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
// For now the request is accepted right away, so both users become friends
exports.postAddFriend = async function(req, res) {
    let fromName = req.body.txt_from;
    let toName = req.body.txt_to.trim();

    let fromUser = await dao.readByUsername(fromName);
    let toUser = await dao.readByUsername(toName);

    // Only add the friend if both users exist, it is not the same person,
    // and they are not already friends
    if (fromUser != null && toUser != null && fromName != toName && !fromUser.friends.includes(toName)) {
        fromUser.friends.push(toName);
        toUser.friends.push(fromName);

        await dao.update(fromUser);
        await dao.update(toUser);
    }

    res.redirect('friends.html?username=' + encodeURIComponent(fromName));
};
