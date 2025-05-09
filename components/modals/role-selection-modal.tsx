"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/gradient-button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CheckCircle, Briefcase, User, AlertCircle, ArrowRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ethers } from "ethers";
import ClientOnly from "../client-only";

import { useAuthentication } from "@/hooks/useAuthentication";
import { useUserStore } from "@/stores/useUserStore";

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RoleSelectionModal({
  isOpen,
  onClose,
  onSuccess,
}: RoleSelectionModalProps) {
  const [selectedRole, setSelectedRole] = useState<"employer" | "employee" | null>(null);
  const [employerAddress, setEmployerAddress] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [hasCopied, setHasCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get authentication hooks and state
  const {
    isLoading,
    error: authError,
    connectWallet,
    register,
    login,
    checkNetwork,
    switchNetwork,
    address,
  } = useAuthentication();
  
  // Get user store functions
  const { setEmployerAddress: storeEmployerAddress } = useUserStore();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setValidationError(null);
    }
  }, [isOpen]);

  const validateEmployerAddress = (address: string) => {
    if (!address) return "Employer address is required";
    
    try {
      // Validate that it's a proper Ethereum address
      ethers.utils.getAddress(address);
      return null;
    } catch (err) {
      return "Invalid Ethereum address format";
    }
  };

  const handleEmployerAddressChange = (value: string) => {
    setEmployerAddress(value);
    setValidationError(value ? validateEmployerAddress(value) : null);
  };

  const copyToClipboard = async (e: React.MouseEvent<HTMLButtonElement>) => {
    try {
      // If we have an address from the wallet, copy that
      if (address) {
        await navigator.clipboard.writeText(address);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy address", err);
    }
  };

  const handleRoleSelection = async () => {
    // Validate input before proceeding
    if (selectedRole === "employee" && !employerAddress) {
      setError("Please enter your employer's wallet address");
      return;
    }

    if (selectedRole === "employee" && validationError) {
      setError(validationError);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Connect to wallet first if not already connected
      if (!address) {
        console.log("Connecting wallet...");
        try {
          await connectWallet();
          console.log("Wallet connected successfully");
        } catch (walletError: any) {
          console.error("Wallet connection error:", walletError);
          throw new Error(
            walletError.message || "Failed to connect wallet. Please try again."
          );
        }
      }
      
      // Step 2: Check if we're on a supported network
      console.log("Checking network...");
      let networkStatus;
      try {
        networkStatus = await checkNetwork();
        console.log("Network status:", networkStatus);
      } catch (networkError: any) {
        console.error("Network check error:", networkError);
        throw new Error(
          networkError.message || "Failed to check network. Please refresh and try again."
        );
      }
      
      if (!networkStatus.valid) {
        console.log(`Current network ${networkStatus.name} is not supported. Attempting to switch...`);
        // Ask user to switch networks to the default network
        try {
          const switched = await switchNetwork(); // Uses DEFAULT_NETWORK_ID
          if (!switched) {
            throw new Error(
              `Please switch to a supported network to continue. Current network: ${networkStatus.name}`
            );
          }
          console.log("Successfully switched network");
        } catch (switchError: any) {
          console.error("Network switch error:", switchError);
          throw new Error(
            switchError.message || "Failed to switch network. Please try switching manually in your wallet."
          );
        }
      }

      // Step 3: Register or login based on mode
      if (mode === "register") {
        if (selectedRole === "employer") {
          console.log("Registering as employer...");
          try {
            await register("employer");
            console.log("Successfully registered as employer");
          } catch (registerError: any) {
            console.error("Employer registration error:", registerError);
            throw new Error(
              registerError.message || "Failed to register as employer. Please try again."
            );
          }
        } else if (selectedRole === "employee" && employerAddress) {
          console.log("Registering as employee with employer address:", employerAddress);
          try {
            await register("employee", employerAddress);
            console.log("Successfully registered as employee");
          } catch (registerError: any) {
            console.error("Employee registration error:", registerError);
            throw new Error(
              registerError.message || "Failed to register as employee. Please try again."
            );
          }
        }
      } else {
        // Login mode
        console.log("Logging in...");
        try {
          await login();
          console.log("Successfully logged in");
          
          // If employee role is selected, store the employer address
          if (selectedRole === "employee" && employerAddress) {
            storeEmployerAddress(employerAddress);
            console.log("Stored employer address:", employerAddress);
          }
        } catch (loginError: any) {
          console.error("Login error:", loginError);
          throw new Error(
            loginError.message || "Failed to login. Please try again."
          );
        }
      }

      // Success! Close the modal and notify the parent component
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Role selection error:", error);
      
      // Handle different error types
      if (error.message?.includes("User rejected")) {
        setError("You rejected the wallet connection request. Please try again and approve the connection.");
      } else if (error.message?.includes("network")) {
        setError("Network Error: Please ensure your wallet is connected to a supported network.");
      } else if (error.code === -32002) {
        setError("Wallet connection request pending. Please check your wallet and approve the connection.");
      } else if (error.code === 4001) {
        setError("You rejected the wallet connection request. Please try again and approve the connection.");
      } else {
        setError(error.message || "An unknown error occurred");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-white to-slate-50 border-indigo-100 shadow-lg">
        <ClientOnly fallback={<div className="p-8 text-center">Loading...</div>}>
        <DialogHeader className="space-y-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto">
            {mode === "register" ? (
              <User className="text-white" size={24} />
            ) : (
              <ArrowRight className="text-white" size={24} />
            )}
          </div>
          <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {mode === "register" ? "Join StablePay ETF" : "Welcome Back"}
          </DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            {mode === "register"
              ? "Choose your role to get started with our decentralized payroll platform"
              : "Select your role to access your dashboard"}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="register"
          value={mode}
          onValueChange={(value) => setMode(value as "register" | "login")}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger
              value="register"
              className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
            >
              Register
            </TabsTrigger>
            <TabsTrigger
              value="login"
              className="data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700"
            >
              Login
            </TabsTrigger>
          </TabsList>

          <TabsContent value="register" className="space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Select your role:</div>
            <div className="flex flex-col gap-4">
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 p-5 rounded-lg border-2 transition-all duration-200",
                  selectedRole === "employer"
                    ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                )}
                onClick={() => {
                  setSelectedRole("employer");
                  setEmployerAddress("");
                  setValidationError(null);
                }}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedRole === "employer" ? "bg-blue-100" : "bg-gray-100"
                  )}
                >
                  <Briefcase
                    className={selectedRole === "employer" ? "text-blue-600" : "text-gray-500"}
                    size={20}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Employer</span>
                  <span className="text-sm text-gray-500">Manage payroll and employees</span>
                </div>
                {selectedRole === "employer" && (
                  <CheckCircle className="ml-auto text-blue-600" size={20} />
                )}
              </button>

              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 p-5 rounded-lg border-2 transition-all duration-200",
                  selectedRole === "employee"
                    ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                )}
                onClick={() => setSelectedRole("employee")}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedRole === "employee" ? "bg-blue-100" : "bg-gray-100"
                  )}
                >
                  <User
                    className={selectedRole === "employee" ? "text-blue-600" : "text-gray-500"}
                    size={20}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Employee</span>
                  <span className="text-sm text-gray-500">Receive payroll and manage investments</span>
                </div>
                {selectedRole === "employee" && (
                  <CheckCircle className="ml-auto text-blue-600" size={20} />
                )}
              </button>
            </div>

            {selectedRole === "employee" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Employer&apos;s Wallet Address
                </label>
                <div className="relative">
                  <Input
                    placeholder="0x..."
                    value={employerAddress}
                    onChange={(e) => handleEmployerAddressChange(e.target.value)}
                    className={cn(
                      "pr-10",
                      validationError
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "focus-visible:ring-blue-500"
                    )}
                  />
                </div>
                {validationError && (
                  <div className="flex items-center gap-1 text-sm text-red-500 mt-1">
                    <AlertCircle size={16} />
                    <span>{validationError}</span>
                  </div>
                )}
                <p className="text-xs text-gray-500 italic mt-1">
                  Ask your employer for their wallet address to register as their employee
                </p>
              </div>
            )}

            {selectedRole === "employer" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Wallet Address (Share with employees)
                </label>
                <div className="relative">
                  <Input
                    readOnly
                    value={address || "Connect wallet to view your address"}
                    className="pr-10 bg-gray-50"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full pr-3 text-gray-500 hover:text-blue-600"
                    onClick={copyToClipboard}
                    disabled={!address}
                  >
                    {hasCopied ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 italic mt-1">
                  Your employees will need this address to register under your company
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="login" className="space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Select your role to login:</div>
            <div className="flex flex-col gap-4">
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 p-5 rounded-lg border-2 transition-all duration-200",
                  selectedRole === "employer"
                    ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                )}
                onClick={() => {
                  setSelectedRole("employer");
                  setEmployerAddress("");
                  setValidationError(null);
                }}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedRole === "employer" ? "bg-blue-100" : "bg-gray-100"
                  )}
                >
                  <Briefcase
                    className={selectedRole === "employer" ? "text-blue-600" : "text-gray-500"}
                    size={20}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Employer</span>
                  <span className="text-sm text-gray-500">Access your employer dashboard</span>
                </div>
                {selectedRole === "employer" && (
                  <CheckCircle className="ml-auto text-blue-600" size={20} />
                )}
              </button>

              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 p-5 rounded-lg border-2 transition-all duration-200",
                  selectedRole === "employee"
                    ? "border-blue-500 bg-blue-50 text-blue-800 shadow-md"
                    : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                )}
                onClick={() => setSelectedRole("employee")}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    selectedRole === "employee" ? "bg-blue-100" : "bg-gray-100"
                  )}
                >
                  <User
                    className={selectedRole === "employee" ? "text-blue-600" : "text-gray-500"}
                    size={20}
                  />
                </div>
                <div className="flex flex-col items-start">
                  <span className="font-semibold text-lg">Employee</span>
                  <span className="text-sm text-gray-500">Access your employee dashboard</span>
                </div>
                {selectedRole === "employee" && (
                  <CheckCircle className="ml-auto text-blue-600" size={20} />
                )}
              </button>
            </div>

            {selectedRole === "employee" && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Employer&apos;s Wallet Address
                </label>
                <div className="relative">
                  <Input
                    placeholder="0x..."
                    value={employerAddress}
                    onChange={(e) => handleEmployerAddressChange(e.target.value)}
                    className={cn(
                      "pr-10",
                      validationError
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "focus-visible:ring-blue-500"
                    )}
                  />
                </div>
                {validationError && (
                  <div className="flex items-center gap-1 text-sm text-red-500 mt-1">
                    <AlertCircle size={16} />
                    <span>{validationError}</span>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {(error || authError) && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 animate-appear">
            <AlertCircle className="text-red-500 flex-shrink-0" size={16} />
            <p className="text-sm text-red-600">{error || authError}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <GradientButton
            onClick={handleRoleSelection}
            disabled={
              isLoading || 
              !selectedRole ||
              (selectedRole === "employee" && mode === "register" && (!employerAddress || !!validationError))
            }
            className="px-8 py-2 font-medium"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing...</span>
              </div>
            ) : mode === "register" ? "Register" : "Login"}
          </GradientButton>
        </DialogFooter>
        </ClientOnly>
      </DialogContent>
    </Dialog>
  );
}
