import { ethers } from 'ethers'
import { getWETHContract } from '../../contracts'
import { ERC20 } from './ERC20'

export class WethContract extends ERC20 {

  constructor(signer: ethers.providers.Provider | ethers.Signer) {
    super(getWETHContract(signer))
  }

  async wrap(
    amount: ethers.BigNumberish
  ): Promise<ethers.providers.TransactionReceipt> {
    try {
      const tx = await this.contract.deposit({ value: amount })
      console.log('Wrap transaction sent:', tx.hash)

      const receipt = await tx.wait()
      console.log('Transaction confirmed in block:', receipt.blockNumber)

      return receipt
    } catch (error) {
      console.error('Error wrapping ETH:', error)
      throw error
    }
  }

  async unwrap(
    amount: ethers.BigNumberish
  ): Promise<ethers.providers.TransactionReceipt> {
    try {
      const tx = await this.contract.withdraw(amount)
      console.log('Unwrap transaction sent:', tx.hash)

      const receipt = await tx.wait()
      console.log('Transaction confirmed in block:', receipt.blockNumber)

      return receipt
    } catch (error) {
      console.error('Error unwrapping WETH:', error)
      throw error
    }
  }

}
