#!/usr/bin/env node

/**
 * AID-LLM-connector: Create Dedicated Test Scenario
 * 
 * Creates a brand new scenario on AI Dungeon pre-loaded with
 * AID-Getopt and the sandbox test suite.
 * 
 * Usage:
 *   node scripts/create_test_scenario.js
 *   npm run create-scenario
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
    console.log("  🏗️ Creating Dedicated AI Dungeon Testing Scenario");
    console.log("==================================================================");

    const client = new AIDClient();

    // 1. Verify user authentication
    const user = await client.getCurrentUser();
    console.log(`Authenticated as: ${user.username || user.email} (ID: ${user.id})`);

    // 2. Read local sandbox scripts and prompt
    const sandboxDir = path.resolve("C:/git/aid-getopt/AID-sandbox");
    
    function readSandboxFile(fileName, fallback) {
        const fullPath = path.join(sandboxDir, fileName);
        if (fs.existsSync(fullPath)) {
            console.log(`✔ Read ${fileName}`);
            return fs.readFileSync(fullPath, "utf8");
        }
        console.warn(`⚠️ ${fileName} not found at ${fullPath}, using fallback.`);
        return fallback;
    }

    const libraryCode = readSandboxFile("library-sandbox.js", "// AID-Getopt Sandbox Library\nconsole.log('[Getopt] Initialized');\n");
    const inputCode = readSandboxFile("input.js", `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        text = GetoptSandbox("input", text);\n    }\n    return { text };\n};\nmodifier(text);`);
    const contextCode = readSandboxFile("context.js", `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        [text, stop] = GetoptSandbox("context", text, stop);\n    }\n    return { text, stop };\n};\nmodifier(text);`);
    const outputCode = readSandboxFile("output.js", `const modifier = (text) => {\n    if (typeof GetoptSandbox === "function") {\n        text = GetoptSandbox("output", text);\n    }\n    return { text };\n};\nmodifier(text);`);
    const openingPrompt = readSandboxFile("Opening-Story.txt", "You stand inside the automated testing pavilion. The hearth burns warmly in the center of the chamber as diagnostic glyphs pulse along the walls.\n\nType /test to initiate the in-game self-test suite.");
    const instructions = readSandboxFile("AI-Instruction.txt", "This adventure uses GetoptAID to handle player slash commands (such as /roll, /inv, and /stat).");

    const scenarioPayload = {
        title: "[DEV] AID Integration Testbed (Antigravity)",
        description: "Dedicated automated testing scenario managed by Antigravity (AID-LLM-connector). Used for regression testing of AID-Getopt, Entity-Cards, and Inner-Entity.",
        prompt: openingPrompt,
        memory: "Active testing ground for AID-Getopt and Entity-Cards.",
        authorsNote: "[ Test Harness Active ]",
        instructions: instructions,
        scriptsEnabled: true,
        gameCode: {
            sharedLibrary: libraryCode,
            onInput: inputCode,
            onModelContext: contextCode,
            onOutput: outputCode
        }
    };

    console.log("\nSending GraphQL mutation to create scenario...");
    const result = await client.createScenario(scenarioPayload);

    if (result.success && result.scenario) {
        const scn = result.scenario;
        const url = `https://play.aidungeon.com/scenario/${scn.shortId}`;

        console.log("==================================================================");
        console.log("🎉 SCENARIO CREATED SUCCESSFULLY!");
        console.log(`   Title:       ${scn.title}`);
        console.log(`   Short ID:    ${scn.shortId}`);
        console.log(`   Internal ID: ${scn.id}`);
        console.log(`   Live URL:    ${url}`);
        if (scn.state?.scripts?.sharedLibrary) {
            console.log(`   Library:     ${scn.state.scripts.sharedLibrary.length} bytes loaded`);
        }
        console.log("==================================================================");

        // Update .env
        updateEnv("AID_DEFAULT_SCENARIO_ID", scn.shortId);
        console.log(`✔ Set AID_DEFAULT_SCENARIO_ID=${scn.shortId} in .env`);
        console.log("\nReady to launch automated test adventures from this scenario!");
    } else {
        console.error("❌ Scenario creation failed:", result.message);
    }
}

main().catch(err => {
    console.error("\n❌ Fatal Error:", err.message);
    process.exit(1);
});
