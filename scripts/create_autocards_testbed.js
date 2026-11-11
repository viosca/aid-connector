#!/usr/bin/env node

/**
 * AID-LLM-connector: Deploy Dedicated Auto-Cards Testbed Scenario
 * 
 * Bundles:
 *   1. AID-Modules   (C:/git/aid-modules/library-aid-modules.js)
 *   2. AID-Getopt    (C:/git/aid-getopt/examples/library-sandbox.js - stripped of demo commands)
 *   3. Auto-Cards    (C:/git/Entity-Cards/src/library.js - v2.8.0-EC)
 * 
 * Configures the sequential cooperative modifier pipeline, sets up clean
 * narrative prompts/instructions, deploys to AI Dungeon, and creates a test adventure.
 * 
 * Usage:
 *   node scripts/create_autocards_testbed.js
 *   npm run create-autocards
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
    console.log("  🎴 Creating Fresh Auto-Cards Testbed Scenario (Modules + Getopt + EC)");
    console.log("==================================================================");

    const client = new AIDClient();

    // 1. Verify user authentication
    const user = await client.getCurrentUser();
    console.log(`Authenticated as: ${user.username || user.email} (ID: ${user.id})`);

    // 2. Read AID-Modules library
    const modLibPath = path.resolve("C:/git/aid-modules/library-aid-modules.js");
    const modLibCode = fs.readFileSync(modLibPath, "utf8");
    console.log(`✔ Read AID-Modules (${modLibCode.length} bytes)`);

    // 3. Read AID-Getopt library and strip demo commands (/roll, /inv, /stat)
    const getoptLibPath = path.resolve("C:/git/aid-getopt/examples/library-sandbox.js");
    let getoptLibCode = fs.readFileSync(getoptLibPath, "utf8");

    const splitStart = getoptLibCode.indexOf("// Command 1: /roll");
    const splitEnd = getoptLibCode.indexOf("// Command 4: /help");
    if (splitStart !== -1 && splitEnd !== -1) {
        getoptLibCode = getoptLibCode.slice(0, splitStart) + getoptLibCode.slice(splitEnd);
        console.log(`✔ Read AID-Getopt & stripped demo commands (${getoptLibCode.length} bytes)`);
    } else {
        console.warn(`⚠️ Could not locate split markers for demo commands; using full library (${getoptLibCode.length} bytes)`);
    }

    // 4. Read Auto-Cards library
    const ecLibPath = path.resolve("C:/git/Entity-Cards/src/library.js");
    const ecLibCode = fs.readFileSync(ecLibPath, "utf8");
    console.log(`✔ Read Auto-Cards engine (${ecLibCode.length} bytes)`);

    // 5. Multi-Module Bridge Glue Code
    const glueCode = `
// ============================================================================
// Multi-Module Bridge: Register all modules with AID-Modules & bind /mods
// ============================================================================
if (typeof globalThis !== "undefined" && globalThis.AID) {
    if (globalThis.AID_MODULES) {
        for (const [key, rawRec] of Object.entries(globalThis.AID_MODULES)) {
            if (rawRec && typeof rawRec === "object" && !globalThis.AID.has(key)) {
                globalThis.AID.register(rawRec);
            }
        }
    }
    if (typeof globalThis.AID.slashCommand === "function" && typeof app !== "undefined") {
        globalThis.AID.slashCommand(app);
    }
}
`;

    const combinedLibrary = [
        modLibCode,
        "\n// ============================================================================\n// PART: AID-GETOPT COMMAND ROUTER\n// ============================================================================\n",
        getoptLibCode,
        "\n// ============================================================================\n// PART: AUTO-CARDS (ENTITY-CARDS) ENGINE\n// ============================================================================\n",
        ecLibCode,
        glueCode
    ].join("\n");

    console.log(`✔ Combined Shared Library: ${combinedLibrary.length} bytes total (~${(combinedLibrary.length / 1024).toFixed(1)} KB)`);

    // 6. Sequential cooperative modifier pipeline
    const inputCode = `// Sequential Cooperative Input Modifier Pipeline
const modifier = (text) => {
    if (typeof AutoCards === "function") {
        text = AutoCards("input", text);
    }
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("input", text);
    }
    return { text };
};
modifier(text);`;

    const contextCode = `// Sequential Cooperative Context Modifier Pipeline
const modifier = (text) => {
    if (typeof AutoCards === "function") {
        [text, stop] = AutoCards("context", text, stop);
    }
    if (typeof GetoptSandbox === "function") {
        [text, stop] = GetoptSandbox("context", text, stop);
    }
    return { text, stop };
};
modifier(text);`;

    const outputCode = `// Sequential Cooperative Output Modifier Pipeline
const modifier = (text) => {
    if (typeof AutoCards === "function") {
        text = AutoCards("output", text);
    }
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("output", text);
    }
    return { text };
};
modifier(text);`;

    // 7. Sanitized opening story & clean GM instructions (zero slash commands)
    const promptPath = path.resolve("C:/git/aid-getopt/examples/Opening-Story.txt");
    const rawPrompt = fs.readFileSync(promptPath, "utf8");
    const sanitizedPrompt = rawPrompt
        .replace(/---\s*\[.*?Active[\s\S]*?---\s*/gi, "")
        .replace(/^\s*\*?\s*\/[a-zA-Z0-9_-]+.*$/gm, "")
        .trim();

    const cleanInstructions = [
        "You are the Game Master for an immersive interactive fiction adventure set in the frontier world of The Crossroads.",
        "- Write in rich, second-person perspective (\"You\").",
        "- Maintain an atmospheric, engaging, and dynamic storytelling tone.",
        "- React directly to player actions, events, and bracketed notifications in the narrative.",
        "- If bracketed system notifications appear (such as entity card updates or system status), narrate the scene naturally without echoing technical notation.",
        "- Focus strictly on storytelling and world progression."
    ].join("\n");

    const scenarioPayload = {
        title: "[DEV] Auto-Cards Integration Testbed",
        description: "Fresh automated integration testbed scenario for Auto-Cards (Entity-Cards v2.8.0), AID-Modules, and AID-Getopt. Managed by Antigravity.",
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

    console.log("\nSending GraphQL mutation to create scenario on AI Dungeon...");
    const scnRes = await client.createScenario(scenarioPayload);

    if (!scnRes.success || !scnRes.scenario) {
        throw new Error(`Scenario creation failed: ${scnRes.message}`);
    }

    const scn = scnRes.scenario;
    const scnUrl = `https://play.aidungeon.com/scenario/${scn.shortId}`;

    console.log("==================================================================");
    console.log("🎉 AUTO-CARDS SCENARIO CREATED SUCCESSFULLY!");
    console.log(`   Title:       ${scn.title}`);
    console.log(`   Short ID:    ${scn.shortId}`);
    console.log(`   Internal ID: ${scn.id}`);
    console.log(`   Live URL:    ${scnUrl}`);
    console.log("==================================================================");

    // Explicitly update scenario to lock in scriptsEnabled=true
    await client.updateScenario({
        shortId: scn.shortId,
        scriptsEnabled: true
    });

    updateEnv("AID_DEFAULT_SCENARIO_ID", scn.shortId);

    // 8. Spawn initial test adventure from this fresh scenario
    console.log("\nSpawning fresh test adventure from scenario...");
    const advRes = await client.playAdventure(scn.shortId);

    if (!advRes.success || !advRes.adventure) {
        throw new Error(`Adventure creation failed: ${advRes.message}`);
    }

    const adv = advRes.adventure;
    const advUrl = `https://play.aidungeon.com/adventure/${adv.shortId}`;

    // Auto-enable adventure script permissions
    try {
        await client.setAdventureScriptEnabled(adv.shortId, scn.shortId, true);
    } catch (e) {
        console.warn("Notice on setAdventureScriptEnabled:", e.message);
    }

    updateEnv("AID_DEFAULT_ADVENTURE_ID", adv.shortId);

    console.log("==================================================================");
    console.log("🎮 FRESH TEST ADVENTURE READY FOR SPECTATING!");
    console.log(`   Adventure ID:       ${adv.shortId} (Internal: ${adv.id})`);
    console.log(`   Direct Browser URL: ${advUrl}`);
    console.log("==================================================================");
    console.log("Updated .env with AID_DEFAULT_SCENARIO_ID and AID_DEFAULT_ADVENTURE_ID");
}

main().catch(err => {
    console.error("\n❌ Fatal Error:", err.message);
    process.exit(1);
});
