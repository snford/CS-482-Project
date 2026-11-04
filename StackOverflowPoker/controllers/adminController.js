
const usersDao = require("../dao/UsersDaoMongoose");

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
