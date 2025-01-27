import { ethers } from 'ethers'
import { getL1StandardBridgeContract } from '../../contracts'
import { StandardBridgeContract } from './StandardBridge'

export class L1StandardBridge extends StandardBridgeContract {
    constructor(signer: ethers.Signer | ethers.providers.Provider) {
        super(getL1StandardBridgeContract(signer))
    }

    async bridgeETH(minGasLimit: number, amount: ethers.BigNumberish, extraData: string = '0x'): Promise<ethers.providers.TransactionReceipt> {
        try {
            const tx = await this.contract.bridgeETH(minGasLimit, extraData, {
                value: amount,
            })
            console.log('ETH bridge transaction sent:', tx.hash)

            const receipt = await tx.wait()
            console.log('Transaction confirmed in block:', receipt.blockNumber)

            return receipt
        } catch (error) {
            console.error('Error bridging ETH:', error)
            throw error
        }
    }

    async bridgeETHTo(
        to: string,
        minGasLimit: number,
        amount: ethers.BigNumberish,
        extraData: string = '0x'
    ): Promise<ethers.providers.TransactionReceipt> {
        try {
            const tx = await this.contract.bridgeETHTo(to, minGasLimit, extraData, {
                value: amount,
            })
            console.log('ETH bridge transaction sent:', tx.hash)

            const receipt = await tx.wait()
            console.log('Transaction confirmed in block:', receipt.blockNumber)

            return receipt
        } catch (error) {
            console.error('Error bridging ETH:', error)
            throw error
        }
    }

    async bridgeERC20(
        localToken: string,
        remoteToken: string,
        amount: ethers.BigNumberish,
        minGasLimit: number,
        extraData: string = '0x'
    ): Promise<ethers.providers.TransactionReceipt> {
        try {
            const tx = await this.contract.bridgeERC20(localToken, remoteToken, amount, minGasLimit, extraData)
            console.log('ERC20 bridge transaction sent:', tx.hash)

            const receipt = await tx.wait()
            console.log('Transaction confirmed in block:', receipt.blockNumber)

            return receipt
        } catch (error) {
            console.error('Error bridging ERC20:', error)
            throw error
        }
    }

    async bridgeERC20To(
        localToken: string,
        remoteToken: string,
        to: string,
        amount: ethers.BigNumberish,
        minGasLimit: number,
        extraData: string = '0x'
    ): Promise<ethers.providers.TransactionReceipt> {
        try {
            const tx = await this.contract.bridgeERC20To(localToken, remoteToken, to, amount, minGasLimit, extraData)
            console.log('ERC20 bridge transaction sent:', tx.hash)

            const receipt = await tx.wait()
            console.log('Transaction confirmed in block:', receipt.blockNumber)

            return receipt
        } catch (error) {
            console.error('Error bridging ERC20:', error)
            throw error
        }
    }
}
