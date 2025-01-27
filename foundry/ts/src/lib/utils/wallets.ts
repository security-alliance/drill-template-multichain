import { ethers, Wallet } from 'ethers'
import fs from 'fs'
import path from 'path'
import { setBalance } from './tenderly'
import { NetworkConfig } from './networks'

interface WalletData {
  address: string
  privateKey: string
}

export async function generateWallets(count: number, outputPath: string): Promise<void> {
  const wallets: WalletData[] = []

  for (let i = 0; i < count; i++) {
    const wallet = Wallet.createRandom()
    wallets.push({
      address: await wallet.getAddress(),
      privateKey: wallet.privateKey,
    })
  }

  // Create directory if it doesn't exist
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Save to file
  fs.writeFileSync(outputPath, JSON.stringify(wallets, null, 2))
  console.log(`Generated ${count} wallets and saved to ${outputPath}`)
}

export function loadWallets(filePath: string): WalletData[] {
  try {
    const data = fs.readFileSync(filePath, 'utf8')
    const wallets: WalletData[] = JSON.parse(data)
    console.log(`Loaded ${wallets.length} wallets from ${filePath}`)
    return wallets
  } catch (error) {
    console.error('Error loading wallets:', error)
    return []
  }
}

export async function seedWalletsForNetwork(
  network: NetworkConfig,
  wallets: { address: string }[],
  amount: string
): Promise<void> {
  console.log(`\nSeeding wallets for network: ${network.name}`);
  
  const provider = new ethers.providers.JsonRpcProvider(network.adminRpcUrl);
  const addresses = wallets.map(wallet => wallet.address);

  try {
      await setBalance(provider, addresses, ethers.utils.parseEther(amount));
      console.log(`Set balance of ${amount} ETH for ${addresses.length} wallets`);

  } catch (error) {
      console.error(`Error seeding wallets for network ${network.name}:`, error);
  }
}
