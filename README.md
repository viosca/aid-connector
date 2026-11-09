# AID-LLM-connector 🚀

Automated connection, GraphQL client, and testing bridge between **Antigravity** and **AI Dungeon** (`play.aidungeon.com`).

Designed to run automated end-to-end integration tests for **AID-Getopt**, **Entity-Cards**, and **Inner-Entity**, and automate scenario script management.

---

## Features

- **Direct Headless GraphQL Client**: Communicates directly with AI Dungeon's production API (`https://api.aidungeon.com/graphql`).
- **Native Firebase Auth Integration**: Supports token-based auth (`Authorization: firebase <token>`) and automated headless sign-in.
- **Scenario Script Deployment**: Uploads scripts (`onInput`, `onModelContext`, `onOutput`, `sharedLibrary`) programmatically into AI Dungeon scenarios.
- **Automated Adventure Play**: Starts adventures from scenarios and sends game actions (`/test`, `/ec -v`, etc.) via the GraphQL action queue.
- **Verification & Test Harness**: Built-in test suite for immediate verification from Antigravity.

---

## Quickstart

### 1. Verification & Status Check

Verify that AI Dungeon's GraphQL backend is reachable:

```bash
npm run verify
```

Run test suite:

```bash
npm test
```

### 2. Authentication Setup

Create a `.env` file in the project root based on [`.env.example`](.env.example):

#### Option A: Direct Token (Recommended)
Extract your token from the browser DevTools (Network tab -> any GraphQL request -> `Authorization` header without the `firebase ` prefix) or via **AID-QoL-Tool**:
```env
AID_ACCESS_TOKEN=your_token_here
```

#### Option B: Email & Password
```env
AID_EMAIL=your_email@example.com
AID_PASSWORD=your_password
```

Verify authentication:
```bash
npm run verify
```

---

## Architecture & File Structure

```text
AID-LLM-connector/
├── src/
│   ├── index.js         # Package entry point
│   ├── config.js        # Environment config & endpoint definitions
│   ├── auth.js          # Firebase authentication & token management
│   └── client.js        # Core AIDClient with GraphQL queries & mutations
├── scripts/
│   └── verify_auth.js   # Interactive connection & user verification tool
├── test/
│   └── test_connection.js # Connectivity and client unit tests
├── .env.example         # Environment template
├── package.json
└── README.md
```

---

## License

MIT (c) Randy Viosca
