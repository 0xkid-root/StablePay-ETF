"use client";

import { useState, useEffect } from 'react';
import { roleAuthentication, UserRole } from '../roleAuthentication';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoaderCircle, Spline, Wallet } from 'lucide-react';
import Loadable from 'next/dist/shared/lib/loadable.shared-runtime';

interface RoleAuthenticationProps {
  onRoleConfirmed: (role: UserRole) => void;
}

export function RoleAuthentication({ onRoleConfirmed }: RoleAuthenticationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      const isConnected = await roleAuthentication.isWalletConnected();
      if (isConnected) {
        const address = await roleAuthentication.connectWallet();
        setAccount(address);
        setIsConnected(true);
        const existingRole = await roleAuthentication.verifyRole(address);
        if (existingRole) {
          onRoleConfirmed(existingRole);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const address = await roleAuthentication.connectWallet();
      setAccount(address);
      setIsConnected(true);
      const existingRole = await roleAuthentication.verifyRole(address);
      if (existingRole) {
        onRoleConfirmed(existingRole);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectRole = async (role: UserRole) => {
    if (!account || !role) return;
    try {
      setLoading(true);
      setError(null);
      await roleAuthentication.setRole(account, role);
      onRoleConfirmed(role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-[350px]">
        <CardHeader className="text-center">
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!isConnected || !account) {
    return (
      <Card className="w-[350px]">
        <CardHeader className="text-center">
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>Connect your wallet to continue</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={connectWallet} disabled={loading}>
            {loading ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wallet className="mr-2 h-4 w-4" />
            )}
            Connect MetaMask
          </Button>
        </CardContent>
        {error && (
          <p className="text-sm text-red-500 text-center mt-2">{error}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="w-[350px]">
      <CardHeader className="text-center">
        <CardTitle>Select Your Role</CardTitle>
        <CardDescription>Choose your role to continue</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          onClick={() => selectRole('employer')}
          variant="outline"
          className="w-full"
          disabled={loading}
        >
          I'm an Employer
        </Button>
        <Button
          onClick={() => selectRole('employee')}
          variant="outline"
          className="w-full"
          disabled={loading}
        >
          I'm an Employee
        </Button>
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}