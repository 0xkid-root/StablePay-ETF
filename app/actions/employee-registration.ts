'use client';

import { useEmployeeStore } from '@/stores/useEmployeeStore';
import { employeeDB, employerDB } from '@/lib/db';

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
    // Check if the employer exists in IndexedDB
    const employer = await employerDB.get(employerAddress);
    
    if (!employer) {
      // If the employer doesn't exist in IndexedDB, register them
      console.log('Employer not found in IndexedDB, registering them first...');
      await employerDB.add({
        address: employerAddress,
        name: 'Auto-registered Employer'
      });
    }

    // Use the Zustand store to handle employee registration
    const registerEmployee = useEmployeeStore.getState().registerAsEmployee;
    await registerEmployee(employerAddress);

    // Update employee details in IndexedDB
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
      throw dbError;
    }

    return { success: true };
  } catch (error: any) {
    console.error('Employee registration error:', error);
    return {
      success: false,
      error: `Failed to register as employee: ${error.message || 'Registration failed'}`,
    };
  }
}