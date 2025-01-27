import { ethers } from "ethers";
import { Provider } from "@ethersproject/abstract-provider";
import axios from "axios";

export async function setBalance(
    provider: ethers.providers.JsonRpcProvider,
    addresses: string[] | string,
    balance: ethers.BigNumber,
) {
    const balanceHex = balance.toHexString();
    // Strip leading 0 after 0x
    const balanceHexStripped = balanceHex.replace(/^0x0*/, "0x");
    await provider.send("tenderly_setBalance", [addresses, balanceHexStripped]);
}

export async function addBalance(
    provider: ethers.providers.JsonRpcProvider,
    addresses: string[] | string,
    balance: ethers.BigNumber,
) {
    const balanceHex = balance.toHexString();
    const balanceHexStripped = balanceHex.replace(/^0x0*/, "0x");
    await provider.send("tenderly_addBalance", [addresses, balanceHexStripped]);
}

export async function setERC20Balance(
    provider: ethers.providers.JsonRpcProvider,
    tokenAddress: string,
    address: string,
    balance: ethers.BigNumber,
) {
    const balanceHex = balance.toHexString();
    const balanceHexStripped = balanceHex.replace(/^0x0*/, "0x");
    await provider.send("tenderly_setErc20Balance", [
        tokenAddress,
        address,
        balanceHexStripped,
    ]);
}

export async function setCode(
  provider: ethers.providers.JsonRpcProvider,
  address: string,
  code: string,
) {
  await provider.send("tenderly_setCode", [address, code]);
}

export async function sendForkTxAs(
    provider: ethers.providers.JsonRpcProvider,
    tx: ethers.PopulatedTransaction,
    from: string,
) {
    const valueHex = tx.value ? tx.value.toHexString() : undefined;
    const valueHexStripped = valueHex ? valueHex.replace(/^0x0*/, "0x") : undefined;
    const params = {
        from,
        to: tx.to || undefined,
        gas: tx.gasLimit ? tx.gasLimit.toHexString() : undefined,
        gasPrice: tx.gasPrice ? tx.gasPrice.toHexString() : undefined,
        value: valueHexStripped,
        data: tx.data || undefined,
    };
    const result = await provider.send("eth_sendTransaction", [params]);
    return result;
}

export const getCurrentBlockTimestamp = async (provider: Provider) => {
    const block = await provider.getBlock("latest");
    const currentBlockTimestamp = block.timestamp;
    return currentBlockTimestamp;
};

// Example Response

interface VnetResponse {
    id: string;
    slug: string;
    display_name: string;
    fork_config: {
        network_id: number;
        block_number: string;
    };
    virtual_network_config: {
        chain_config: {
            chain_id: number;
        };
    };
    sync_state_config: {
        enabled: boolean;
    };
    explorer_page_config: {
        enabled: boolean;
        verification_visibility: "src" | "bytecode" | "abi";
    };
    rpcs: {
        url: string;
        name: "Admin RPC" | "Public RPC";
    }[];
}

interface CreateVnetResponse {
    id: string;
    slug: string;
    display_name: string;
    adminRpcUrl: string;
    publicRpcUrl: string;
}

export const createVnet = async (
    name: string,
    slug: string,
    networkId: number,
    blockNumber: string,
): Promise<CreateVnetResponse> => {
    const accountSlug = process.env.TENDERLY_ACCOUNT_SLUG;
    const projectSlug = process.env.TENDERLY_PROJECT_SLUG;
    const accessKey = process.env.TENDERLY_ACCESS_TOKEN;
    
    if (!accountSlug || !projectSlug || !accessKey) {
        throw new Error("TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG, or TENDERLY_ACCESS_TOKEN is not set");
    }

    // const blockNumberHex = ethers.utils.hexlify(blockNumber);
    const blockNumberHex = blockNumber
    console.log("Creating VNet with block number: ", blockNumberHex);
    const options = {
        method: "POST",
        url: `https://api.tenderly.co/api/v1/account/${accountSlug}/project/${projectSlug}/vnets`,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Access-Key": accessKey,
        },
        data: {
            slug: slug,
            display_name: name,
            fork_config: {
                network_id: networkId,
                block_number: blockNumberHex,
            },
            virtual_network_config: { chain_config: { chain_id: networkId } },
            sync_state_config: { enabled: false },
            explorer_page_config: {
                enabled: true,
                verification_visibility: "src",
            },
        },
    };

    try {
        const response = await axios.request(options);
        const data: VnetResponse = response.data;
        console.log(data);
        return {
            id: data.id,
            slug: data.slug,
            display_name: data.display_name,
            adminRpcUrl: data.rpcs.find((rpc) => rpc.name === "Admin RPC")?.url,
            publicRpcUrl: data.rpcs.find((rpc) => rpc.name === "Public RPC")
                ?.url,
        };
    } catch (error) {
        console.error(error);
        throw error;
    }
};
