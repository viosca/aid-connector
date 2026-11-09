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
        headers: { "Content-Type": "application/json" },
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

    return data;
}

/**
 * Get a valid Authorization header value for AI Dungeon's GraphQL API
 * @returns {Promise<string>} e.g. "firebase eyJhbGci..."
 */
async function getAuthHeader() {
    // 1. Direct access token from .env or manual config
    if (config.accessToken) {
        let token = config.accessToken.trim();
        if (!token.toLowerCase().startsWith("firebase ") && !token.toLowerCase().startsWith("bearer ")) {
            token = `firebase ${token}`;
        }
        return token;
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
