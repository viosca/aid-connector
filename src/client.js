/**
 * AID-LLM-connector: Core GraphQL Client for AI Dungeon
 * 
 * Handles authenticated communication with AI Dungeon's GraphQL backend
 * at https://api.aidungeon.com/graphql.
 */

const config = require("./config");
const { getAuthHeader, signInWithEmailPassword } = require("./auth");

class AIDClient {
    /**
     * @param {Object} [options]
     * @param {string} [options.endpoint] - Custom GraphQL endpoint
     * @param {string} [options.token] - Optional fixed token
     */
    constructor(options = {}) {
        this.endpoint = options.endpoint || config.graphqlEndpoint;
        this.token = options.token || null;
    }

    /**
     * Execute a GraphQL query or mutation against AI Dungeon
     * 
     * @param {string} operationName - Name of the operation (must match x-gql-operation-name)
     * @param {string} query - Full GraphQL query/mutation document
     * @param {Object} [variables] - Variables payload
     * @returns {Promise<any>} Data payload from GraphQL response
     */
    async request(operationName, query, variables = {}, isRetry = false) {
        if (!operationName) {
            throw new Error("AIDClient.request requires an operationName.");
        }

        const authHeader = this.token ? `firebase ${this.token.replace(/^firebase\s+/i, "")}` : await getAuthHeader();

        const headers = {
            "Content-Type": "application/json",
            "x-gql-operation-name": operationName
        };

        if (authHeader) {
            headers["Authorization"] = authHeader;
        }

        const body = JSON.stringify({
            operationName,
            query,
            variables
        });

        const response = await fetch(this.endpoint, {
            method: "POST",
            headers,
            body
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status} ${response.statusText} from ${this.endpoint}: ${errorText}`);
        }

        const result = await response.json();

        if (result.errors && result.errors.length > 0) {
            const isAuthError = result.errors.some(e => 
                e.extensions?.code === "UNAUTHENTICATED" || 
                (e.message && e.message.includes("Not authorized"))
            );

            if (isAuthError && !isRetry && config.email && config.password) {
                try {
                    await signInWithEmailPassword(config.email, config.password);
                    return await this.request(operationName, query, variables, true);
                } catch (_) {
                    // Fall through to throw original error
                }
            }

            const errorMessages = result.errors.map(e => {
                const code = e.extensions?.code || "GRAPHQL_ERROR";
                return `[${code}] ${e.message}`;
            }).join("; ");
            const err = new Error(`AI Dungeon GraphQL Error in ${operationName}: ${errorMessages}`);
            err.errors = result.errors;
            throw err;
        }

        return result.data;
    }

    /**
     * Get details for the currently authenticated user
     * @returns {Promise<{id: string, username: string, email: string, verifiedAt: string}>}
     */
    async getCurrentUser() {
        const query = `
            query UserContextGetUser {
                user {
                    id
                    username
                    email
                    verifiedAt
                    firebaseUid
                }
            }
        `;
        const data = await this.request("UserContextGetUser", query);
        return data.user;
    }

    /**
     * Fetch adventure data by shortId
     * @param {string} shortId - Adventure shortId (e.g. from play.aidungeon.com/adventure/<shortId>)
     * @returns {Promise<any>} Adventure object
     */
    async getAdventure(shortId) {
        const query = `
            query GetGameplayAdventure($shortId: String) {
                adventure(shortId: $shortId) {
                    id
                    publicId
                    shortId
                    scenarioId
                    title
                    description
                    actionCount
                    gameState
                    memory
                    authorsNote
                    thirdPerson
                }
            }
        `;
        const data = await this.request("GetGameplayAdventure", query, { shortId });
        return data.adventure;
    }

    /**
     * Fetch scenario data and scripts by shortId
     * @param {string} shortId - Scenario shortId (e.g. from play.aidungeon.com/scenario/<shortId>)
     * @param {boolean} [viewPublished=true] - Whether to view published state or draft state
     * @returns {Promise<any>} Scenario object
     */
    async getScenario(shortId, viewPublished = true) {
        const query = `
            query GetScenarioDetails($shortId: String, $viewPublished: Boolean) {
                scenario(shortId: $shortId) {
                    id
                    shortId
                    title
                    description
                    published
                    isPublishedSnapshot
                    createdAt
                    updatedAt
                    user {
                        id
                        username
                    }
                    state(viewPublished: $viewPublished) {
                        prompt
                        memory
                        authorsNote
                        scripts {
                            onInput
                            onOutput
                            onModelContext
                            sharedLibrary
                        }
                    }
                }
            }
        `;
        const data = await this.request("GetScenarioDetails", query, { shortId, viewPublished });
        return data.scenario;
    }

    /**
     * Update the scripts of a Scenario
     * @param {string} shortId - Scenario shortId
     * @param {Object} scripts - { sharedLibrary, onInput, onModelContext, onOutput }
     * @returns {Promise<any>}
     */
    async updateScenarioScripts(shortId, scripts) {
        const query = `
            mutation UpdateScenarioScripts($shortId: String, $gameCode: JSONObject) {
                updateScenarioScripts(shortId: $shortId, gameCode: $gameCode) {
                    success
                    message
                    scenario {
                        id
                        shortId
                        state(viewPublished: false) {
                            scripts {
                                onInput
                                onOutput
                                onModelContext
                                sharedLibrary
                            }
                        }
                    }
                }
            }
        `;
        const gameCode = {
            sharedLibrary: scripts.sharedLibrary || "",
            onInput: scripts.onInput || "",
            onModelContext: scripts.onModelContext || "",
            onOutput: scripts.onOutput || ""
        };
        const data = await this.request("UpdateScenarioScripts", query, { shortId, gameCode });
        return data.updateScenarioScripts;
    }

    /**
     * Start a new adventure from a scenario
     * @param {string} scenarioShortId 
     * @param {Object} [options]
     * @returns {Promise<any>} Created adventure object
     */
    async playAdventure(scenarioShortId, options = {}) {
        const query = `
            mutation SimpleStartAddAdventure(
                $scenarioShortId: String
                $prompt: String
                $memory: String
                $authorsNote: String
            ) {
                playAdventure(
                    scenarioShortId: $scenarioShortId
                    prompt: $prompt
                    memory: $memory
                    authorsNote: $authorsNote
                ) {
                    success
                    message
                    adventure {
                        id
                        shortId
                        title
                        description
                    }
                }
            }
        `;
        const variables = {
            scenarioShortId,
            prompt: options.prompt,
            memory: options.memory,
            authorsNote: options.authorsNote
        };
        const data = await this.request("SimpleStartAddAdventure", query, variables);
        return data.playAdventure;
    }

    /**
     * Send an action to an active adventure
     * @param {Object} input - ActionRequestInput
     * @returns {Promise<any>}
     */
    async actionRequest(input) {
        const query = `
            mutation ActionRequest($input: ActionRequestInput!) {
                actionRequest(input: $input) {
                    success
                    message
                    errorContext
                }
            }
        `;
        const data = await this.request("ActionRequest", query, { input });
        return data.actionRequest;
    }

    /**
     * Check action request status
     * @param {Object} input - CheckActionRequestInput
     * @returns {Promise<any>}
     */
    async checkActionRequest(input) {
        const query = `
            mutation CheckActionRequest($input: CheckActionRequestInput!) {
                checkActionRequest(input: $input) {
                    success
                    message
                    code
                    isProcessing
                    processingState
                }
            }
        `;
        const data = await this.request("CheckActionRequest", query, { input });
        return data.checkActionRequest;
    }
}

module.exports = AIDClient;
