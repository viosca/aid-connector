#!/usr/bin/env node

/**
 * AID-LLM-connector: Bridge Server Launcher
 * 
 * Usage:
 *   node scripts/bridge.js
 *   npm run bridge
 */

const { startBridge } = require("../src/bridge");

const port = parseInt(process.env.BRIDGE_PORT || "8765", 10);
startBridge(port);
