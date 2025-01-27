import { ethers } from "ethers";
import { getL2CrossDomainMessengerContract, getL1CrossDomainMessengerContract } from "../../contracts";
import { sendForkTxAs, setBalance } from "../../utils/tenderly";
import { L1_MESSENGER_ADDRESS_ALIAS} from "../../config/constants";

// Domain identifiers for training

// Helper function to apply L1-to-L2 address aliasing
function applyL1ToL2Alias(l1Address: string): string {
    const offset = BigInt("0x1111000000000000000000000000000000001111");
    return ethers.utils.getAddress(
        "0x" + (BigInt(l1Address) + offset).toString(16)
    );
}

export async function relayL1Message(
    provider: ethers.providers.JsonRpcProvider,
    l1Sender: string,
    target: string,
    message: string,
    nonce: string | ethers.BigNumber,
    value: ethers.BigNumber = ethers.constants.Zero,
    minGasLimit: number = 5000000
) {
    const l2CrossDomainMessengerContract = getL2CrossDomainMessengerContract(provider);

    // Create versioned nonce (version 1)
    const versionedNonce = ethers.BigNumber.from(1)
        .shl(240)
        .or(ethers.BigNumber.from(nonce));

    try {
        // If value is not 0, set the balance of the L1 messenger address
        if (!value.isZero()) {
            await setBalance(
                provider,
                L1_MESSENGER_ADDRESS_ALIAS,
                value
            );
            console.log(`Set L1 messenger balance to ${ethers.utils.formatEther(value)} ETH`);
        }

        // Populate the transaction data
        const tx = await l2CrossDomainMessengerContract.populateTransaction.relayMessage(
            versionedNonce,  // Nonce with version 1
            l1Sender,        // L1 sender address
            target,          // Target contract address
            value,           // ETH value
            minGasLimit,     // Gas limit
            message         // Encoded message
        );

        // Add the value to the transaction object if it's not zero
        if (!value.isZero()) {
            tx.value = value;
        }

        // Send the transaction as the L1 messenger
        const txHash = await sendForkTxAs(
            provider,
            tx,
            L1_MESSENGER_ADDRESS_ALIAS
        );

        console.log("Relay message transaction sent:", txHash);
        const receipt = await provider.getTransactionReceipt(txHash);
        console.log("Transaction confirmed in block:", receipt.blockNumber);
        
        return receipt;
    } catch (error) {
        console.error("Error relaying message:", error);
        throw error;
    }
}

export async function getSentMessageFromTx(
    provider: ethers.providers.JsonRpcProvider,
    txHash: string
): Promise<{
    target: string;
    sender: string;
    message: string;
    messageNonce: string;
    gasLimit: number;
    value: ethers.BigNumber;
} | null> {
    const l1CrossDomainMessenger = getL1CrossDomainMessengerContract(provider);
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
        throw new Error("Transaction not found");
    }

    // Filter logs for SentMessage events from L1CrossDomainMessenger
    const sentMessageEvents = receipt.logs
        .filter(log => log.address.toLowerCase() === l1CrossDomainMessenger.address.toLowerCase())
        .map(log => {
            try {
                return l1CrossDomainMessenger.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        });

    const sentMessageEvent = sentMessageEvents.find(event => event?.name === "SentMessage");
    const sentMessageExtensionEvent = sentMessageEvents.find(event => event?.name === "SentMessageExtension1");

    if (!sentMessageEvent) {
        return null;
    }

    return {
        target: sentMessageEvent.args.target,
        sender: sentMessageEvent.args.sender,
        message: sentMessageEvent.args.message,
        messageNonce: sentMessageEvent.args.messageNonce.toString(),
        gasLimit: sentMessageEvent.args.gasLimit.toNumber(),
        value: sentMessageExtensionEvent ? sentMessageExtensionEvent.args.value : ethers.constants.Zero,
    };
}

/**
 * Encodes a cross domain message based on the V1 (current) encoding.
 */
export function encodeCrossDomainMessageV1(
    nonce: string | ethers.BigNumber,
    sender: string,
    target: string,
    value: ethers.BigNumber,
    gasLimit: number,
    data: string
): string {
    const messageInterface = new ethers.utils.Interface([
        "function relayMessage(uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data)"
    ]);

    return messageInterface.encodeFunctionData("relayMessage", [
        nonce,
        sender,
        target,
        value,
        gasLimit,
        data
    ]);
}

/**
 * Hashes a cross domain message based on the V1 (current) encoding.
 */
export function hashCrossDomainMessageV1(
    nonce: string | ethers.BigNumber,
    sender: string,
    target: string,
    value: ethers.BigNumber,
    gasLimit: number,
    data: string
): string {
    const encodedMessage = encodeCrossDomainMessageV1(
        nonce,
        sender,
        target,
        value,
        gasLimit,
        data
    );
    
    return ethers.utils.keccak256(encodedMessage);
}

/**
 * Get SentMessage events from L1CrossDomainMessenger contract
 */
export async function getSentMessageEvents(
    provider: ethers.providers.Provider,
    fromBlock: number,
    toBlock: number | 'latest' = 'latest'
): Promise<{
    messageHash: string;
    sender: string;
    target: string;
    message: string;
    messageNonce: string;
    gasLimit: number;
    value: ethers.BigNumber;
    blockNumber: number;
    transactionHash: string;
}[]> {
    const l1CrossDomainMessenger = getL1CrossDomainMessengerContract(provider);
    const sentMessageFilter = l1CrossDomainMessenger.filters.SentMessage();
    const extensionFilter = l1CrossDomainMessenger.filters.SentMessageExtension1();
    
    const [sentMessageEvents, extensionEvents] = await Promise.all([
        l1CrossDomainMessenger.queryFilter(sentMessageFilter, fromBlock, toBlock),
        l1CrossDomainMessenger.queryFilter(extensionFilter, fromBlock, toBlock)
    ]);

    return Promise.all(sentMessageEvents.map(async (event) => {
        // Find matching extension event by transaction hash
        const extensionEvent = extensionEvents.find(ext => ext.transactionHash === event.transactionHash);
        
        // Validate sender matches if extension event exists
        if (extensionEvent && extensionEvent.args.sender.toLowerCase() !== event.args.sender.toLowerCase()) {
            throw new Error(`Sender mismatch in transaction ${event.transactionHash}: SentMessage sender ${event.args.sender} != SentMessageExtension1 sender ${extensionEvent.args.sender}`);
        }

        const value = extensionEvent ? extensionEvent.args.value : ethers.constants.Zero;

        const messageHash = hashCrossDomainMessageV1(
            event.args.messageNonce,
            event.args.sender,
            event.args.target,
            value,
            event.args.gasLimit,
            event.args.message
        );

        return {
            messageHash,
            sender: event.args.sender,
            target: event.args.target,
            message: event.args.message,
            messageNonce: event.args.messageNonce.toString(),
            gasLimit: event.args.gasLimit.toNumber(),
            value,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
        };
    }));
}

/**
 * Get RelayedMessage events from L2CrossDomainMessenger contract
 */
export async function getRelayedMessageEvents(
    provider: ethers.providers.Provider,
    fromBlock: number,
    toBlock: number | 'latest' = 'latest'
): Promise<string[]> {
    const l2CrossDomainMessenger = getL2CrossDomainMessengerContract(provider);
    const filter = l2CrossDomainMessenger.filters.RelayedMessage();
    const events = await l2CrossDomainMessenger.queryFilter(filter, fromBlock, toBlock);
    
    return events.map(event => event.args.msgHash);
}