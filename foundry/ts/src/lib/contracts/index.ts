import { ethers } from 'ethers'
import L2_CROSS_DOMAIN_MESSENGER_ABI from './L2CrossDomainMessenger.json'
import L1StandardBridgeAbi from './L1StandardBridge.json'
import L2StandardBridgeAbi from './L2StandardBridge.json'
import L1_CROSS_DOMAIN_MESSENGER_ABI from './L1CrossDomainMessenger.json'
import {
    L1_CROSS_DOMAIN_MESSENGER_ADDRESS,
    L2_CROSS_DOMAIN_MESSENGER_ADDRESS,
    OP_L1_STANDARD_BRIDGE_ADDRESS,
    OP_L2_STANDARD_BRIDGE_ADDRESS,
    OP_USDC_E_ADDRESS,
    OP_WETH_ADDRESS,
    USDC_ADDRESS,
    WETH_ADDRESS,
} from '../config/constants'

// Export ABIs
export const ERC20_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
]

export const WETH_ABI = [...ERC20_ABI, 'function deposit() payable returns (bool)', 'function withdraw(uint256 wad) returns (bool)']

export function getL2CrossDomainMessengerContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(L2_CROSS_DOMAIN_MESSENGER_ADDRESS, L2_CROSS_DOMAIN_MESSENGER_ABI, signerOrProvider)
}

export function getL1CrossDomainMessengerContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(L1_CROSS_DOMAIN_MESSENGER_ADDRESS, L1_CROSS_DOMAIN_MESSENGER_ABI, signerOrProvider)
}

export function getL1StandardBridgeContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(OP_L1_STANDARD_BRIDGE_ADDRESS, L1StandardBridgeAbi, signerOrProvider)
}

export function getL2StandardBridgeContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(OP_L2_STANDARD_BRIDGE_ADDRESS, L2StandardBridgeAbi, signerOrProvider)
}

export function getWETHContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(WETH_ADDRESS, WETH_ABI, signerOrProvider)
}

export function getOPWETHContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(OP_WETH_ADDRESS, WETH_ABI, signerOrProvider)
}

export function getUSDCContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signerOrProvider)
}

export function getOPUSDCContract(signerOrProvider: ethers.Signer | ethers.providers.Provider) {
    return new ethers.Contract(OP_USDC_E_ADDRESS, ERC20_ABI, signerOrProvider)
}
