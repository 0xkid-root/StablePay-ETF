import { ethers } from 'ethers';
import { employerDB, employeeDB } from './db';

// Network details interface
interface NetworkDetails {
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// Define supported networks with details needed for adding to MetaMask
export const SUPPORTED_NETWORKS: Record<number, NetworkDetails> = {
  1: {
    name: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  },
  5: {
    name: 'Goerli Testnet',
    nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://goerli.infura.io/v3/'],
    blockExplorerUrls: ['https://goerli.etherscan.io']
  },
  11155111: {
    name: 'Sepolia Testnet',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://sepolia.infura.io/v3/'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },
  137: {
    name: 'Polygon Mainnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com']
  },
  80001: {
    name: 'Mumbai Testnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
    blockExplorerUrls: ['https://mumbai.polygonscan.com']
  },
  50002: {
    name: 'PHAROS',
    nativeCurrency: { name: 'PHAROS', symbol: 'PHAROS', decimals: 18 },
    rpcUrls: ['https://devnet.dplabs-internal.com'],
    blockExplorerUrls: []
  }
};

// Default network to use for development/testing
export const DEFAULT_NETWORK_ID = 50002; // Pharos

// User role types
export type UserRole = 'employer' | 'employee' | null;

// Event callback type
type EventCallback = (event: 'disconnected' | 'accountChanged' | 'networkChanged', data?: any) => void;

/**
 * Auth service for handling wallet connections and user authentication
 * Uses IndexedDB for storing user data instead of blockchain contracts
 */
class AuthService {
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;
  private eventCallbacks: EventCallback[] = [];
  private cleanupListeners: (() => void) | null = null;

  /**
   * Connect to wallet and validate network
   * @returns The connected wallet address
   */
  async connectWallet(): Promise<string> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask or compatible wallet not detected. Please install a Web3 wallet to continue.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please ensure your wallet is unlocked and try again.');
      }

      // Create provider and signer
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Force provider to refresh its connection to get the latest account
      await this.provider.send('eth_accounts', []);
      
      // Get signer after refreshing provider connection
      this.signer = this.provider.getSigner();
      
      // Validate the connected address
      let address;
      try {
        address = await this.signer.getAddress();
        if (!address) {
          throw new Error('Failed to get wallet address. Please try again.');
        }
      } catch (error: any) {
        console.error('Error getting address:', error);
        // If there's an error with the signer, try to get the address directly from accounts
        if (accounts[0]) {
          address = accounts[0];
        } else {
          throw new Error('Failed to get wallet address. Please try again.');
        }
      }
      
      // Check if we're on a supported network
      const networkStatus = await this.checkNetwork();
      if (!networkStatus.valid) {
        console.warn(`Connected to unsupported network: ${networkStatus.name}`);
        // We don't throw here to allow the UI to handle network switching
      }

      // Return the connected address
      return address;
    } catch (error: any) {
      // Enhance error messages for common issues
      if (error.code === 4001) {
        throw new Error('You rejected the wallet connection request. Please try again and approve the connection.');
      } else if (error.code === -32002) {
        throw new Error('Wallet connection request already pending. Please check your wallet and approve the connection.');
      }
      
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }

  // This function has been moved to the end of the class to avoid duplication

  /**
   * Get network parameters for adding a network to MetaMask
   */
  private getNetworkParams(chainId: number): any {
    switch (chainId) {
      case 1: // Ethereum Mainnet
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Ethereum Mainnet',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://mainnet.infura.io/v3/'],
          blockExplorerUrls: ['https://etherscan.io'],
        };
      case 5: // Goerli Testnet
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Goerli Testnet',
          nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://goerli.infura.io/v3/'],
          blockExplorerUrls: ['https://goerli.etherscan.io'],
        };
      case 11155111: // Sepolia Testnet
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Sepolia Testnet',
          nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.infura.io/v3/'],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        };
      case 137: // Polygon Mainnet
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Polygon Mainnet',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: ['https://polygon-rpc.com/'],
          blockExplorerUrls: ['https://polygonscan.com'],
        };
      case 80001: // Mumbai Testnet
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Mumbai Testnet',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
          blockExplorerUrls: ['https://mumbai.polygonscan.com'],
        };
      case 50002: // Foundry Local
        return {
          chainId: `0x${chainId.toString(16)}`,
          chainName: 'Foundry Local',
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['http://localhost:8545'],
          blockExplorerUrls: [],
        };
      default:
        return null;
    }
  }

  /**
   * Check if a user is registered and get their role
   */
  async checkUserRole(address: string): Promise<{ role: UserRole; employerAddress?: string }> {
    try {
      // Check if user is registered as an employer in IndexedDB
      const employerData = await employerDB.get(address);
      if (employerData) {
        // Update last login time - no need to update in this function
        // We'll just check the role
        return { role: 'employer' };
      }
      
      // Check if user is registered as an employee in IndexedDB
      const employeeData = await employeeDB.get(address);
      if (employeeData) {
        // We'll just check the role
        return { role: 'employee', employerAddress: employeeData.employerAddress };
      }
      
      // User not registered
      return { role: null };
    } catch (error) {
      console.error('Error checking user role:', error);
      return { role: null };
    }
  }

  /**
   * Login a user with their wallet
   * @returns Object containing the user's address, role, and employer address (if applicable)
   */
  async login(): Promise<{ address: string; role: UserRole; employerAddress?: string }> {
    try {
      // Connect wallet and get address
      const address = await this.connectWallet();
      
      // Check if we're on a supported network
      const networkStatus = await this.checkNetwork();
      if (!networkStatus.valid) {
        throw new Error(`Please switch to a supported network to login. Current network: ${networkStatus.name}`);
      }
      
      // Check user role in the database
      const { role, employerAddress } = await this.checkUserRole(address);
      
      // If user is not registered, provide a helpful error
      if (!role) {
        throw new Error('This wallet is not registered. Please register first to access the platform.');
      }
      
      console.log(`User logged in: ${address} as ${role}${employerAddress ? ` under employer: ${employerAddress}` : ''}`);
      return { address, role, employerAddress };
    } catch (error: any) {
      console.error('Login error:', error);
      // Enhance common error messages
      if (error.code === 4001) {
        throw new Error('You rejected the wallet connection request. Please try again and approve the connection.');
      }
      throw error;
    }
  }
  
  /**
   * Register a user as an employer
   * @param name The employer's name or company name
   * @returns True if registration was successful
   */
  async registerAsEmployer(name: string = 'Employer'): Promise<boolean> {
    try {
      // Ensure we have a wallet connection
      if (!this.signer) {
        await this.connectWallet();
      }
      
      if (!this.signer) {
        throw new Error('No wallet connection available. Please connect your wallet first.');
      }
      
      // Validate network before registration
      const networkStatus = await this.checkNetwork();
      if (!networkStatus.valid) {
        throw new Error(`Please switch to a supported network to register. Current network: ${networkStatus.name}`);
      }
      
      const address = await this.signer.getAddress();
      
      // Check if user is already registered
      const { role } = await this.checkUserRole(address);
      if (role) {
        if (role === 'employer') {
          throw new Error('This wallet is already registered as an employer. Please use a different wallet or log in instead.');
        } else {
          throw new Error('This wallet is already registered as an employee. Please use a different wallet to register as an employer.');
        }
      }
      
      // Store employer data in IndexedDB
      await employerDB.add({
        address,
        name: name.trim() || 'Employer' // Use default if empty
      });
      
      console.log(`Successfully registered as employer: ${address}`);
      return true;
    } catch (error: any) {
      console.error('Error registering as employer:', error);
      // Enhance error message if it's a generic one
      if (error.message === 'No signer available') {
        throw new Error('Wallet connection failed. Please try connecting your wallet again.');
      }
      throw error;
    }
  }

  /**
   * Register a user as an employee
   * @param employerAddress The Ethereum address of the employer
   * @param skipEmployerCheck Whether to skip validating if the employer exists
   * @returns True if registration was successful
   */
  async registerAsEmployee(employerAddress: string, skipEmployerCheck: boolean = false): Promise<boolean> {
    try {
      // Validate employer address format
      try {
        employerAddress = ethers.utils.getAddress(employerAddress); // Normalize address format
      } catch (error) {
        throw new Error('Invalid employer address format. Please provide a valid Ethereum address.');
      }
      
      // Ensure we have a wallet connection
      if (!this.signer) {
        await this.connectWallet();
      }
      
      if (!this.signer) {
        throw new Error('No wallet connection available. Please connect your wallet first.');
      }
      
      // Validate network before registration
      const networkStatus = await this.checkNetwork();
      if (!networkStatus.valid) {
        throw new Error(`Please switch to a supported network to register. Current network: ${networkStatus.name}`);
      }
      
      const address = await this.signer.getAddress();
      
      // Prevent registering with your own address as employer
      if (address.toLowerCase() === employerAddress.toLowerCase()) {
        throw new Error('You cannot register as an employee using your own address as the employer.');
      }
      
      // Check if user is already registered
      const { role } = await this.checkUserRole(address);
      if (role) {
        if (role === 'employee') {
          throw new Error('This wallet is already registered as an employee. Please use a different wallet or log in instead.');
        } else {
          throw new Error('This wallet is already registered as an employer. Please use a different wallet to register as an employee.');
        }
      }
      
      // Check if employer exists
      if (!skipEmployerCheck) {
        const employerData = await employerDB.get(employerAddress);
        if (!employerData) {
          throw new Error('Employer not found. Please verify the employer address and try again.');
        }
      }
      
      // Store employee data in IndexedDB
      await employeeDB.add({
        address,
        name: '',
        employerAddress,
        amount: '0',
        schedule: 'monthly'
      });
      
      console.log(`Successfully registered as employee: ${address} under employer: ${employerAddress}`);
      return true;
    } catch (error: any) {
      console.error('Error registering as employee:', error);
      // Enhance error message if it's a generic one
      if (error.message === 'No signer available') {
        throw new Error('Wallet connection failed. Please try connecting your wallet again.');
      }
      throw error;
    }
  }

  /**
   * Check if wallet is connected
   */
  async isWalletConnected(): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts && accounts.length > 0;
    } catch (error) {
      console.error('Error checking if wallet is connected:', error);
      return false;
    }
  }

  /**
   * Get current wallet address
   */
  async getCurrentAddress(): Promise<string | null> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return null;
    }
    
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts && accounts.length > 0 ? accounts[0] : null;
    } catch (error) {
      console.error('Error getting current address:', error);
      return null;
    }
  }

  /**
   * Notify all registered callbacks of an event
   */
  private notifyCallbacks(event: 'disconnected' | 'accountChanged' | 'networkChanged', data?: any): void {
    this.eventCallbacks.forEach(callback => {
      callback(event, data);
    });
  }

  /**
   * Set up event listeners for wallet events
   * @returns A cleanup function to remove the event listeners
   */
  setupEventListeners(callback: EventCallback): () => void {
    if (typeof window === 'undefined' || !window.ethereum) {
      return () => {};
    }
    
    this.eventCallbacks.push(callback);
    
    // Define event handlers
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        this.provider = null;
        this.signer = null;
        this.notifyCallbacks('disconnected');
      } else {
        // User switched accounts
        this.notifyCallbacks('accountChanged', accounts[0]);
      }
    };
    
    const handleChainChanged = () => {
      this.notifyCallbacks('networkChanged');
    };
    
    // Add event listeners
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    
    // Store cleanup function
    this.cleanupListeners = () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
      
      // Remove callback from array
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
    
    // Return cleanup function
    return this.cleanupListeners;
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    
    // Clean up event listeners if they exist
    if (this.cleanupListeners) {
      this.cleanupListeners();
      this.cleanupListeners = null;
    }
    
    this.notifyCallbacks('disconnected');
  }
  
  /**
   * Logout user (alias for disconnect)
   */
  logout(): void {
    this.disconnect();
  }

  /**
   * Check if the current network is supported
   * @returns Object with network information
   */
  async checkNetwork(): Promise<{valid: boolean, chainId: number, name: string}> {
    if (typeof window === 'undefined' || !window.ethereum) {
      return { valid: false, chainId: 0, name: 'No wallet detected' };
    }
    
    try {
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      
      // Check if network is supported in a type-safe way
      const isSupported = Object.keys(SUPPORTED_NETWORKS).map(Number).includes(chainId);
      
      // Get network name from the network details object
      let networkName = 'Unknown Network';
      if (isSupported && SUPPORTED_NETWORKS[chainId]) {
        networkName = SUPPORTED_NETWORKS[chainId].name;
      }
      
      return {
        valid: isSupported,
        chainId,
        name: networkName
      };
    } catch (error) {
      console.error('Error checking network:', error);
      return { valid: false, chainId: 0, name: 'Error checking network' };
    }
  }

  /**
   * Switch to a supported network
   * @param chainId The chain ID to switch to (defaults to DEFAULT_NETWORK_ID)
   * @returns True if the switch was successful
   */
  async switchNetwork(chainId: number = DEFAULT_NETWORK_ID): Promise<boolean> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('MetaMask or compatible wallet not detected. Please install a Web3 wallet to continue.');
    }
    
    try {
      // First check if we're already on the requested network
      const { chainId: currentChainId } = await this.checkNetwork();
      if (currentChainId === chainId) {
        console.log(`Already on network with chainId ${chainId}`);
        return true;
      }
      
      console.log(`Attempting to switch to network with chainId ${chainId}`);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
      
      // Verify the switch was successful
      const { chainId: newChainId } = await this.checkNetwork();
      return newChainId === chainId;
    } catch (error: any) {
      console.error('Error switching network:', error);
      
      // Handle specific error codes
      if (error.code === 4902) {
        // Chain not added to MetaMask, attempt to add it
        try {
          console.log(`Network not found in wallet, attempting to add chainId ${chainId}`);
          const networkDetails = SUPPORTED_NETWORKS[chainId];
          if (!networkDetails) {
            throw new Error(`Network with chainId ${chainId} is not supported. Please contact support.`);
          }
          
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${chainId.toString(16)}`,
                chainName: networkDetails.name,
                nativeCurrency: networkDetails.nativeCurrency,
                rpcUrls: networkDetails.rpcUrls,
                blockExplorerUrls: networkDetails.blockExplorerUrls,
              },
            ],
          });
          
          // Verify the network was added and switched successfully
          const { chainId: addedChainId } = await this.checkNetwork();
          return addedChainId === chainId;
        } catch (addError: any) {
          console.error('Error adding network:', addError);
          throw new Error(`Failed to add network: ${addError.message || 'Unknown error'}. Please try adding the network manually in your wallet.`);
        }
      } else if (error.code === 4001) {
        // User rejected the request
        throw new Error('You rejected the network switch request. Please approve the network switch to continue.');
      } else {
        throw new Error(`Failed to switch network: ${error.message || 'Unknown error'}. Please try switching networks manually in your wallet.`);
      }
      
      return false;
    }
  }
}

// ... rest of the code remains the same ...
const authService = new AuthService();
export default authService;
