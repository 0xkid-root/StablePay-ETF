"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { GradientButton } from "@/components/ui/gradient-button"
import { PlusCircle } from "lucide-react"
import { handleEmployeeRegistration } from "@/app/actions/employee-registration"
import { useToast } from "@/components/ui/use-toast"
import { ethers } from "ethers"
import { useRouter } from "next/navigation"

interface AddEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (employee: {
    name: string
    address: string
    amount: string
    schedule: string
  }) => void
  isProcessing: boolean
}

export function AddEmployeeModal({ isOpen, onClose, onSubmit, isProcessing }: AddEmployeeModalProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    amount: "",
    schedule: "Bi-weekly",
  })

  const handleSubmit = async () => {
    console.log("Employee address:", formData.address)
    if (!formData.name || !formData.address || !formData.amount) return
    
    try {
      // Get the current wallet address (employer's address) from window.ethereum
      let employerAddress = "";
      if (!window.ethereum) {
        throw new Error("MetaMask not detected. Please install MetaMask or another Web3 wallet");
      }
      
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please connect your wallet.");
      }
      
      employerAddress = accounts[0];
      console.log("Employer address (current wallet):", employerAddress);
      
      // Check if we're on a supported network
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      console.log("Current network:", network);
      
      // List of supported networks
      const supportedNetworks: Record<number, string> = {
        1: 'Ethereum Mainnet',
        5: 'Goerli Testnet',
        11155111: 'Sepolia Testnet',
        137: 'Polygon Mainnet',
        80001: 'Mumbai Testnet',
        50002: 'Foundry Local'
      };
      
      // If not on a supported network, try to switch to Foundry Local
      if (!supportedNetworks[network.chainId]) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xc352' }], // 0xc352 is hex for 50002
          });
          console.log("Switched to Foundry Local network");
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0xc352', // 50002 in hex
                    chainName: 'Foundry Local',
                    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                    rpcUrls: ['http://localhost:8545'],
                    blockExplorerUrls: []
                  }
                ],
              });
              console.log("Added and switched to Foundry Local network");
            } catch (addError: any) {
              throw new Error(`Failed to add Foundry Local network: ${addError.message || 'Unknown error'}`);
            }
          } else {
            throw new Error(`Failed to switch network: ${switchError.message}`);
          }
        }
      }

      // Check if the current address is registered as an employer in IndexedDB
      const { employerDB } = await import('@/lib/db');
      const employer = await employerDB.get(employerAddress);
      
      if (!employer) {
        console.log('Current address is not registered as an employer in IndexedDB, registering now...');
        // Auto-register the current address as an employer
        await employerDB.add({
          address: employerAddress,
          name: 'Auto-registered Employer'
        });
        console.log('Successfully registered current address as an employer');
      }
      
      // Pass the employer's address (current wallet) and employee data
      const result = await handleEmployeeRegistration(
        employerAddress, 
        formData
      )
      console.log("Registration result:", result)

      if (result.success) {
        onSubmit(formData)
        setFormData({
          name: "",
          address: "",
          amount: "",
          schedule: "Bi-weekly",
        })
        toast({
          title: "Success",
          description: "Employee registered successfully",
        })
        
        // Redirect to the employee dashboard
        // We'll first close the modal, then redirect after a short delay
        onClose()
        setTimeout(() => {
          // Redirect the newly registered employee to their dashboard
          router.push(`/employee?address=${formData.address}`)
        }, 1000) // 1 second delay to allow the toast to be visible
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || "Failed to register employee",
        })
      }
    } catch (error: any) {
      console.error("Employee registration error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to register employee",
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>Enter employee details to add them to your payroll</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Employee Name</label>
            <Input
              placeholder="Enter employee name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet Address</label>
            <Input
              placeholder="0x..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payroll Amount (SPAY)</label>
            <Input
              type="number"
              placeholder="1000"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Schedule</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.schedule}
              onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
            >
              <option>Bi-weekly</option>
              <option>Monthly</option>
              <option>Weekly</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <GradientButton
            className="gap-2"
            onClick={handleSubmit}
            disabled={isProcessing || !formData.name || !formData.address || !formData.amount}
          >
            <PlusCircle className="h-4 w-4" />
            {isProcessing ? "Processing..." : "Add Employee"}
          </GradientButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}