import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import { useEmployerStore } from '@/stores/useEmployerStore';
import { useEmployeeStore } from '@/stores/useEmployeeStore';
import authService, { UserRole, DEFAULT_NETWORK_ID } from '@/lib/auth-service';
import { useIsClient } from '@/providers/hydration-provider';

interface UseAuthenticationReturn {
  // Authentication state
  isConnected: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  address: string | null;
  role: UserRole;
  error: string | null;
  
  // Authentication actions
  connectWallet: () => Promise<string>;
  login: () => Promise<void>;
  register: (role: 'employer' | 'employee', employerAddress?: string) => Promise<void>;
  logout: () => void;
  
  // Network state and actions
  checkNetwork: () => Promise<{valid: boolean, chainId: number, name: string}>;
  switchNetwork: (chainId?: number) => Promise<boolean>;
}

export function useAuthentication(): UseAuthenticationReturn {
  const router = useRouter();
  const isClient = useIsClient();
  
  // Get state and actions from Zustand stores
  const { 
    address, 
    role, 
    isConnected, 
    isAuthenticated,
    employerAddress: userEmployerAddress,
    setAddress,
    setRole,
    setIsConnected,
    setIsAuthenticated,
    setEmployerAddress,
    logout: logoutUser
  } = useUserStore();
  
  const { registerAsEmployer: storeRegisterAsEmployer } = useEmployerStore();
  
  // Helper function to register as employer with name parameter
  const registerAsEmployer = async (name?: string) => {
    return await storeRegisterAsEmployer();
  };
  const { registerAsEmployee } = useEmployeeStore();
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check network
  const checkNetwork = useCallback(async (): Promise<{valid: boolean, chainId: number, name: string}> => {
    setError(null);
    
    try {
      // The authService.checkNetwork() returns the correct type
      const networkInfo = await authService.checkNetwork();
      // Explicitly return the network info to satisfy TypeScript
      return {
        valid: networkInfo.valid,
        chainId: networkInfo.chainId,
        name: networkInfo.name
      };
    } catch (error: any) {
      setError(error.message || 'Failed to check network');
      // In case of error, return a default error object
      throw new Error(error.message || 'Failed to check network');
    }
  }, []);
  
  // Switch network
  const switchNetwork = useCallback(async (chainId: number = DEFAULT_NETWORK_ID) => {
    setError(null);
    
    try {
      return await authService.switchNetwork(chainId);
    } catch (error: any) {
      setError(error.message || 'Failed to switch network');
      throw error;
    }
  }, []);
  
  // Check if user is authenticated
  const checkAuthentication = useCallback(async () => {
    if (!isClient) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if wallet is connected
      const isConnected = await authService.isWalletConnected();
      setIsConnected(isConnected);
      
      if (!isConnected) {
        setIsAuthenticated(false);
        setAddress(null);
        setRole(null);
        return;
      }
      
      // Get wallet address
      const address = await authService.getCurrentAddress();
      setAddress(address);
      
      if (!address) {
        setIsAuthenticated(false);
        setRole(null);
        return;
      }
      
      // Check user role
      const { role, employerAddress }: { role: UserRole; employerAddress?: string } = await authService.checkUserRole(address);
      setRole(role);
      
      if (role) {
        setIsAuthenticated(true);
        
        if (role === 'employee' && employerAddress) {
          setEmployerAddress(employerAddress);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isClient, setAddress, setIsConnected, setRole, setIsAuthenticated, setEmployerAddress]);

  useEffect(() => {
    if (!isClient) return;

    // Set up event listeners for wallet events
    const cleanup = authService.setupEventListeners((event: 'disconnected' | 'accountChanged' | 'networkChanged', data?: any) => {
      if (event === 'disconnected') {
        // User disconnected their wallet
        setIsConnected(false);
        setIsAuthenticated(false);
        setAddress(null);
        setRole(null);
        logoutUser();
      } else if (event === 'accountChanged' && data) {
        // User switched accounts
        setAddress(data);
        checkAuthentication();
      }
    });
    
    // Return cleanup function
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [isClient, setAddress, setIsConnected, setRole, setIsAuthenticated, logoutUser, checkAuthentication]);
  
  // Connect wallet
  const connectWallet = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const address = await authService.connectWallet();
      setAddress(address);
      setIsConnected(true);
      return address;
    } catch (error: any) {
      setError(error.message || 'Failed to connect wallet');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setAddress, setIsConnected]);
  
  // Login
  const login = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { address, role, employerAddress } = await authService.login();
      
      // Update store
      setAddress(address);
      setRole(role);
      setIsConnected(true);
      setIsAuthenticated(true);
      
      if (role === 'employee' && employerAddress) {
        setEmployerAddress(employerAddress);
      }
      
      // Redirect based on role
      if (role === 'employer') {
        router.push('/employer');
      } else if (role === 'employee') {
        router.push('/employee');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to login');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setAddress, setRole, setIsConnected, setIsAuthenticated, setEmployerAddress, router]);
  
  // Register
  const register = useCallback(async (role: 'employer' | 'employee', employerAddress?: string, employerName?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First check network and connect wallet if not connected
      if (!isConnected) {
        await connectWallet();
      }
      
      // Validate network before registration
      const networkStatus = await checkNetwork();
      if (!networkStatus.valid) {
        // Try to switch to a supported network
        const switched = await switchNetwork();
        if (!switched) {
          throw new Error(`Please switch to a supported network to register. Current network: ${networkStatus.name}`);
        }
      }
      
      // Register based on role
      if (role === 'employer') {
        // Pass employer name if provided, otherwise use default
        await registerAsEmployer(employerName || 'Employer');
      } else if (role === 'employee' && employerAddress) {
        // Validate employer address format
        if (!employerAddress || employerAddress.trim() === '') {
          throw new Error('Employer address is required for employee registration');
        }
        
        await registerAsEmployee(employerAddress);
      } else {
        throw new Error('Invalid registration parameters');
      }
      
      // Update store
      setRole(role);
      setIsAuthenticated(true);
      
      if (role === 'employee' && employerAddress) {
        setEmployerAddress(employerAddress);
      }
      
      // Redirect based on role
      if (role === 'employer') {
        router.push('/employer');
      } else if (role === 'employee') {
        router.push('/employee');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || `Failed to register as ${role}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, connectWallet, checkNetwork, switchNetwork, registerAsEmployer, registerAsEmployee, setRole, setIsAuthenticated, setEmployerAddress, router]);
  
  // Logout
  const logout = useCallback(() => {
    logoutUser();
    router.push('/');
  }, [logoutUser, router]);
  
  // Initialize on mount
  useEffect(() => {
    if (isClient) {
      checkAuthentication();
    }
  }, [isClient, checkAuthentication]);
  
  return {
    // Authentication state
    isConnected,
    isAuthenticated,
    isLoading,
    address,
    role,
    error,
    
    // Authentication actions
    connectWallet,
    login,
    register,
    logout,
    
    // Network state and actions
    checkNetwork,
    switchNetwork
  };
}
