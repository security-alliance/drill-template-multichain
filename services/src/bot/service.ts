import {
  BaseServiceV2,
  StandardOptions,
  ExpressRouter,
  Gauge,
  validators,
  waitForProvider,
} from '@eth-optimism/common-ts'
import { BigNumber, Signer, Wallet, ethers } from 'ethers'
import {
  USDCContract,
  OPUSDCContract,
  L1StandardBridge,
} from '../../lib/sealnet-lib/services'
import {
  setBalance,
  setERC20Balance,
} from '../../lib/sealnet-lib/utils/tenderly'
import { version } from '../../package.json'

type Options = {
  l1RpcProvider: ethers.providers.JsonRpcProvider
  l2RpcProvider: ethers.providers.JsonRpcProvider
  mnemonic: string
  l1FaucetKey: string
  l2FaucetKey: string
  sleepTimeMs: number
  numBots: number
  minimumL1EthBalance: string
  minimumL2EthBalance: string
  minimumL1UsdcBalance: string
  faucetL1EthAmount: string
  faucetL2EthAmount: string
  faucetL1UsdcAmount: string
  enableBridging: boolean
  enableL1Transfers: boolean
  enableL2Transfers: boolean
  minimumFaucetEthBalance: string
  targetFaucetEthBalance: string
  minimumFaucetUsdcBalance: string
  targetFaucetUsdcBalance: string
}

type Metrics = {
  nodeConnectionFailures: Gauge
  l1FaucetEthBalance: Gauge
  l2FaucetEthBalance: Gauge
  l1FaucetUsdcBalance: Gauge
  l2FaucetUsdcBalance: Gauge
  l1EthBalances: Gauge
  l2EthBalances: Gauge
  l1UsdcBalances: Gauge
  l2UsdcBalances: Gauge
  bridgeDepositsStatus: Gauge
}

type Bot = {
  l1Signer: Signer
  l2Signer: Signer
  l1EthBalance: BigNumber
  l2EthBalance: BigNumber
  l1UsdcBalance: BigNumber
  l2UsdcBalance: BigNumber
  address: string
  nickname: string
  l1UsdcContract: USDCContract
  l2UsdcContract: OPUSDCContract
  l1Bridge: L1StandardBridge
}

type State = {
  bots: Bot[]
  l1FaucetSigner: Wallet
  l2FaucetSigner: Wallet
}

interface BotAction {
  name: string
  execute: (bot: Bot) => Promise<void>
  isAvailable: (bot: Bot) => boolean
}

export class BridgeBot extends BaseServiceV2<Options, Metrics, State> {
  constructor(options?: Partial<Options & StandardOptions>) {
    super({
      version,
      name: 'bot',
      loop: true,
      options: {
        loopIntervalMs: 1000,
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
        mnemonic: {
          validator: validators.str,
          desc: 'Mnemonic for generating bot wallets',
        },
        l1FaucetKey: {
          validator: validators.str,
          desc: 'Private key for L1 faucet',
        },
        l2FaucetKey: {
          validator: validators.str,
          desc: 'Private key for L2 faucet',
        },
        numBots: {
          validator: validators.num,
          default: 5,
          desc: 'Number of bots to run',
        },
        sleepTimeMs: {
          validator: validators.num,
          default: 3000,
          desc: 'Time to sleep between loops',
        },
        minimumL1EthBalance: {
          validator: validators.str,
          default: '2.5',
          desc: 'Minimum L1 ETH balance',
        },
        minimumL2EthBalance: {
          validator: validators.str,
          default: '0.8',
          desc: 'Minimum L2 ETH balance',
        },
        minimumL1UsdcBalance: {
          validator: validators.str,
          default: '1000',
          desc: 'Minimum L1 USDC balance',
        },
        faucetL1EthAmount: {
          validator: validators.str,
          default: '3.2',
          desc: 'Amount of ETH to send from L1 faucet',
        },
        faucetL2EthAmount: {
          validator: validators.str,
          default: '1',
          desc: 'Amount of ETH to send from L2 faucet',
        },
        faucetL1UsdcAmount: {
          validator: validators.str,
          default: '2000',
          desc: 'Amount of USDC to send from L1 faucet',
        },
        enableBridging: {
          validator: validators.bool,
          default: true,
          desc: 'Enable ETH bridging',
        },
        enableL1Transfers: {
          validator: validators.bool,
          default: true,
          desc: 'Enable L1 transfers',
        },
        enableL2Transfers: {
          validator: validators.bool,
          default: true,
          desc: 'Enable L2 transfers',
        },
        minimumFaucetEthBalance: {
          validator: validators.str,
          default: '1000',
          desc: 'Minimum faucet balance in ETH before refill',
        },
        targetFaucetEthBalance: {
          validator: validators.str,
          default: '10000',
          desc: 'Target faucet balance in ETH when refilling',
        },
        minimumFaucetUsdcBalance: {
          validator: validators.str,
          default: '1000',
          desc: 'Minimum faucet balance in USDC before refill',
        },
        targetFaucetUsdcBalance: {
          validator: validators.str,
          default: '10000',
          desc: 'Target faucet balance in USDC when refilling',
        },
      },
      metricsSpec: {
        nodeConnectionFailures: {
          type: Gauge,
          desc: 'Number of node connection failures',
          labels: ['layer'],
        },
        l1FaucetEthBalance: {
          type: Gauge,
          desc: 'L1 faucet ETH balance',
        },
        l2FaucetEthBalance: {
          type: Gauge,
          desc: 'L2 faucet ETH balance',
        },
        l1FaucetUsdcBalance: {
          type: Gauge,
          desc: 'L1 faucet USDC balance',
        },
        l2FaucetUsdcBalance: {
          type: Gauge,
          desc: 'L2 faucet USDC balance',
        },
        l1EthBalances: {
          type: Gauge,
          desc: 'L1 ETH balances',
          labels: ['address', 'nickname'],
        },
        l2EthBalances: {
          type: Gauge,
          desc: 'L2 ETH balances',
          labels: ['address', 'nickname'],
        },
        l1UsdcBalances: {
          type: Gauge,
          desc: 'L1 USDC balances',
          labels: ['address', 'nickname'],
        },
        l2UsdcBalances: {
          type: Gauge,
          desc: 'L2 USDC balances',
          labels: ['address', 'nickname'],
        },
        bridgeDepositsStatus: {
          type: Gauge,
          desc: 'Bridge deposits status (1 = enabled, 0 = disabled)',
          labels: ['layer'],
        },
      },
    })
  }

  async init(): Promise<void> {
    // Wait for providers
    await waitForProvider(this.options.l1RpcProvider, {
      logger: this.logger,
      name: 'L1',
    })
    await waitForProvider(this.options.l2RpcProvider, {
      logger: this.logger,
      name: 'L2',
    })

    // Initialize faucet signers
    this.state.l1FaucetSigner = new Wallet(this.options.l1FaucetKey).connect(
      this.options.l1RpcProvider
    )
    this.state.l2FaucetSigner = new Wallet(this.options.l2FaucetKey).connect(
      this.options.l2RpcProvider
    )

    // Initialize bots
    this.state.bots = []
    for (let i = 0; i < this.options.numBots; i++) {
      const l1Signer = Wallet.fromMnemonic(
        this.options.mnemonic,
        `m/44'/60'/0'/0/${i}`
      ).connect(this.options.l1RpcProvider)

      const l2Signer = new Wallet(l1Signer.privateKey).connect(
        this.options.l2RpcProvider
      )

      this.state.bots.push({
        l1Signer,
        l2Signer,
        address: l1Signer.address,
        l1EthBalance: BigNumber.from(0),
        l2EthBalance: BigNumber.from(0),
        l1UsdcBalance: BigNumber.from(0),
        l2UsdcBalance: BigNumber.from(0),
        nickname: `Bot-${i}`,
        l1UsdcContract: new USDCContract(l1Signer),
        l2UsdcContract: new OPUSDCContract(l2Signer),
        l1Bridge: new L1StandardBridge(l1Signer),
      })
      console.log(`Initialized bot ${i} at address ${l1Signer.address}`)
    }
  }

  private botActions: BotAction[] = [
    {
      name: 'Bridge ETH to L2',
      execute: async (bot) => {
        const bridgeAmount = bot.l1EthBalance.div(4)
        console.log(
          `Bot ${bot.address} bridging ${ethers.utils.formatEther(
            bridgeAmount
          )} ETH to L2`
        )
        await bot.l1Bridge.bridgeETH(200000, bridgeAmount)
      },
      isAvailable: (bot) =>
        bot.l1EthBalance.gt(
          ethers.utils.parseEther(this.options.minimumL1EthBalance)
        ) && this.options.enableBridging,
    },
    {
      name: 'Bridge USDC to L2',
      execute: async (bot) => {
        const bridgeAmount = bot.l1UsdcBalance.div(4)
        console.log(
          `Bot ${bot.address} bridging ${ethers.utils.formatUnits(
            bridgeAmount,
            6
          )} USDC to L2`
        )
        await bot.l1UsdcContract.approve(bot.l1Bridge.address, bridgeAmount)
        await bot.l1Bridge.bridgeERC20(
          bot.l1UsdcContract.address,
          bot.l2UsdcContract.address,
          bridgeAmount,
          200000
        )
      },
      isAvailable: (bot) =>
        bot.l1UsdcBalance.gt(
          ethers.utils.parseUnits(this.options.minimumL1UsdcBalance, 6)
        ) && this.options.enableBridging,
    },
    {
      name: 'Transfer ETH on L1',
      execute: async (bot) => {
        const transferAmount = bot.l1EthBalance.div(4)
        const otherBot = this.state.bots.find((b) => b.address !== bot.address)
        if (otherBot) {
          console.log(
            `Bot ${bot.address} transferring ${ethers.utils.formatEther(
              transferAmount
            )} ETH to ${otherBot.address} on L1`
          )
          await bot.l1Signer.sendTransaction({
            to: otherBot.address,
            value: transferAmount,
          })
        }
      },
      isAvailable: (bot) =>
        bot.l1EthBalance.gt(
          ethers.utils.parseEther(this.options.minimumL1EthBalance)
        ) && this.options.enableL1Transfers,
    },
    {
      name: 'Transfer USDC on L1',
      execute: async (bot) => {
        const transferAmount = bot.l1UsdcBalance.div(4)
        const otherBot = this.state.bots.find((b) => b.address !== bot.address)
        if (otherBot) {
          console.log(
            `Bot ${bot.address} transferring ${ethers.utils.formatUnits(
              transferAmount,
              6
            )} USDC to ${otherBot.address} on L1`
          )
          await bot.l1UsdcContract.transfer(otherBot.address, transferAmount)
        }
      },
      isAvailable: (bot) =>
        bot.l1UsdcBalance.gt(
          ethers.utils.parseUnits(this.options.minimumL1UsdcBalance, 6)
        ) && this.options.enableL1Transfers,
    },
    {
      name: 'Transfer ETH on L2',
      execute: async (bot) => {
        const transferAmount = bot.l2EthBalance.div(4)
        const otherBot = this.state.bots.find((b) => b.address !== bot.address)
        if (otherBot) {
          console.log(
            `Bot ${bot.address} transferring ${ethers.utils.formatEther(
              transferAmount
            )} ETH to ${otherBot.address} on L2`
          )
          await bot.l2Signer.sendTransaction({
            to: otherBot.address,
            value: transferAmount,
          })
        }
      },
      isAvailable: (bot) =>
        bot.l2EthBalance.gt(
          ethers.utils.parseEther(this.options.minimumL2EthBalance)
        ) && this.options.enableL2Transfers,
    },
    {
      name: 'Transfer USDC on L2',
      execute: async (bot) => {
        const transferAmount = bot.l2UsdcBalance.div(4)
        const otherBot = this.state.bots.find((b) => b.address !== bot.address)
        if (otherBot) {
          console.log(
            `Bot ${bot.address} transferring ${ethers.utils.formatUnits(
              transferAmount,
              6
            )} USDC to ${otherBot.address} on L2`
          )
          await bot.l2UsdcContract.transfer(otherBot.address, transferAmount)
        }
      },
      isAvailable: (bot) =>
        bot.l2UsdcBalance.gt(0) && this.options.enableL2Transfers,
    },
  ]

  private async getAvailableActions(bot: Bot): Promise<BotAction[]> {
    return this.botActions.filter((action) => action.isAvailable(bot))
  }

  private async executeRandomAction(bot: Bot): Promise<void> {
    const availableActions = await this.getAvailableActions(bot)
    if (availableActions.length === 0) {
      console.log(`No actions available for bot ${bot.address}`)
      return
    }
    const randomAction =
      availableActions[Math.floor(Math.random() * availableActions.length)]
    console.log(`Executing action: ${randomAction.name}`)
    await randomAction.execute(bot)
  }

  private async ensureMinimumBalances(bot: Bot): Promise<void> {
    const minimumL1EthBalance = ethers.utils.parseEther(
      this.options.minimumL1EthBalance
    )
    const minimumL2EthBalance = ethers.utils.parseEther(
      this.options.minimumL2EthBalance
    )
    const minimumL1UsdcBalance = ethers.utils.parseUnits(
      this.options.minimumL1UsdcBalance,
      6
    )

    // Check and fund ETH balances
    if (bot.l1EthBalance.lt(minimumL1EthBalance)) {
      console.log(`Funding bot ${bot.address} with L1 ETH`)
      const tx = await this.state.l1FaucetSigner.sendTransaction({
        to: bot.address,
        value: ethers.utils.parseEther(this.options.faucetL1EthAmount),
      })
      await tx.wait()
    }

    if (bot.l2EthBalance.lt(minimumL2EthBalance)) {
      console.log(`Funding bot ${bot.address} with L2 ETH`)
      const tx = await this.state.l2FaucetSigner.sendTransaction({
        to: bot.address,
        value: ethers.utils.parseEther(this.options.faucetL2EthAmount),
      })
      await tx.wait()
    }

    // Check and fund USDC balances
    if (bot.l1UsdcBalance.lt(minimumL1UsdcBalance)) {
      console.log(`Funding bot ${bot.address} with L1 USDC`)
      const l1UsdcContract = new USDCContract(this.state.l1FaucetSigner)
      await l1UsdcContract.transfer(
        bot.address,
        ethers.utils.parseUnits(this.options.faucetL1UsdcAmount, 6)
      )
    }
  }

  private async trackBalances(): Promise<void> {
    // Track faucet ETH balances
    const l1FaucetEthBalance = await this.state.l1FaucetSigner.getBalance()
    const l2FaucetEthBalance = await this.state.l2FaucetSigner.getBalance()

    this.metrics.l1FaucetEthBalance.set(
      parseInt(l1FaucetEthBalance.toString(), 10)
    )
    this.metrics.l2FaucetEthBalance.set(
      parseInt(l2FaucetEthBalance.toString(), 10)
    )

    // Track faucet USDC balances
    const l1UsdcContract = new USDCContract(this.state.l1FaucetSigner)
    const l2UsdcContract = new OPUSDCContract(this.state.l2FaucetSigner)

    const l1FaucetUsdcBalance = await l1UsdcContract.getBalance(
      this.state.l1FaucetSigner.address
    )
    const l2FaucetUsdcBalance = await l2UsdcContract.getBalance(
      this.state.l2FaucetSigner.address
    )

    this.metrics.l1FaucetUsdcBalance.set(
      parseInt(l1FaucetUsdcBalance.toString(), 10)
    )
    this.metrics.l2FaucetUsdcBalance.set(
      parseInt(l2FaucetUsdcBalance.toString(), 10)
    )

    // Track bot balances
    for (const bot of this.state.bots) {
      bot.l1EthBalance = await bot.l1Signer.getBalance()
      bot.l2EthBalance = await bot.l2Signer.getBalance()
      bot.l1UsdcBalance = await bot.l1UsdcContract.getBalance(bot.address)
      bot.l2UsdcBalance = await bot.l2UsdcContract.getBalance(bot.address)

      // Update metrics
      this.metrics.l1EthBalances.set(
        { address: bot.address, nickname: bot.nickname },
        parseInt(bot.l1EthBalance.toString(), 10)
      )
      this.metrics.l2EthBalances.set(
        { address: bot.address, nickname: bot.nickname },
        parseInt(bot.l2EthBalance.toString(), 10)
      )
      this.metrics.l1UsdcBalances.set(
        { address: bot.address, nickname: bot.nickname },
        parseInt(bot.l1UsdcBalance.toString(), 10)
      )
      this.metrics.l2UsdcBalances.set(
        { address: bot.address, nickname: bot.nickname },
        parseInt(bot.l2UsdcBalance.toString(), 10)
      )
    }
  }

  private async ensureMinFaucetBalance(): Promise<void> {
    const minEthBalance = ethers.utils.parseEther(
      this.options.minimumFaucetEthBalance
    )
    const targetEthBalance = ethers.utils.parseEther(
      this.options.targetFaucetEthBalance
    )
    const minUsdcBalance = ethers.utils.parseUnits(
      this.options.minimumFaucetUsdcBalance,
      6
    )
    const targetUsdcBalance = ethers.utils.parseUnits(
      this.options.targetFaucetUsdcBalance,
      6
    )

    // Check and refill ETH balances
    const l1FaucetEthBalance = await this.state.l1FaucetSigner.getBalance()
    const l2FaucetEthBalance = await this.state.l2FaucetSigner.getBalance()

    if (l1FaucetEthBalance.lt(minEthBalance)) {
      console.log('Refilling L1 faucet ETH balance')
      await setBalance(
        this.options.l1RpcProvider,
        this.state.l1FaucetSigner.address,
        targetEthBalance
      )
    }

    if (l2FaucetEthBalance.lt(minEthBalance)) {
      console.log('Refilling L2 faucet ETH balance')
      await setBalance(
        this.options.l2RpcProvider,
        this.state.l2FaucetSigner.address,
        targetEthBalance
      )
    }

    // Check and refill USDC balances
    const l1UsdcContract = new USDCContract(this.state.l1FaucetSigner)
    const l2UsdcContract = new OPUSDCContract(this.state.l2FaucetSigner)

    const l1FaucetUsdcBalance = await l1UsdcContract.getBalance(
      this.state.l1FaucetSigner.address
    )
    const l2FaucetUsdcBalance = await l2UsdcContract.getBalance(
      this.state.l2FaucetSigner.address
    )

    if (l1FaucetUsdcBalance.lt(minUsdcBalance)) {
      console.log('Refilling L1 faucet USDC balance')
      await setERC20Balance(
        this.options.l1RpcProvider,
        l1UsdcContract.address,
        this.state.l1FaucetSigner.address,
        targetUsdcBalance
      )
    }

  }

  async main(): Promise<void> {
    await this.ensureMinFaucetBalance()

    await this.trackBalances()

    for (const bot of this.state.bots) {
      console.log('\nBot:', bot.nickname)
      console.log('----------------------------------------------------')
      console.log('Address:', bot.address)
      console.log('L1 ETH Balance:', ethers.utils.formatEther(bot.l1EthBalance))
      console.log('L2 ETH Balance:', ethers.utils.formatEther(bot.l2EthBalance))
      console.log(
        'L1 USDC Balance:',
        ethers.utils.formatUnits(bot.l1UsdcBalance, 6)
      )
      console.log(
        'L2 USDC Balance:',
        ethers.utils.formatUnits(bot.l2UsdcBalance, 6)
      )

      await this.ensureMinimumBalances(bot)
      await this.executeRandomAction(bot)
      console.log('----------------------------------------------------')
    }

    await new Promise((resolve) =>
      setTimeout(resolve, this.options.sleepTimeMs)
    )
  }

  async routes(router: ExpressRouter): Promise<void> {
    router.get('/healthz', async (req, res) => {
      return res.status(200).json({
        ok: true,
      })
    })

    router.get('/bots', async (req, res) => {
      return res.status(200).json({
        bots: this.state.bots.map((bot) => ({
          address: bot.address,
          nickname: bot.nickname,
          l1EthBalance: bot.l1EthBalance.toString(),
          l2EthBalance: bot.l2EthBalance.toString(),
          l1UsdcBalance: bot.l1UsdcBalance.toString(),
          l2UsdcBalance: bot.l2UsdcBalance.toString(),
        })),
      })
    })
  }
}

if (require.main === module) {
  const service = new BridgeBot()
  service.run()
}
