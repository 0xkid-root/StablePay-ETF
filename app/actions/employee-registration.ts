'use client';

import { ethers } from 'ethers';
import { registerAsEmployee } from '@/WEB3/roleAuthentication';
import { employeeDB } from '@/lib/db';

// Define employee registration data interface
export interface EmployeeRegistrationData {
  name: string;
  address: string;
  amount: string;
  schedule: string;
}

/**
 * Handle employee registration with blockchain and IndexedDB
 * @param employerAddress The employer's wallet address
 * @param employeeData Employee details
 * @returns Success status and error message if applicable
 */
export async function handleEmployeeRegistration(
  employerAddress: string,
  employeeData: EmployeeRegistrationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Initialize provider and connect to wallet
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
    
    // Force a refresh of the connection to ensure we have the latest state
    await provider.send('eth_requestAccounts', []);
    const currentSigner = provider.getSigner();
    const currentSignerAddress = await currentSigner.getAddress();
    console.log('Current signer address:', currentSignerAddress);
    
    // Verify that the signer address matches the expected address
    if (currentSignerAddress.toLowerCase() !== employerAddress.toLowerCase()) {
      console.warn(`Warning: Signer address (${currentSignerAddress}) doesn't match employer address (${employerAddress})`);
      console.log('Using the current signer address as the employer address');
      employerAddress = currentSignerAddress;
    }
    
    // Check if the network is supported
    const supportedNetworks: Record<number, string> = {
      1: 'Ethereum Mainnet',
      5: 'Goerli Testnet',
      11155111: 'Sepolia Testnet',
      137: 'Polygon Mainnet',
      80001: 'Mumbai Testnet',
      50002: 'PHAROS'
    };
    
    if (!supportedNetworks[network.chainId]) {
      throw new Error(`Network with chainId ${network.chainId} is not supported. Please switch to one of the following networks: ${Object.values(supportedNetworks).join(', ')}`);
    }

    // We already have the signer and signer address from above
    console.log('Using signer address for validation:', currentSignerAddress);

    // Validate the employer address
    if (!ethers.utils.isAddress(employerAddress)) {
      throw new Error('Invalid employer address format');
    }

    // Validate the employee address
    if (!ethers.utils.isAddress(employeeData.address)) {
      throw new Error('Invalid employee address format');
    }

    // Check if the employer exists in IndexedDB
    const { employerDB } = await import('@/lib/db');
    const employer = await employerDB.get(employerAddress);
    
    if (!employer) {
      // If the employer doesn't exist in IndexedDB, register them
      console.log('Employer not found in IndexedDB, registering them first...');
      await employerDB.add({
        address: employerAddress,
        name: 'Auto-registered Employer'
      });
    }
    
    // Register the employee on the blockchain with skipEmployerCheck=true
    await registerAsEmployee(employerAddress, true);
    
    // Store employee data in IndexedDB
    try {
      await employeeDB.add({
        address: employeeData.address,
        name: employeeData.name,
        employerAddress: employerAddress,
        amount: employeeData.amount,
        schedule: employeeData.schedule
      });
      console.log('Employee data stored in IndexedDB');
    } catch (dbError: any) {
      console.error('Error storing employee data in IndexedDB:', dbError);
      // Continue even if DB storage fails, as blockchain registration succeeded
    }

    return { success: true };
  } catch (error: any) {
    console.error('Employee registration error:', error);
    return {
      success: false,
      error: `Failed to register as employee: ${error.message || 'Transaction failed'}`,
    };
  }
}