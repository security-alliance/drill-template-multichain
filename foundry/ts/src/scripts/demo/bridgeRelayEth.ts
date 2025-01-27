import { ethers } from "ethers";
import { setBalance, loadNetworkConfig } from "../../lib";
import {
    getSentMessageFromTx,
    hashCrossDomainMessageV1,
    relayL1Message,
    L1StandardBridge
} from "../../lib/services/optimism";
import { formatTestnetConfig } from "../../lib";

async function main() {
    // Get network configs using utility function
    const mainnetConfig = formatTestnetConfig('Mainnet');
    const optimismConfig = formatTestnetConfig('Optimism');

    // Load network configs
    const mainnetNetworkConfig = loadNetworkConfig(mainnetConfig.slug);
    const optimismNetworkConfig = loadNetworkConfig(optimismConfig.slug);

    if (!mainnetNetworkConfig || !optimismNetworkConfig) {
        throw new Error("Network configurations not found. Please run configure scripts first.");
    }

    const mainnetProvider = new ethers.providers.JsonRpcProvider(mainnetNetworkConfig.adminRpcUrl);
    const optimismProvider = new ethers.providers.JsonRpcProvider(optimismNetworkConfig.adminRpcUrl);

    // Create the signer and connect it to the provider
    const signerMainnet = ethers.Wallet.createRandom().connect(mainnetProvider);
    const signerOptimism = new ethers.Wallet(signerMainnet.privateKey, optimismProvider);
    
    const l1Bridge = new L1StandardBridge(signerMainnet);

    // Set initial balance on L1
    const initialBalance = ethers.utils.parseEther("10");
    await setBalance(
        mainnetProvider,
        [signerMainnet.address],
        initialBalance
    );
    console.log("Set initial L1 balance:", ethers.utils.formatEther(initialBalance), "ETH");

    // Bridge ETH to L2
    const bridgeAmount = ethers.utils.parseEther("5");
    const minGasLimit = 200000; // Adjust as needed
    const bridgeReceipt = await l1Bridge.bridgeETH(
        minGasLimit,
        bridgeAmount
    );
    console.log("Bridged ETH to L2. Transaction:", bridgeReceipt.transactionHash);

    // Get and log the sent message details
    const sentMessage = await getSentMessageFromTx(
        mainnetProvider,
        bridgeReceipt.transactionHash
    );
    if (sentMessage) {
        console.log("\nSent Message Details:");
        console.log("Target:", sentMessage.target);
        console.log("Sender:", sentMessage.sender);
        console.log("Message:", sentMessage.message);
        console.log("Message Nonce:", sentMessage.messageNonce);
        console.log("Gas Limit:", sentMessage.gasLimit);
        console.log("Value:", sentMessage.value);

        const messageHash = hashCrossDomainMessageV1(
            sentMessage.messageNonce,
            sentMessage.sender,
            sentMessage.target,
            sentMessage.value,
            sentMessage.gasLimit,
            sentMessage.message
        );

        console.log("Message Hash:", messageHash);
        
        // Check if we should skip relay
        if (process.env.SKIP_RELAY === 'true') {
            console.log("\nSkipping message relay due to SKIP_RELAY=true");
            return;
        }
        
        // Relay the message on Optimism
        console.log("\nRelaying message to Optimism...");
        const relayReceipt = await relayL1Message(
            optimismProvider,
            sentMessage.sender,
            sentMessage.target,
            sentMessage.message,
            sentMessage.messageNonce,
            sentMessage.value,
            sentMessage.gasLimit,
        );

        console.log(
            "Message relayed on Optimism in block:",
            relayReceipt.blockNumber
        );
        
        // Check L2 ETH balance
        const l2Balance = await optimismProvider.getBalance(signerOptimism.address);
        console.log("L2 ETH Balance:", ethers.utils.formatEther(l2Balance));
    } else {
        console.log("No SentMessage event found");
    }
}

main().catch(console.error); 