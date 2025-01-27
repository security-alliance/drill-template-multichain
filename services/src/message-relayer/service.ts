import {
  BaseServiceV2,
  StandardOptions,
  ExpressRouter,
  Gauge,
  validators,
  waitForProvider,
} from '@eth-optimism/common-ts'
import { ethers } from 'ethers'

import { version } from '../../package.json'
import { getSentMessageEvents, getRelayedMessageEvents, relayL1Message } from '../../lib/sealnet-lib/services/optimism'
import { L1_MESSENGER_ADDRESS_ALIAS } from '../../lib/sealnet-lib/config/constants'
import { setBalance } from '../../lib/sealnet-lib/utils/tenderly'

type Options = {
  l1RpcProvider: ethers.providers.JsonRpcProvider
  l2RpcProvider: ethers.providers.JsonRpcProvider
  l1StartBlock: number
  l2StartBlock: number
  sleepTimeMs: number
  minimumMessengerBalance: string
  targetMessengerBalance: string
}

type Metrics = {
  nodeConnectionFailures: Gauge
  messagesSent: Gauge
  messagesRelayed: Gauge
  pendingMessages: Gauge
  messengerBalance: Gauge
}

type Message = {
  messageHash: string
  sender: string
  target: string
  message: string
  messageNonce: string
  gasLimit: number
  value: ethers.BigNumber
  blockNumber: number
  transactionHash: string
  timestamp: number
  isRelayed: boolean
}

type State = {
  messageQueue: Map<string, Message> // messageHash -> Message
  lastScannedL1Block: number
  lastScannedL2Block: number
}

export class MessageRelayerService extends BaseServiceV2<Options, Metrics, State> {
  constructor(options?: Partial<Options & StandardOptions>) {
    super({
      version,
      name: 'message-relayer',
      loop: true,
      options: {
        loopIntervalMs: 1000,
        ...options,
      },
      optionsSpec: {
        l1RpcProvider: {
          validator: validators.jsonRpcProvider,
          desc: 'Provider for L1',
        },
        l2RpcProvider: {
          validator: validators.jsonRpcProvider,
          desc: 'Provider for L2',
        },
        l1StartBlock: {
          validator: validators.num,
          default: 0,
          desc: 'L1 block to start indexing from',
        },
        l2StartBlock: {
          validator: validators.num,
          default: 0,
          desc: 'L2 block to start indexing from',
        },
        sleepTimeMs: {
          validator: validators.num,
          default: 15000,
          desc: 'Time to sleep between loops',
        },
        minimumMessengerBalance: {
          validator: validators.str,
          default: '100',
          desc: 'Minimum messenger balance in ETH before refill',
        },
        targetMessengerBalance: {
          validator: validators.str,
          default: '1000',
          desc: 'Target messenger balance in ETH when refilling',
        },
      },
      metricsSpec: {
        nodeConnectionFailures: {
          type: Gauge,
          desc: 'Number of times node connection has failed',
          labels: ['layer', 'section'],
        },
        messagesSent: {
          type: Gauge,
          desc: 'Number of messages sent from L1 to L2',
        },
        messagesRelayed: {
          type: Gauge,
          desc: 'Number of messages relayed on L2',
        },
        pendingMessages: {
          type: Gauge,
          desc: 'Number of messages pending relay',
        },
        messengerBalance: {
          type: Gauge,
          desc: 'L2 messenger ETH balance',
        },
      },
    })
  }

  async init(): Promise<void> {
    // Initialize message queue
    this.state.messageQueue = new Map<string, Message>()

    // Connect to L1 and L2
    await waitForProvider(this.options.l1RpcProvider, {
      logger: this.logger,
      name: 'L1',
    })
    await waitForProvider(this.options.l2RpcProvider, {
      logger: this.logger,
      name: 'L2',
    })

    // Initialize metrics
    this.metrics.messagesSent.set(0)
    this.metrics.messagesRelayed.set(0)
    this.metrics.pendingMessages.set(0)

    // Initialize last scanned blocks
    this.state.lastScannedL1Block = this.options.l1StartBlock;
    this.state.lastScannedL2Block = this.options.l2StartBlock;

    // Initialize RPC providers

    // Initialize historical messages
    await this.indexHistoricalMessages();
  }

  private async indexHistoricalMessages(): Promise<void> {
    console.log('Indexing historical messages...');
    
    // Get latest block numbers at the start
    const latestL1Block = await this.options.l1RpcProvider.getBlockNumber();
    const latestL2Block = await this.options.l2RpcProvider.getBlockNumber();
    
    // Get sent messages from L1 using the captured block number
    const sentMessages = await getSentMessageEvents(
        this.options.l1RpcProvider,
        this.options.l1StartBlock,
        latestL1Block
    );
    
    console.log('Found', sentMessages.length, 'sent messages');

    // Add messages to queue
    for (const msg of sentMessages) {
        const timestamp = (await this.options.l1RpcProvider.getBlock(msg.blockNumber)).timestamp;
        this.state.messageQueue.set(msg.messageHash, {
            ...msg,
            timestamp,
            isRelayed: false
        });
        this.metrics.messagesSent.inc();
        console.log('Added message', msg.messageHash, 'to queue');
    }

    this.state.lastScannedL1Block = latestL1Block;
    console.log('Finished indexing historical sent messages');

    // Check for already relayed messages using the captured L2 block
    const relayedHashes = await getRelayedMessageEvents(
        this.options.l2RpcProvider,
        this.options.l2StartBlock,
        latestL2Block
    );

    console.log('Found', relayedHashes.length, 'relayed messages');

    // Mark messages as relayed
    for (const hash of relayedHashes) {
        const message = this.state.messageQueue.get(hash);
        if (message) {
            message.isRelayed = true;
            this.metrics.messagesRelayed.inc();
            console.log('Marked message', hash, 'as relayed');
        }
    }

    this.state.lastScannedL2Block = latestL2Block;
    console.log('Finished indexing historical relayed messages');
  }

  private async indexNewMessages(): Promise<void> {
    const latestL1Block = await this.options.l1RpcProvider.getBlockNumber();
    
    if (latestL1Block > this.state.lastScannedL1Block) {
    console.log('Scanning for new messages from L1 block', this.state.lastScannedL1Block, 'to', latestL1Block);
        const newMessages = await getSentMessageEvents(
            this.options.l1RpcProvider,
            this.state.lastScannedL1Block + 1,
            latestL1Block
        );

        console.log('Found', newMessages.length, 'new messages');

        for (const msg of newMessages) {
            const timestamp = (await this.options.l1RpcProvider.getBlock(msg.blockNumber)).timestamp;
            this.state.messageQueue.set(msg.messageHash, {
                ...msg,
                timestamp,
                isRelayed: false
            });
            this.metrics.messagesSent.inc();
            console.log('Added message', msg.messageHash, 'to queue');
        }

        this.state.lastScannedL1Block = latestL1Block;
    } else {
        console.log('No new messages found');
    }
  }

  private async checkRelayedMessages(): Promise<void> {
    const latestL2Block = await this.options.l2RpcProvider.getBlockNumber();
    
    
    if (latestL2Block > this.state.lastScannedL2Block) {
    console.log('Scanning for new relayed messages from L2 block', this.state.lastScannedL2Block, 'to', latestL2Block);
        const newRelayedHashes = await getRelayedMessageEvents(
            this.options.l2RpcProvider,
            this.state.lastScannedL2Block + 1,
            latestL2Block
        );

        console.log('Found', newRelayedHashes.length, 'new relayed messages');

        for (const hash of newRelayedHashes) {
            const message = this.state.messageQueue.get(hash);
            if (message && !message.isRelayed) {
                console.log('Marking message', hash, 'as relayed');
                message.isRelayed = true;
                this.metrics.messagesRelayed.inc();
                this.metrics.pendingMessages.dec();
            }
        }

        this.state.lastScannedL2Block = latestL2Block;
    } else {
        console.log('No new relayed messages found');
    }
  }

  private async relayPendingMessages(): Promise<void> {
    for (const [messageHash, message] of this.state.messageQueue.entries()) {
        if (!message.isRelayed) {
            try {
                console.log(`Attempting to relay message ${messageHash}`);
                
                const relayReceipt = await relayL1Message(
                    this.options.l2RpcProvider,
                    message.sender,
                    message.target,
                    message.message,
                    message.messageNonce,
                    message.value,
                    message.gasLimit
                );

                console.log(`Message relayed in block: ${relayReceipt.blockNumber}`);
                
                message.isRelayed = true;
                this.metrics.messagesRelayed.inc();
                this.metrics.pendingMessages.dec();
            } catch (error) {
                console.error(`Failed to relay message ${messageHash}:`, error);
            }
        }
    }
  }

  private updateMetrics(): void {
    let pendingCount = 0
    for (const message of this.state.messageQueue.values()) {
      if (!message.isRelayed) {
        pendingCount++
      }
    }
    this.metrics.pendingMessages.set(pendingCount)
  }

  private async ensureMessengerBalance(): Promise<void> {
    const minBalance = ethers.utils.parseEther(this.options.minimumMessengerBalance)
    const targetBalance = ethers.utils.parseEther(this.options.targetMessengerBalance)

    const messengerBalance = await this.options.l2RpcProvider.getBalance(L1_MESSENGER_ADDRESS_ALIAS)
    console.log('L2 messenger balance:', messengerBalance.toString())
    this.metrics.messengerBalance.set(parseInt(messengerBalance.toString(), 10))

    if (messengerBalance.lt(minBalance)) {
      console.log('Refilling L2 messenger balance')
      await setBalance(
        this.options.l2RpcProvider,
        L1_MESSENGER_ADDRESS_ALIAS,
        targetBalance
      )
    }
  }

  async main(): Promise<void> {
    // Ensure messenger has enough balance
    // await this.ensureMessengerBalance()

    // Index new messages from L1
    await this.indexNewMessages()

    // Check for relayed messages on L2
    await this.checkRelayedMessages()

    // Attempt to relay pending messages
    await this.relayPendingMessages()

    // Update metrics
    this.updateMetrics()

    // Sleep before next iteration
    await new Promise(resolve => setTimeout(resolve, this.options.sleepTimeMs))
  }

  async routes(router: ExpressRouter): Promise<void> {
    router.get('/healthz', async (req, res) => {
      return res.status(200).json({
        ok: true,
        synced: true,
        pendingMessages: this.state.messageQueue.size,
      })
    })

    router.get('/messages', async (req, res) => {
      return res.status(200).json({
        messages: Array.from(this.state.messageQueue.values()),
      })
    })
  }
}

if (require.main === module) {
  const service = new MessageRelayerService()
  service.run()
}