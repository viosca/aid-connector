const crypto = require("crypto");
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
    console.log("  WATERFALL CASE 3: Blank Host + Dual Attached Scripts");
    console.log("  Script 1 (Attached): AID-Getopt Router (3MdjmiOipsOx)");
    console.log("  Script 2 (Attached): Entity-Cards v2.8.0 (_X5-3ouDjE10)");
    console.log("==================================================================");

    // 1. Create blank host scenario (NO built-in script)
    console.log("\n1. Creating blank Host Scenario (no built-in script)...");
    const scnRes = await client.createScenario({
        title: "[TEST] Waterfall Case 3 (Dual Attached Scripts)",
        description: "Case 3: Host scenario with no built-in scripts. User attaches both Getopt and EntityCards.",
        prompt: "The alpine wind sweeps over the snowfields. You stand at the gates of Pinecrest.",
        scriptsEnabled: true
    });
    const hostId = scnRes.scenario.shortId;
    console.log(`Host Scenario created: ${hostId}`);

    // Ensure scriptsEnabled: true
    await client.updateScenario({ shortId: hostId, scriptsEnabled: true });

    // 2. Attach Script 1: AID-Getopt Router (3MdjmiOipsOx)
    console.log("2. Attaching Script 1: AID-Getopt Router (3MdjmiOipsOx)...");
    await client.attachScenarioScript(hostId, "3MdjmiOipsOx");

    // 3. Attach Script 2: Entity-Cards v2.8.0 (_X5-3ouDjE10)
    console.log("3. Attaching Script 2: Entity-Cards v2.8.0 (_X5-3ouDjE10)...");
    await client.attachScenarioScript(hostId, "_X5-3ouDjE10");

    const scnScripts = await client.getScenarioScripts(hostId);
    console.log("Attached scripts on Host Scenario:", scnScripts.map(s => `${s.title} (${s.shortId}) builtIn: ${s.builtIn}`));

    // 4. Play adventure
    console.log("\n4. Spawning test adventure...");
    const advRes = await client.playAdventure(hostId);
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

    // --- Turn 1: /diag (Verify Attached Script 1 intercepts and halts) ---
    console.log("\n=======================================================");
    console.log("TURN 1: Test /diag (Attached Script 1 Interception & Halt)");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "/diag");

    // --- Turn 2: /ec (Verify Attached Script 2 initializes across waterfall) ---
    console.log("\n=======================================================");
    console.log("TURN 2: Test /ec Initialization (Attached Script 2 Execution)");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "/ec");

    // Inspect story cards after /ec
    const cardsQ = `query GetCards($id: String!) {
        adventure(shortId: $id) {
            storyCards {
                id
                title
                type
            }
        }
    }`;
    let cardsRes = await client.request("GetCards", cardsQ, { id: adv.shortId });
    console.log(`\nStory cards in adventure: ${cardsRes.adventure.storyCards.length}`);
    for (const c of cardsRes.adventure.storyCards) {
        console.log(`  - Card [${c.id}] "${c.title.replace(/\n/g, ' ')}" (type: ${c.type})`);
    }

    // --- Turn 3: /ec -loc "Pinecrest Inn" / {A cozy alpine lodge} ---
    console.log("\n=======================================================");
    console.log("TURN 3: Test /ec Manual Card Creation across Dual Attached Scripts");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, `/ec -loc "Pinecrest Inn" / {A warm alpine lodge with a glowing stone hearth}`);

    cardsRes = await client.request("GetCards", cardsQ, { id: adv.shortId });
    console.log(`\nStory cards after manual creation: ${cardsRes.adventure.storyCards.length}`);
    for (const c of cardsRes.adventure.storyCards) {
        console.log(`  - Card [${c.id}] "${c.title.replace(/\n/g, ' ')}" (type: ${c.type})`);
    }

    // --- Turn 4: Story narrative turn (Check passthrough to LLM) ---
    console.log("\n=======================================================");
    console.log("TURN 4: Test Story Narrative Passthrough to LLM");
    console.log("=======================================================");
    await sendTurn(client, adv.id, adv.shortId, "You walk up the stone stairs and push open the front door.");

    console.log("\n=== ALL CASE 3 WATERFALL TESTS COMPLETE ===");
}

main().catch(console.error);
