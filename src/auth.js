/**
 * AID-LLM-connector: Authentication Manager
 * 
 * Handles Firebase Auth for AI Dungeon, supporting:
 *  1. Direct Token (AID_ACCESS_TOKEN in .env)
 *  2. Headless Firebase Email/Password Sign-In
 *  3. Token caching & Authorization header formatting
 */

const config = require("./config");

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Sign in using Firebase REST API with email and password
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{idToken: string, refreshToken: string, expiresIn: string, localId: string}>}
 */
async function signInWithEmailPassword(email, password) {
    if (!email || !password) {
        throw new Error("Missing email or password for Firebase sign-in.");
    }

    const url = `${config.firebase.signInUrl}?key=${config.firebase.apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Referer": "https://play.aidungeon.com/",
            "Origin": "https://play.aidungeon.com"
        },
        body: JSON.stringify({
            email,
            password,
            returnSecureToken: true
        })
    });

    const data = await response.json();
    if (!response.ok) {
        const errMsg = data.error?.message || response.statusText;
        throw new Error(`Firebase sign-in failed (${response.status}): ${errMsg}`);
    }

    cachedToken = data.idToken;
    // Set expiration slightly before actual (expiresIn is in seconds)
    tokenExpiresAt = Date.now() + (parseInt(data.expiresIn, 10) - 60) * 1000;
    config.accessToken = data.idToken;

    // Persist refreshed token to .env if available
    try {
        const fs = require("fs");
        const path = require("path");
        const envPath = path.resolve(process.cwd(), ".env");
        if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, "utf8");
            if (/^AID_ACCESS_TOKEN=.*$/m.test(envContent)) {
                envContent = envContent.replace(/^AID_ACCESS_TOKEN=.*$/m, `AID_ACCESS_TOKEN=${data.idToken}`);
            } else {
                envContent = `AID_ACCESS_TOKEN=${data.idToken}\n` + envContent;
            }
            fs.writeFileSync(envPath, envContent, "utf8");
        }
    } catch (_) {
        // Non-critical file write failure
    }

    return data;
}

/**
 * Check if a JWT token has expired
 * @param {string} token 
 * @returns {boolean}
 */
function isJwtExpired(token) {
    try {
        const raw = token.replace(/^firebase\s+/i, "").replace(/^bearer\s+/i, "");
        const parts = raw.split(".");
        if (parts.length !== 3) return false;
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        if (!payload.exp) return false;
        // Expired if current time is within 60s of expiration
        return Date.now() >= (payload.exp * 1000) - 60000;
    } catch (_) {
        return false;
    }
}

/**
 * Get a valid Authorization header value for AI Dungeon's GraphQL API
 * @returns {Promise<string>} e.g. "firebase eyJhbGci..."
 */
async function getAuthHeader() {
    // 1. Check direct access token from .env or manual config
    if (config.accessToken) {
        if (!isJwtExpired(config.accessToken)) {
            let token = config.accessToken.trim();
            if (!token.toLowerCase().startsWith("firebase ") && !token.toLowerCase().startsWith("bearer ")) {
                token = `firebase ${token}`;
            }
            return token;
        }
        // Token in .env has expired, clear it to trigger refresh
        config.accessToken = "";
    }

    // 2. Cached token from previous sign-in
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return `firebase ${cachedToken}`;
    }

    // 3. Automated sign-in via email & password if configured
    if (config.email && config.password) {
        const signData = await signInWithEmailPassword(config.email, config.password);
        return `firebase ${signData.idToken}`;
    }

    return "";
}

/**
 * Set an access token programmatically (e.g., from userscript bridge or test fixture)
 * @param {string} token 
 */
function setAccessToken(token) {
    config.accessToken = token;
    cachedToken = token;
    tokenExpiresAt = Date.now() + 3600 * 1000;
}

module.exports = {
    getAuthHeader,
    signInWithEmailPassword,
    setAccessToken
};
