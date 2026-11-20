
jest.mock("../dao/ReportsDaoMongoose");
jest.mock("../dao/UsersDaoMongoose");

const mongoose = require("mongoose");

const reportsDao = require("../dao/ReportsDaoMongoose");
const usersDao = require("../dao/UsersDaoMongoose");
const controller = require("./reportsController");

const reporterId = new mongoose.Types.ObjectId();
const targetId = new mongoose.Types.ObjectId();
const strangerId = new mongoose.Types.ObjectId();
const reportId = new mongoose.Types.ObjectId();

const player = (id = reporterId) => ({
    _id: id,
    username: "Player1",
    role: "player"
});

const response = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
});

const report = () => ({
    _id: reportId,
    reporterId,
    reporterName: "Player1",
    reportedUserId: targetId,
    reportedUsername: "Player2",
    reason: "harassment",
    details: "Bad behavior",
    status: "open",
    messages: []
});

beforeEach(() => {
    jest.clearAllMocks();
});

// Test 1: Player submits report
test("AM-01 player submits a report", async () => {
    usersDao.readByUsernameIgnoreCase.mockResolvedValue({
        _id: targetId,
        username: "Player2",
        googleId: "google123",
        needsUsername: false
    });

    reportsDao.createReport.mockResolvedValue(report());

    const res = response();

    await controller.createReport({
        user: player(),
        body: {
            username: "Player2",
            reason: "harassment",
            details: "Bad behavior"
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(reportsDao.createReport).toHaveBeenCalled();
});

// Test 2: Cannot report yourself
test("AM-01 cannot report self", async () => {
    usersDao.readByUsernameIgnoreCase.mockResolvedValue({
        _id: reporterId,
        username: "Player1",
        googleId: "google123"
    });

    const res = response();

    await controller.createReport({
        user: player(),
        body: {
            username: "Player1",
            reason: "other",
            details: "Test"
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
});

// Test 3: Cannot read another player's report
test("AM-01 cannot read someone else's report", async () => {
    reportsDao.findById.mockResolvedValue(report());

    const res = response();

    await controller.getOne({
        user: player(strangerId),
        params: {
            id: String(reportId)
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);
});

// Test 4: Reporter sends message
test("AM-01 reporter sends a message", async () => {
    reportsDao.findById.mockResolvedValue(report());
    reportsDao.addMessage.mockResolvedValue(report());

    const res = response();

    await controller.sendMessage({
        user: player(),
        params: {
            id: String(reportId)
        },
        body: {
            text: "Help please"
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(201);
});

// Test 5: Stranger cannot send message
test("AM-01 stranger cannot send a message", async () => {
    reportsDao.findById.mockResolvedValue(report());

    const res = response();

    await controller.sendMessage({
        user: player(strangerId),
        params: {
            id: String(reportId)
        },
        body: {
            text: "No"
        }
    }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(reportsDao.addMessage).not.toHaveBeenCalled();
});

// Test 6: Administrator resolves report
test("AM-01 administrator resolves a report", async () => {
    reportsDao.resolveReport.mockResolvedValue({
        ...report(),
        status: "resolved"
    });

    const res = response();

    await controller.resolve({
        user: {
            _id: targetId,
            role: "admin"
        },
        params: {
            id: String(reportId)
        }
    }, res);

    expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
            msg: "Report resolved."
        })
    );
});
