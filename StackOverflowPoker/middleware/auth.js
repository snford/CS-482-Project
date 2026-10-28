const usersDao = require('../dao/UsersDaoMongoose');

// TT-03: who is making this request?
// Puts the signed-in player in req.user (or null). Players who signed in with
// Google but haven't picked a poker name yet don't count as signed in.
exports.loadUser = async function(req, res, next) {
    req.user = null;

    let userId = req.session ? req.session.userId : null;
    if (userId) {
        let user = await usersDao.readById(userId);
        if (user != null && !user.needsUsername) {
            req.user = user;
        }
    }

    next();
};

// True when the page called us with fetch() and expects JSON back
exports.wantsJson = function(req) {
    let accept = (req.headers && req.headers.accept) || "";
    let type = (req.headers && req.headers["content-type"]) || "";
    return accept.includes("application/json") || type.includes("application/json");
};

// TT-03: only signed-in players can use this route
exports.requireLogin = function(req, res, next) {
    if (req.user) {
        next();
        return;
    }

    if (exports.wantsJson(req)) {
        res.status(401).json({ msg: "Please sign in first." });
        return;
    }

    res.redirect('/index.html');
};
