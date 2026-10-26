const mongoose = require("mongoose");
const tableSchema = new mongoose.Schema({
  
  name: { type: String, required: true, trim: true },
  maxPlayers: { type: Number, default: 6, min: 2 },
  players: { type: [String], default: [] },
  status: {
      type: String,
      enum: ["waiting", "playing", "closed"],
      default: "waiting"
  },
  privacy: {
      type: String,
      enum: ["public", "private"],
      default: "public"
  }
});

const Table = mongoose.model("table", tableSchema);

exports.readAll = async function() {
  const tables = await Table.find({
    status: { $in: ["waiting", "playing"] }
  }).sort({ name: 1 });

  return tables;
};

exports.joinTable = async function(tableId, username) {
    const table = await Table.findById(tableId);

    if (!table) {
        return null;
    }
  
    if (table.status !== "waiting") {
        return null;
    }

    if (table.players.length >= table.maxPlayers) {
        return null;
    }

    if (table.players.includes(username)) {
        return null;
    }

    table.players.push(username);
    await table.save();

    return table;
};

exports.createTable = async function(name, maxPlayers, privacy) {
    const table = new Table({
        name: name,
        maxPlayers: maxPlayers,
        privacy: privacy
    });

    await table.save();

    return table;
};
