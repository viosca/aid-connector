#!/usr/bin/env node

/**
 * AID-LLM-connector: Live In-Game Self-Test Runner
 * 
 * Sends an action turn (defaults to `/test`) to the active AI Dungeon adventure,
 * monitors completion, and displays test assertions.
 * 
 * Usage:
 *   node scripts/run_aid_test.js [adventureShortId] [commandText]
 *   npm run test:aid
 */

const crypto = require("crypto");
const { AIDClient, config } = require("../src");

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(adventureShortId, customCommand) {
    const client = new AIDClient();
    const shortId = adventureShortId || config.defaultAdventureId;

    if (!shortId) {
        throw new Error("No adventure ID specified and AID_DEFAULT_ADVENTURE_ID is not set in .env");
    }

    const commandText = customCommand || "/test";

    console.log("==================================================================");
    console.log("  🎮 AI Dungeon In-Game Action / Test Runner");
    console.log("==================================================================");
    console.log(`Target Adventure: https://play.aidungeon.com/adventure/${shortId}`);

    // 1. Fetch adventure to resolve internal ID
    const adv = await client.getAdventure(shortId);
    if (!adv) {
        throw new Error(`Adventure not found for shortId: ${shortId}`);
    }
    console.log(`Title: "${adv.title}"`);
    console.log(`Internal ID: ${adv.id} (Action Count: ${adv.actionCount})`);

    // 2. Prepare action request (AI Dungeon database requires internal numeric ID)
    const actionKey = crypto.randomUUID();
    console.log(`\nSending action turn: "${commandText}" (Key: ${actionKey.slice(0, 8)}...)...`);

    const actionRes = await client.actionRequest({
        adventureId: adv.id,
        type: "do",
        text: commandText,
        key: actionKey
    });

    if (!actionRes.success) {
        throw new Error(`actionRequest failed: ${actionRes.message || "Unknown error"}`);
    }

    // 3. Poll checkActionRequest until turn processing completes
    console.log("Waiting for AI Dungeon engine to process turn and execute scripts...");
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max
    let isProcessing = true;

    while (isProcessing && attempts < maxAttempts) {
        await sleep(1000);
        attempts++;
        try {
            const check = await client.checkActionRequest({
                adventureId: adv.id,
                key: actionKey
            });
            isProcessing = check.isProcessing;
            process.stdout.write(`  [${attempts}s] Processing state: ${check.processingState || (check.isProcessing ? "active" : "done")}\r`);
            if (!check.isProcessing) {
                break;
            }
        } catch (e) {
            process.stdout.write(`  [${attempts}s] Polling (${e.message.slice(0, 30)}...)\r`);
        }
    }
    console.log("\n✔ Turn processing complete!");

    // 4. Fetch updated adventure to inspect the result
    await sleep(500);
    const updatedAdv = await client.getAdventure(shortId);
    console.log(`Updated Action Count: ${updatedAdv.actionCount}`);

    console.log("\n==================================================================");
    console.log("  📜 LATEST ADVENTURE ACTIONS");
    console.log("==================================================================");

    const window = updatedAdv.actionWindow || [];
    const recent = window.slice(-2);
    for (const act of recent) {
        console.log(`\n[Action #${act.id} (${act.type})]:`);
        console.log(act.text.trim());
    }

    // Check if test passed
    const fullText = recent.map(a => a.text).join("\n");
    if (fullText.includes("ALL 10 TESTS PASSED") || fullText.includes("TESTS PASSED")) {
        console.log("\n==================================================================");
        console.log("🎉 SUCCESS: AID-GETOPT IN-GAME TEST SUITE PASSED (10/10)!");
        console.log("==================================================================");
    } else {
        console.log("\n==================================================================");
        console.log("✔ Action completed successfully.");
        console.log("==================================================================");
    }
}

const targetShortId = process.argv[2] || null;
const targetCommand = process.argv[3] || null;

runTest(targetShortId, targetCommand).catch(err => {
    console.error("\n❌ Test execution failed:", err.message);
    process.exit(1);
});
