import type React from "react"
import type { Metadata } from "next/types"
import { Inter } from 'next/font/google'
import "./globals.css"
import ClientLayout from "./ClientLayout"
import { Web3Provider } from "@/providers/web3-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "StablePay ETF",
  description: "A blockchain-based payroll platform using a stablecoin backed by gold, BTC, and ETH ETFs",
  generator: 'v0.dev',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
    other: {
      rel: 'mask-icon',
      url: '/favicon.svg'
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Web3Provider>
          <ClientLayout>{children}</ClientLayout>
          <Toaster />
        </Web3Provider>
      </body>
    </html>
  )
}
