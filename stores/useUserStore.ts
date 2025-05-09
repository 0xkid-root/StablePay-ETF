import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { employerDB, employeeDB } from '../lib/db';
import { checkEmployerRole, checkEmployeeRole } from '../WEB3/roleAuthentication';

type UserRole = 'employer' | 'employee' | null;

interface UserState {
  address: string | null;
  role: UserRole;
  isConnected: boolean;
  isAuthenticated: boolean;
  employerAddress: string | null; // For employees, stores their employer's address
  
  // Actions
  setAddress: (address: string | null) => void;
  setRole: (role: UserRole) => void;
  setIsConnected: (isConnected: boolean) => void;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setEmployerAddress: (employerAddress: string | null) => void;
  
  // Complex actions
  login: (address: string) => Promise<void>;
  logout: () => void;
  checkAndSetRole: (address: string) => Promise<UserRole>;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      address: null,
      role: null,
      isConnected: false,
      isAuthenticated: false,
      employerAddress: null,
      
      setAddress: (address) => set({ address }),
      setRole: (role) => set({ role }),
      setIsConnected: (isConnected) => set({ isConnected }),
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setEmployerAddress: (employerAddress) => set({ employerAddress }),
      
      login: async (address) => {
        try {
          const role = await get().checkAndSetRole(address);
          
          // Update last login time in IndexedDB
          if (role === 'employer') {
            try {
              await employerDB.updateLastLogin(address);
            } catch (error) {
              console.log('Employer not found in DB, might be first login');
            }
          }
          
          set({ 
            address, 
            isConnected: true, 
            isAuthenticated: true
          });
        } catch (error) {
          console.error('Login failed:', error);
          throw error;
        }
      },
      
      logout: () => {
        set({ 
          address: null, 
          role: null, 
          isConnected: false, 
          isAuthenticated: false,
          employerAddress: null
        });
      },
      
      checkAndSetRole: async (address) => {
        try {
          // Check blockchain roles
          const isEmployer = await checkEmployerRole(address);
          const isEmployee = await checkEmployeeRole(address);
          
          let role: UserRole = null;
          let employerAddr = null;
          
          if (isEmployer) {
            role = 'employer';
          } else if (isEmployee) {
            role = 'employee';
            
            // Get employee data from IndexedDB to find employer
            try {
              const employeeData = await employeeDB.get(address);
              if (employeeData) {
                employerAddr = employeeData.employerAddress;
              }
            } catch (error) {
              console.log('Employee data not found in DB');
            }
          }
          
          set({ role, employerAddress: employerAddr });
          return role;
        } catch (error) {
          console.error('Error checking role:', error);
          set({ role: null });
          throw error;
        }
      }
    }),
    {
      name: 'stablepay-user-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
