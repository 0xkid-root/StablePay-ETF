import { create } from 'zustand';
import { employeeDB } from '../lib/db';
import { registerAsEmployee } from '../WEB3/roleAuthentication';
import { ethers } from 'ethers';

interface EmployeeState {
  // State
  employeeData: {
    address: string;
    name: string;
    employerAddress: string;
    amount: string;
    schedule: string;
    registrationDate: number;
    lastPaid?: number;
    status: 'Active' | 'Inactive';
  } | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  registerAsEmployee: (employerAddress: string) => Promise<void>;
  fetchEmployeeData: (address: string) => Promise<void>;
  updateEmployeeProfile: (data: Partial<EmployeeState['employeeData']> & { address: string }) => Promise<void>;
  clearState: () => void;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employeeData: null,
  isLoading: false,
  error: null,
  
  registerAsEmployee: async (employerAddress: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get wallet address from connected wallet
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Check if employee already exists in IndexedDB
      const existingEmployee = await employeeDB.get(address);
      if (existingEmployee) {
        set({
          employeeData: existingEmployee,
          isLoading: false
        });
        return; // Already registered, just return the data
      }
      
      // Create minimal employee data
      const employeeData = {
        address,
        name: '',
        employerAddress,
        amount: '0',
        schedule: 'monthly',
        registrationDate: Date.now(),
        status: 'Active' as const
      };
      
      // Store employee data in IndexedDB
      await employeeDB.add({
        address,
        name: '',
        employerAddress,
        amount: '0',
        schedule: 'monthly'
      });
      
      set({ 
        employeeData,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Failed to register as employee:', error);
      set({ 
        error: error?.message || 'Failed to register as employee', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  fetchEmployeeData: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get employee data from IndexedDB
      const employeeData = await employeeDB.get(address);
      
      if (employeeData) {
        set({ employeeData, isLoading: false });
      } else {
        set({ 
          error: 'Employee data not found', 
          isLoading: false 
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch employee data:', error);
      set({ 
        error: error?.message || 'Failed to fetch employee data', 
        isLoading: false 
      });
    }
  },
  
  updateEmployeeProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Update employee data in IndexedDB
      await employeeDB.update(data);
      
      // Update local state
      const currentData = get().employeeData;
      set({ 
        employeeData: currentData ? { ...currentData, ...data } : null,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Failed to update employee profile:', error);
      set({ 
        error: error?.message || 'Failed to update employee profile', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  clearState: () => {
    set({
      employeeData: null,
      isLoading: false,
      error: null
    });
  }
}));
