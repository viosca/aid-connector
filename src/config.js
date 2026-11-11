/**
 * AID-LLM-connector: Configuration
 * 
 * Manages configuration variables, default endpoints, Firebase settings,
 * and automatic loading of .env files.
 */

const fs = require("fs");
const path = require("path");

// Automatically load .env file if present in workspace root or package root
function loadEnv() {
    const candidatePaths = [
        path.resolve(process.cwd(), ".env"),
        path.resolve(__dirname, "..", ".env")
    ];
    for (const envPath of candidatePaths) {
        if (fs.existsSync(envPath)) {
            try {
                const content = fs.readFileSync(envPath, "utf8");
                for (const line of content.split(/\r?\n/)) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("#")) continue;
                    const eqIdx = trimmed.indexOf("=");
                    if (eqIdx !== -1) {
                        const key = trimmed.slice(0, eqIdx).trim();
                        let val = trimmed.slice(eqIdx + 1).trim();
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.slice(1, -1);
                        }
                        if (!(key in process.env)) {
                            process.env[key] = val;
                        }
                    }
                }
            } catch (e) {
                console.warn("[config] Warning: Failed to read .env file:", e.message);
            }
        }
    }
}

loadEnv();

const config = {
    // AI Dungeon GraphQL API endpoint
    graphqlEndpoint: process.env.AID_GRAPHQL_ENDPOINT || "https://api.aidungeon.com/graphql",

    // Firebase Auth configuration for AI Dungeon
    firebase: {
        // Public Firebase client API key for project aidungeon-2c6cc (shipped in play.aidungeon.com web client).
        // Note: This is a public client identifier, not a private server secret. Can be overridden via AID_FIREBASE_API_KEY.
        apiKey: process.env.AID_FIREBASE_API_KEY || "AIzaSyCnvo_XFPmAabrDkOKBRpbivp5UH8r_3mg",
        authDomain: "auth.aidungeon.com",
        projectId: "aidungeon-2c6cc",
        signInUrl: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword",
        tokenUrl: "https://securetoken.googleapis.com/v1/token"
    },

    // Auth credentials
    accessToken: process.env.AID_ACCESS_TOKEN || "",
    email: process.env.AID_EMAIL || "",
    password: process.env.AID_PASSWORD || "",

    // Defaults for testing
    defaultScenarioId: process.env.AID_DEFAULT_SCENARIO_ID || "",
    defaultAdventureId: process.env.AID_DEFAULT_ADVENTURE_ID || ""
};

module.exports = config;
