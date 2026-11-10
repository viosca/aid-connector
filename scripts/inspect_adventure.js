const { AIDClient, config } = require("../src");

async function main() {
    const client = new AIDClient();
    const shortId = process.argv[2] || config.defaultAdventureId;
    console.log("Inspecting adventure:", shortId);

    const adv = await client.getAdventure(shortId);
    console.log("Title:", adv.title);
    console.log("ID:", adv.id);
    console.log("Action Count:", adv.actionCount);

    const q = `query GetStoryCards($shortId: String) {
        adventure(shortId: $shortId) {
            gameState
            storyCardCount
            storyCards {
                id
                title
                type
                keys
                value
            }
            actionWindow {
                id
                text
                type
            }
        }
    }`;
    const res = await client.request("GetStoryCards", q, { shortId });
    if (res.adventure?.gameState) {
        console.log("\n--- GameState ---");
        try {
            const gs = typeof res.adventure.gameState === "string" ? JSON.parse(res.adventure.gameState) : res.adventure.gameState;
            console.log("AutoCards.generation:", JSON.stringify(gs.AutoCards?.generation, null, 2));
        } catch (_) {
            console.log(String(res.adventure.gameState).slice(0, 500));
        }
    }
    const cards = res.adventure?.storyCards || [];
    console.log("\n--- Story Cards (" + cards.length + ") ---");
    for (const card of cards) {
        console.log(`[${card.type}] "${card.title}" (keys: ${card.keys})`);
        console.log("Value preview:", card.value.slice(0, 150).replace(/\n/g, " "), "\n");
    }

    const actions = res.adventure?.actionWindow || [];
    console.log("\n--- Latest 3 Actions ---");
    for (const a of actions.slice(-3)) {
        console.log(`[#${a.id} ${a.type}]: ${a.text.trim()}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
