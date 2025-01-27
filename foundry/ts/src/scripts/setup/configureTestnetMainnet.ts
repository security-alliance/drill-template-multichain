import { generateNetwork, saveNetworkConfig, loadNetworkConfig, formatTestnetConfig } from "../../lib";


// Example usage
async function main() {
    const config = formatTestnetConfig('Mainnet');
    const chainId = 1; // Mainnet
    const blockNumber = process.env.L1_START_BLOCK;

    try {
        // Generate network
        console.log('Generating network...');
        const networkConfig = await generateNetwork(
            config.name,
            config.slug,
            chainId,
            blockNumber
        );
        
        // Save configuration
        console.log('Saving configuration...');
        saveNetworkConfig(networkConfig);
        
        // Load and verify configuration
        console.log('\nVerifying saved configuration...');
        const loadedConfig = loadNetworkConfig(config.slug);
        if (loadedConfig) {
            console.log('Successfully loaded saved configuration');
        }
    } catch (error) {
        console.error('Error in main:', error);
    }
}

main().catch(console.error);