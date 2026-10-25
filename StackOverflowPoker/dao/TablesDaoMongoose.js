const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  maxPlayers: { type: Number, default: 6, min: 2 },
  players: { type: [String], default: [] },
  status: {
    type: String,
    enum: ["waiting", "playing", "closed"],
    default: "waiting"
  }
});

const Table = mongoose.model("table", tableSchema);

exports.readAll = async function() {
  const tables = await Table.find({
    status: { $in: ["waiting", "playing"] }
  }).sort({ name: 1 });

  return tables;
};
