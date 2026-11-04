
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
