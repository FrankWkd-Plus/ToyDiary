/**
 * Injective EVM 链上确权演示模块。
 *
 * 纯前端演示：私钥签名全部交给 MetaMask 处理，本模块不接触私钥、
 * 不落地存储交易记录、不做链上数据回读。
 */
import {
  createWalletClient,
  custom,
  defineChain,
  keccak256,
  toHex,
  type Address,
  type Hash,
} from 'viem'

declare global {
  interface Window {
    ethereum?: import('viem').EIP1193Provider
  }
}

export const injectiveTestnet = defineChain({
  id: 1439,
  name: 'Injective Testnet',
  nativeCurrency: { name: 'Injective', symbol: 'INJ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://k8s.testnet.json-rpc.injective.network/'] },
  },
  blockExplorers: {
    default: {
      name: 'InjectiveScan',
      url: 'https://testnet.blockscout.injective.network',
    },
  },
  testnet: true,
})

/**
 * 演示占位地址：尚未部署真实 SBT 合约。
 * 路演前必须替换为已部署的公开 SBT 合约地址。
 */
export const SBT_CONTRACT_ADDRESS: Address =
  '0x0000000000000000000000000000000000000000'

/**
 * 占位 ABI：假定合约暴露标准 `mint(to, dataHash)`。
 * 接入真实合约后请按实际函数签名调整。
 */
export const SBT_CONTRACT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'dataHash', type: 'bytes32' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const

function getEthereumProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('未检测到 MetaMask，请先安装浏览器插件')
  }
  return window.ethereum
}

function getWalletClient() {
  const provider = getEthereumProvider()
  return createWalletClient({
    chain: injectiveTestnet,
    transport: custom(provider),
  })
}

export async function requestAccount(): Promise<Address> {
  const client = getWalletClient()
  const [account] = await client.requestAddresses()
  if (!account) throw new Error('未获取到钱包账户')
  return account
}

/** 切换到 Injective 测试网，未添加则回退到添加网络 */
export async function ensureInjectiveNetwork(): Promise<void> {
  const provider = getEthereumProvider()
  const chainIdHex = `0x${injectiveTestnet.id.toString(16)}`
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (err) {
    const code = (err as { code?: number })?.code
    if (code !== 4902) throw err
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: injectiveTestnet.name,
          nativeCurrency: injectiveTestnet.nativeCurrency,
          rpcUrls: injectiveTestnet.rpcUrls.default.http,
          blockExplorerUrls: [injectiveTestnet.blockExplorers.default.url],
        },
      ],
    })
  }
}

/** 浏览器原生计算记录内容 hash（keccak256） */
export function computeRecordHash(payload: unknown): Hash {
  return keccak256(toHex(JSON.stringify(payload)))
}

export async function mintOwnershipSbt(params: {
  account: Address
  dataHash: Hash
}): Promise<Hash> {
  const client = getWalletClient()
  return client.writeContract({
    account: params.account,
    chain: injectiveTestnet,
    address: SBT_CONTRACT_ADDRESS,
    abi: SBT_CONTRACT_ABI,
    functionName: 'mint',
    args: [params.account, params.dataHash],
  })
}

export function buildExplorerTxUrl(hash: Hash): string {
  return `${injectiveTestnet.blockExplorers.default.url}/tx/${hash}`
}
