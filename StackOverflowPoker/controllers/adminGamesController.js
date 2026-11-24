const mongoose = require("mongoose");
const tablesDao = require("../dao/TablesDaoMongoose");
const gameRounds = require("../game/sevenStud");

// AM-06: Retrieve all tables and game information
exports.getGames = async function(req, res) {

    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            msg: "Administrators only."
        });
    }

    try {
        const tables = await tablesDao.readAllAdmin();

        const games = tables.map(table => {

            const round = gameRounds.getRound(
                String(table._id)
            );

            return {
                id: String(table._id),
                name: table.name,
                players: table.players || [],
                maxPlayers: table.maxPlayers,
                status: table.status,
                privacy: table.privacy,
                ante: table.ante,
                bots: table.bots,

                activeGame: Boolean(
                    round && round.status !== "complete"
                ),

                roundStatus: round
                    ? round.status
                    : null,

                street: round
                    ? round.street
                    : null,

                pot: round
                    ? round.pot
                    : 0,

                participants: round
                    ? round.players.map(player => ({
                        username: player.username,
                        isBot: player.isBot,
                        folded: player.folded
                    }))
                    : []
            };
        });

        return res.status(200).json({
            games,

            summary: {
                totalTables: games.length,

                activeGames: games.filter(
                    game => game.activeGame
                ).length,

                waitingTables: games.filter(
                    game => game.status === "waiting"
                ).length,

                closedTables: games.filter(
                    game => game.status === "closed"
                ).length
            }
        });

    } catch (error) {

        console.error(
            "AM-06 loading games:",
            error
        );

        return res.status(500).json({
            msg: "Unable to retrieve games."
        });
    }
};

// AM-06: End an active game and close its table

exports.endGame = async function(req, res) {

    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            msg: "Administrators only."
        });
    }

    const tableId = req.params.tableId;

    if (!mongoose.isValidObjectId(tableId)) {
        return res.status(400).json({
            msg: "Invalid table ID."
        });
    }

    try {

        const table =
            await tablesDao.readAdminById(tableId);

        if (!table) {
            return res.status(404).json({
                msg: "Table not found."
            });
        }

        const round =
            gameRounds.getRound(String(tableId));

        if (round && round.status === "complete") {
            return res.status(409).json({
                msg: "Wait for the completed game to finish processing."
            });
        }

        if (
            table.status !== "playing" &&
            !round
        ) {
            return res.status(409).json({
                msg: "This table has no active game."
            });
        }

        // Close first so no new players can join
        await tablesDao.closeTable(tableId);

        // Refund unfinished bets and clear the round
        await gameRounds.cancelRound(
            String(tableId),
            req
        );

        return res.status(200).json({
            msg: "Game ended and table closed successfully."
        });

    } catch (error) {

        console.error("AM-06 ending game:", error);

        return res.status(500).json({
            msg: "Unable to finish ending the game. Check the server logs."
        });
    }
};

// AM-06: Remove a poker table

exports.removeTable = async function(req, res) {

    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            msg: "Administrators only."
        });
    }

    const tableId = req.params.tableId;

    if (!mongoose.isValidObjectId(tableId)) {
        return res.status(400).json({
            msg: "Invalid table ID."
        });
    }

    try {

        const table =
            await tablesDao.readAdminById(tableId);

        if (!table) {
            return res.status(404).json({
                msg: "Table not found."
            });
        }

        const round =
            gameRounds.getRound(String(tableId));

        if (table.status === "playing" || round) {

            return res.status(409).json({
                msg: "End the active game before removing this table."
            });
        }

        if (table.status !== "closed") {

            await tablesDao.closeTable(tableId);
        }

        const removed =
            await tablesDao.removeTable(tableId);

        if (!removed) {
            return res.status(409).json({
                msg: "The table could not be removed."
            });
        }

        return res.status(200).json({
            msg: "Table removed successfully."
        });

    } catch (error) {

        console.error(
            "AM-06 removing table:",
            error
        );

        return res.status(500).json({
            msg: "Unable to remove table."
        });
    }
};