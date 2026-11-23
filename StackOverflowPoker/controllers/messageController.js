const messageDao = require("../dao/messageDaoMongoose");
const userDao = require("../dao/UsersDaoMongoose");
const blockDao = require("../dao/blockDaoMongoose");

function myName(req) {
    return (
        req.user?.username ||
        req.session?.user?.username ||
        req.session?.guestName ||
        null
    );
}

exports.sendMessage = async function(req, res) {

    try {

        const from = myName(req);
        const to = req.body.to;
        const text = req.body.text;

        if (!from) return res.status(401).json({ msg: "Sign in to send messages." });
        if (!to || to === from) return res.status(400).json({ msg: "Invalid recipient." });

        const sender = await userDao.readByUsername(from);
        if (!sender) return res.status(403).json({ msg: "Sign in to send messages." });

        const recipient = await userDao.readByUsername(to);
        if (!recipient) return res.status(404).json({ msg: "That user doesn't exist." });

        if (await blockDao.isBlocked(to, from)) {
            return res.status(403).json({ msg: "You can't message this user." });
        }
        if (await blockDao.isBlocked(from, to)) {
            return res.status(403).json({ msg: "You've blocked this user. Unblock them to send a message." });
        }

        const message =
            await messageDao.sendMessage(
                from,
                to,
                text
            );

        res.status(200).json(message);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            msg: "Failed to send message."
        });
    }
};

exports.getConversation = async function(req, res) {

    try {

        const me = myName(req);
        const friend = req.params.friend;

        if (!me) return res.status(401).json({ msg: "Sign in first." });    

        const messages =
            await messageDao.getConversation(
                me,
                friend
            );

        res.status(200).json(messages);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            msg: "Failed to load messages."
        });
    }
};

exports.sendTableChat = async function(req, res) {
    try {
        const me = myName(req);

        const { tableId, text } = req.body;

        const message =
            await messageDao.sendTableMessage(
                me,
                tableId,
                text
            );

        res.json(message);

    } catch (err) {
        res.status(500).json({
            msg: err.message
        });
    }
};

exports.getTableChat = async function(req, res) {

    const messages =
        await messageDao.getTableMessages(
            req.params.tableId
        );

    res.json(messages);
};

exports.getNew = async function(req, res) {
    try {
        const me = myName(req);
        if (!me) return res.status(401).json({ msg: "Sign in first." });

        const now = Date.now();
        const sinceMs = Number(req.query.since);
        if (!Number.isFinite(sinceMs)) return res.json({ now, messages: [] });

        const messages = await messageDao.getNewMessagesFor(me, new Date(sinceMs));
        res.json({ now, messages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Failed to check messages." });
    }
};

exports.getInbox = async function(req, res) {
    try {
        const me = myName(req);
        if (!me) return res.status(401).json({ msg: "Sign in first." });

        const rows = await messageDao.getInbox(me);
        res.json(rows.map(r => ({
            user: r._id,
            from: r.last.from,
            text: r.last.text,
            sentAt: r.last.sentAt
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: "Failed to load conversations." });
    }
};