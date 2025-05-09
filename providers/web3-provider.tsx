"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { toast } from "@/components/ui/use-toast"
import { DEFAULT_CHAIN } from "@/config/blockchain"
import { HydrationProvider, useIsClient } from "./hydration-provider"
import authService from "@/lib/auth-service"

// Define window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: any[] }) => Promise<any>;
      on: (eventName: string, callback: (...args: any[]) => void) => void;
      removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
      selectedAddress: string | undefined;
      chainId: string | undefined;
    } | undefined
  }
}

type Web3ContextType = {
  account: string | null
  chainId: number | null
  isConnecting: boolean
  isConnected: boolean
  userRole: 'employer' | 'employee' | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  formatAddress: (address: string | null) => string
  viewOnExplorer: () => void
  setUserRole: (role: 'employer' | 'employee' | null) => void
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  chainId: null,
  isConnecting: false,
  isConnected: false,
  userRole: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  formatAddress: () => "",
  viewOnExplorer: () => {},
  setUserRole: () => {},
})

export const useWeb3 = () => useContext(Web3Context)

const Web3ProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isClient = useIsClient()
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [userRole, setUserRole] = useState<'employer' | 'employee' | null>(null)

  // Format address for display
  const formatAddress = useCallback((address: string | null): string => {
    if (!address) return ""
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }, [])

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isClient || !window.ethereum) {
      toast({
        title: "Wallet Not Found",
        description: "Please install MetaMask or another compatible wallet to use this application.",
        variant: "destructive",
      })
      return
    }

    setIsConnecting(true)

    try {
      // Use auth service to connect wallet
      const address = await authService.connectWallet()
      const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const chainIdDecimal = Number.parseInt(chainIdHex, 16)
      
      // Set account and authentication cookie
      setAccount(address)
      document.cookie = `auth-token=${address}; path=/`

      // Check if we're on Pharos Devnet (chainId 50002)
      if (chainIdDecimal !== DEFAULT_CHAIN.id) {
        try {
          // Try to switch to Pharos Devnet
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${DEFAULT_CHAIN.id.toString(16)}` }], // 50002 in hex (0xC352)
          })
        } catch (switchError: any) {
          // If Pharos Devnet is not added to wallet, add it
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: `0x${DEFAULT_CHAIN.id.toString(16)}`,
                  chainName: DEFAULT_CHAIN.name,
                  nativeCurrency: DEFAULT_CHAIN.nativeCurrency,
                  rpcUrls: DEFAULT_CHAIN.rpcUrls.default.http,
                  blockExplorerUrls: [DEFAULT_CHAIN.blockExplorers.default.url],
                },
              ],
            })
          } else {
            throw switchError
          }
        }
      }

      // Get updated chain ID after potential network switch
      const updatedChainIdHex = await window.ethereum.request({ method: "eth_chainId" })
      const updatedChainIdDecimal = Number.parseInt(updatedChainIdHex, 16)

      // Store the account address in its original format
      setAccount(address)
      setChainId(updatedChainIdDecimal)
      setIsConnected(true)

      toast({
        title: "Wallet Connected",
        description: `Connected to ${formatAddress(address)}`,
      })
    } catch (error) {
      console.error("Failed to connect wallet:", error)
      toast({
        title: "Connection Failed",
        description: "Failed to connect to your wallet. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsConnecting(false)
    }
  }, [formatAddress])

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    if (isClient) {
      // Use auth service to disconnect
      authService.disconnect()
      
      // Update local state
      setAccount(null)
      setChainId(null)
      setIsConnected(false)
      setUserRole(null)
      
      // Clear authentication cookie
      document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    }
  }, [isClient])

  // Initialize provider and set up event listeners
  useEffect(() => {
    if (!window.ethereum || !isClient) return

    // Use auth service to set up event listeners
    const cleanup = authService.setupEventListeners((event, data) => {
      if (event === 'disconnected') {
        // User disconnected their wallet
        disconnectWallet()
      } else if (event === 'accountChanged' && data) {
        // User switched accounts
        setAccount(data)
        setIsConnected(true)
      } else if (event === 'networkChanged') {
        // Chain changed, refresh the page to avoid state inconsistencies
        window.location.reload()
      }
    })

    // Check if already connected
    const checkConnection = async () => {
      try {
        const isConnected = await authService.isWalletConnected()
        if (isConnected) {
          const address = await authService.getCurrentAddress()
          const chainIdHex = await window.ethereum.request({ method: "eth_chainId" })
          const chainIdDecimal = Number.parseInt(chainIdHex, 16)
          
          if (address) {
            setAccount(address)
            setChainId(chainIdDecimal)
            setIsConnected(true)
            
            // Check user role
            const { role } = await authService.checkUserRole(address)
            setUserRole(role)
          }
        }
      } catch (error) {
        console.error("Error checking connection:", error)
      }
    }

    checkConnection()

    // Clean up event listeners
    return cleanup
  }, [disconnectWallet, isClient])

  // View address on block explorer
  const viewOnExplorer = useCallback(() => {
    if (!account) return

    const explorerUrl = `${DEFAULT_CHAIN.blockExplorers.default.url}/address/${account}`
    window.open(explorerUrl, "_blank")
  }, [account])

  const value = {
    account,
    chainId,
    isConnecting,
    isConnected,
    userRole,
    connectWallet,
    disconnectWallet,
    formatAddress,
    viewOnExplorer,
    setUserRole,
  }

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  )
}

// Export the wrapped provider that handles hydration
export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <HydrationProvider>
      <Web3ProviderInner>{children}</Web3ProviderInner>
    </HydrationProvider>
  )
}
