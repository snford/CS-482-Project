
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderRole: {
        type: String,
        enum: ["player", "admin"],
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const reportSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reporterName: {
        type: String,
        required: true
    },
    reportedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reportedUsername: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        enum: ["harassment", "cheating", "username", "other"],
        required: true
    },
    details: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    status: {
        type: String,
        enum: ["open", "resolved"],
        default: "open"
    },
    messages: {
        type: [messageSchema],
        default: []
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    }
}, { timestamps: true });

reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("report", reportSchema);

exports.createReport = data => Report.create(data);

exports.findById = id =>
    mongoose.isValidObjectId(id)
        ? Report.findById(id)
        : null;

exports.findByReporter = id =>
    Report.find({ reporterId: id })
        .sort({ createdAt: -1 })
        .lean();

exports.findAll = () =>
    Report.find()
        .sort({ createdAt: -1 })
        .lean();

exports.addMessage = (id, message) =>
    Report.findOneAndUpdate(
        { _id: id, status: "open" },
        { $push: { messages: message } },
        { new: true, runValidators: true }
    );

exports.resolveReport = (id, adminId) =>
    Report.findOneAndUpdate(
        { _id: id, status: "open" },
        {
            $set: {
                status: "resolved",
                resolvedAt: new Date(),
                resolvedBy: adminId
            }
        },
        { new: true }
    );
