
require("dotenv").config();

const mongoose = require("mongoose");

const usersDao = require("../dao/UsersDaoMongoose");

async function promoteAdmin() {

    try {

        const googleId = process.env.ADMIN_GOOGLE_ID;

        if (!googleId) {
            throw new Error(
                "Set ADMIN_GOOGLE_ID in your local .env file."
            );
        }

        if (!process.env.DB_URI) {
            throw new Error(
                "DB_URI is missing from your .env file."
            );
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.DB_URI);

        // Promote the selected existing account
        const user =
            await usersDao.promoteAdminByGoogleId(googleId);

        if (!user) {
            throw new Error(
                "No completed Google account matches that ID."
            );
        }

        console.log(
            "Administrator enabled for:",
            user.username
        );

    } catch (error) {

        console.error(error.message);
        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

    }

}

promoteAdmin();
