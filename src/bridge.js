/**
 * AID-LLM-connector: Local Dev Bridge Server
 * 
 * Provides a lightweight local HTTP bridge (port 8765) that receives
 * tokens, active scenario/adventure IDs, and logs directly from
 * the AID-QoL-Tool Tampermonkey userscript.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const AIDClient = require("./client");

const DEFAULT_PORT = 8765;

function saveToEnv(keyValues) {
    const envPath = path.resolve(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf8");
    }

    for (const [key, val] of Object.entries(keyValues)) {
        if (!val) continue;
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${val}`);
        } else {
            content = `${content.trim()}\n${key}=${val}\n`;
        }
    }

    fs.writeFileSync(envPath, content.trim() + "\n", "utf8");
}

function startBridge(port = DEFAULT_PORT) {
    const server = http.createServer(async (req, res) => {
        // Handle CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        // GET /status
        if (req.method === "GET" && req.url === "/status") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "active",
                port,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // POST /sync
        if (req.method === "POST" && req.url === "/sync") {
            let body = "";
            req.on("data", chunk => { body += chunk; });
            req.on("end", async () => {
                try {
                    const data = JSON.parse(body || "{}");
                    const token = (data.token || "").replace(/^firebase\s+/i, "").trim();

                    if (!token) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: false, message: "Missing token" }));
                        return;
                    }

                    console.log("\n📥 [Bridge] Received auth token sync from browser!");

                    // Verify token with AI Dungeon
                    const client = new AIDClient({ token });
                    let user = null;
                    try {
                        user = await client.getCurrentUser();
                        console.log(`   ✔ Verified with AI Dungeon: Logged in as ${user.username || user.email || user.id}`);
                    } catch (verifyErr) {
                        console.warn(`   ⚠️ Warning: Token verification had an issue:`, verifyErr.message);
                    }

                    // Save to .env
                    const updates = { AID_ACCESS_TOKEN: token };
                    if (data.scenarioId) updates.AID_DEFAULT_SCENARIO_ID = data.scenarioId;
                    if (data.adventureId) updates.AID_DEFAULT_ADVENTURE_ID = data.adventureId;

                    saveToEnv(updates);
                    console.log("   ✔ Successfully updated .env file.");

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({
                        success: true,
                        message: "Token synced to .env successfully",
                        user: user ? { id: user.id, username: user.username } : null
                    }));
                } catch (err) {
                    console.error("   ❌ [Bridge] Sync error:", err.message);
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
    });

    server.listen(port, "127.0.0.1", () => {
        console.log("==================================================================");
        console.log(`  🌐 AID-LLM-connector Local Dev Bridge listening on port ${port}`);
        console.log(`  URL: http://127.0.0.1:${port}/sync`);
        console.log("==================================================================");
        console.log("Waiting for token sync from AID-QoL-Tool or browser...\n");
    });

    return server;
}

module.exports = {
    startBridge,
    DEFAULT_PORT
};
