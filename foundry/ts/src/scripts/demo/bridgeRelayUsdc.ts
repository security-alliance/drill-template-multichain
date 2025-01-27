import { ethers } from 'ethers'
import { setBalance, setERC20Balance, loadNetworkConfig } from '../../lib'
import { USDCContract, OPUSDCContract } from '../../lib'
import { getSentMessageFromTx, hashCrossDomainMessageV1, relayL1Message, L1StandardBridge } from '../../lib'
import { formatTestnetConfig } from '../../lib'

async function main() {
    // Get network configs using utility function
    const mainnetConfig = formatTestnetConfig('Mainnet')
    const optimismConfig = formatTestnetConfig('Optimism')

    // Load network configs
    const mainnetNetworkConfig = loadNetworkConfig(mainnetConfig.slug)
    const optimismNetworkConfig = loadNetworkConfig(optimismConfig.slug)

    if (!mainnetNetworkConfig || !optimismNetworkConfig) {
        throw new Error('Network configurations not found. Please run configure scripts first.')
    }

    const mainnetProvider = new ethers.providers.JsonRpcProvider(mainnetNetworkConfig.adminRpcUrl)
    const optimismProvider = new ethers.providers.JsonRpcProvider(optimismNetworkConfig.adminRpcUrl)

    // Create the signer and connect it to the provider
    const signerMainnet = ethers.Wallet.createRandom().connect(mainnetProvider)
    const signerOptimism = new ethers.Wallet(signerMainnet.privateKey, optimismProvider)

    const usdcContract = new USDCContract(signerMainnet)
    const l2UsdcContract = new OPUSDCContract(signerOptimism)
    const l1Bridge = new L1StandardBridge(signerMainnet)

    // Set ETH balance for gas on both networks
    await setBalance(mainnetProvider, [signerMainnet.address], ethers.utils.parseEther('1'))
    console.log('Set initial ETH balance for L1:', signerMainnet.address)

    await setBalance(optimismProvider, [signerOptimism.address], ethers.utils.parseEther('1'))
    console.log('Set initial ETH balance for L2:', signerOptimism.address)

    // Set USDC balance on L1
    const usdcAmount = ethers.utils.parseUnits('1000', 6) // USDC has 6 decimals
    await setERC20Balance(mainnetProvider, usdcContract.address, signerMainnet.address, usdcAmount)
    console.log('Set initial USDC balance:', ethers.utils.formatUnits(usdcAmount, 6))

    // Approve USDC for bridge
    const approveReceipt = await usdcContract.approve(l1Bridge.address, usdcAmount)
    console.log('Approved USDC for bridge. Transaction:', approveReceipt.transactionHash)

    // Bridge USDC to L2
    const minGasLimit = 200000 // Adjust as needed
    const bridgeReceipt = await l1Bridge.bridgeERC20(usdcContract.address, l2UsdcContract.address, usdcAmount, minGasLimit)
    console.log('Bridged USDC to L2. Transaction:', bridgeReceipt.transactionHash)

    // Get and log the sent message details
    const sentMessage = await getSentMessageFromTx(mainnetProvider, bridgeReceipt.transactionHash)
    if (sentMessage) {
        console.log('\nSent Message Details:')
        console.log('Target:', sentMessage.target)
        console.log('Sender:', sentMessage.sender)
        console.log('Message:', sentMessage.message)
        console.log('Message Nonce:', sentMessage.messageNonce)
        console.log('Gas Limit:', sentMessage.gasLimit)

        const messageHash = hashCrossDomainMessageV1(
            sentMessage.messageNonce,
            sentMessage.sender,
            sentMessage.target,
            ethers.constants.Zero,
            sentMessage.gasLimit,
            sentMessage.message
        )

        console.log('Message Hash:', messageHash)

        // Check if we should skip relay
        if (process.env.SKIP_RELAY === 'true') {
            console.log('\nSkipping message relay due to SKIP_RELAY=true')
            return
        }

        // Relay the message on Optimism
        console.log('\nRelaying message to Optimism...')
        const relayReceipt = await relayL1Message(
            optimismProvider,
            sentMessage.sender,
            sentMessage.target,
            sentMessage.message,
            sentMessage.messageNonce,
            ethers.constants.Zero,
            sentMessage.gasLimit
        )

        console.log('Message relayed on Optimism in block:', relayReceipt.blockNumber)

        // Check L2 USDC balance
        const l2Balance = await l2UsdcContract.getBalance(signerOptimism.address)
        console.log('L2 USDC Balance:', ethers.utils.formatUnits(l2Balance, 6))
    } else {
        console.log('No SentMessage event found')
    }
}

main().catch(console.error)
