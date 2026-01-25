# Monad Farcaster Mini App Template

A production-ready starting point for building Farcaster Mini Apps on the Monad blockchain.

## � The Idea
a
**Where Social Meets On-Chain.**
This template bridges the gap between social feeds and blockchain utility. It allows developers to build lightweight applications that run natively inside Farcaster clients (like Warpcast), leveraging Farcaster's social context while performing high-performance on-chain actions on Monad.

## 🔗 Monad Testnet Contracts

| Contract | Address |
| :--- | :--- |
| **RUGS Token** | `0x4297F610EF0E14E988494507dF51Fb2E396A9fF3` |
| **RUGS Fun** | `0x3e52d90257fF7db1c0e300FD4c9EfBa4F0C233D3` |
| **Game Manager** | `0x279b095b1a44d1d91754359AA45725fb376185BE` |
| **Treasury** | `0x6AaAbB7085076A46B2B6b8E98BEAb0CFC56Cf910` |

## �🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone https://github.com/monad-developers/monad-miniapp-template.git
   cd monad-miniapp-template
   pnpm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.local.example .env.local
   # Set NEXT_PUBLIC_URL to your app's public URL
   ```

3. **Development**
   ```bash
   pnpm dev
   ```

## 🛠 Features

- **Farcaster Native**: Context hooks, native actions (cast, profile), and UI safety insets.
- **Monad Integration**: Built-in wallet support, Viem/Wagmi configured for Monad Testnet.
- **Tech Stack**: Next.js 15 (App Router), React 19, Tailwind CSS, Radix UI, Framer Motion.
- **Ready to Go**: Includes Supabase integration and essential styling.

## 🧪 Local Testing

Mini Apps require a public URL for Warpcast integration.

1. **Tunnel**: `cloudflared tunnel --url http://localhost:3000` (or use ngrok).
2. **Update `.env`**: Set `NEXT_PUBLIC_URL` to your tunnel URL.
3. **Warpcast**: Test via [Warpcast Embed Tool](https://warpcast.com/~/developers/mini-apps/embed).

## 📁 Key Files

- `app/page.tsx`: Mini App configuration and main entry.
- `components/pages/app.tsx`: Main application UI shell.
- `app/.well-known/farcaster.json/route.ts`: Farcaster manifest configuration.
- `constants/constants.ts`: Contract addresses and configuration.

## 📦 Deployment

Deploy to **Vercel** or any Next.js host. Ensure `NEXT_PUBLIC_URL` is set to your production domain in the dashboard.

## 📚 Resources

- [Farcaster Mini Apps Docs](https://miniapps.farcaster.xyz/)
- [Monad Documentation](https://docs.monad.xyz/)
- [Warpcast Embed Tool](https://warpcast.com/~/developers/mini-apps/embed)
