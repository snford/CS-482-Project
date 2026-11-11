const usersDao = require("../dao/UsersDaoMongoose");
const tablesDao = require("../dao/TablesDaoMongoose");

// SF-09: a friend seen on the site within this long counts as online
const ONLINE_WITHIN_MS = 3 * 60 * 1000;

// SF-09: is each of my friends online, and are they sitting at a table?
// Friends can see (and join) each other's private tables too.
exports.getFriendStatus = async function(req, res) {
    try {
        const friends = req.user.friends || [];

        if (friends.length === 0) {
            return res.status(200).json([]);
        }

        const seen = await usersDao.readLastSeen(friends);
        const tables = await tablesDao.readTablesWithPlayers(friends);
        const now = Date.now();

        const status = friends.map(function(name) {
            const user = seen.find(u => u.username === name);
            const lastSeen = user && user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
            const table = tables.find(t => t.players.includes(name));

            return {
                username: name,
                online: now - lastSeen < ONLINE_WITHIN_MS,
                table: table ? {
                    id: String(table._id),
                    name: table.name,
                    status: table.status,
                    privacy: table.privacy,
                    players: table.players.length,
                    maxPlayers: table.maxPlayers,
                    // Same rules as joining from the lobby
                    canJoin: table.status === "waiting" &&
                        table.players.length < table.maxPlayers &&
                        !table.players.includes(req.user.username)
                } : null
            };
        });

        return res.status(200).json(status);

    } catch (error) {
        console.error("Error loading friend status:", error);

        return res.status(500).json({
            msg: "Could not load your friends' status."
        });
    }
};
