const usersDao = require("../dao/UsersDaoMongoose");
const adsDaoo = require("../dao/AdsDaoMongoose");

// AM-05: Return dashboard information
exports.getDashboard = async function(req, res) {

    try {

        // Count registered users
        const totalUsers =
            await usersDao.countRegisteredUsers();

        // Count administrators
        const totalAdmins =
            await usersDao.countAdmins();

        // Return dashboard statistics
        return res.status(200).json({

            message: "Admin dashboard loaded successfully.",

            admin: {
                username: req.user.username,
                role: req.user.role
            },

            statistics: {
                totalUsers: totalUsers,
                totalAdmins: totalAdmins
            }

        });

    } catch (error) {

        console.error("Admin dashboard error:", error);

        return res.status(500).json({
            msg: "Unable to load admin dashboard."
        });

    }

};

// AM-05: Return registered users to administrators
exports.getAllUsers = async function(req, res) {

    try {

        const users = await usersDao.getAllRegisteredUsers();

        // Only return information needed by the dashboard
        const safeUsers = users.map(function(user) {

            return {
                username: user.username,
                role: user.role || "player",
                chips: user.chips ?? 1000,
                wins: user.wins ?? 0,
                losses: user.losses ?? 0,
                avatar: user.avatar || "spade"
            };

        });

        return res.status(200).json({
            users: safeUsers
        });

    } catch (error) {

        console.error("Unable to retrieve users:", error);

        return res.status(500).json({
            msg: "Unable to load registered users."
        });

    }

};

// AM-04: Remove a registered user
exports.removeUser = async function(req, res) {

    try {

        const username = req.params.username;

        // Prevent an administrator from deleting themselves
        if (username === req.user.username) {
            return res.status(403).json({
                msg: "You cannot remove your own account."
            });
        }

        const result = await usersDao.deleteRegisteredUser(username);

        if (result.status === "not_found") {
            return res.status(404).json({
                msg: "User not found."
            });
        }

        if (result.status === "admin_protected") {
            return res.status(403).json({
                msg: "Administrator accounts cannot be removed."
            });
        }

        return res.status(200).json({
            msg: "User removed successfully."
        });

    } catch (error) {

        console.error("AM-04 remove user error:", error);

        return res.status(500).json({
            msg: "Unable to remove user."
        });

    }

};

// AV-01: Get advertisements created by administrators
exports.getAds = async function(req, res) {

    try {
        const ads = await adsDao.readAll();
        return res.status(200).json(ads);
    } catch (error) {
        console.error("Error loading ads:", error);
        return res.status(500).json({
            msg: "Could not load advertisements."
        });
    }
};

// AV-01: Create a new advertisement
exports.createAd = async function(req, res) {

    const name = req.body.name;
    const imageUrl = req.body.imageUrl;
    const linkUrl = req.body.linkUrl;
    const placement = req.body.placement;
    const intervalMinutes = Number(req.body.intervalMinutes);
    const active = req.body.active;

    // Check that the administrator entered valid information
    if (
        typeof name !== "string" || !name.trim() ||
        typeof imageUrl !== "string" || !imageUrl.trim() ||
        typeof linkUrl !== "string" || !linkUrl.trim() ||
        !["lobby", "table"].includes(placement) ||
        !Number.isInteger(intervalMinutes) ||
        intervalMinutes < 1 ||
        typeof active !== "boolean"
    ) {
        return res.status(400).json({
            msg: "Invalid advertisement information."
        });
    }

    try {
        const ad = await adsDao.createAd({
            name: name.trim(),
            imageUrl: imageUrl.trim(),
            linkUrl: linkUrl.trim(),
            placement: placement,
            intervalMinutes: intervalMinutes,
            active: active
        });
        return res.status(201).json({
            msg: "Advertisement created successfully.",
            ad: ad
        });
    } catch (error) {
        console.error("Error creating ad:", error);
        return res.status(500).json({
            msg: "Could not create advertisement."
        });
    }
};
