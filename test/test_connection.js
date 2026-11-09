/**
 * AID-LLM-connector: Unit & Connection Tests
 */

const assert = require("assert");
const { AIDClient, config } = require("../src");

async function runTests() {
    console.log("==================================================================");
    console.log("  🧪 Running AID-LLM-connector Unit & Connectivity Tests");
    console.log("==================================================================");

    // Test 1: Client initialization
    console.log("• Test 1: AIDClient initialization with default config...");
    const client = new AIDClient();
    assert.strictEqual(client.endpoint, config.graphqlEndpoint, "Client endpoint should match config");
    console.log("  ✔ Passed.");

    // Test 2: Custom endpoint options
    console.log("• Test 2: AIDClient initialization with custom options...");
    const custom = new AIDClient({ endpoint: "https://custom.endpoint/graphql", token: "custom-token" });
    assert.strictEqual(custom.endpoint, "https://custom.endpoint/graphql");
    assert.strictEqual(custom.token, "custom-token");
    console.log("  ✔ Passed.");

    // Test 3: Operation name validation
    console.log("• Test 3: Missing operationName should throw descriptive error...");
    let threw = false;
    try {
        await client.request("", "{ test }");
    } catch (e) {
        threw = true;
        assert(e.message.includes("operationName"), "Error message should mention operationName");
    }
    assert(threw, "Request without operationName must throw");
    console.log("  ✔ Passed.");

    // Test 4: Live server probe
    console.log("• Test 4: Live reachability check to AI Dungeon GraphQL endpoint...");
    let connected = false;
    try {
        await client.request("PingCheck", "query PingCheck { __typename }");
        connected = true;
    } catch (err) {
        // Unauthenticated error is expected and proves the GraphQL server is alive and responding
        if (err.message.includes("Not authorized") || err.message.includes("UNAUTHENTICATED")) {
            connected = true;
        } else {
            console.warn("  Probe warning:", err.message);
        }
    }
    assert(connected, "Should establish connection with AI Dungeon GraphQL endpoint");
    console.log("  ✔ Passed: AI Dungeon API is reachable.");

    console.log("------------------------------------------------------------------");
    console.log("🎉 ALL TESTS PASSED (100% OPERATIONAL)");
    console.log("==================================================================");
}

runTests().catch(err => {
    console.error("❌ Test suite failed:", err);
    process.exit(1);
});
