import { ethers } from 'ethers'
import { getUSDCContract} from '../../contracts'
import { ERC20 } from './ERC20'

export class USDCContract extends ERC20 {

  constructor(signer: ethers.providers.Provider | ethers.Signer) {
    super(getUSDCContract(signer))
  }


}
