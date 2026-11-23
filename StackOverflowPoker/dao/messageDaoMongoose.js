const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    from: {
        type: String,
        required: true
    },

    to: {
        type: String,
        default: null
    },

    tableId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },

    text: {
        type: String,
        required: true,
        maxlength: 500
    },

    sentAt: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model('Message', messageSchema);

exports.sendMessage = async function(from, to, text) {
    const message = new Message({
        from,
        to,
        text
    });

    await message.save();

    return message;
};

exports.getConversation = async function(userA, userB) {

    return await Message.find({
        $or: [
            { from: userA, to: userB },
            { from: userB, to: userA }
        ]
    }).sort({ sentAt: 1 })
    .limit(100);
};

exports.sendTableMessage = async function(from, tableId, text) {
    const message = new Message({
        from,
        tableId,
        text
    });

    await message.save();

    return message;
};

exports.getTableMessages = async function(tableId) {
    return await Message.find({
        tableId
    })
    .sort({ sentAt: 1 })
    .limit(100);
};

exports.deleteAll = async function(check) {
    if (check === "test") {
        await Message.deleteMany({});
    }
};


 // AM-03: Search existing stored messages with bounded, paginated results.
exports.searchChatLogs = async function({
    type = "all",
    player = "",
    search = "",
    page = 1,
    limit = 25
}) {
    const query = {};

    if (type === "private") {
        query.tableId = null;
        query.to = { $ne: null };
    }

    if (type === "table") {
        query.tableId = { $ne: null };
    }

    if (player) {
        const escaped = player.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        const match = new RegExp(escaped, "i");

        query.$or = [
            { from: match },
            { to: match }
        ];
    }

    if (search) {
        const escaped = search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );

        query.text = new RegExp(escaped, "i");
    }

    const [messages, total] = await Promise.all([
        Message.find(query)
            .sort({ sentAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

        Message.countDocuments(query)
    ]);

    return {
        messages,
        total,
        page,
        limit
    };
};

exports.getNewMessagesFor = async function(me, since) {
    return await Message.find({ to: me, sentAt: { $gt: since } })
        .sort({ sentAt: 1 })
        .limit(100);
};

exports.getInbox = async function(me) {
    return await Message.aggregate([
        { $match: { to: { $ne: null }, tableId: null, $or: [{ from: me }, { to: me }] } },
        { $sort: { _id: -1 } },
        { $group: {
            _id: { $cond: [{ $eq: ["$from", me] }, "$to", "$from"] },
            last: { $first: "$$ROOT" }
        }},
        { $sort: { "last._id": -1 } },
        { $limit: 50 }
    ]);
};