import { ethers } from 'ethers'

export class ERC20 {
  protected contract: ethers.Contract

  public get address(): string {
    return this.contract.address
  }

  constructor(contract: ethers.Contract) {
    this.contract = contract
  }

  async getTotalSupply(): Promise<ethers.BigNumber> {
    return await this.contract.totalSupply()
  }

  async getBalance(account: string): Promise<ethers.BigNumber> {
    return await this.contract.balanceOf(account)
  }

  async transfer(
    to: string,
    amount: ethers.BigNumberish
  ): Promise<ethers.providers.TransactionReceipt> {
    try {
      const tx = await this.contract.transfer(to, amount)
      console.log('Transfer transaction sent:', tx.hash)

      const receipt = await tx.wait()
      console.log('Transaction confirmed in block:', receipt.blockNumber)

      return receipt
    } catch (error) {
      console.error('Error transferring tokens:', error)
      throw error
    }
  }

  async approve(
    spender: string,
    amount: ethers.BigNumberish
  ): Promise<ethers.providers.TransactionReceipt> {
    try {
      const tx = await this.contract.approve(spender, amount)
      console.log('Approval transaction sent:', tx.hash)

      const receipt = await tx.wait()
      console.log('Transaction confirmed in block:', receipt.blockNumber)

      return receipt
    } catch (error) {
      console.error('Error approving tokens:', error)
      throw error
    }
  }
}
