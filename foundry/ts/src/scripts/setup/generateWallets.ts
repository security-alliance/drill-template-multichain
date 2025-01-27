import { generateWallets } from "../../lib";

async function main() {
    console.log("Generating wallets");
    const WALLET_FILE = "wallets/generated-wallets.json";
    // Generate wallets
    await generateWallets(100, WALLET_FILE);
    console.log("Wallets generated");
}

main().catch(console.error);
