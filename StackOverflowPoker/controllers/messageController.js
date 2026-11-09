const messageDao = require("../dao/messageDaoMongoose");
const userDao = require("../dao/UsersDaoMongoose");

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

        const sender = await userDao.readByUsername(from);

        if (!sender.friends.includes(to)) {
            return res.status(403).json({
                msg: "You can only message friends."
            });
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

        const user = await userDao.readByUsername(me);

        if (!user.friends.includes(friend)) {
            return res.status(403).json({
                msg: "Not friends."
            });
        }

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