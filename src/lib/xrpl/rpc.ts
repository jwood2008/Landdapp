/**
 * Shared XRPL helper with local signing via the `xrpl` library.
 * All server-side XRPL calls should use this instead of hardcoded URLs.
 */
import { Client, Wallet, type SubmittableTransaction } from 'xrpl'

const MAINNET_WSS = [
  'wss://xrplcluster.com/',
  'wss://s1.ripple.com/',
  'wss://s2.ripple.com/',
]

const TESTNET_WSS = [
  'wss://s.altnet.rippletest.net:51233/',
  'wss://testnet.xrpl-labs.com/',
]

const MAINNET_RPCS = [
  'https://xrplcluster.com/',
  'https://s1.ripple.com:51234/',
  'https://s2.ripple.com:51234/',
]

const TESTNET_RPCS = [
  'https://s.altnet.rippletest.net:51234/',
  'https://testnet.xrpl-labs.com/',
  'https://clio.altnet.rippletest.net:51234/',
]

const TESTNET_FAUCETS = [
  'https://faucet.altnet.rippletest.net/accounts',
  'https://faucet.devnet.rippletest.net/accounts',
]

export function isTestnet() {
  return process.env.XRPL_NETWORK !== 'mainnet'
}

export function getNetwork() {
  return isTestnet() ? 'testnet' : 'mainnet'
}

function getRpcEndpoints() {
  return isTestnet() ? TESTNET_RPCS : MAINNET_RPCS
}

function getWssEndpoints() {
  return isTestnet() ? TESTNET_WSS : MAINNET_WSS
}

/**
 * Connect an xrpl Client, trying fallback WebSocket endpoints.
 * Caller must disconnect when done.
 */
async function connectClient(): Promise<Client> {
  const endpoints = getWssEndpoints()
  let lastError = ''

  for (const url of endpoints) {
    try {
      const client = new Client(url, { timeout: 15000 })
      await client.connect()
      return client
    } catch (err) {
      lastError = `${url}: ${err instanceof Error ? err.message : 'failed'}`
      continue
    }
  }

  throw new Error(`All XRPL ${getNetwork()} WebSocket endpoints failed. Last: ${lastError}`)
}

/**
 * Send a JSON-RPC request to XRPL, trying fallback endpoints on failure.
 */
export async function xrplRpc(
  method: string,
  params: Record<string, unknown>[] = [{}],
  timeoutMs = 15000
): Promise<Record<string, unknown>> {
  const endpoints = getRpcEndpoints()
  let lastError = ''

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!res.ok) {
        lastError = `${endpoint} returned HTTP ${res.status}`
        continue
      }

      const json = await res.json()
      if (json?.result !== undefined) {
        return json
      }

      lastError = `${endpoint} returned no result`
    } catch (err) {
      lastError = `${endpoint}: ${err instanceof Error ? err.message : 'failed'}`
      continue
    }
  }

  throw new Error(`All XRPL ${getNetwork()} endpoints failed. Last: ${lastError}`)
}

/**
 * Sign and submit a transaction using local signing (xrpl library).
 * Connects to XRPL, autofills Sequence/Fee/LastLedgerSequence, signs locally, submits.
 */
export async function xrplSignAndSubmit(
  secret: string,
  txJson: Record<string, unknown>
): Promise<{ hash: string; engineResult: string; success: boolean }> {
  const wallet = Wallet.fromSeed(secret)
  const client = await connectClient()

  try {
    // Autofill required fields (Sequence, Fee, LastLedgerSequence)
    const prepared = await client.autofill(txJson as unknown as SubmittableTransaction)

    // Sign locally — secret never leaves the server
    const { tx_blob, hash } = wallet.sign(prepared)

    // Submit the signed blob
    const response = await client.request({
      command: 'submit',
      tx_blob,
    })

    const engineResult = (response.result as Record<string, unknown>)?.engine_result as string ?? 'unknown'
    const success = engineResult === 'tesSUCCESS' || engineResult.startsWith('tes')

    return { hash, engineResult, success }
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/**
 * Generate a funded testnet wallet via faucet (tries multiple faucets).
 */
export async function generateTestnetWallet(): Promise<{ address: string; seed: string }> {
  let lastError = ''

  for (const faucetUrl of TESTNET_FAUCETS) {
    try {
      const res = await fetch(faucetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000),
      })

      if (!res.ok) {
        lastError = `${faucetUrl} returned ${res.status}`
        continue
      }

      const json = await res.json()
      const address = json?.account?.classicAddress ?? json?.account?.address
      const seed = json?.seed

      if (address && seed) {
        return { address, seed }
      }
      lastError = `${faucetUrl} returned invalid data`
    } catch (err) {
      lastError = `${faucetUrl}: ${err instanceof Error ? err.message : 'timeout'}`
      continue
    }
  }

  throw new Error(`All testnet faucets failed. Last: ${lastError}`)
}

/**
 * Generate a mainnet wallet locally (unfunded).
 */
export async function generateMainnetWallet(): Promise<{ address: string; seed: string }> {
  const wallet = Wallet.generate()
  if (!wallet.seed) throw new Error('Wallet generation failed — no seed')
  return { address: wallet.classicAddress, seed: wallet.seed }
}

/**
 * Generate an XRPL wallet (testnet or mainnet based on env).
 */
export async function generateWallet(): Promise<{ address: string; seed: string }> {
  return isTestnet() ? generateTestnetWallet() : generateMainnetWallet()
}
