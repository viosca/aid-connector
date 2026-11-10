const crypto = require("crypto");
const fs = require("fs");
const { AIDClient } = require("../src");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function sendTurn(client, advId, advShortId, text, type = "do") {
    const key = crypto.randomUUID();
    console.log(`\n>>> Action: [${type}] "${text}"`);
    await client.actionRequest({ adventureId: advId, type, text, key });

    for (let i = 0; i < 40; i++) {
        await sleep(1000);
        const chk = await client.checkActionRequest({ adventureId: advId, key });
        if (!chk.isProcessing) break;
    }

    const updated = await client.getAdventure(advShortId);
    const lastActions = (updated.actionWindow || []).slice(-2);
    for (const a of lastActions) {
        console.log(`<<< [${a.type}]: ${a.text.trim()}`);
    }
    return updated;
}

async function main() {
    const client = new AIDClient();
    console.log("==================================================================");
    console.log("  WATERFALL CASE 1: Built-in Router + Attached Entity-Cards v2.8.0");
    console.log("==================================================================");

    // 1. Build Getopt + Modules code for built-in script
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

    // 2. Create scenario with Getopt built-in
    console.log("\n1. Creating Case 1 Scenario (Built-in: AID-Modules + AID-Getopt)...");
    const scnRes = await client.createScenario({
        title: "[TEST] Waterfall Case 1 (Getopt Builtin + EC Attached)",
        description: "Case 1: Scenario creator provides router builtin, attaches Entity-Cards",
        prompt: "The cold mountain wind howls through the pine valley. You stand outside Oakhaven Post.",
        scriptsEnabled: true,
        gameCode: {
            sharedLibrary: sharedLib,
            onInput: inputCode,
            onModelContext: contextCode,
            onOutput: outputCode
        }
    });
    const scnId = scnRes.scenario.shortId;
    console.log(`Scenario created: ${scnId}`);

    // Ensure scriptsEnabled: true
    await client.updateScenario({ shortId: scnId, scriptsEnabled: true });

    // 3. Attach published Entity-Cards script (_X5-3ouDjE10)
    console.log("2. Attaching published Entity-Cards script (_X5-3ouDjE10)...");
    await client.attachScenarioScript(scnId, "_X5-3ouDjE10");

    const scnScripts = await client.getScenarioScripts(scnId);
    console.log("Scenario scripts:", scnScripts.map(s => `${s.title} (${s.shortId}) builtIn: ${s.builtIn}`));

    // 4. Play adventure
    console.log("\n3. Spawning test adventure...");
    const advRes = await client.playAdventure(scnId);
    const adv = advRes.adventure;
    console.log(`Adventure created: ${adv.shortId} (ID: ${adv.id})`);

    const advScripts = await client.getAdventureScripts(adv.shortId);
    console.log("Adventure scripts:", advScripts.map(s => `${s.title} (${s.shortId}) enabled: ${s.enabled}`));

    // Ensure all scripts enabled
    for (const s of advScripts) {
        if (!s.enabled) {
            console.log(`Enabling ${s.title} (${s.shortId})...`);
            await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
        }
    }

    // --- Turn 1: /mods (Check module registry across waterfall) ---
    console.log("\n=======================================================");
    console.log("TURN 1: Test /mods across Waterfall");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "/mods");

    // --- Turn 2: /diag (Check router early halting) ---
    console.log("\n=======================================================");
    console.log("TURN 2: Test /diag (Router Early Halt)");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "/diag");

    // --- Turn 3: /ec (Init & verify downstream attached script execution) ---
    console.log("\n=======================================================");
    console.log("TURN 3: Test /ec Initialization (Downstream Script Execution)");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "/ec");

    // Inspect story cards after /ec
    const cardsQ = `query GetCards($id: String!) {
        adventure(shortId: $id) {
            storyCards {
                id
                title
                type
                keys
                value
            }
        }
    }`;
    let cardsRes = await client.request("GetCards", cardsQ, { id: adv.shortId });
    console.log(`\nStory cards in adventure: ${cardsRes.adventure.storyCards.length}`);
    for (const c of cardsRes.adventure.storyCards) {
        console.log(`  - Card [${c.id}] "${c.title.replace(/\n/g, ' ')}" (type: ${c.type})`);
    }

    // --- Turn 4: /ec -loc "Oakhaven Post" / {A timber outpost} ---
    console.log("\n=======================================================");
    console.log("TURN 4: Test /ec Manual Card Creation across Waterfall");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, `/ec -loc "Oakhaven Post" / {A secluded timber outpost nestled in the pines}`);

    cardsRes = await client.request("GetCards", cardsQ, { id: adv.shortId });
    console.log(`\nStory cards after manual creation: ${cardsRes.adventure.storyCards.length}`);
    for (const c of cardsRes.adventure.storyCards) {
        console.log(`  - Card [${c.id}] "${c.title.replace(/\n/g, ' ')}" (type: ${c.type}) keys: [${c.keys}]`);
        if (c.title.includes("Oakhaven")) {
            console.log(`    Value:\n${c.value}`);
        }
    }

    // --- Turn 5: Story narrative turn (Check passthrough to LLM) ---
    console.log("\n=======================================================");
    console.log("TURN 5: Test Story Narrative Passthrough to LLM");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "You push open the heavy oak door and step inside out of the freezing wind.");

    console.log("\n=== ALL CASE 1 WATERFALL TESTS COMPLETE ===");
}

main().catch(console.error);
