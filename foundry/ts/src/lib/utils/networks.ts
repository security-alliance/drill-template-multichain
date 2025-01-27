import { ethers } from "ethers";
import { createVnet } from "./tenderly";
import fs from 'fs';
import path from 'path';

export interface NetworkConfig {
    name: string;
    slug: string;
    chainId: number;
    blockNumber: string;
    adminRpcUrl: string;
    publicRpcUrl: string;
    timestamp?: number;
    validationData?: {
        confirmedChainId: number;
        confirmedBlockNumber: number;
    };
}

export interface TestnetConfig {
    name: string;
    slug: string;
    internal: boolean;
}

// Network generation function
export async function generateNetwork(
    name: string,
    slug: string,
    chainId: number,
    blockNumber: string
): Promise<NetworkConfig> {
    // Create vnet
    const vnet = await createVnet(name, slug, chainId, blockNumber);
    
    // Validate the network
    const provider = new ethers.providers.JsonRpcProvider(vnet.publicRpcUrl);
    const block = await provider.getBlock(blockNumber);
    const network = await provider.getNetwork();

    // Return config object
    return {
        name: vnet.display_name,
        slug,
        chainId,
        blockNumber,
        adminRpcUrl: vnet.adminRpcUrl,
        publicRpcUrl: vnet.publicRpcUrl,
        timestamp: Date.now(),
        validationData: {
            confirmedChainId: network.chainId,
            confirmedBlockNumber: block.number
        }
    };
}

// Configuration saving function
export function saveNetworkConfig(config: NetworkConfig): void {
    // Create configs directory if it doesn't exist
    const configsDir = path.join(process.cwd(), 'network_configs');
    if (!fs.existsSync(configsDir)) {
        fs.mkdirSync(configsDir, { recursive: true });
    }

    // Save config to file
    const configPath = path.join(configsDir, `${config.slug}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log(`Network configuration saved to: ${configPath}`);
    console.log('Configuration details:');
    console.log(`- Name: ${config.name}`);
    console.log(`- Admin RPC URL: ${config.adminRpcUrl}`);
    console.log(`- Public RPC URL: ${config.publicRpcUrl}`);
    console.log(`- Chain ID: ${config.chainId}`);
    console.log(`- Block Number: ${config.blockNumber}`);
}

// Configuration loading function
export function loadNetworkConfig(slug: string): NetworkConfig | null {
    try {
        const configPath = path.join(process.cwd(), 'network_configs', `${slug}.json`);
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error(`Error loading config for ${slug}:`, error);
        return null;
    }
}

// Load all network configs from the configs directory
export function loadAllNetworkConfigs(): NetworkConfig[] {
  const configsDir = path.join(process.cwd(), 'network_configs');
  if (!fs.existsSync(configsDir)) {
      console.log('No configs directory found');
      return [];
  }

  const configs: NetworkConfig[] = [];
  const configFiles = fs.readdirSync(configsDir)
      .filter(file => file.endsWith('.json'));

  for (const file of configFiles) {
      try {
          const configPath = path.join(configsDir, file);
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData);
          configs.push(config);
      } catch (error) {
          console.error(`Error loading config file ${file}:`, error);
      }
  }

  return configs;
}

export function formatTestnetConfig(network: string): TestnetConfig {
    const testnetName = process.env.TESTNET_NAME;
    if (!testnetName) {
        throw new Error("TESTNET_NAME not set in environment");
    }

    const internal = process.env.INTERNAL === 'true';
    const formattedTestnetName = testnetName.toLowerCase().replace(/\s+/g, '-');
    const networkSlug = network.toLowerCase();
    
    return {
        name: internal 
            ? `${testnetName} ${network} Internal Testnet` 
            : `${testnetName} ${network} Testnet`,
        slug: internal 
            ? `${formattedTestnetName}-${networkSlug}-internal-testnet` 
            : `${formattedTestnetName}-${networkSlug}-testnet`,
        internal
    };
}