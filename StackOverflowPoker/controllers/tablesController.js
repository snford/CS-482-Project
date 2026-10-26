const dao = require("../dao/TablesDaoMongoose");
const mongoose = require("mongoose");

//Lt-01: View Lobbys
exports.getTables = async function(req, res) {
  try {
    const tables = await dao.readAll();
    return res.status(200).json(tables);
  } catch (error) {
    console.error("Error retrieving tables:", error);
    return res.status(500).json({
      msg: "Error retrieving tables"
    });
  }
};

//LT-02: Join Tables
exports.joinTable = async function(req, res) {
    const tableId = req.body.tableId;
    const username = req.body.username;

    if (typeof tableId !== "string" || !mongoose.isValidObjectId(tableId) || typeof username !== "string" || !username.trim()) {
        return res.status(400).json({
            msg: "Invalid table or username"
        });
    }

    try {
        const table = await dao.joinTable(tableId, username.trim());

        if (!table) {
            return res.status(400).json({
                msg: "Unable to join table"
            });
        }

        return res.status(200).json({
            msg: "Joined table successfully",
            table: table
        });

    } catch (error) {
        return res.status(500).json({
            msg: "Error joining table"
        });
    }
};

//Lt-03: creating the tables
exports.createTable = async function(req, res) {
    const name = req.body.name;
    const maxPlayers = Number(req.body.maxPlayers);
    const privacy = req.body.privacy;
    const ante = req.body.ante;
    const bots = req.body.bots;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 40 || ![2, 3, 4, 5, 6, 7].includes(maxPlayers) || !["public", "private"].includes(privacy) || typeof ante !== "string" || !ante.trim() || !["off", "easy", "medium", "hard"].includes(bots)) {
        return res.status(400).json({
            msg: "Invalid table information"
        });
    }

    try {
        const table = await dao.createTable(
            name.trim(), maxPlayers, privacy, ante.trim(), bots
        );

        return res.status(201).json({
            msg: "Table created successfully",
            table: table
        });

    } catch (error) {
        return res.status(500).json({
            msg: "Error creating table"
        });
    }
};
