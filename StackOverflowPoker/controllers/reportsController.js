
const mongoose = require("mongoose");
const reportsDao = require("../dao/ReportsDaoMongoose");
const usersDao = require("../dao/UsersDaoMongoose");

const reasons = new Set([
    "harassment",
    "cheating",
    "username",
    "other"
]);

const fail = (res, code, msg) =>
    res.status(code).json({ msg });

function publicReport(report) {
    return {
        id: String(report._id),
        reporterName: report.reporterName,
        reportedUsername: report.reportedUsername,
        reason: report.reason,
        details: report.details,
        status: report.status,
        createdAt: report.createdAt,
        resolvedAt: report.resolvedAt,
        messages: (report.messages || []).map(m => ({
            senderName: m.senderName,
            senderRole: m.senderRole,
            text: m.text,
            createdAt: m.createdAt
        }))
    };
}

const allowed = (user, report) =>
    user.role === "admin" ||
    String(user._id) === String(report.reporterId);

// Submit a report
exports.createReport = async (req, res) => {
    try {
        const username =
            typeof req.body.username === "string"
                ? req.body.username.trim()
                : "";

        const reason = req.body.reason;

        const details =
            typeof req.body.details === "string"
                ? req.body.details.trim()
                : "";

        if (
            !username ||
            !reasons.has(reason) ||
            !details ||
            details.length > 500
        ) {
            return fail(
                res,
                400,
                "Provide a player, valid reason, and description (1-500 characters)."
            );
        }

        const target =
            await usersDao.readByUsernameIgnoreCase(username);

        if (!target || !target.googleId || target.needsUsername) {
            return fail(res, 404, "Registered player not found.");
        }

        if (String(target._id) === String(req.user._id)) {
            return fail(res, 400, "You cannot report yourself.");
        }

        const report = await reportsDao.createReport({
            reporterId: req.user._id,
            reporterName: req.user.username,
            reportedUserId: target._id,
            reportedUsername: target.username,
            reason,
            details
        });

        return res.status(201).json({
            msg: "Report submitted.",
            report: publicReport(report)
        });

    } catch (err) {
        console.error("AM-01 submit:", err);
        return fail(res, 500, "Unable to submit report.");
    }
};

// View reports submitted by current player
exports.getMine = async (req, res) => {
    try {
        const reports = await reportsDao.findByReporter(
            req.user._id
        );

        return res.json({
            reports: reports.map(publicReport)
        });

    } catch (err) {
        console.error(err);
        return fail(res, 500, "Unable to load reports.");
    }
};

// Administrator views all reports
exports.getAll = async (req, res) => {
    try {
        const reports = await reportsDao.findAll();

        return res.json({
            reports: reports.map(publicReport)
        });

    } catch (err) {
        console.error(err);
        return fail(res, 500, "Unable to load reports.");
    }
};

// View a single report
exports.getOne = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return fail(res, 400, "Invalid report ID.");
        }

        const report = await reportsDao.findById(req.params.id);

        if (!report) {
            return fail(res, 404, "Report not found.");
        }

        if (!allowed(req.user, report)) {
            return fail(res, 403, "Access denied.");
        }

        return res.json({
            report: publicReport(report)
        });

    } catch (err) {
        console.error(err);
        return fail(res, 500, "Unable to load report.");
    }
};

// Send message to report conversation
exports.sendMessage = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return fail(res, 400, "Invalid report ID.");
        }

        const text =
            typeof req.body.text === "string"
                ? req.body.text.trim()
                : "";

        if (!text || text.length > 1000) {
            return fail(
                res,
                400,
                "Message must be 1-1000 characters."
            );
        }

        const report = await reportsDao.findById(req.params.id);

        if (!report) {
            return fail(res, 404, "Report not found.");
        }

        if (!allowed(req.user, report)) {
            return fail(res, 403, "Access denied.");
        }

        if (report.status !== "open") {
            return fail(res, 409, "Report is resolved.");
        }

        const updated = await reportsDao.addMessage(
            req.params.id,
            {
                senderId: req.user._id,
                senderName: req.user.username,
                senderRole:
                    req.user.role === "admin"
                        ? "admin"
                        : "player",
                text
            }
        );

        if (!updated) {
            return fail(res, 409, "Report is no longer open.");
        }

        return res.status(201).json({
            msg: "Message sent.",
            report: publicReport(updated)
        });

    } catch (err) {
        console.error(err);
        return fail(res, 500, "Unable to send message.");
    }
};

// Administrator resolves report
exports.resolve = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return fail(res, 400, "Invalid report ID.");
        }

        const updated = await reportsDao.resolveReport(
            req.params.id,
            req.user._id
        );

        if (!updated) {
            const existing = await reportsDao.findById(
                req.params.id
            );

            return fail(
                res,
                existing ? 409 : 404,
                existing ? "Already resolved." : "Report not found."
            );
        }

        return res.json({
            msg: "Report resolved.",
            report: publicReport(updated)
        });

    } catch (err) {
        console.error(err);
        return fail(res, 500, "Unable to resolve report.");
    }
};
