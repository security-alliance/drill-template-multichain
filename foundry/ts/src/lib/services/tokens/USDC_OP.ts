import { ethers } from 'ethers'
import { getOPUSDCContract } from '../../contracts'
import { ERC20 } from './ERC20'

export class OPUSDCContract extends ERC20 {
    constructor(signer: ethers.providers.Provider | ethers.Signer) {
        super(getOPUSDCContract(signer))
    }
}
