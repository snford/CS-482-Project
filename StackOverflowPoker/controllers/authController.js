const dao = require('../dao/UsersDaoMongoose');

// TT-03: Google sign-in

// Finds the account for this Google profile, or creates a new one.
// New accounts have no poker name yet (needsUsername), they pick one next.
exports.findOrCreateGoogleUser = async function(profile) {
    if (!profile || !profile.id) {
        throw new Error("Google profile is missing an id");
    }

    let user = await dao.readByGoogleId(profile.id);
    if (user != null) {
        return user;
    }

    let email = null;
    if (Array.isArray(profile.emails) && profile.emails.length > 0) {
        email = profile.emails[0].value;
    }

    user = await dao.create({
        googleId: profile.id,
        email: email,
        needsUsername: true
    });
    return user;
};

// Passport calls this after Google confirms who the player is
exports.verifyGoogle = async function(accessToken, refreshToken, profile, done) {
    try {
        let user = await exports.findOrCreateGoogleUser(profile);
        done(null, user);
    } catch (error) {
        done(error);
    }
};

// Starts a brand new session for the player (a new session id on every
// login stops anyone from reusing an old one), then sends them on.
exports.finishGoogleLogin = function(req, res, user) {
    req.session.regenerate(function(error) {
        if (error) {
            res.redirect('/index.html?login=failed');
            return;
        }

        req.session.userId = user._id.toString();

        // Make sure the session is saved before the next page asks /api/me
        req.session.save(function(saveError) {
            if (saveError) {
                res.redirect('/index.html?login=failed');
                return;
            }
            if (user.needsUsername) {
                res.redirect('/choosename.html');
            } else {
                res.redirect('/home.html?username=' + encodeURIComponent(user.username));
            }
        });
    });
};

// Ends the session and removes the login cookie
exports.postLogout = function(req, res) {
    if (!req.session) {
        res.redirect('/index.html');
        return;
    }

    req.session.destroy(function() {
        res.clearCookie('sop.sid');
        res.redirect('/index.html');
    });
};
