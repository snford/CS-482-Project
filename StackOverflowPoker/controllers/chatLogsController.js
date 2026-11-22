
// AM-03: Administrator-only chat log API
const messageDao = require("../dao/messageDaoMongoose");

exports.getLogs = async (req, res) => {
    // Defense in depth, in addition to requireAdmin on the route.
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({
            msg: "Administrators only."
        });
    }

    const type = String(req.query.type || "all");

    if (!["all", "private", "table"].includes(type)) {
        return res.status(400).json({
            msg: "Invalid chat type."
        });
    }

    const player = String(req.query.player || "").trim();
    const search = String(req.query.search || "").trim();

    if (player.length > 60 || search.length > 100) {
        return res.status(400).json({
            msg: "Search terms are too long."
        });
    }

    const page = Number(req.query.page || 1);

    if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        page > 10000
    ) {
        return res.status(400).json({
            msg: "Invalid page."
        });
    }

    try {
        const result = await messageDao.searchChatLogs({
            type,
            player,
            search,
            page,
            limit: 25
        });

        return res.json(result);

    } catch (error) {
        console.error("AM-03 chat logs:", error);

        return res.status(500).json({
            msg: "Could not load chat logs."
        });
    }
};
