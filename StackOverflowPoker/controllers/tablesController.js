const dao = require("../dao/TablesDaoMongoose");

exports.getTables = async function(req, res) {
  try {
    const tables = await dao.readAll();
    return res.status(200).json(tables);
  } catch (error) {
    console.error("Error retrieving tables:", error);
    return res.status(500).json({
      msg: "Error retrieving tables"
    });
  }
};
