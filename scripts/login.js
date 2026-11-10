#!/usr/bin/env node

/**
 * AID-LLM-connector: Headless Login Script (Option B)
 * 
 * Signs into AI Dungeon via Firebase REST API, saves the token
 * into .env, and verifies the connection.
 * 
 * Usage:
 *   node scripts/login.js
 *   node scripts/login.js <email> <password>
 *   npm run login
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { AIDClient, auth, config } = require("../src");

function askQuestion(query, hidden = false) {
    return new Promise(resolve => {
        if (!hidden) {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            rl.question(query, answer => {
                rl.close();
                resolve(answer.trim());
            });
        } else {
            const Writable = require("stream").Writable;
            const mutableStdout = new Writable({
                write: function (chunk, encoding, callback) {
                    if (!this.muted) {
                        process.stdout.write(chunk, encoding);
                    }
                    callback();
                }
            });
            mutableStdout.muted = false;
            const rl = readline.createInterface({
                input: process.stdin,
                output: mutableStdout,
                terminal: true
            });
            rl.question(query, answer => {
                console.log();
                rl.close();
                resolve(answer.trim());
            });
            mutableStdout.muted = true;
        }
    });
}

function updateEnvFile(token, email = "") {
    const envPath = path.resolve(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf8");
    }

    // Update or append AID_ACCESS_TOKEN
    if (/^AID_ACCESS_TOKEN=.*$/m.test(content)) {
        content = content.replace(/^AID_ACCESS_TOKEN=.*$/m, `AID_ACCESS_TOKEN=${token}`);
    } else {
        content = `${content.trim()}\n\nAID_ACCESS_TOKEN=${token}\n`;
    }

    if (email) {
        if (/^AID_EMAIL=.*$/m.test(content)) {
            content = content.replace(/^AID_EMAIL=.*$/m, `AID_EMAIL=${email}`);
        } else {
            content = `${content.trim()}\nAID_EMAIL=${email}\n`;
        }
    }

    fs.writeFileSync(envPath, content.trim() + "\n", "utf8");
    console.log("✔ Saved AID_ACCESS_TOKEN to .env (git-ignored)");
}

async function main() {
    console.log("==================================================================");
    console.log("  🔐 AI Dungeon Headless Login");
    console.log("==================================================================");

    let email = process.argv[2] || config.email;
    let password = process.argv[3] || config.password;

    if (!email) {
        email = await askQuestion("Enter AI Dungeon Email: ");
    } else if (!process.argv[2]) {
        console.log(`Using email from .env:    ${email}`);
    }

    if (!password) {
        password = await askQuestion("Enter AI Dungeon Password: ", true);
    } else if (!process.argv[3]) {
        console.log("Using password from .env: (configured)");
    }

    if (!email || !password) {
        console.error("❌ Email and password are required.");
        process.exit(1);
    }

    console.log(`\nSigning into AI Dungeon as ${email}...`);
    try {
        const signData = await auth.signInWithEmailPassword(email, password);
        console.log("✔ Firebase authentication successful!");

        updateEnvFile(signData.idToken, email);

        // Verify with GraphQL
        console.log("\nVerifying session with AI Dungeon GraphQL API...");
        const client = new AIDClient({ token: signData.idToken });
        const user = await client.getCurrentUser();

        console.log("==================================================================");
        console.log("🎉 LOGGED IN SUCCESSFULLY!");
        console.log(`   User ID:   ${user.id}`);
        console.log(`   Username:  ${user.username || "(not set)"}`);
        console.log(`   Email:     ${user.email || email}`);
        console.log("==================================================================");
    } catch (err) {
        console.error("\n❌ Sign-in failed:", err.message);
        process.exit(1);
    }
}

main();
