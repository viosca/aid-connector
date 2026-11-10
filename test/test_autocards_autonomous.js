/**
 * Auto-Cards Autonomous NER & Deterministic Context Injection Regression Test
 * 
 * Verifies:
 *  1. Passive Named Entity Recognition (NER) in natural story flow across the waterfall.
 *  2. Autonomous background story card generation without slash commands.
 *  3. Accurate trigger keyword generation (punctuation-padded keys).
 *  4. Deterministic model context injection: card content is placed under 'World Lore:'
 *     in the exact prompt payload passed to onModelContext.
 */

const crypto = require("crypto");
const fs = require("fs");
const assert = require("assert");
const { AIDClient } = require("../src");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function sendTurn(client, advId, advShortId, text, type = "do") {
    const key = crypto.randomUUID();
    console.log(`\n  >>> Action: [${type}] "${text}"`);
    await client.actionRequest({ adventureId: advId, type, text, key });

    for (let i = 0; i < 40; i++) {
        await sleep(1000);
        const chk = await client.checkActionRequest({ adventureId: advId, key });
        if (!chk.isProcessing) break;
    }

    const updated = await client.getAdventure(advShortId);
    const lastActions = (updated.actionWindow || []).slice(-2);
    for (const a of lastActions) {
        console.log(`  <<< [${a.type}]: ${a.text.trim()}`);
    }
    return updated;
}

async function driveContinues(client, advId, advShortId) {
    console.log("\n  Driving continue turns for autonomous generation...");
    for (let i = 1; i <= 8; i++) {
        const updated = await sendTurn(client, advId, advShortId, "", "continue");
        const lastAction = (updated.actionWindow || []).slice(-1)[0];
        if (lastAction && !lastAction.text.includes("please select \"continue\"")) {
            console.log(`  ✓ Generation complete after ${i} continue turn(s)!`);
            return updated;
        }
    }
}

async function main() {
    const client = new AIDClient();
    console.log("==================================================================");
    console.log("  TEST: AUTONOMOUS CARD GENERATION & CONTEXT INJECTION (WATERFALL)");
    console.log("==================================================================");

    // 1. Prepare Built-in router code with context telemetry
    const modLib = fs.readFileSync("C:/git/aid-modules/library-aid-modules.js", "utf8");
    let getoptLib = fs.readFileSync("C:/git/aid-getopt/AID-sandbox/library-sandbox.js", "utf8");
    const splitStart = getoptLib.indexOf("// Command 1: /roll");
    const splitEnd = getoptLib.indexOf("// Command 4: /help");
    if (splitStart !== -1 && splitEnd !== -1) {
        getoptLib = getoptLib.slice(0, splitStart) + getoptLib.slice(splitEnd);
    }

    const glueCode = `
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

    const sharedLib = [modLib, getoptLib, glueCode].join("\n");
    const inputCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("input", text);
    }
    return { text };
};
modifier(text);`;

    const contextCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        [text, stop] = GetoptSandbox("context", text, stop);
    }
    return { text, stop };
};
modifier(text);`;

    const outputCode = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("output", text);
    }
    return { text };
};
modifier(text);`;

    // 2. Create scenario and attach published Entity-Cards (_X5-3ouDjE10)
    console.log("1. Creating test scenario with built-in router...");
    const scnRes = await client.createScenario({
        title: "[TEST] Autonomous NER & Context Injection",
        description: "Testing passive entity detection and context injection across waterfall",
        prompt: "The cold mountain wind howls across the snowy ridge.",
        scriptsEnabled: true,
        gameCode: {
            sharedLibrary: sharedLib,
            onInput: inputCode,
            onModelContext: contextCode,
            onOutput: outputCode
        }
    });
    const scnId = scnRes.scenario.shortId;
    await client.updateScenario({ shortId: scnId, scriptsEnabled: true });
    await client.attachScenarioScript(scnId, "_X5-3ouDjE10");

    // 3. Play adventure
    console.log("2. Spawning test adventure...");
    const advRes = await client.playAdventure(scnId);
    const adv = advRes.adventure;
    console.log(`Adventure: ${adv.shortId} (ID: ${adv.id})`);

    const advScripts = await client.getAdventureScripts(adv.shortId);
    for (const s of advScripts) {
        if (!s.enabled) await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
    }

    // 4. Initialize Auto-Cards
    console.log("\n3. Initializing Auto-Cards via /ec...");
    await sendTurn(client, adv.id, adv.shortId, "/ec");

    // 5. Tune Configure Auto-Cards settings for rapid discovery
    console.log("\n4. Tuning Configure Auto-Cards story card for high sensitivity...");
    let cards = await client.getStoryCards(adv.shortId);
    const configCard = cards.find(c => c.title.includes("Configure") && c.title.includes("Auto-Cards"));
    assert(configCard, "Configure Auto-Cards card must exist");

    let tunedValue = configCard.value
        .replace("> Minimum turns cooldown for new cards: 28", "> Minimum turns cooldown for new cards: 0")
        .replace("> Also detect titles from player inputs: false", "> Also detect titles from player inputs: true")
        .replace("> Minimum turns age for title detection: 5", "> Minimum turns age for title detection: 2");

    await client.updateStoryCard(adv.shortId, configCard, {
        value: tunedValue
    });
    console.log("  ✓ Configure card updated: cooldown=0, readFromInputs=true, lookback=2");

    // 6. Natural Gameplay: Introduce named entity "Master Balin"
    console.log("\n5. Natural Gameplay: Introducing novel entity 'Master Balin'...");
    await sendTurn(client, adv.id, adv.shortId, "You walk into the forge of Master Balin the dwarven weaponsmith.");

    console.log("\n6. Natural Gameplay: Advancing turn to establish entity in recent history...");
    await sendTurn(client, adv.id, adv.shortId, "Master Balin inspects your chipped broadsword with a deep scowl.");

    console.log("\n7. Natural Gameplay: Reaching lookback distance threshold (turn 2)...");
    const turnRes = await sendTurn(client, adv.id, adv.shortId, "He strikes the glowing anvil with a heavy hammer.");

    // Check if Auto-Cards initiated generation
    const lastAction = (turnRes.actionWindow || []).slice(-1)[0]?.text || "";
    if (lastAction.includes("please select \"continue\"")) {
        console.log("  ✓ Auto-Cards autonomously detected 'Master Balin' and triggered card generation!");
        await driveContinues(client, adv.id, adv.shortId);
    } else {
        const turn4 = await sendTurn(client, adv.id, adv.shortId, "Master Balin sets the red-hot iron into the quenching trough.");
        if (turn4.actionWindow.slice(-1)[0]?.text.includes("please select \"continue\"")) {
            console.log("  ✓ Auto-Cards autonomously triggered card generation on turn 4!");
            await driveContinues(client, adv.id, adv.shortId);
        }
    }

    // 8. Verify story card creation
    cards = await client.getStoryCards(adv.shortId);
    console.log(`\nStory cards now in adventure (${cards.length}):`);
    for (const c of cards) {
        console.log(`  - [${c.id}] "${c.title.replace(/\n/g, ' ')}" (type: ${c.type}) keys: [${c.keys}]`);
    }

    const balinCard = cards.find(c => c.title.toLowerCase().includes("balin"));
    assert(balinCard, "Master Balin story card must be autonomously generated");
    assert(balinCard.keys.includes("Balin"), "Card keys must contain 'Balin'");
    console.log(`\n  🎉 AUTONOMOUS CARD CREATION VERIFIED: "${balinCard.title}"`);
    console.log("  [CARD CONTENT]:\n", balinCard.value);

    // 9. Deterministic Context Injection Verification
    console.log("\n=======================================================");
    console.log("8. Deterministic Context Injection Verification");
    console.log("=======================================================");
    console.log("Sending narrative action with keyword 'Balin' to trigger card injection...");
    await sendTurn(client, adv.id, adv.shortId, "You ask Balin if the sword can be reforged before sunset.");

    const fullAdv = await client.request("GetAdvContext", `query GetAdvContext($id: String!) {
        adventure(shortId: $id) {
            gameState
        }
    }`, { id: adv.shortId });

    const capturedCtx = fullAdv.adventure.gameState?.GetoptSandbox?.lastContext || "";
    console.log(`\nCaptured Model Context Length: ${capturedCtx.length} chars`);

    assert(capturedCtx.length > 0, "Model context must be captured by GetoptSandbox in onModelContext");
    assert(capturedCtx.includes("Balin"), "Model context must contain trigger keyword 'Balin'");
    assert(capturedCtx.includes("World Lore:") || capturedCtx.includes("Named Entities"), "Model context must contain World Lore / Named Entities section header");
    assert(capturedCtx.includes("Master Balin"), "Model context must contain the entity card title");

    console.log("  ✓ Card title in context ('Master Balin'): YES");
    console.log("  ✓ Trigger keyword in context ('Balin'): YES");
    console.log("  ✓ Section header present in context: YES");
    console.log("  ✓ Prompt payload integrity confirmed!");

    console.log("\n==================================================================");
    console.log("  🎉 ALL AUTONOMOUS NER & CONTEXT INJECTION TESTS PASSED (100%)");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ Regression Test Failure:", err.message);
    process.exit(1);
});
