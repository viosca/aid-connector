const fs = require("fs");
const crypto = require("crypto");
const { AIDClient } = require("../src");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const client = new AIDClient();
    const shortId = "XXU_L_ethgZg";
    console.log(`=== Deploying Latest Inner-Entity (Minds-Only) to Test Script (${shortId}) ===`);

    const sharedLibrary = fs.readFileSync("C:/git/Inner-Entity/dist/inner-self-minds-only.js", "utf8");
    const onInput = `// Your "Input" tab should look like this\nInnerEntity("input");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`;
    const onModelContext = `// Your "Context" tab should look like this\nInnerEntity("context");\nconst modifier = (text) => {\n  return { text, stop };\n};\nmodifier(text);`;
    const onOutput = `// Your "Output" tab should look like this\nInnerEntity("output");\nconst modifier = (text) => {\n  return { text };\n};\nmodifier(text);`;

    console.log(`Loaded inner-self-minds-only.js: ${sharedLibrary.length} bytes`);

    // 1. Update Scenario details
    console.log("1. Updating scenario details...");
    await client.updateScenario({
        shortId,
        title: "Inner Entity V3.0 (plain)",
        description: "This is the stripped down Inner Self with YAPPER's optimization mods. It does not include Auto-Cards or Entity-Cards. It runs cleanly from AID's scripting interface. If you need Auto-Cards or Entity-Cards, you must include it previous to this script in the scripting interface.\n",
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
            title: "Inner Entity V3.0 (plain)",
            body: "Internal test snapshot with first-class /ie command router and AMS v1.1.0 standard"
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
