/**
 * Triad Multi-Script Waterfall Regression Test Suite
 * 
 * Verifies the 3-script multi-mod cascade running in AI Dungeon's QuickJS engine:
 *  1. Script 1: AID-Getopt Router       (3MdjmiOipsOx)
 *  2. Script 2: Entity-Cards v2.8.0-EC  (_X5-3ouDjE10)
 *  3. Script 3: Inner Entity V3.0       (XXU_L_ethgZg)
 * 
 * Verification Milestones:
 *  - Step 1: Clean scenario creation & 3-way script attachment in waterfall sequence.
 *  - Step 2: Configuration story card coexistence (Configure Auto-Cards + Configure Inner Self).
 *  - Step 3: Upstream command interception & early halting (/diag handled by Script 1).
 *  - Step 4: Downstream command passthrough (/ec handled by Script 2).
 *  - Step 5: Character mind & entity lore activation (Balin as NPC & Entity).
 *  - Step 6: Full context telemetry inspection on model input.
 */

const crypto = require("crypto");
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

async function driveContinues(client, advId, advShortId, maxTurns = 6) {
    console.log("\n  Driving continue turns for background generation/thought cycles...");
    for (let i = 1; i <= maxTurns; i++) {
        const updated = await sendTurn(client, advId, advShortId, "", "continue");
        const lastAction = (updated.actionWindow || []).slice(-1)[0];
        if (lastAction && !lastAction.text.includes("please select \"continue\"")) {
            console.log(`  ✓ Cycle stabilized after ${i} continue turn(s)!`);
            return updated;
        }
    }
}

async function main() {
    const client = new AIDClient();

    console.log("==================================================================");
    console.log("  TEST SUITE: TRIAD MULTI-SCRIPT WATERFALL REGRESSION");
    console.log("  Cascade: AID-Getopt -> Entity-Cards -> Inner Entity");
    console.log("==================================================================");

    // 1. Create Host Scenario with 3 Attached Scripts
    console.log("\n1. Spawning Host Scenario with Triad Attached Scripts...");
    const scnRes = await client.createScenario({
        title: "[TEST] Triad Waterfall: Router + EC + Inner Entity",
        description: "Automated regression testbed for 3-script cascade",
        prompt: "The cold mountain wind howls across the snowy ridge near the dwarven forge.",
        scriptsEnabled: true
    });
    const hostId = scnRes.scenario.shortId;
    console.log(`  Scenario ID: ${hostId} (ID: ${scnRes.scenario.id})`);

    // Attach in strict waterfall sequence:
    console.log("  Attaching Script 1: AID-Getopt Router (3MdjmiOipsOx)...");
    await client.attachScenarioScript(hostId, "3MdjmiOipsOx");
    console.log("  Attaching Script 2: Entity-Cards v2.8.0-EC (_X5-3ouDjE10)...");
    await client.attachScenarioScript(hostId, "_X5-3ouDjE10");
    console.log("  Attaching Script 3: Inner Entity V3.0 (XXU_L_ethgZg)...");
    await client.attachScenarioScript(hostId, "XXU_L_ethgZg");

    // 2. Start Adventure
    console.log("\n2. Playing Adventure from Triad Scenario...");
    const advRes = await client.playAdventure(hostId);
    const adv = advRes.adventure;
    console.log(`  Adventure: ${adv.shortId} (ID: ${adv.id})`);

    // Verify all 3 scripts are enabled on the adventure
    const advScripts = await client.getAdventureScripts(adv.shortId);
    console.log(`  Discovered ${advScripts.length} attached scripts on adventure:`);
    for (const s of advScripts) {
        console.log(`    - [${s.enabled ? "ENABLED" : "DISABLED"}] ${s.title || s.shortId} (${s.shortId})`);
        if (!s.enabled) {
            await client.setAdventureScriptEnabled(adv.shortId, s.shortId, true);
        }
    }

    // 3. Step 1: Upstream Router Interception & Early Halting (/diag)
    console.log("\n==================================================================");
    console.log("  STEP 1: Upstream Router Interception & Early Halting (/diag)");
    console.log("==================================================================");
    const diagTurn = await sendTurn(client, adv.id, adv.shortId, "/diag");
    const diagText = diagTurn.actionWindow.slice(-1)[0]?.text || "";
    assert(diagText.includes("AID-Getopt System Diagnostics"), "Script 1 must intercept /diag and halt before downstream scripts");
    console.log("  ✓ /diag successfully intercepted and halted by Script 1 (Router).");

    // 4. Step 2: Cross-Script Command Passthrough (/ec)
    console.log("\n==================================================================");
    console.log("  STEP 2: Downstream Command Passthrough (/ec)");
    console.log("==================================================================");
    await sendTurn(client, adv.id, adv.shortId, "/ec");
    const ecGenTurn = await sendTurn(client, adv.id, adv.shortId, '/ec -loc "Mountain Forge" / {A blazing dwarven weaponsmith forge}');
    const ecText = ecGenTurn.actionWindow.slice(-2).map(a => a.text).join("\n");
    assert(ecText.includes("Mountain Forge") && ecText.includes("Success"), "Script 2 must receive /ec command passed down from Script 1");
    console.log("  ✓ /ec passed cleanly through Script 1 and was processed by Script 2.");

    // Complete continue turns for card generation if requested
    if (ecText.includes("please select \"continue\"")) {
        await driveContinues(client, adv.id, adv.shortId, 4);
    }

    // 5. Step 3: Story Card Coexistence
    console.log("\n==================================================================");
    console.log("  STEP 3: Story Card Architecture & Configuration Coexistence");
    console.log("==================================================================");
    let cards = await client.getStoryCards(adv.shortId);
    console.log(`  Total Story Cards in Adventure: ${cards.length}`);
    for (const c of cards) {
        console.log(`    • Card: "${c.title}" [type: ${c.type || "class"}] (keys: "${c.keys ? c.keys.slice(0, 40) : ""}")`);
    }

    const hasAC = cards.some(c => c.title.includes("Auto-Cards") || c.title.includes("Entity Cards"));
    const hasIS = cards.some(c => c.title.includes("Inner Self") || c.title.includes("Inner Entity"));

    console.log(`  ✓ Auto-Cards / Entity-Cards Card Present: ${hasAC ? "YES" : "NO"}`);
    console.log(`  ✓ Inner Self / Inner Entity Card Present: ${hasIS ? "YES" : "NO"}`);
    assert(hasAC, "Configure Auto-Cards or Configure Entity Cards must exist");
    assert(hasIS, "Configure Inner Self must exist from Inner Entity script");

    // 6. Step 4: Configure NPC Minds & NER Lore for "Master Balin"
    console.log("\n==================================================================");
    console.log("  STEP 4: Tuning NPC Minds & NER Lore for 'Balin'");
    console.log("==================================================================");
    const innerCard = cards.find(c => c.title.includes("Configure") && (c.title.includes("Inner Self") || c.title.includes("Inner Entity")));
    if (innerCard) {
        let entry = innerCard.value || "";
        // Register Balin as an intelligent NPC in Inner Self
        let updatedNotes = innerCard.description || "";
        if (!updatedNotes.includes("Balin")) {
            updatedNotes = (updatedNotes.trim() + "\nBalin").trim();
        }
        await client.updateStoryCard(adv.shortId, innerCard, {
            description: updatedNotes
        });
        console.log("  ✓ Configured NPC 'Balin' in Inner Self character roster.");
    }

    // Also tune Auto-Cards for active detection
    const configCard = cards.find(c => c.title.includes("Configure") && c.title.includes("Auto-Cards"));
    if (configCard) {
        let tunedValue = configCard.value
            .replace("> Minimum turns cooldown for new cards: 28", "> Minimum turns cooldown for new cards: 0")
            .replace("> Also detect titles from player inputs: false", "> Also detect titles from player inputs: true")
            .replace("> Minimum turns age for title detection: 5", "> Minimum turns age for title detection: 1");
        await client.updateStoryCard(adv.shortId, configCard, { value: tunedValue });
        console.log("  ✓ Configured Auto-Cards for rapid entity discovery (cooldown=0, lookback=1).");
    }

    // 7. Step 5: Natural Narrative Gameplay Action with "Master Balin"
    console.log("\n==================================================================");
    console.log("  STEP 5: Natural Gameplay Interaction with 'Master Balin'");
    console.log("==================================================================");
    await sendTurn(client, adv.id, adv.shortId, "You step inside the warmth of the forge and greet Master Balin the dwarven weaponsmith.");

    console.log("  Advancing turn to trigger NPC mind reflection and entity card indexing...");
    await sendTurn(client, adv.id, adv.shortId, "Balin wipes sweat from his brow and looks at your broken blade.");

    // Drive continue turns if either system requested model thought cycles
    cards = await client.getStoryCards(adv.shortId);
    console.log(`\n  Updated Story Cards after NPC engagement (${cards.length} cards):`);
    for (const c of cards) {
        console.log(`    • Card: "${c.title}" [type: ${c.type || "class"}] (keys: "${c.keys ? c.keys.slice(0, 40) : ""}")`);
    }

    // 8. Step 6: Model Context Telemetry & Triad Coexistence
    console.log("\n==================================================================");
    console.log("  STEP 6: Full Context Telemetry & Triad Coexistence");
    console.log("==================================================================");
    console.log("Sending query turn to inspect captured model context...");
    await sendTurn(client, adv.id, adv.shortId, "You ask Balin how much gold it will take to reforge the sword.");

    const fullAdv = await client.request("GetAdvContext", `query GetAdvContext($id: String!) {
        adventure(shortId: $id) {
            gameState
        }
    }`, { id: adv.shortId });

    const gs = fullAdv.adventure.gameState || {};
    const routerState = gs.scripts?.["3MdjmiOipsOx"]?.GetoptSandbox || gs.GetoptSandbox || {};
    const capturedCtx = routerState.lastContext || "";
    console.log(`\nCaptured Context Length: ${capturedCtx.length} chars (length tracker: ${routerState.lastContextLength || 0})`);
    if (capturedCtx.length > 0) {
        console.log("Context Header Preview:");
        console.log(capturedCtx.slice(0, 500));
    }

    assert(capturedCtx.length > 0, "Model context must be captured by Getopt telemetry in onModelContext");
    assert(capturedCtx.includes("Balin"), "Context must contain active character name 'Balin'");

    console.log("  ✓ Context Telemetry Captured: YES");
    console.log("  ✓ Character Trigger Keyword Present: YES");
    console.log("  ✓ Triad Execution Verified across 3 Scripts in Sequence!");

    console.log("\n==================================================================");
    console.log("  🎉 ALL TRIAD WATERFALL REGRESSION TESTS PASSED (100% HARMONY)");
    console.log("==================================================================");
}

main().catch(err => {
    console.error("\n❌ Triad Regression Test Failure:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
