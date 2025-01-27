import { ethers } from 'ethers'
import { getOPWETHContract } from '../../contracts' // Assuming you have this function
import { WethContract } from './WETH'

export class L2WethContract extends WethContract {
  constructor(signer: ethers.providers.Provider | ethers.Signer) {
    super(signer)
    this.contract = getOPWETHContract(signer)
  }
} 