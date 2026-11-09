#!/usr/bin/env node

/**
 * AID-LLM-connector: Connection & Authentication Verification Script
 * 
 * Usage:
 *   node scripts/verify_auth.js
 *   npm run verify
 */

const { AIDClient, config, auth } = require("../src");

async function main() {
    console.log("==================================================================");
    console.log("  🔗 AID-LLM-connector: Connection & Auth Verification");
    console.log("==================================================================");
    console.log(`Endpoint:        ${config.graphqlEndpoint}`);
    console.log(`Firebase Target: ${config.firebase.projectId} (${config.firebase.authDomain})`);

    const hasToken = Boolean(config.accessToken);
    const hasCreds = Boolean(config.email && config.password);

    console.log(`Token Set:       ${hasToken ? "Yes (configured)" : "No"}`);
    console.log(`Email/Pass Set:  ${hasCreds ? `Yes (${config.email})` : "No"}`);
    console.log("------------------------------------------------------------------");

    const client = new AIDClient();

    if (!hasToken && !hasCreds) {
        console.log("🔍 Testing basic unauthenticated reachability to AI Dungeon...");
        try {
            await client.getCurrentUser();
        } catch (err) {
            if (err.message.includes("Not authorized") || err.message.includes("UNAUTHENTICATED")) {
                console.log("✔ Network connection established! AI Dungeon GraphQL API is responsive.");
                console.log("✔ Server correctly enforced Firebase authentication requirement.");
                console.log("\n👉 Next Step: To authenticate, choose one of these methods:");
                console.log("   1. Create a '.env' file in this directory with your token:");
                console.log("      AID_ACCESS_TOKEN=your_token_here");
                console.log("   2. Or provide your login credentials in '.env':");
                console.log("      AID_EMAIL=your_email@example.com");
                console.log("      AID_PASSWORD=your_password");
                console.log("   3. Or export your token using AID-QoL-Tool from play.aidungeon.com.\n");
            } else {
                console.error("❌ Unexpected connection error:", err.message);
            }
        }
        return;
    }

    console.log("🔐 Authenticating and fetching current user profile from AI Dungeon...");
    try {
        const user = await client.getCurrentUser();
        console.log("\n🎉 AUTHENTICATION SUCCESSFUL!");
        console.log(`   User ID:   ${user.id}`);
        console.log(`   Username:  ${user.username || "(not set)"}`);
        console.log(`   Email:     ${user.email || "(hidden)"}`);
        console.log(`   Verified:  ${user.verifiedAt ? "Yes (" + user.verifiedAt + ")" : "No"}`);
        console.log("==================================================================");
    } catch (err) {
        console.error("\n❌ Authentication failed:");
        console.error("  ", err.message);
        console.log("\nPlease check your token or credentials in .env.");
    }
}

main();
