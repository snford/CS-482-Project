const blockDao = require("../dao/blockDaoMongoose");
const userDao = require("../dao/UsersDaoMongoose");

function myName(req) {
    return (
        req.user?.username ||
        req.session?.user?.username ||
        req.session?.guestName ||
        null
    );
}

exports.list = async function(req, res) {
    try {
        const me = myName(req);
        if (!me) return res.status(401).json({ msg: "Sign in first." });
        res.json(await blockDao.listBlocked(me));
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Failed to load blocked users." });
    }
};

exports.block = async function(req, res) {
    try {
        const me = myName(req);
        const target = String(req.body.username || "").trim();

        if (!me) return res.status(401).json({ msg: "Sign in first." });
        if (!target || target === me) return res.status(400).json({ msg: "Invalid user." });

        const self = await userDao.readByUsername(me);
        if (!self) return res.status(403).json({ msg: "Sign in to block users." });

        const user = await userDao.readByUsername(target);
        if (!user) return res.status(404).json({ msg: "That user doesn't exist." });

        await blockDao.block(me, target);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Failed to block user." });
    }
};

exports.unblock = async function(req, res) {
    try {
        const me = myName(req);
        if (!me) return res.status(401).json({ msg: "Sign in first." });

        await blockDao.unblock(me, req.params.username);
        res.json({ ok: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Failed to unblock user." });
    }
};