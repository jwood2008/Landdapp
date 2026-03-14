import { Client } from 'xrpl'

let client: Client | null = null

export async function getXrplClient(): Promise<Client> {
  const network = process.env.NEXT_PUBLIC_XRPL_NETWORK || 'wss://xrplcluster.com'

  if (!client || !client.isConnected()) {
    client = new Client(network)
    await client.connect()
  }

  return client
}

export async function getAccountLines(address: string) {
  const xrpl = await getXrplClient()
  const response = await xrpl.request({
    command: 'account_lines',
    account: address,
    ledger_index: 'validated',
  })
  return response.result.lines
}

export async function getAccountInfo(address: string) {
  const xrpl = await getXrplClient()
  const response = await xrpl.request({
    command: 'account_info',
    account: address,
    ledger_index: 'validated',
  })
  return response.result.account_data
}

export type TrustLine = {
  account: string
  balance: string
  currency: string
  limit: string
  limit_peer: string
  quality_in: number
  quality_out: number
}
