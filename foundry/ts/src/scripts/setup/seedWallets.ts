import { loadAllNetworkConfigs, loadWallets} from "../../lib";
import path from 'path'
import { seedWalletsForNetwork } from "../../lib/utils/wallets";

async function main() {
    let internal = false;
    if (process.env.INTERNAL === 'true') {
        internal = true;
    }
  console.log("Loading wallets and network configs...");
  
  console.log({internal})
  
  // Load wallets from project root
  const WALLET_FILE = path.join(process.cwd(), "wallets/generated-wallets.json");
  const wallets = loadWallets(WALLET_FILE);
  console.log(`Loaded ${wallets.length} wallets from ${WALLET_FILE}`);
  
  // Load network configs
  let networks = loadAllNetworkConfigs();
  
  // Filter for internal in slug name if internal enabled. Otherwise filter for not internal
  networks = networks.filter((network) => {
    if (internal) {
        return network.slug.includes('internal');
    } else {
        return !network.slug.includes('internal');
    }
  });

  console.log(`Loaded ${networks.length} network configs`);
  

  
  if (networks.length === 0) {
      console.error('No network configs found. Please ensure configs are present in the configs directory.');
      return;
  }

  // Amount to seed each wallet with
  const seedAmount = '1000';

  // Seed wallets for each network
  for (const network of networks) {
      await seedWalletsForNetwork(network, wallets, seedAmount);
  }

  console.log('\nWallet seeding complete!');
}

main().catch(console.error);

