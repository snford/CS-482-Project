const dao = require("../dao/TablesDaoMongoose");
const mongoose = require("mongoose");
const gameRounds = require("../game/sevenStud");

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

// TT-03: the player joining/leaving is whoever is signed in, or the guest
function playerName(req) {
    if (req.user && req.user.username) {
        return req.user.username;
    }
    if (req.session && req.session.guestName) {
        return req.session.guestName;
    }
    return null;
}

exports.playerName = playerName;

//LT-02: Join Tables
exports.joinTable = async function(req, res) {
    const tableId = req.body.tableId;
    const username = playerName(req);

    if (!username) {
        return res.status(401).json({
            msg: "Sign in or play as a guest to join a table."
        });
    }

    if (typeof tableId !== "string" || !mongoose.isValidObjectId(tableId)) {
        return res.status(400).json({
            msg: "Invalid table or username"
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
            table: table,
            username: username
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

exports.leaveTable = async function(req, res) {
    const tableId = req.body.tableId;
    const username = playerName(req);
    if (!tableId || !username) {
        return res.status(400).json({
            msg: "Table ID and username are required"
        });
    }

    try {
        await dao.leaveTable(tableId, username);

        return res.status(200).json({
            msg: "Successfully left the table"
        });
    } catch (error) {
        return res.status(500).json({
            msg: "Could not leave table"
        });
    }
};

// LT-03: Load the selected table to show its player seats.
exports.getTable = async function (req, res) {
  const tableId = req.params.tableId;
  if (typeof tableId !== "string" || !mongoose.isValidObjectId(tableId)) {
    return res.status(400).json({ msg: "Invalid table ID" });
  }
  try {
    const table = await dao.readById(tableId);
    if (!table) return res.status(404).json({ msg: "Table not found" });
    return res.status(200).json(table);
  } catch (error) {
    console.error("Error loading table:", error);
    return res.status(500).json({ msg: "Error loading table" });
  }
};

//PG-01: Start a new round of poker
exports.startRound = async function (req, res) {
    const tableId = req.params.tableId;

    if (!tableId || !mongoose.isValidObjectId(tableId)) {
        return res.status(400).json({
            msg: "Invalid table ID."
        });
    }

    try {
        const table = await dao.readById(tableId);

        if (!table) {
            return res.status(404).json({
                msg: "Table not found."
            });
        }

        if (table.status !== "waiting") {
            return res.status(400).json({
                msg: "This table has already started a game."
            });
        }

        const players = table.players || [];

        if (players.length < 2 || players.length > 7) {
            return res.status(400).json({
                msg: "Seven-Card Stud requires 2 to 7 players."
            });
        }

        const round = gameRounds.startRound(
            String(table._id),
            players.map(username => ({ username }))
        );

        const updatedTable = await dao.updateStatus(tableId, "playing");

        if (!updatedTable) {
            return res.status(404).json({
                msg: "Table not found when updating status."
            });
        }

        return res.status(201).json({
            msg: "Round started successfully.",
            tableId: String(table._id),
            status: updatedTable.status,
            street: round.street,
            players: round.players.map(player => ({
                username: player.username,
                cardCount: player.hand.cards.length
            }))
        });

    } catch (error) {
        console.error("Error starting round:", error);

        return res.status(500).json({
            msg: "Unable to start the round."
        });
    }
};

exports.getRound = async function (req, res) {
    const tableId = req.params.tableId;

    if (!tableId || !mongoose.isValidObjectId(tableId)) {
        return res.status(400).json({ msg: "Invalid table ID." });
    }

    try {
        const round = gameRounds.getRound(String(tableId));

        if (!round) {
            return res.status(404).json({
                msg: "No active round found for this table."
            });
        }

        const username = playerName(req);

        if (!username) {
            return res.status(401).json({
                msg: "You must be signed in or playing as a guest."
            });
        }

        const currentPlayer = round.players.find(
            player => player.username === username
        );

        if (!currentPlayer) {
            return res.status(403).json({
                msg: "You are not part of this round."
            });
        }

        const players = round.players.map(player => ({
            username: player.username,
            cards: player.hand.cards.map((card, index) => {
                const isOwnCard = player.username === username;
                const isFaceUp = index >= 2;

                // Only reveal a card if it belongs to the
                // requesting player or is face-up.
                if (isOwnCard || isFaceUp) {
                    return {
                        rank: card.rank,
                        suit: card.suit,
                        hidden: false
                    };
                }

                return { hidden: true };
            })
        }));

        return res.json({
            tableId: String(tableId),
            street: round.street,
            players
        });
    } catch (error) {
        console.error("Error retrieving round:", error);
        return res.status(500).json({
            msg: "Unable to retrieve the round."
        });
    }
};