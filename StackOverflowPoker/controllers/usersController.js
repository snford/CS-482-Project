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
