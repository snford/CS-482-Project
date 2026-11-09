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
