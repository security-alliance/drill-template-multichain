# Multichain Drill Infrastructure

A framework for conducting cross-chain incident response drills, focusing on Ethereum L1 and Optimism L2 interactions.

## Motivation

DeFi protocols increasingly operate across multiple chains, making incident response more complex. When incidents occur, responders often need to coordinate actions across both L1 and L2 chains simultaneously.

This project provides infrastructure to:
- Set up realistic test environments across chains
- Simulate user activities including bridging and transfers
- Monitor and relay cross-chain messages
- Track bridge transactions and volume

## Architecture

### Test Networks
- Configurable forks of Ethereum mainnet and Optimism
- Uses Tenderly Virtual Testnets for testing environments (could be extended to use Anvil)
- Maintains state consistency across both chains

### Components

1. **Message Relayer**
   - Monitors L1 CrossDomainMessenger for events
   - Relays messages to L2
   - Handles message passing between chains

2. **User Simulation Bots**
   - Simulates bridging operations
   - Performs ERC20 and ETH transfers
   - Operates on both L1 and L2

3. **Monitoring Service**
   - Tracks bridge transactions
   - Measures transaction volume
   - Provides metrics for drill evaluation

## Limitations

- Currently only supports L1 → L2 deposits and transactions
- Withdrawals (L2 → L1) not yet implemented
- Assumes normal rollup operation

## Architecture Details

### Message Passing
- Follows [Optimism's deposit specification](https://specs.optimism.io/protocol/deposits.html#execution)
- Uses CrossDomainMessenger contracts for cross-chain communication
- Maintains message ordering and consistency

### Monitoring
- Tracks bridge events on both chains
- Compares transaction data with mainnet
- Provides real-time metrics

## Setup

### Prerequisites
- Node.js >= 20
- Docker
- Foundry
- Tenderly API access

### Installation

#### Install dependencies

```bash
cd foundry
pnpm install
cd ..
cd services
pnpm install
```




## Repository Structure

```
├── foundry/           
│   ├── src/           # Smart contracts
│   └── ts/          
│       ├── lib/          # Shared libraries
│       └── scripts/      # Deployment and management scripts
|   
├── services/          # Backend services
│   └── src/          
│       ├── message-relayer/     # Message relayer service
│       ├── bot/                 # User simulation bots
│       └── monitor/             # Monitoring service
|   
└── monitoring/          # Monitoring service
    └── compose.yaml      # Docker compose file for monitoring service with Grafana and Prometheus
```

## License

MIT


