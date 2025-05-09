import { ethers } from 'ethers';
import { Contract } from 'ethers';
import RoleManagerABI from './abis/RoleManager.json';
import { CONTRACT_ADDRESSES } from '../config/blockchain';
import { initializeBlockchain } from './blockchainIntergation';

// Types
export interface RoleManagerContract extends Contract {
  registerAsEmployer(): Promise<ethers.ContractTransaction>;
  registerAsEmployee(employer: string, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>;
  isEmployer(account: string): Promise<boolean>;
  isEmployee(account: string): Promise<boolean>;
  getEmployerOf(employee: string): Promise<string>;
  revokeRole(role: string, account: string): Promise<ethers.ContractTransaction>;
  renounceRole(role: string, account: string): Promise<ethers.ContractTransaction>;
  pause(): Promise<ethers.ContractTransaction>;
  unpause(): Promise<ethers.ContractTransaction>;
  hasRole(role: string, account: string): Promise<boolean>;
  EMPLOYER_ROLE(): Promise<string>;
  EMPLOYEE_ROLE(): Promise<string>;
  signer: ethers.Signer;
  estimateGas: {
    registerAsEmployer(): Promise<ethers.BigNumber>;
    registerAsEmployee(employer: string): Promise<ethers.BigNumber>;
  };
}

// Role Manager Functions
export async function initializeRoleManager(): Promise<RoleManagerContract> {
  try {
    console.log('Initializing Role Manager...');
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Please install MetaMask or another Web3 wallet');
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    console.log('Web3 Provider initialized:', provider);

    await provider.send('eth_requestAccounts', []); // Request account access
    console.log('Wallet connection approved');

    // Ensure we're connected to the correct network
    const network = await provider.getNetwork();
    console.log('Network:', network);
    if (!network.chainId) {
      throw new Error('Network not properly configured. Please check your wallet connection.');
    }
    console.log('Connected to network with chainId:', network.chainId);
    
    // Check if we're on a supported network
    const supportedNetworks: Record<number, string> = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      137: 'Polygon Mainnet',
      80001: 'Mumbai Testnet',
      50002: 'PHAROS',
      11155111: 'Sepolia Testnet'
    };
    
    if (!supportedNetworks[network.chainId]) {
      throw new Error(`Network with chainId ${network.chainId} is not supported. Please switch to one of the following networks: ${Object.values(supportedNetworks).join(', ')}`);
    }

    const signer = provider.getSigner();
    const address = await signer.getAddress();
    console.log('Signer initialized for address:', address);

    const contracts = await initializeBlockchain();
    console.log('Blockchain contracts initialized');

    const roleManager = new Contract(
      CONTRACT_ADDRESSES.ROLE_MANAGER_CONTRACT,
      RoleManagerABI,
      contracts.signer
    ) as RoleManagerContract;

    console.log('Role Manager Contract initialized at:', CONTRACT_ADDRESSES.ROLE_MANAGER_CONTRACT);
    return roleManager;
  } catch (error: any) {
    console.error('Role Manager initialization failed:', error);
    if (error.code === 4001) {
      throw new Error('User rejected wallet connection request');
    } else if (error.code === -32002) {
      throw new Error('Wallet connection request already pending. Please check your wallet and approve the connection.');
    } else if (error.message && error.message.includes('underlying network changed')) {
      throw new Error('Network changed during operation. Please refresh the page and try again.');
    } else if (!window.ethereum) {
      throw new Error('Web3 provider not found. Please install MetaMask');
    } else {
      throw new Error(`Failed to initialize Role Manager: ${error.message || error}`);
    }
  }
}

export async function registerAsEmployer(): Promise<void> {
  try {
    const roleManager = await initializeRoleManager();
    const signer = await roleManager.signer.getAddress();

    // Check if already registered
    const [isEmployer, isEmployee] = await Promise.all([
      roleManager.hasRole(await roleManager.EMPLOYER_ROLE(), signer),
      roleManager.hasRole(await roleManager.EMPLOYEE_ROLE(), signer)
    ]);

    if (isEmployer) {
      throw new Error('You are already registered as an employer');
    }

    if (isEmployee) {
      throw new Error('You cannot register as an employer because you are already an employee');
    }
    
    // Estimate gas before sending transaction
    try {
      await roleManager.estimateGas.registerAsEmployer();
    } catch (estimateError: any) {
      if (estimateError.code === 'CALL_EXCEPTION') {
        throw new Error('Pre-check failed: You may not meet the requirements to register as an employer');
      }
      throw estimateError;
    }
    
    const tx = await roleManager.registerAsEmployer();
    
    const receipt = await tx.wait();
    console.log('Transaction receipt:', receipt);
    
    if (!receipt.status) {
      throw new Error('Transaction failed during execution. Please check your wallet and try again.');
    }
  } catch (error: any) {
    let errorMessage = 'Failed to register as employer';
    if (error.code === 'CALL_EXCEPTION') {
      errorMessage += ': Contract call reverted. This could be because you are already registered or do not meet the requirements.';
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage += ': Insufficient funds to cover gas costs. Please ensure your wallet has enough ETH.';
    } else if (error.transaction) {
      errorMessage += `: Transaction failed (hash: ${error.transaction.hash}). Please check the transaction on the blockchain explorer.`;
    }
    throw new Error(`${errorMessage}${error.message ? `. Details: ${error.message}` : ''}`);
  }
}

export async function registerAsEmployee(employerAddress: string, skipEmployerCheck: boolean = false): Promise<void> {
  try {
    console.log("Registering as employee with employer address:", employerAddress);
    const roleManager = await initializeRoleManager();
    const signerAddress = await roleManager.signer.getAddress();

    // Validate employer address
    if (!ethers.utils.isAddress(employerAddress)) {
      throw new Error('Invalid employer address format');
    }

    // Get role constants from the contract
    const employerRole = await roleManager.EMPLOYER_ROLE();
    const employeeRole = await roleManager.EMPLOYEE_ROLE();
    console.log('Retrieved role constants:', { employerRole, employeeRole });

    // Check if already registered
    const [isEmployer, isEmployee] = await Promise.all([
      roleManager.hasRole(employerRole, signerAddress),
      roleManager.hasRole(employeeRole, signerAddress)
    ]);
    console.log('Role check results:', { isEmployer, isEmployee });

    if (isEmployee) {
      throw new Error('You are already registered as an employee');
    }

    if (isEmployer) {
      throw new Error('You cannot register as an employee because you are already an employer');
    }

    // Check if the provided employer is actually registered as an employer
    if (!skipEmployerCheck) {
      const isValidEmployer = await roleManager.isEmployer(employerAddress);
      console.log('Is valid employer check:', isValidEmployer);
      if (!isValidEmployer) {
        throw new Error('The provided address is not registered as an employer');
      }
    } else {
      console.log('Skipping employer validation check as requested');
    }

    // Estimate gas with a higher limit to handle complex transactions
    console.log('Estimating gas for transaction...');
    let gasLimit;
    try {
      const gasEstimate = await roleManager.estimateGas.registerAsEmployee(employerAddress);
      // Add 20% buffer to the estimated gas
      gasLimit = Math.floor(gasEstimate.toNumber() * 1.2);
      console.log('Gas estimate with buffer:', gasLimit);
    } catch (estimateError: any) {
      console.error('Gas estimation failed:', estimateError);
      if (estimateError.code === 'UNPREDICTABLE_GAS_LIMIT') {
        // Use a default gas limit if estimation fails
        gasLimit = 500000; // Default high gas limit
        console.log('Using default gas limit:', gasLimit);
      } else {
        throw estimateError;
      }
    }

    // Use the gas limit in the transaction
    console.log('Sending transaction with gas limit:', gasLimit);
    
    // Get the connected signer address to ensure it matches
    const currentSignerAddress = await roleManager.signer.getAddress();
    console.log('Signer address for transaction:', currentSignerAddress);
    
    // Make sure we're using the right signer for the transaction
    console.log('Checking if we need to reconnect the signer...');
    // Reconnect the provider and signer to ensure we have the latest state
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const freshSigner = provider.getSigner();
    const connectedAddress = await freshSigner.getAddress();
    console.log('Connected address:', connectedAddress);
    
    // Create a new contract instance with the fresh signer
    const roleManagerWithSigner = roleManager.connect(freshSigner);
    
    // Send the transaction with the gas limit
    const tx = await roleManagerWithSigner.registerAsEmployee(employerAddress, { gasLimit });
    console.log('Transaction sent:', tx);

    console.log('Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction receipt:', receipt);
    
    if (!receipt.status) {
      throw new Error('Transaction failed during execution. Please check your wallet and try again.');
    }
    
    console.log('Successfully registered as employee');
  } catch (error: any) {
    console.error('Registration error:', error);
    let errorMessage = 'Failed to register as employee';
    if (error.code === 'CALL_EXCEPTION') {
      errorMessage += ': Contract call reverted. This could be because you are already registered, the employer address is invalid, or you do not meet the requirements.';
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage += ': Insufficient funds to cover gas costs. Please ensure your wallet has enough ETH.';
    } else if (error.transaction) {
      errorMessage += `: Transaction failed (hash: ${error.transaction.hash}). Please check the transaction on the blockchain explorer.`;
    }
    throw new Error(`${errorMessage}${error.message ? `. Details: ${error.message}` : ''}`);
  }
}

export async function checkEmployerRole(address: string): Promise<boolean> {
  try {
    const roleManager = await initializeRoleManager();
    return await roleManager.isEmployer(address);
  } catch (error) {
    throw new Error(`Failed to check employer role: ${error}`);
  }
}

export async function checkEmployeeRole(address: string): Promise<boolean> {
  try {
    const roleManager = await initializeRoleManager();
    return await roleManager.isEmployee(address);
  } catch (error) {
    throw new Error(`Failed to check employee role: ${error}`);
  }
}

export async function getEmployerAddress(employeeAddress: string): Promise<string> {
  try {
    const roleManager = await initializeRoleManager();
    return await roleManager.getEmployerOf(employeeAddress);
  } catch (error) {
    throw new Error(`Failed to get employer address: ${error}`);
  }
}

// Role constants
export const EMPLOYER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMPLOYER_ROLE"));
export const EMPLOYEE_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("EMPLOYEE_ROLE"));
export const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
export const PAUSER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PAUSER_ROLE"));

export async function revokeRole(role: string, account: string): Promise<void> {
  try {
    const roleManager = await initializeRoleManager();
    const tx = await roleManager.revokeRole(role, account);
    await tx.wait();
  } catch (error) {
    throw new Error(`Failed to revoke role: ${error}`);
  }
}

export async function renounceRole(role: string, account: string): Promise<void> {
  try {
    const roleManager = await initializeRoleManager();
    const tx = await roleManager.renounceRole(role, account);
    await tx.wait();
  } catch (error) {
    throw new Error(`Failed to renounce role: ${error}`);
  }
}

export async function pauseContract(): Promise<void> {
  try {
    const roleManager = await initializeRoleManager();
    const tx = await roleManager.pause();
    await tx.wait();
  } catch (error) {
    throw new Error(`Failed to pause contract: ${error}`);
  }
}

export async function unpauseContract(): Promise<void> {
  try {
    const roleManager = await initializeRoleManager();
    const tx = await roleManager.unpause();
    await tx.wait();
  } catch (error) {
    throw new Error(`Failed to unpause contract: ${error}`);
  }
}

export async function checkRole(role: string, account: string): Promise<boolean> {
  try {
    const roleManager = await initializeRoleManager();
    return await roleManager.hasRole(role, account);
  } catch (error) {
    throw new Error(`Failed to check role: ${error}`);
  }
}