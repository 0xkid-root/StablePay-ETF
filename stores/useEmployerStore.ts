import { create } from 'zustand';
import { employerDB, employeeDB } from '../lib/db';
import { registerAsEmployer } from '../WEB3/roleAuthentication';
import { ethers } from 'ethers';

interface EmployerState {
  // State
  employerData: {
    address: string;
    name?: string;
    registrationDate?: number;
    lastLogin?: number;
  } | null;
  employees: Array<{
    address: string;
    name: string;
    amount: string;
    schedule: string;
    registrationDate: number;
    lastPaid?: number;
    status: 'Active' | 'Inactive';
  }>;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  registerAsEmployer: () => Promise<void>;
  fetchEmployerData: (address: string) => Promise<void>;
  fetchEmployees: (employerAddress: string) => Promise<void>;
  updateEmployerProfile: (data: Partial<EmployerState['employerData']> & { address: string }) => Promise<void>;
  addEmployee: (employeeData: {
    address: string;
    name: string;
    employerAddress: string;
    amount: string;
    schedule: string;
  }) => Promise<void>;
  updateEmployeeStatus: (employeeAddress: string, status: 'Active' | 'Inactive') => Promise<void>;
  clearState: () => void;
}

export const useEmployerStore = create<EmployerState>((set, get) => ({
  employerData: null,
  employees: [],
  isLoading: false,
  error: null,
  
  registerAsEmployer: async () => {
    set({ isLoading: true, error: null });
    try {
      // Get wallet address from connected wallet
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      // Check if employer already exists in IndexedDB
      const existingEmployer = await employerDB.get(address);
      if (existingEmployer) {
        set({
          employerData: existingEmployer,
          isLoading: false
        });
        return; // Already registered, just return the data
      }
      
      // Store employer data in IndexedDB
      await employerDB.add({
        address,
        name: '',
      });
      
      set({ 
        employerData: { 
          address,
          name: '',
          registrationDate: Date.now()
        },
        isLoading: false
      });
    } catch (error: any) {
      console.error('Failed to register as employer:', error);
      set({ 
        error: error?.message || 'Failed to register as employer', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  fetchEmployerData: async (address: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get employer data from IndexedDB
      const employerData = await employerDB.get(address);
      
      if (employerData) {
        set({ employerData, isLoading: false });
      } else {
        // If not found in DB, create a minimal record
        const minimalData = { address };
        set({ employerData: minimalData, isLoading: false });
        
        // Add to DB for future use
        await employerDB.add(minimalData);
      }
    } catch (error: any) {
      console.error('Failed to fetch employer data:', error);
      set({ 
        error: error?.message || 'Failed to fetch employer data', 
        isLoading: false 
      });
    }
  },
  
  fetchEmployees: async (employerAddress: string) => {
    set({ isLoading: true, error: null });
    try {
      // Get employees from IndexedDB
      const employees = await employeeDB.getByEmployer(employerAddress);
      set({ employees, isLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch employees:', error);
      set({ 
        error: error?.message || 'Failed to fetch employees', 
        isLoading: false 
      });
    }
  },
  
  updateEmployerProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      // Update employer data in IndexedDB
      await employerDB.update(data);
      
      // Update local state
      const currentData = get().employerData;
      set({ 
        employerData: currentData ? { ...currentData, ...data } : data,
        isLoading: false
      });
    } catch (error: any) {
      console.error('Failed to update employer profile:', error);
      set({ 
        error: error?.message || 'Failed to update employer profile', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  addEmployee: async (employeeData) => {
    set({ isLoading: true, error: null });
    try {
      // Add employee to IndexedDB
      await employeeDB.add(employeeData);
      
      // Refresh employees list
      await get().fetchEmployees(employeeData.employerAddress);
      set({ isLoading: false });
    } catch (error: any) {
      console.error('Failed to add employee:', error);
      set({ 
        error: error?.message || 'Failed to add employee', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  updateEmployeeStatus: async (employeeAddress: string, status: 'Active' | 'Inactive') => {
    set({ isLoading: true, error: null });
    try {
      // Update employee status in IndexedDB
      await employeeDB.updateStatus(employeeAddress, status);
      
      // Update local state
      const employees = get().employees.map(employee => 
        employee.address === employeeAddress 
          ? { ...employee, status } 
          : employee
      );
      
      set({ employees, isLoading: false });
    } catch (error: any) {
      console.error('Failed to update employee status:', error);
      set({ 
        error: error?.message || 'Failed to update employee status', 
        isLoading: false 
      });
      throw error;
    }
  },
  
  clearState: () => {
    set({
      employerData: null,
      employees: [],
      isLoading: false,
      error: null
    });
  }
}));
