const mongoose = require("mongoose");

const adSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    imageUrl: {
        type: String,
        required: true
    },

    linkUrl: {
        type: String,
        required: true
    },

    placement: {
        type: String,
        enum: ["lobby", "table"],
        required: true
    },

    intervalMinutes: {
        type: Number,
        default: 5,
        min: 1
    },

    active: {
        type: Boolean,
        default: true
    }
});

const Ad = mongoose.model("Ad", adSchema);

exports.createAd = async function(data) {
    const ad = new Ad(data);
    await ad.save();
    return ad;
};

exports.readAll = async function() {
    return await Ad.find();
};
