const usersDao = require('../dao/UsersDaoMongoose');

// SF-09: how often "last seen" is saved for a player who keeps using the site
const SEEN_EVERY_MS = 60 * 1000;

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
            await markSeen(user);
        }
    }

    next();
};

// SF-09: friends see a player as online while they are using the site.
// Saved at most once a minute so every request doesn't write to the database.
async function markSeen(user) {
    let lastSeen = user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    if (Date.now() - lastSeen < SEEN_EVERY_MS) {
        return;
    }

    try {
        await usersDao.markSeen(user._id);
    } catch (error) {
        // Online status is a nice extra; never block the request over it
        console.error("Could not update last seen:", error.message);
    }
}

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

// AM-05: Allow only registered administrators
exports.requireAdmin = function(req, res, next) {

    // Check whether the player is signed in
    if (!req.user) {

        return res.status(401).json({
            msg: "Please sign in first."
        });

    }

    // Check administrator permission
    if (req.user.role !== "admin") {

        return res.status(403).json({
            msg: "Access denied. Administrators only."
        });

    }

    // Administrator is allowed to continue
    next();

};