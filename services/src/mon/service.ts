import {
  BaseServiceV2,
  StandardOptions,
  ExpressRouter,
  Gauge,
  validators,
  waitForProvider,
} from '@eth-optimism/common-ts'
import { ethers } from 'ethers'
import { L1StandardBridge, L2StandardBridge } from '../../lib/sealnet-lib/services'
import { version } from '../../package.json'

type Options = {
  l1RpcProvider: ethers.providers.JsonRpcProvider
  l2RpcProvider: ethers.providers.JsonRpcProvider
  sleepTimeMs: number
  l1StartBlock: number
  l2StartBlock: number
}

type Metrics = {
  nodeConnectionFailures: Gauge
  l1EthBridgeInitiated: Gauge
  l1Erc20BridgeInitiated: Gauge
  l2EthBridgeFinalized: Gauge
  l2Erc20BridgeFinalized: Gauge
  lastScannedL1Block: Gauge
  bridgeVolume: Gauge
}

type State = {
  l1Bridge: L1StandardBridge
  l2Bridge: L2StandardBridge
  lastScannedL1Block: number
  lastScannedL2Block: number
}

export class BridgeMonitor extends BaseServiceV2<Options, Metrics, State> {
  constructor(options?: Partial<Options & StandardOptions>) {
    super({
      version,
      name: 'bridge-monitor',
      loop: true,
      options: {
        loopIntervalMs: 1000,
        sleepTimeMs: 3000,
        ...options,
      },
      optionsSpec: {
        l1RpcProvider: {
          validator: validators.provider,
          desc: 'Provider for L1',
        },
        l2RpcProvider: {
          validator: validators.provider,
          desc: 'Provider for L2',
        },
        sleepTimeMs: {
          validator: validators.num,
          default: 3000,
          desc: 'Time to sleep between loops',
        },
        l1StartBlock: {
          validator: validators.num,
          desc: 'Start block for L1 scanning',
        },
        l2StartBlock: {
          validator: validators.num,
          desc: 'Start block for L2 scanning',
        },
      },
      metricsSpec: {
        nodeConnectionFailures: {
          type: Gauge,
          desc: 'Number of node connection failures',
          labels: ['layer'],
        },
        l1EthBridgeInitiated: {
          type: Gauge,
          desc: 'Number of ETH bridge initiations on L1',
        },
        l1Erc20BridgeInitiated: {
          type: Gauge,
          desc: 'Number of ERC20 bridge initiations on L1',
          labels: ['localToken', 'remoteToken'],
        },
        l2EthBridgeFinalized: {
          type: Gauge,
          desc: 'Number of ETH bridge finalizations on L2',
        },
        l2Erc20BridgeFinalized: {
          type: Gauge,
          desc: 'Number of ERC20 bridge finalizations on L2',
          labels: ['localToken', 'remoteToken'],
        },
        lastScannedL1Block: {
          type: Gauge,
          desc: 'Last L1 block scanned',
        },
        // lastScannedL2Block: {
        //   type: Gauge,
        //   desc: 'Last L2 block scanned',
        // },
        bridgeVolume: {
          type: Gauge,
          desc: 'Volume of assets bridged',
          labels: ['type', 'direction', 'token'],
        },
      },
    })
  }

  async init(): Promise<void> {
    await waitForProvider(this.options.l1RpcProvider, {
      logger: this.logger,
      name: 'L1',
    })
    await waitForProvider(this.options.l2RpcProvider, {
      logger: this.logger,
      name: 'L2',
    })

    this.state.l1Bridge = new L1StandardBridge(this.options.l1RpcProvider)
    this.state.l2Bridge = new L2StandardBridge(this.options.l2RpcProvider)
    this.state.lastScannedL1Block = this.options.l1StartBlock
    this.state.lastScannedL2Block = this.options.l2StartBlock

    await this.indexHistoricalEvents()
  }

  private async indexHistoricalEvents(): Promise<void> {
    this.logger.info('Indexing historical bridge events...')
    
    const [latestL1Block, latestL2Block] = await Promise.all([
      this.options.l1RpcProvider.getBlockNumber(),
      this.options.l2RpcProvider.getBlockNumber()
    ])

    // Get L1 events using StandardBridge methods
    const [l1EthEvents, l1Erc20Events] = await Promise.all([
      this.state.l1Bridge.getETHBridgeInitiatedEvents(
        this.state.lastScannedL1Block,
        latestL1Block
      ),
      this.state.l1Bridge.getERC20BridgeInitiatedEvents(
        this.state.lastScannedL1Block,
        latestL1Block
      )
    ])

    // Get L2 events using StandardBridge methods
    const [l2EthEvents, l2Erc20Events] = await Promise.all([
      this.state.l2Bridge.getETHBridgeFinalizedEvents(
        this.state.lastScannedL2Block,
        latestL2Block
      ),
      this.state.l2Bridge.getERC20BridgeFinalizedEvents(
        this.state.lastScannedL2Block,
        latestL2Block
      )
    ])

    this.logger.info('Found historical bridge events', {
      l1EthInitiated: l1EthEvents.length,
      l1Erc20Initiated: l1Erc20Events.length,
      l2EthFinalized: l2EthEvents.length,
      l2Erc20Finalized: l2Erc20Events.length,
    })

    // Update ETH metrics
    this.metrics.l1EthBridgeInitiated.set(l1EthEvents.length)
    this.metrics.l2EthBridgeFinalized.set(l2EthEvents.length)

    // Update ERC20 metrics with token addresses
    const l1Erc20Counts = new Map<string, number>()
    const l2Erc20Counts = new Map<string, number>()

    l1Erc20Events.forEach(event => {
      const key = `${event.localToken}-${event.remoteToken}`
      l1Erc20Counts.set(key, (l1Erc20Counts.get(key) || 0) + 1)
      this.metrics.bridgeVolume.set(
        { type: 'erc20', direction: 'l1-to-l2', token: event.localToken },
        parseInt(event.amount.toString(), 10)
      )
    })

    l2Erc20Events.forEach(event => {
      const key = `${event.localToken}-${event.remoteToken}`
      l2Erc20Counts.set(key, (l2Erc20Counts.get(key) || 0) + 1)
      this.metrics.bridgeVolume.set(
        { type: 'erc20', direction: 'l2-finalized', token: event.localToken },
        parseInt(event.amount.toString(), 10)
      )
    })

    // Update ETH volume metrics
    l1EthEvents.forEach(event => {
      this.metrics.bridgeVolume.inc(
        { type: 'eth', direction: 'l1-to-l2', token: 'eth' },
        parseInt(event.amount.toString(), 10)
      )
    })

    l2EthEvents.forEach(event => {
      this.metrics.bridgeVolume.inc(
        { type: 'eth', direction: 'l2-finalized', token: 'eth' },
        parseInt(event.amount.toString(), 10)
      )
    })

    // Set ERC20 metrics for each token pair
    l1Erc20Counts.forEach((count, key) => {
      const [localToken, remoteToken] = key.split('-')
      this.metrics.l1Erc20BridgeInitiated.set({ localToken, remoteToken }, count)
    })

    l2Erc20Counts.forEach((count, key) => {
      const [localToken, remoteToken] = key.split('-')
      this.metrics.l2Erc20BridgeFinalized.set({ localToken, remoteToken }, count)
    })
    
    this.state.lastScannedL1Block = latestL1Block
    this.state.lastScannedL2Block = latestL2Block
    
    this.metrics.lastScannedL1Block.set(latestL1Block)
    // this.metrics.lastScannedL2Block.set(latestL2Block)
  }

  private async checkNewEvents(): Promise<void> {
    try {
      const [latestL1Block, latestL2Block] = await Promise.all([
        this.options.l1RpcProvider.getBlockNumber(),
        this.options.l2RpcProvider.getBlockNumber()
      ])

      // Check L1 events
      if (latestL1Block > this.state.lastScannedL1Block) {
        const [newL1EthEvents, newL1Erc20Events] = await Promise.all([
          this.state.l1Bridge.getETHBridgeInitiatedEvents(
            this.state.lastScannedL1Block + 1,
            latestL1Block
          ),
          this.state.l1Bridge.getERC20BridgeInitiatedEvents(
            this.state.lastScannedL1Block + 1,
            latestL1Block
          )
        ])

        if (newL1EthEvents.length > 0 || newL1Erc20Events.length > 0) {
          this.logger.info('Found new L1 events', {
            ethEvents: newL1EthEvents.length,
            erc20Events: newL1Erc20Events.length
          })

          this.metrics.l1EthBridgeInitiated.inc(newL1EthEvents.length)
          
          // Update ERC20 metrics and volumes
          newL1Erc20Events.forEach(event => {
            this.metrics.l1Erc20BridgeInitiated.inc({ 
              localToken: event.localToken, 
              remoteToken: event.remoteToken 
            })
            this.metrics.bridgeVolume.inc(
              { type: 'erc20', direction: 'l1-to-l2', token: event.localToken },
              parseInt(event.amount.toString(), 10)
            )
          })

          // Update ETH volumes
          newL1EthEvents.forEach(event => {
            this.metrics.bridgeVolume.inc(
              { type: 'eth', direction: 'l1-to-l2', token: 'eth' },
              parseInt(event.amount.toString(), 10)
            )
          })
        }

        this.state.lastScannedL1Block = latestL1Block
        this.metrics.lastScannedL1Block.set(latestL1Block)
      } else {
        this.logger.info('No new L1 events found')
      }

      // Check L2 events
      if (latestL2Block > this.state.lastScannedL2Block) {
        const [newL2EthEvents, newL2Erc20Events] = await Promise.all([
          this.state.l2Bridge.getETHBridgeFinalizedEvents(
            this.state.lastScannedL2Block + 1,
            latestL2Block
          ),
          this.state.l2Bridge.getERC20BridgeFinalizedEvents(
            this.state.lastScannedL2Block + 1,
            latestL2Block
          )
        ])

        if (newL2EthEvents.length > 0 || newL2Erc20Events.length > 0) {
          this.logger.info('Found new L2 events', {
            ethEvents: newL2EthEvents.length,
            erc20Events: newL2Erc20Events.length
          })

          this.metrics.l2EthBridgeFinalized.inc(newL2EthEvents.length)
          
          // Update ERC20 metrics and volumes
          newL2Erc20Events.forEach(event => {
            this.metrics.l2Erc20BridgeFinalized.inc({ 
              localToken: event.localToken, 
              remoteToken: event.remoteToken 
            })
            this.metrics.bridgeVolume.inc(
              { type: 'erc20', direction: 'l2-finalized', token: event.localToken },
              parseInt(event.amount.toString(), 10)
            )
          })

          // Update ETH volumes
          newL2EthEvents.forEach(event => {
            this.metrics.bridgeVolume.inc(
              { type: 'eth', direction: 'l2-finalized', token: 'eth' },
              parseInt(event.amount.toString(), 10)
            )
          })
        }

        this.state.lastScannedL2Block = latestL2Block
        // this.metrics.lastScannedL2Block.set(latestL2Block)
      } else {
        this.logger.info('No new L2 events found')
      }
    } catch (error) {
      this.logger.error('Error checking new events', { error })
      this.metrics.nodeConnectionFailures.inc({ layer: 'unknown' })
    }
  }

  async main(): Promise<void> {
    this.logger.info('--------------------------------')
    this.logger.info(`Tracking Bridge Metrics at ${new Date().toISOString()}`)
    await this.checkNewEvents()
    await new Promise((resolve) => setTimeout(resolve, this.options.sleepTimeMs))
  }

  async routes(router: ExpressRouter): Promise<void> {
    router.get('/healthz', async (req, res) => {
      return res.status(200).json({ ok: true })
    })

    router.get('/metrics', async (req, res) => {
      return res.status(200).json({
        lastScannedL1Block: this.state.lastScannedL1Block,
        lastScannedL2Block: this.state.lastScannedL2Block,
        metrics: {
          l1EthBridgeInitiated: await this.metrics.l1EthBridgeInitiated.get(),
          l2EthBridgeFinalized: await this.metrics.l2EthBridgeFinalized.get(),
          bridgeVolume: await this.metrics.bridgeVolume.get(),
          erc20Metrics: {
            l1Initiated: await this.metrics.l1Erc20BridgeInitiated.get(),
            l2Finalized: await this.metrics.l2Erc20BridgeFinalized.get(),
          }
        }
      })
    })
  }
}

if (require.main === module) {
  const service = new BridgeMonitor()
  service.run()
}