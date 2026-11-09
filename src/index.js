/**
 * AID-LLM-connector: Main Package Entry Point
 */

const AIDClient = require("./client");
const config = require("./config");
const auth = require("./auth");

module.exports = {
    AIDClient,
    config,
    auth
};
