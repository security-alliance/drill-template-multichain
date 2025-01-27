import { ethers } from "ethers";

export interface BridgeEvent {
    from: string;
    to: string;
    amount: ethers.BigNumber;
    extraData: string;
    blockNumber: number;
    transactionHash: string;
}

export interface ERC20BridgeEvent extends BridgeEvent {
    localToken: string;
    remoteToken: string;
}

export class StandardBridgeContract {
    protected contract: ethers.Contract;
    
    public get address(): string {
        return this.contract.address;
    }

  constructor(contract: ethers.Contract) {
    this.contract = contract
  }

    async getETHBridgeInitiatedEvents(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
    ): Promise<BridgeEvent[]> {
        const filter = this.contract.filters.ETHBridgeInitiated();
        const logs = await this.contract.queryFilter(filter, fromBlock, toBlock);

        return logs
            .map(log => {
                try {
                    const event = this.contract.interface.parseLog(log);
                    if (event.name !== "ETHBridgeInitiated") return null;

                    const [from, to, amount, extraData] = event.args;
                    return {
                        from,
                        to,
                        amount,
                        extraData,
                        blockNumber: log.blockNumber,
                        transactionHash: log.transactionHash,
                    };
                } catch (e) {
                    console.warn("Failed to parse ETHBridgeInitiated event:", e);
                    return null;
                }
            })
            .filter((event): event is NonNullable<typeof event> => event !== null);
    }

    async getETHBridgeFinalizedEvents(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
    ): Promise<BridgeEvent[]> {
        const filter = this.contract.filters.ETHBridgeFinalized();
        const logs = await this.contract.queryFilter(filter, fromBlock, toBlock);

        return logs
            .map(log => {
                try {
                    const event = this.contract.interface.parseLog(log);
                    if (event.name !== "ETHBridgeFinalized") return null;

                    const [from, to, amount, extraData] = event.args;
                    return {
                        from,
                        to,
                        amount,
                        extraData,
                        blockNumber: log.blockNumber,
                        transactionHash: log.transactionHash,
                    };
                } catch (e) {
                    console.warn("Failed to parse ETHBridgeFinalized event:", e);
                    return null;
                }
            })
            .filter((event): event is NonNullable<typeof event> => event !== null);
    }

    async getERC20BridgeInitiatedEvents(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
    ): Promise<ERC20BridgeEvent[]> {
        const filter = this.contract.filters.ERC20BridgeInitiated();
        const logs = await this.contract.queryFilter(filter, fromBlock, toBlock);

        return logs
            .map(log => {
                try {
                    const event = this.contract.interface.parseLog(log);
                    if (event.name !== "ERC20BridgeInitiated") return null;

                    const [localToken, remoteToken, from, to, amount, extraData] = event.args;
                    return {
                        localToken,
                        remoteToken,
                        from,
                        to,
                        amount,
                        extraData,
                        blockNumber: log.blockNumber,
                        transactionHash: log.transactionHash,
                    };
                } catch (e) {
                    console.warn("Failed to parse ERC20BridgeInitiated event:", e);
                    return null;
                }
            })
            .filter((event): event is NonNullable<typeof event> => event !== null);
    }

    async getERC20BridgeFinalizedEvents(
        fromBlock: number,
        toBlock: number | "latest" = "latest",
    ): Promise<ERC20BridgeEvent[]> {
        const filter = this.contract.filters.ERC20BridgeFinalized();
        const logs = await this.contract.queryFilter(filter, fromBlock, toBlock);

        return logs
            .map(log => {
                try {
                    const event = this.contract.interface.parseLog(log);
                    if (event.name !== "ERC20BridgeFinalized") return null;

                    const [localToken, remoteToken, from, to, amount, extraData] = event.args;
                    return {
                        localToken,
                        remoteToken,
                        from,
                        to,
                        amount,
                        extraData,
                        blockNumber: log.blockNumber,
                        transactionHash: log.transactionHash,
                    };
                } catch (e) {
                    console.warn("Failed to parse ERC20BridgeFinalized event:", e);
                    return null;
                }
            })
            .filter((event): event is NonNullable<typeof event> => event !== null);
    }
}