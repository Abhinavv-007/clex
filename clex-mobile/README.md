# Clex Mobile — Android

Native Android application for the Clex file workspace.
Kotlin + Jetpack Compose · Exact behavioral parity with the web product.

## Module Structure

```
app/                   # Application entry point
core/
  design/              # ClexTheme, color tokens (tokens.css mirror), typography
  model/               # Domain types — all web contracts in Kotlin
  network/             # SignalingClient (OkHttp WS), ChainClient
  storage/             # DataStore (theme, chain-id), Room (Vault)
  transfer/            # WebRtcTransfer, TransferStateMachine
feature/
  workspace/           # Files → Prepare → Share panels
  receive/             # Code entry, QR, connection, save flows
  vault/               # Vault file browser
  chain/               # Chain ID, stats, sessions
  explore/             # Chapterized home/features/how-it-works/faq
  legal/               # Privacy, Terms
  tool-runtime/        # All 7 tools + golden fixture harness
```

## Key Parity Contracts

- Room code: 6-char uppercase alphanumeric
- Data channel label: `clex-transfer`  
- Chunk size: 64 KB  
- Receive link: `https://clex.in/receive?code=ABC123&mode=webrtc` (primary)
- Chain ID: 32 hex chars from 16 random bytes
- Theme default: dark (DataStore key `clex-theme-dark`)

## Building

```bash
cd clex-mobile
./gradlew assembleDebug
```

## Running tests

```bash
./gradlew test   # unit tests (all modules)
./gradlew :feature:tool-runtime:test  # golden fixture tests only
```
