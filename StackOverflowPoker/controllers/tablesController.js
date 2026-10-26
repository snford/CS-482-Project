const dao = require("../dao/TablesDaoMongoose");

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

exports.joinTable = async function(req, res) {
    const tableId = req.body.tableId;
    const username = req.body.username;

    if (!tableId || !username) {
        return res.status(400).json({
            msg: "Table and username are required"
        });
    }

    try {
        const table = await dao.joinTable(tableId, username);

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

exports.createTable = async function(req, res) {
    const { name, maxPlayers } = req.body;

    if (!name || !maxPlayers) {
        return res.status(400).json({
            msg: "Name and maxPlayers are required"
        });
    }

    try {
        const table = await dao.createTable(name, maxPlayers);
        return res.status(201).json({
            msg: "Table created successfully",
            table: table
        });
    } catch (error) {
        console.error("Error creating table:", error);
        return res.status(500).json({
            msg: "Error creating table"
        });
    }
};
