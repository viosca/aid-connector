#!/usr/bin/env node

/**
 * AID-LLM-connector: Create Dedicated Multi-Module Test Scenario & Adventure
 * 
 * Bundles:
 *   1. AID-Modules (C:/git/aid-modules/library-aid-modules.js)
 *   2. AID-Getopt  (C:/git/aid-getopt/examples/library-sandbox.js)
 * 
 * Deploys the multi-module testbed scenario, launches an adventure,
 * and executes `/mods` and `/test`.
 * 
 * Usage:
 *   node scripts/create_multimod_scenario.js
 *   npm run create-multimod
 */

const fs = require("fs");
const path = require("path");
const { AIDClient } = require("../src");

function updateEnv(key, val) {
    const envPath = path.resolve(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf8");
    }
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
        content = content.replace(regex, `${key}=${val}`);
    } else {
        content = `${content.trim()}\n${key}=${val}\n`;
    }
    fs.writeFileSync(envPath, content.trim() + "\n", "utf8");
}

async function main() {
    console.log("==================================================================");
    console.log("  🏗️ Creating Multi-Mod AI Dungeon Scenario (Getopt + Modules)");
    console.log("==================================================================");

    const client = new AIDClient();

    // 1. Verify user authentication
    const user = await client.getCurrentUser();
    console.log(`Authenticated as: ${user.username || user.email} (ID: ${user.id})`);

    // 2. Read AID-Modules library
    const modLibPath = path.resolve("C:/git/aid-modules/library-aid-modules.js");
    if (!fs.existsSync(modLibPath)) {
        throw new Error(`AID-Modules library not found at ${modLibPath}`);
    }
    const modLibCode = fs.readFileSync(modLibPath, "utf8");
    console.log(`✔ Read AID-Modules library (${modLibCode.length} bytes)`);

    // 3. Read AID-Getopt sandbox library & modifiers
    const getoptLibPath = path.resolve("C:/git/aid-getopt/examples/library-sandbox.js");
    if (!fs.existsSync(getoptLibPath)) {
        throw new Error(`AID-Getopt library not found at ${getoptLibPath}`);
    }
    const getoptLibCode = fs.readFileSync(getoptLibPath, "utf8");
    console.log(`✔ Read AID-Getopt library (${getoptLibCode.length} bytes)`);

    const inputPath = path.resolve("C:/git/aid-getopt/examples/input.js");
    const contextPath = path.resolve("C:/git/aid-getopt/examples/context.js");
    const outputPath = path.resolve("C:/git/aid-getopt/examples/output.js");
    const promptPath = path.resolve("C:/git/aid-getopt/examples/Opening-Story.txt");

    const inputCode = fs.readFileSync(inputPath, "utf8");
    const contextCode = fs.readFileSync(contextPath, "utf8");
    const outputCode = fs.readFileSync(outputPath, "utf8");
    const rawPrompt = fs.readFileSync(promptPath, "utf8");

    // Glue code to wire AID-Getopt into AID-Modules registry & bind /mods
    const glueCode = `
// ============================================================================
// Multi-Module Bridge: Register Getopt with AID-Modules & bind /mods command
// ============================================================================
if (typeof globalThis !== "undefined" && globalThis.AID) {
    if (typeof globalThis.AID.register === "function" && globalThis.AID_MODULES && globalThis.AID_MODULES["aid-getopt"]) {
        globalThis.AID.register(globalThis.AID_MODULES["aid-getopt"]);
    }
    if (typeof globalThis.AID.slashCommand === "function" && typeof app !== "undefined") {
        globalThis.AID.slashCommand(app);
    }
}
`;

    const combinedLibrary = `${modLibCode}\n\n// --- Combined with AID-Getopt Engine ---\n${getoptLibCode}\n\n${glueCode}`;
    console.log(`✔ Bundled Multi-Mod Library: ${combinedLibrary.length} bytes total`);

    // Sanitize prompt: Strip command tutorials so LLM does not mimic syntax
    const sanitizedPrompt = rawPrompt
        .replace(/---\s*\[.*?Active[\s\S]*?---\s*/gi, "")
        .replace(/^\s*\*?\s*\/[a-zA-Z0-9_-]+.*$/gm, "")
        .trim();

    const cleanInstructions = [
        "You are the Game Master for an immersive interactive fiction adventure set in the frontier world of The Crossroads.",
        "- Write in rich, second-person perspective (\"You\").",
        "- Maintain an atmospheric, engaging, and dynamic storytelling tone.",
        "- React directly to player actions, events, and bracketed notifications in the narrative.",
        "- If bracketed system notifications appear (such as dice rolls or inventory updates), narrate the consequences naturally without repeating technical notation.",
        "- Focus strictly on storytelling and world progression."
    ].join("\n");

    const scenarioPayload = {
        title: "[DEV] AID Multi-Mod Testbed (Getopt + Modules)",
        description: "Integration testbed for multi-module AI Dungeon cooperative scripting (AID-Modules + AID-Getopt). Managed by Antigravity.",
        prompt: sanitizedPrompt,
        memory: "The Crossroads Waystation is a warm mountain haven along the treacherous pass of the Ironridge Range.",
        authorsNote: "",
        instructions: cleanInstructions,
        scriptsEnabled: true,
        gameCode: {
            sharedLibrary: combinedLibrary,
            onInput: inputCode,
            onModelContext: contextCode,
            onOutput: outputCode
        }
    };

    console.log("\nSending GraphQL mutation to create multi-mod scenario...");
    const scnRes = await client.createScenario(scenarioPayload);

    if (!scnRes.success || !scnRes.scenario) {
        throw new Error(`Scenario creation failed: ${scnRes.message}`);
    }

    const scn = scnRes.scenario;
    const scnUrl = `https://play.aidungeon.com/scenario/${scn.shortId}`;

    console.log("==================================================================");
    console.log("🎉 MULTI-MOD SCENARIO CREATED SUCCESSFULLY!");
    console.log(`   Title:       ${scn.title}`);
    console.log(`   Short ID:    ${scn.shortId}`);
    console.log(`   Internal ID: ${scn.id}`);
    console.log(`   Live URL:    ${scnUrl}`);
    console.log("==================================================================");

    // Ensure scriptsEnabled is true on scenario
    await client.updateScenario({
        shortId: scn.shortId,
        scriptsEnabled: true
    });

    updateEnv("AID_DEFAULT_SCENARIO_ID", scn.shortId);

    // 4. Spawn a test adventure from this new scenario
    console.log("\nSpawning initial test adventure from multi-mod scenario...");
    const advRes = await client.playAdventure(scn.shortId);

    if (!advRes.success || !advRes.adventure) {
        throw new Error(`Adventure creation failed: ${advRes.message}`);
    }

    const adv = advRes.adventure;
    const advUrl = `https://play.aidungeon.com/adventure/${adv.shortId}`;

    // Ensure adventure script toggle is enabled
    try {
        await client.setAdventureScriptEnabled(adv.shortId, scn.shortId, true);
    } catch (e) {
        console.warn("Notice on setAdventureScriptEnabled:", e.message);
    }

    updateEnv("AID_DEFAULT_ADVENTURE_ID", adv.shortId);

    console.log("==================================================================");
    console.log("🎮 TEST ADVENTURE READY FOR SPECTATING!");
    console.log(`   Adventure ID:       ${adv.shortId} (Internal: ${adv.id})`);
    console.log(`   Direct Browser URL: ${advUrl}`);
    console.log("==================================================================");
    console.log("Recorded scenario and adventure IDs in .env");
}

main().catch(err => {
    console.error("\n❌ Fatal Error:", err.message);
    process.exit(1);
});
