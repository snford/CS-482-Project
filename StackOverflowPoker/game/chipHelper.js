const dao = require("../dao/UsersDaoMongoose");

// Guests have no account, so their chips are kept here on the server, by
// guest name. (They used to live in each guest's own session, but then a
// round started by one player couldn't charge another guest's ante.)
const STARTING_GUEST_CHIPS = 1000;
const guestChips = new Map();

// Guests are named "Guest-1234". Registered players can't pick a name
// starting with "guest", so the name alone tells us who is a guest.
function isGuestName(username) {
    return /^Guest-\d+$/.test(String(username));
}

// A new guest starts with a fresh stack of chips
exports.startGuest = function(guestName) {
    guestChips.set(guestName, STARTING_GUEST_CHIPS);
};

// A guest we haven't seen yet (for example after a server restart)
// gets the starting amount
exports.getGuestChips = function(guestName) {
    if (!guestChips.has(guestName)) {
        guestChips.set(guestName, STARTING_GUEST_CHIPS);
    }
    return guestChips.get(guestName);
};

exports.isGuestName = isGuestName;
exports.STARTING_GUEST_CHIPS = STARTING_GUEST_CHIPS;

// req is no longer needed (guest chips aren't in the session anymore) but is
// kept so the game code that calls these functions didn't have to change.
exports.deductChips = async function(
    req,
    username,
    amount
) {

    if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
    ) {
        throw new Error(
            "Amount must be a positive integer."
        );
    }

    if (isGuestName(username)) {

        const balance = exports.getGuestChips(username);

        if (balance < amount) {
            throw new Error(
                "Not enough chips."
            );
        }

        guestChips.set(username, balance - amount);

        return balance - amount;
    }

    return await dao.removeChips(
        username,
        amount
    );
};

exports.addChips = async function(
    req,
    username,
    amount
) {
    if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
    ) {
        throw new Error(
            "Amount must be a positive integer."
        );
    }

    if (isGuestName(username)) {

        const balance = exports.getGuestChips(username) + amount;

        guestChips.set(username, balance);

        return balance;
    }

    return await dao.addChips(
        username,
        amount
    );
};
