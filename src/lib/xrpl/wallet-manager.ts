import { createClient } from '@supabase/supabase-js'
import { encryptSeed, decryptSeed } from '@/lib/crypto/wallet-encryption'
import { Client, Wallet } from 'xrpl'

const XRPL_WS_MAINNET = 'wss://xrplcluster.com/'
const XRPL_WS_TESTNET = 'wss://testnet.xrpl-labs.com'

// JSON-RPC fallback for submit-only (no signing)
const XRPL_RPC_MAINNET = 'https://xrplcluster.com/'
const XRPL_RPC_TESTNET = 'https://testnet.xrpl-labs.com/'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TESTNET_FAUCET = 'https://faucet.altnet.rippletest.net/accounts'

function isTestnet(): boolean {
  return process.env.XRPL_NETWORK !== 'mainnet'
}

/**
 * Get a connected XRPL client. Caller must disconnect when done.
 */
async function getXrplClient(): Promise<Client> {
  const wsUrl = isTestnet() ? XRPL_WS_TESTNET : XRPL_WS_MAINNET
  const client = new Client(wsUrl, { connectionTimeout: 15000 })
  await client.connect()
  return client
}

/**
 * Generate a new XRPL wallet.
 *
 * TESTNET: Uses the testnet faucet which both generates keys AND funds
 * the wallet with test XRP so it's immediately active on the ledger.
 *
 * MAINNET: Uses xrpl.js Wallet.generate(). The wallet must be
 * funded separately (e.g. via MoonPay or manual transfer).
 */
async function generateXrplWallet(): Promise<{ address: string; seed: string }> {
  if (isTestnet()) {
    // Testnet faucet: generates AND funds the wallet in one call
    const res = await fetch(TESTNET_FAUCET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) throw new Error(`XRPL testnet faucet failed: ${res.status}`)
    const json = await res.json()

    const address = json?.account?.classicAddress ?? json?.account?.address
    const seed = json?.seed

    if (!address || !seed) {
      throw new Error('XRPL testnet faucet returned invalid result')
    }

    return { address, seed }
  }

  // Mainnet: generate locally with xrpl.js
  const wallet = Wallet.generate()
  return {
    address: wallet.address,
    seed: wallet.seed!,
  }
}

/**
 * Create a custodial wallet for a user.
 * - Generates a new XRPL keypair
 * - Encrypts the seed with AES-256-GCM
 * - Stores encrypted seed in custodial_wallets table
 * - Also links the address in the wallets table for holdings sync
 *
 * Returns the wallet address (never the seed to the caller).
 */
export async function createCustodialWallet(userId: string): Promise<{ address: string }> {
  const supabase = getServiceClient()

  // Check if user already has a custodial wallet
  const { data: existing } = await supabase
    .from('custodial_wallets')
    .select('address')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  if (existing) {
    return { address: existing.address }
  }

  // Generate new XRPL wallet
  const { address, seed } = await generateXrplWallet()

  // Encrypt the seed — plaintext seed is wiped after this
  const encryptedSeed = encryptSeed(seed)

  // Store in custodial_wallets (service role bypasses RLS)
  const { error: custodialError } = await supabase
    .from('custodial_wallets')
    .insert({
      user_id: userId,
      address,
      encrypted_seed: encryptedSeed,
      encryption_method: 'aes-256-gcm-env',
      is_primary: true,
    })

  if (custodialError) {
    throw new Error(`Failed to store custodial wallet: ${custodialError.message}`)
  }

  // Also add to the wallets table so holdings sync works
  const { error: walletError } = await supabase
    .from('wallets')
    .insert({
      user_id: userId,
      address,
      label: 'Platform Wallet',
      is_primary: true,
    })

  if (walletError) {
    console.warn(`Could not insert into wallets table: ${walletError.message}`)
  }

  // Update the platform_investors row with the real wallet address.
  const { data: existingInvestor } = await supabase
    .from('platform_investors')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (existingInvestor) {
    await supabase
      .from('platform_investors')
      .update({ wallet_address: address })
      .eq('id', existingInvestor.id)
  } else {
    const { data: userRow } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    if (userRow) {
      await supabase
        .from('platform_investors')
        .insert({
          user_id: userId,
          wallet_address: address,
          full_name: userRow.full_name,
          email: userRow.email,
          kyc_status: 'pending',
          aml_cleared: false,
          accredited: false,
        })
    }
  }

  return { address }
}

/**
 * Sign and submit an XRPL transaction from a custodial wallet.
 * Uses xrpl.js for LOCAL signing — seed never leaves the server.
 */
export async function signAndSubmit(
  userId: string,
  txJson: Record<string, unknown>
): Promise<{ hash: string; engineResult: string }> {
  const supabase = getServiceClient()

  const { data: walletRow, error } = await supabase
    .from('custodial_wallets')
    .select('address, encrypted_seed')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  if (error || !walletRow) {
    throw new Error('No custodial wallet found for this user')
  }

  const seed = decryptSeed(walletRow.encrypted_seed)
  const wallet = Wallet.fromSeed(seed)

  const client = await getXrplClient()
  try {
    const prepared = await client.autofill({
      ...txJson,
      Account: walletRow.address,
    } as Parameters<Client['autofill']>[0])

    const signed = wallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    const meta = result.result.meta
    const engineResult = typeof meta === 'object' && meta !== null && 'TransactionResult' in meta
      ? (meta as { TransactionResult: string }).TransactionResult
      : 'unknown'

    return {
      hash: result.result.hash,
      engineResult,
    }
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/**
 * Sign and submit an XRPL transaction from a wallet identified by address.
 * Used for issuer wallets (which may not have a user_id).
 * Uses xrpl.js for LOCAL signing.
 */
export async function signAndSubmitFromAddress(
  walletAddress: string,
  txJson: Record<string, unknown>
): Promise<{ hash: string; engineResult: string; sequence: number }> {
  const supabase = getServiceClient()

  const { data: walletRow, error } = await supabase
    .from('custodial_wallets')
    .select('address, encrypted_seed')
    .eq('address', walletAddress)
    .single()

  if (error || !walletRow) {
    throw new Error(`No custodial wallet found for address ${walletAddress}`)
  }

  const seed = decryptSeed(walletRow.encrypted_seed)
  const wallet = Wallet.fromSeed(seed)

  const client = await getXrplClient()
  try {
    const prepared = await client.autofill({
      ...txJson,
      Account: walletRow.address,
    } as Parameters<Client['autofill']>[0])

    const signed = wallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    const meta = result.result.meta
    const engineResult = typeof meta === 'object' && meta !== null && 'TransactionResult' in meta
      ? (meta as { TransactionResult: string }).TransactionResult
      : 'unknown'

    return {
      hash: result.result.hash,
      engineResult,
      sequence: (prepared as Record<string, unknown>).Sequence as number ?? 0,
    }
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/**
 * Legacy: Sign a transaction and return the blob + hash (without submitting).
 */
export async function signTransaction(
  userId: string,
  txJson: Record<string, unknown>
): Promise<{ tx_blob: string; hash: string }> {
  const supabase = getServiceClient()

  const { data: walletRow, error } = await supabase
    .from('custodial_wallets')
    .select('address, encrypted_seed')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  if (error || !walletRow) {
    throw new Error('No custodial wallet found for this user')
  }

  const seed = decryptSeed(walletRow.encrypted_seed)
  const wallet = Wallet.fromSeed(seed)

  const client = await getXrplClient()
  try {
    const prepared = await client.autofill({
      ...txJson,
      Account: walletRow.address,
    } as Parameters<Client['autofill']>[0])

    const signed = wallet.sign(prepared)
    return {
      tx_blob: signed.tx_blob,
      hash: signed.hash,
    }
  } finally {
    await client.disconnect().catch(() => {})
  }
}

/**
 * Get a user's custodial wallet address (safe — no seed exposed).
 */
export async function getCustodialAddress(userId: string): Promise<string | null> {
  const supabase = getServiceClient()

  const { data } = await supabase
    .from('custodial_wallets')
    .select('address')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .single()

  return data?.address ?? null
}
