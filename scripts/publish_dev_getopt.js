const fs = require("fs");
const crypto = require("crypto");
const { AIDClient } = require("../src");

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const client = new AIDClient();
    const shortId = "3MdjmiOipsOx";
    console.log(`=== Deploying Latest AID-Modules & AID-Getopt to Script (${shortId}) ===`);

    const modLib = fs.readFileSync("C:/git/aid-modules/library-aid-modules.js", "utf8");
    let getoptLib = fs.readFileSync("C:/git/aid-getopt/examples/library-sandbox.js", "utf8");
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

    const sharedLibrary = [modLib, getoptLib, glueCode].join("\n");

    const onInput = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("input", text);
    }
    return { text };
};
modifier(text);`;

    const onModelContext = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        [text, stop] = GetoptSandbox("context", text, stop);
    }
    return { text, stop };
};
modifier(text);`;

    const onOutput = `const modifier = (text) => {
    if (typeof GetoptSandbox === "function") {
        text = GetoptSandbox("output", text);
    }
    return { text };
};
modifier(text);`;

    // 1. Update Scenario details
    console.log("1. Updating scenario details...");
    await client.updateScenario({
        shortId,
        title: "[DEV] AID-Getopt Router (v1.0.0)",
        description: "Standalone published router for AID-Getopt & AID-Modules",
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
    await client.request("Mod", `mutation Mod($input: AiModerateScenarioInput!) {
        aiModerateScenario(input: $input) { success isProcessing final_rating }
    }`, { input: { shortId, key, forceFullCheck: true } });

    console.log("4. Confirming AI Moderation...");
    await client.request("Conf", `mutation Conf($input: ConfirmAiModerationInput!) {
        confirmAiModeration(input: $input) { success }
    }`, { input: { shortId, key, forceFullCheck: true } });

    console.log("Waiting for moderation check...");
    for (let i = 0; i < 30; i++) {
        await sleep(1500);
        const cr = await client.request("CheckMod", `mutation CheckMod($input: AiModerateScenarioInput!) {
            aiModerateScenario(input: $input) { isProcessing final_rating }
        }`, { input: { shortId, key: crypto.randomUUID() } });
        process.stdout.write(`  [${i + 1}] Processing: ${cr.aiModerateScenario?.isProcessing}, Rating: ${cr.aiModerateScenario?.final_rating}\r`);
        if (!cr.aiModerateScenario?.isProcessing && cr.aiModerateScenario?.final_rating) break;
    }
    console.log("\nModeration complete!");

    // 4. Publish scenario
    console.log("5. Publishing scenario (SILENT tier)...");
    const pubRes = await client.request("Pub", `mutation Pub($shortId: String!, $pub: ScenarioPublicationInput!) {
        publishScenario(shortId: $shortId, publication: $pub) { success message }
    }`, {
        shortId,
        pub: {
            updateTier: "SILENT",
            title: "[DEV] AID-Getopt Router (v1.0.0)",
            body: "Internal test router snapshot"
        }
    });
    console.log("Publish result:", pubRes.publishScenario);

    // 5. Verify published script
    const sres = await client.request("GetS", `query GetS($id: String!) {
        script(shortId: $id) { id shortId title version hooks }
    }`, { id: shortId });
    console.log("\nVerified Published Script:", sres.script);
}

main().catch(console.error);
