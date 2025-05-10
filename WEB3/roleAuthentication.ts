import { ethers } from 'ethers';
import Cookies from 'js-cookie';

export type UserRole = 'employer' | 'employee' | null;

class RoleAuthentication {
  private provider: ethers.providers.Web3Provider | null = null;

  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('Please install MetaMask');
    }
    this.provider = new ethers.providers.Web3Provider(window.ethereum);
  }

  async connectWallet(): Promise<string> {
    if (!this.provider) {
      await this.initialize();
    }
    try {
      const accounts = await this.provider!.send('eth_requestAccounts', []);
      const address = accounts[0];
      return address;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }

  async verifyRole(address: string): Promise<UserRole> {
    // Here you would typically make a contract call or API request to verify the role
    // For now, we'll simulate this with local storage
    const role = localStorage.getItem(`role_${address}`);
    return role as UserRole;
  }

  async setRole(address: string, role: UserRole): Promise<void> {
    // Here you would typically make a contract call or API request to set the role
    // For now, we'll simulate this with local storage
    if (role) {
      localStorage.setItem(`role_${address}`, role);
      Cookies.set('auth-token', address);
      Cookies.set('user-role', role);
    }
  }

  async logout(): Promise<void> {
    Cookies.remove('auth-token');
    Cookies.remove('user-role');
  }

  async isWalletConnected(): Promise<boolean> {
    if (!this.provider) {
      await this.initialize();
    }
    try {
      const accounts = await this.provider!.listAccounts();
      return accounts.length > 0;
    } catch {
      return false;
    }
  }
}

export const roleAuthentication = new RoleAuthentication();