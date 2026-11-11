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
            "x-gql-operation-name": operationName,
            "User-Agent": "aid-connector/0.1.0 (Scenario CI/CD & Regression Testing Harness; Developer Tooling)"
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
                    scenario {
                        id
                        shortId
                    }
                    title
                    description
                    actionCount
                    gameState
                    memory
                    authorsNote
                    thirdPerson
                    actionWindow {
                        id
                        type
                        text
                    }
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
                        plotEssentials
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
     * Create a new Scenario
     * @param {Object} input - ScenarioInput
     * @param {string} input.title - Scenario title
     * @param {string} [input.description] - Scenario description
     * @param {string} [input.prompt] - Starting story prompt
     * @param {string} [input.memory] - Plot essentials / memory
     * @param {string} [input.authorsNote] - Author's note
     * @param {Object} [input.gameCode] - { sharedLibrary, onInput, onModelContext, onOutput }
     * @param {boolean} [input.scriptsEnabled=true]
     * @returns {Promise<any>} Created scenario object
     */
    async createScenario(input) {
        const query = `
            mutation NewMenuCreateScenario($input: ScenarioInput) {
                createScenario(input: $input) {
                    success
                    message
                    scenario {
                        id
                        shortId
                        title
                        description
                        published
                        isPublishedSnapshot
                        state(viewPublished: false) {
                            prompt
                            plotEssentials
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
            }
        `;
        const scenarioInput = {
            title: input.title,
            description: input.description || "",
            prompt: input.prompt || "",
            memory: input.memory || "",
            authorsNote: input.authorsNote || "",
            scriptsEnabled: input.scriptsEnabled !== undefined ? input.scriptsEnabled : true,
            ...input
        };
        const data = await this.request("NewMenuCreateScenario", query, { input: scenarioInput });
        const created = data.createScenario;

        // If custom gameCode was provided and scenario was created, update scripts
        if (created.success && created.scenario && input.gameCode) {
            try {
                const scriptRes = await this.updateScenarioScripts(created.scenario.shortId, input.gameCode);
                if (scriptRes.scenario?.state?.scripts) {
                    created.scenario.state.scripts = scriptRes.scenario.state.scripts;
                }
            } catch (err) {
                console.warn(`[AIDClient] Warning: Failed to upload initial gameCode scripts: ${err.message}`);
            }
        }

        // Always persist scriptsEnabled and isScript flags via updateScenario
        if (created.success && created.scenario) {
            const updates = { shortId: created.scenario.shortId };
            if (input.scriptsEnabled !== false) {
                updates.scriptsEnabled = true;
            }
            if (input.isScript) {
                updates.isScript = true;
            }
            try {
                await this.updateScenario(updates);
            } catch (err) {
                console.warn(`[AIDClient] Warning: Failed to persist scenario flags: ${err.message}`);
            }
        }

        return created;
    }

    /**
     * Update scenario details (title, description, prompt, instructions, memory, etc.)
     * @param {Object} input - ScenarioInput (must include shortId)
     * @returns {Promise<any>}
     */
    async updateScenario(input) {
        const query = `
            mutation UpdateScenario($input: ScenarioInput) {
                updateScenario(input: $input) {
                    success
                    message
                    scenario {
                        id
                        shortId
                        title
                        description
                        state(viewPublished: false) {
                            prompt
                            plotEssentials
                            authorsNote
                            instructions
                        }
                    }
                }
            }
        `;
        const data = await this.request("UpdateScenario", query, { input });
        return data.updateScenario;
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
     * Update an individual story card in an adventure
     * @param {string} shortId - Adventure shortId
     * @param {Object} card - Existing card object
     * @param {Object} updates - Fields to override ({ value, title, keys, type, description, etc. })
     * @returns {Promise<any>}
     */
    async updateStoryCard(shortId, card, updates = {}) {
        const input = {
            shortId,
            contentType: "adventure",
            id: String(card.id),
            title: updates.title !== undefined ? updates.title : card.title,
            type: updates.type !== undefined ? updates.type : (card.type || "auto-card"),
            keys: updates.keys !== undefined ? updates.keys : (card.keys || ""),
            description: updates.description !== undefined ? updates.description : (card.description || ""),
            value: updates.value !== undefined ? updates.value : card.value,
            useForCharacterCreation: updates.useForCharacterCreation !== undefined ? updates.useForCharacterCreation : Boolean(card.useForCharacterCreation),
            isPinned: updates.isPinned !== undefined ? updates.isPinned : Boolean(card.isPinned)
        };
        const query = `
            mutation UpdateStoryCard($input: UpdateStoryCardInput!) {
                updateStoryCard(input: $input) {
                    success
                    message
                    storyCard {
                        id
                        title
                        type
                        keys
                        value
                    }
                }
            }
        `;
        const data = await this.request("UpdateStoryCard", query, { input });
        return data.updateStoryCard;
    }

    /**
     * Fetch all story cards for an adventure
     * @param {string} shortId - Adventure shortId
     * @returns {Promise<Array<any>>}
     */
    async getStoryCards(shortId) {
        const query = `
            query GetStoryCards($shortId: String) {
                adventure(shortId: $shortId) {
                    storyCardCount
                    storyCards {
                        id
                        title
                        type
                        keys
                        value
                        description
                        isPinned
                        useForCharacterCreation
                    }
                }
            }
        `;
        const data = await this.request("GetStoryCards", query, { shortId });
        return data.adventure?.storyCards || [];
    }

    /**
     * Start a new adventure from a scenario
     * @param {string} scenarioShortId 
     * @param {Object} [options]
     * @param {boolean} [options.viewPublished=false]
     * @returns {Promise<any>} Created adventure object
     */
    async playAdventure(scenarioShortId, options = {}) {
        let prompt = options.prompt;
        let memory = options.memory;
        let authorsNote = options.authorsNote;
        const viewPublished = options.viewPublished !== undefined ? options.viewPublished : false;

        // If prompt/memory omitted, populate from scenario state
        if (prompt === undefined || memory === undefined) {
            try {
                const scn = await this.getScenario(scenarioShortId, viewPublished);
                if (scn?.state) {
                    if (prompt === undefined) prompt = scn.state.prompt || "";
                    if (memory === undefined) memory = scn.state.plotEssentials || "";
                    if (authorsNote === undefined) authorsNote = scn.state.authorsNote || "";
                }
            } catch (e) {
                // Ignore fallback error
            }
        }

        const query = `
            mutation SimpleStartAddAdventure(
                $scenarioShortId: String
                $prompt: String
                $memory: String
                $authorsNote: String
                $viewPublished: Boolean
            ) {
                playAdventure(
                    scenarioShortId: $scenarioShortId
                    prompt: $prompt
                    memory: $memory
                    authorsNote: $authorsNote
                    viewPublished: $viewPublished
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
            prompt,
            memory,
            authorsNote,
            viewPublished
        };
        const data = await this.request("SimpleStartAddAdventure", query, variables);
        const playAdv = data.playAdventure;

        // Auto-enable all attached scripts on newly spawned adventure
        if (playAdv.success && playAdv.adventure?.shortId) {
            try {
                const advScripts = await this.getAdventureScripts(playAdv.adventure.shortId);
                for (const s of advScripts) {
                    try {
                        await this.setAdventureScriptEnabled(playAdv.adventure.shortId, s.shortId, true);
                    } catch (_) {}
                }
                if (scenarioShortId) {
                    try {
                        await this.setAdventureScriptEnabled(playAdv.adventure.shortId, scenarioShortId, true);
                    } catch (_) {}
                }
            } catch (err) {
                // Ignore if scenario has no active script module
            }
        }

        return playAdv;
    }

    /**
     * Enable or disable an attached script on an adventure
     * @param {string} adventureShortId 
     * @param {string} scriptShortId 
     * @param {boolean} [enabled=true]
     * @returns {Promise<any>}
     */
    async setAdventureScriptEnabled(adventureShortId, scriptShortId, enabled = true) {
        const query = `
            mutation SetAdventureScriptEnabled(
                $adventureShortId: String!
                $scriptShortId: String!
                $enabled: Boolean!
            ) {
                setAdventureScriptEnabled(
                    adventureShortId: $adventureShortId
                    scriptShortId: $scriptShortId
                    enabled: $enabled
                ) {
                    success
                    message
                }
            }
        `;
        const data = await this.request("SetAdventureScriptEnabled", query, {
            adventureShortId,
            scriptShortId,
            enabled
        });
        return data.setAdventureScriptEnabled;
    }

    /**
     * Attach an external script to a scenario
     * @param {string} scenarioShortId 
     * @param {string} scriptShortId 
     * @returns {Promise<any>}
     */
    async attachScenarioScript(scenarioShortId, scriptShortId) {
        const query = `
            mutation AttachScenarioScript(
                $scenarioShortId: String!
                $scriptShortId: String!
            ) {
                attachScenarioScript(
                    scenarioShortId: $scenarioShortId
                    scriptShortId: $scriptShortId
                ) {
                    code
                    success
                    message
                }
            }
        `;
        const data = await this.request("AttachScenarioScript", query, {
            scenarioShortId,
            scriptShortId
        });
        return data.attachScenarioScript;
    }

    /**
     * Detach an external script from a scenario
     * @param {string} scenarioShortId 
     * @param {string} scriptShortId 
     * @returns {Promise<any>}
     */
    async detachScenarioScript(scenarioShortId, scriptShortId) {
        const query = `
            mutation DetachScenarioScript(
                $scenarioShortId: String!
                $scriptShortId: String!
            ) {
                detachScenarioScript(
                    scenarioShortId: $scenarioShortId
                    scriptShortId: $scriptShortId
                ) {
                    code
                    success
                    message
                }
            }
        `;
        const data = await this.request("DetachScenarioScript", query, {
            scenarioShortId,
            scriptShortId
        });
        return data.detachScenarioScript;
    }

    /**
     * Get attached scripts for a scenario
     * @param {string} scenarioShortId 
     * @returns {Promise<Array<any>>}
     */
    async getScenarioScripts(scenarioShortId) {
        const query = `
            query GetScenarioScripts($scenarioShortId: String!) {
                scenarioScripts(scenarioShortId: $scenarioShortId) {
                    id
                    shortId
                    title
                    enabled
                    builtIn
                }
            }
        `;
        const data = await this.request("GetScenarioScripts", query, { scenarioShortId });
        return data.scenarioScripts || [];
    }

    /**
     * Get attached scripts for an adventure
     * @param {string} adventureShortId 
     * @returns {Promise<Array<any>>}
     */
    async getAdventureScripts(adventureShortId) {
        const query = `
            query GetAdventureScripts($adventureShortId: String!) {
                adventureScripts(adventureShortId: $adventureShortId) {
                    id
                    shortId
                    title
                    enabled
                    builtIn
                }
            }
        `;
        const data = await this.request("GetAdventureScripts", query, { adventureShortId });
        return data.adventureScripts || [];
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
