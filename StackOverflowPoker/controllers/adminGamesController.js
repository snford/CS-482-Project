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