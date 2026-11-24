// AM-06: Serialize operations affecting the same poker table

const locks = new Map();

exports.withTableLock = async function(tableId, operation) {

    const key = String(tableId);

    const previous =
        locks.get(key) || Promise.resolve();

    let release;

    const current = new Promise(resolve => {
        release = resolve;
    });

    locks.set(key, current);

    await previous;

    try {
        return await operation();

    } finally {

        release();

        if (locks.get(key) === current) {
            locks.delete(key);
        }
    }
};

exports.lockHandler = function(handler) {

    return async function(req, res, next) {

        const tableId =
            req.params.tableId ||
            req.body?.tableId;

        if (!tableId) {
            return handler(req, res, next);
        }

        try {

            return await exports.withTableLock(
                tableId,
                () => handler(req, res, next)
            );

        } catch (error) {
            return next(error);
        }
    };
};