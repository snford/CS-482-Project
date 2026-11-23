const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema({
    blocker: { type: String, required: true },   // the person who blocked
    blocked: { type: String, required: true },   // the person who got blocked
    createdAt: { type: Date, default: Date.now }
});

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const Block = mongoose.model("Block", blockSchema);

exports.block = async function(blocker, blocked) {
    await Block.updateOne(
        { blocker, blocked },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
    );
};

exports.unblock = async function(blocker, blocked) {
    await Block.deleteOne({ blocker, blocked });
};

// Names this person has blocked
exports.listBlocked = async function(blocker) {
    const rows = await Block.find({ blocker }).sort({ createdAt: -1 }).lean();
    return rows.map(r => r.blocked);
};

// Has `blocker` blocked `blocked`?
exports.isBlocked = async function(blocker, blocked) {
    return !!(await Block.exists({ blocker, blocked }));
};