import { ethers } from 'ethers'
import { getL2StandardBridgeContract } from '../../contracts'
import { StandardBridgeContract } from './StandardBridge'

export class L2StandardBridge extends StandardBridgeContract {
    constructor(signer: ethers.Signer | ethers.providers.Provider) {
        super(getL2StandardBridgeContract(signer))
    }

}
