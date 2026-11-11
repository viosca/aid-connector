const fs = require("fs");
const crypto = require("crypto");
const { AIDClient } = require("../src");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const client = new AIDClient();
    const shortId = "_X5-3ouDjE10";
    console.log(`=== Deploying Latest Auto-Cards/Entity-Cards to Test Script (${shortId}) ===`);

    const sharedLibrary = fs.readFileSync("C:/git/Entity-Cards/src/library.js", "utf8");
    const onInput = fs.readFileSync("C:/git/Entity-Cards/src/input.js", "utf8");
    const onModelContext = fs.readFileSync("C:/git/Entity-Cards/src/context.js", "utf8");
    const onOutput = fs.readFileSync("C:/git/Entity-Cards/src/output.js", "utf8");

    console.log(`Loaded library.js: ${sharedLibrary.length} bytes`);

    // 1. Update Scenario details
    console.log("1. Updating scenario details...");
    await client.updateScenario({
        shortId,
        title: "[DEV] Entity-Cards (v2.8.0-EC)",
        description: "Standalone published test script for Auto-Cards / Entity-Cards v2.8.0-EC",
        isScript: true,
        scriptsEnabled: true
    });

    // 2. Update Scenario scripts
    console.log("2. Updating scenario scripts...");
    const scriptRes = await client.updateScenarioScripts(shortId, {
        sharedLibrary,
        onInput,
        onModelContext,
        onOutput
    });
    console.log("Scripts updated:", scriptRes.success);

    // 3. AI Moderation handshake
    console.log("3. Initiating aiModerateScenario...");
    const key = crypto.randomUUID();
    const modQ = `mutation Mod($input: AiModerateScenarioInput!) {
        aiModerateScenario(input: $input) {
            success
            isProcessing
            final_rating
            message
        }
    }`;
    await client.request("Mod", modQ, {
        input: { shortId, key, forceFullCheck: true }
    });

    console.log("4. Confirming AI Moderation...");
    const confQ = `mutation Conf($input: ConfirmAiModerationInput!) {
        confirmAiModeration(input: $input) {
            success
            message
        }
    }`;
    await client.request("Conf", confQ, {
        input: { shortId, key, forceFullCheck: true }
    });

    console.log("Waiting for moderation check to complete...");
    for (let i = 0; i < 30; i++) {
        await sleep(1500);
        const checkQ = `mutation CheckMod($input: AiModerateScenarioInput!) {
            aiModerateScenario(input: $input) {
                success
                isProcessing
                final_rating
            }
        }`;
        try {
            const cr = await client.request("CheckMod", checkQ, { input: { shortId, key: crypto.randomUUID() } });
            process.stdout.write(`  [${i + 1}] Processing: ${cr.aiModerateScenario?.isProcessing}, Rating: ${cr.aiModerateScenario?.final_rating}\r`);
            if (!cr.aiModerateScenario?.isProcessing && cr.aiModerateScenario?.final_rating) break;
        } catch (_) {}
    }
    console.log("\nModeration complete!");

    // 4. Publish scenario
    console.log("5. Publishing scenario (SILENT tier)...");
    const pubQ = `mutation Pub($shortId: String!, $pub: ScenarioPublicationInput!) {
        publishScenario(shortId: $shortId, publication: $pub) {
            success
            message
        }
    }`;
    const pubRes = await client.request("Pub", pubQ, {
        shortId,
        pub: {
            updateTier: "SILENT",
            title: "[DEV] Entity-Cards (v2.8.0-EC)",
            body: "Internal waterfall test snapshot for Entity-Cards v2.8.0-EC"
        }
    });
    console.log("Publish result:", pubRes.publishScenario);

    // 5. Verify published script snapshot
    const sq = `query GetS($id: String!) {
        script(shortId: $id) {
            id
            shortId
            title
            version
            hooks
        }
    }`;
    const sres = await client.request("GetS", sq, { id: shortId });
    console.log("\nVerified Published Script:", sres.script);
}

main().catch(console.error);
