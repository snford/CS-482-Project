const dao = require("../dao/UsersDaoMongoose");

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

    if (
        req.session &&
        req.session.guestName === username
    ) {

        if (
            !Number.isSafeInteger(
                req.session.guestChips
            )
        ) {
            throw new Error(
                "Guest chip balance is unavailable."
            );
        }

        if (
            req.session.guestChips < amount
        ) {
            throw new Error(
                "Not enough chips."
            );
        }

        req.session.guestChips -= amount;

        return req.session.guestChips;
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

    if (
        req.session &&
        req.session.guestName === username
    ) {
        if (
            !Number.isSafeInteger(
                req.session.guestChips
            )
        ) {
            req.session.guestChips = 0;
        }

        req.session.guestChips += amount;

        return req.session.guestChips;
    }

    return await dao.addChips(
        username,
        amount
    );
};