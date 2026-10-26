const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  maxPlayers: { type: Number, default: 6, min: 2, max: 7 },
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
  },

  ante: { type: String, default: "" },

  bots: {
    type: String,
    enum: ["off", "easy", "medium", "hard"],
    default: "off"
  }
});

const Table = mongoose.model("table", tableSchema);

//Lt-01: public tables for lobby
exports.readAll = async function() {
  const tables = await Table.find({
    status: { $in: ["waiting", "playing"] }, privacy: { $ne: "private" }
  }).sort({ name: 1 });

  return tables;
};

//Lt-02: Joining a table
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


//Lt-03: creating a table
exports.createTable = async function(name, maxPlayers, privacy, ante, bots) {
    const table = new Table({
        name: name,
        maxPlayers: maxPlayers,
        privacy: privacy,
        ante: ante,
        bots: bots
    });

    await table.save();

    return table;
};

exports.leaveTable = async function(tableId, username) {
    const table = await Table.findById(tableId);

    if (!table) {
        throw new Error("Table not found");
    }

    if (!table.players.includes(username)) {
        throw new Error("Player is not at this table");
    }

    table.players = table.players.filter(
        player => player !== username
    );

    await table.save();

    return table;
};