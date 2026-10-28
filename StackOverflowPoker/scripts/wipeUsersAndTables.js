/*
 * TT-03: one-time cleanup for the switch to Google sign-in.
 *
 * Old accounts were made with the username-only login, so they have no Google
 * account attached and can't be signed in to anymore. This deletes every user,
 * every table (their player lists use the old names), and every login session.
 *
 * Uses DB_URI from .env (the same database the server uses).
 *
 *   node scripts/wipeUsersAndTables.js          shows what would be deleted
 *   node scripts/wipeUsersAndTables.js --yes    really deletes it
 */
const mongoose = require("mongoose");
const dbcon = require("../DbConnection");

const COLLECTIONS = ["users", "tables", "sessions"];

async function main() {
    const really = process.argv.includes("--yes");

    await dbcon.connect("prod");
    if (mongoose.connection.readyState !== 1) {
        console.log("Could not connect to the database. Nothing was deleted.");
        process.exitCode = 1;
        return;
    }

    const db = mongoose.connection.db;
    // Only the host and database name are printed, never the password
    console.log("Database: " + mongoose.connection.name + " on " + mongoose.connection.host);

    for (const name of COLLECTIONS) {
        const count = await db.collection(name).countDocuments();
        if (really) {
            await db.collection(name).deleteMany({});
            console.log("  " + name + ": deleted " + count);
        } else {
            console.log("  " + name + ": " + count + " would be deleted");
        }
    }

    if (!really) {
        console.log("Nothing was deleted. Run again with --yes to delete.");
    }
}

main()
    .catch(function (error) {
        console.log(error);
        process.exitCode = 1;
    })
    .finally(function () {
        return dbcon.disconnect();
    });
