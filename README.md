# Monad Farcaster Mini App

A production-ready Farcaster Mini App built on Monad blockchain, demonstrating the full capabilities of Mini Apps with seamless social and blockchain integration.

## About This Project

This Mini App showcases the power of combining Farcaster's social features with Monad's high-performance blockchain. Built with Next.js 15, React 19, and TypeScript, it provides a complete foundation for building engaging social dApps.

## Features

✨ **Social Integration**
- Access user context (username, FID, profile data)
- Native Farcaster actions (compose cast, view profile, bookmark)
- Seamless social sharing and engagement

💰 **Blockchain Capabilities**
- Built-in wallet integration (no external wallet needed)
- Monad Testnet support out-of-the-box
- Transaction handling with Viem and Wagmi
- Smart contract interactions

🎨 **Modern UI/UX**
- Radix UI components for accessible interfaces
- Tailwind CSS for responsive design
- Framer Motion animations
- Dark mode support with next-themes

🚀 **Developer Experience**
- TypeScript for type safety
- Next.js 15 with App Router
- Hot reload development
- Production-ready architecture

## Getting Started

### Prerequisites

- Node.js 18+ and Yarn
- A Farcaster account for testing
- Basic knowledge of React and TypeScript

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/monad-developers/monad-miniapp-template.git
cd monad-miniapp-template
```
 
2. **Install dependencies**

```bash
yarn install
```

3. **Set up environment variables**

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your configuration:

```env
NEXT_PUBLIC_URL=http://localhost:3000
# Add other environment variables as needed
```

4. **Run the development server**

```bash
yarn dev
```

The app will be available at `http://localhost:3000`

### Testing in Warpcast

To test your Mini App in Warpcast, you'll need to expose your local server to the internet.

#### Option 1: Using Cloudflared (Recommended)

1. **Install Cloudflared**

```bash
# macOS
brew install cloudflared

# Windows
winget install --id Cloudflare.cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

2. **Expose your local server**

```bash
cloudflared tunnel --url http://localhost:3000
```

3. **Update your `.env.local`**

```bash
NEXT_PUBLIC_URL=<url-from-cloudflared>
```

4. **Test in Warpcast Embed Tool**

Visit the [Warpcast Embed Tool](https://warpcast.com/~/developers/mini-apps/embed) and enter your cloudflared URL.

#### Option 2: Using ngrok

```bash
ngrok http 3000
```

Then update `NEXT_PUBLIC_URL` in `.env.local` with the ngrok URL.

## Project Structure

## Customizing the Mini App Embed

Mini App Embed is how the Mini App shows up in the feed or in a chat conversation when the URL of the app is shared.

The Mini App Embed looks like this:

![embed-preview](https://docs.monad.xyz/img/guides/farcaster-miniapp/2.png)

You can customize this by editing the file `app/page.tsx`:

```js
...

const appUrl = env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/images/feed.png`, // Embed image URL (3:2 image ratio)
  button: {
    title: "Template", // Text on the embed button
    action: {
      type: "launch_frame",
      name: "Monad Farcaster MiniApp Template",
      url: appUrl, // URL that is opened when the embed button is tapped or clicked.
      splashImageUrl: `${appUrl}/images/splash.png`,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};

...
```

You can either edit the URLs for the images or replace the images in `public/images` folder in the template.

Once you are happy with the changes, click `Refetch` in the Embed tool to get the latest configuration.

> [!NOTE]
> If you are developing locally, ensure that your Next.js app is running locally and the cloudflare tunnel is open. 


## Customizing the Splash Screen

Upon opening the Mini App, the first thing the user will see is the Splash screen:

![splash-screen](https://docs.monad.xyz/img/guides/farcaster-miniapp/3.png)

You can edit the `app/page.tsx` file to customize the Splash screen.

```js
...

const appUrl = env.NEXT_PUBLIC_URL;

const frame = {
  version: "next",
  imageUrl: `${appUrl}/images/feed.png`,
  button: {
    title: "Launch Template",
    action: {
      type: "launch_frame",
      name: "Monad Farcaster MiniApp Template",
      url: appUrl,
      splashImageUrl: `${appUrl}/images/splash.png`, // App icon in the splash screen (200px * 200px)
      splashBackgroundColor: "#f7f7f7", // Splash screen background color
    },
  },
};

...
```

For `splashImageUrl`, you can either change the URL or replace the image in `public/images` folder in the template.

## Modifying the Mini App

Upon opening the template Mini App, you should see a screen like this:

<img width="1512" alt="4" src="https://github.com/user-attachments/assets/259a3dd2-17ee-4afd-8942-ad83a92f6335" />


The code for this screen is in the `components/pages/app.tsx` file:

```tsx
export default function Home() {
  const { context } = useMiniAppContext();
  return (
    // SafeAreaContainer component makes sure that the app margins are rendered properly depending on which client is being used.
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      {/* You replace the Demo component with your home component */}
      <Demo />
    </SafeAreaContainer>
  )
}
```

You can remove or edit the code in this file to build your Mini App.

### Accessing User Context

<img width="1130" alt="5" src="https://github.com/user-attachments/assets/4448c141-d159-4538-abda-a175d02330a7" />


Your Mini App receives various information about the user, including `username`, `fid`, `displayName`, `pfpUrl` and other fields.

The template provides a helpful hook `useMiniAppContext` that you can use to access these fields:

```js
export function User() {
    const { context } = useMiniAppContext();
    return <p>{context.user.username}</p>
}
```

The template also provide an example of the same in `components/Home/User.tsx` file.

You can learn more about Context [here](https://miniapps.farcaster.xyz/docs/sdk/context).

### Performing App Actions

![composeCast](https://docs.monad.xyz/img/guides/farcaster-miniapp/composeCast.gif)

Mini Apps have the capability to perform native actions that enhance the user experience!

Actions like:

- `addFrame`: Allows the user to save (bookmark) the app in a dedicated section
- `composeCast`: Allows the MiniApp to prompt the user to cast with prefilled text and media
- `viewProfile`: Presents a profile of a Farcaster user in a client native UI

Learn more about Mini App actions [here](https://miniapps.farcaster.xyz/docs/sdk/actions/add-frame)

The template provides an easy way to access the actions via the `useMiniAppContext` hook!

```js
const { actions } = useMiniAppContext();
```

An example for the same can be found in `components/Home/FarcasterActions.tsx` file.

### Prompting Wallet Actions

<img width="1130" alt="6" src="https://github.com/user-attachments/assets/7dc46f05-bcbb-43b4-a0e6-4f421648dfc6" />

Every user of Warpcast has a Warpcast wallet with Monad Testnet support.

**Mini Apps can prompt the user to perform onchain actions**!

The template provides an example for the same in `components/Home/WalletActions.tsx` file.

```js
export function WalletActions() {
    ...

    async function sendTransactionHandler() {
        sendTransaction({
            to: "0x7f748f154B6D180D35fA12460C7E4C631e28A9d7",
            value: parseEther("1"),
        });
    }

    ...
}
```

> [!WARNING]
> The Warpcast wallet supports multiple networks. It is recommended that you ensure that the right network is connected before prompting wallet actions.

You can use viem's `switchChain` or equivalent to prompt a chain switch.

```js
// Switching to Monad Testnet
switchChain({ chainId: 10143 });
```

The template has an example for the same in the `components/Home/WalletActions.tsx` file.
:::

## Modifying the `farcaster.json` file

When publishing the Mini App you will need to have a `farcaster.json` file that follows the specification.

You can edit the `app/.well-known/farcaster.json/route.ts` file with your app details before publishing the app!

```ts
...

const appUrl = process.env.NEXT_PUBLIC_URL;
const farcasterConfig = {
    // accountAssociation details are required to associated the published app with it's author
    accountAssociation: {
        "header": "",
        "payload": "",
        "signature": ""
    },
    frame: {
        version: "1",
        name: "Monad Farcaster MiniApp Template",
        iconUrl: `${appUrl}/images/icon.png`, // Icon of the app in the app store
        homeUrl: `${appUrl}`, // Default launch URL
        imageUrl: `${appUrl}/images/feed.png`, // Default image to show if shared in a feed.
        screenshotUrls: [], // Visual previews of the app
        tags: ["monad", "farcaster", "miniapp", "template"], // Descriptive tags for search
        primaryCategory: "developer-tools",
        buttonTitle: "Launch Template",
        splashImageUrl: `${appUrl}/images/splash.png`, // URL of image to show on loading screen.	
        splashBackgroundColor: "#ffffff", // Hex color code to use on loading screen.
    }
};

...
```

You can learn more about publishing the Mini App and other manifest properties [here](https://miniapps.farcaster.xyz/docs/guides/publishing).

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with modern features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Smooth animations

### Blockchain
- **Viem** - TypeScript-first Ethereum library
- **Wagmi** - React hooks for Ethereum
- **Ethers.js** - Contract interactions

### Farcaster
- **@farcaster/miniapp-sdk** - Official Mini App SDK
- **@farcaster/miniapp-wagmi-connector** - Wallet integration

### Additional Tools
- **Supabase** - Database and authentication
- **Upstash Redis** - Caching and real-time features
- **Zustand** - State management
- **Zod** - Schema validation

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Configure environment variables
4. Deploy!

Vercel will automatically detect Next.js and configure the build settings.

### Environment Variables for Production

Make sure to set these in your deployment platform:

```env
NEXT_PUBLIC_URL=https://your-domain.com
# Add other production environment variables
```

## Publishing Your Mini App

1. **Update the manifest** in `app/.well-known/farcaster.json/route.ts`
2. **Add account association** (required for publishing)
3. **Test thoroughly** in the Warpcast Embed Tool
4. **Submit to Farcaster** Mini App store

For detailed publishing instructions, see the [official documentation](https://miniapps.farcaster.xyz/docs/guides/publishing).

## Resources

- 📚 [Farcaster Mini Apps Documentation](https://miniapps.farcaster.xyz/)
- 📖 [Monad Documentation](https://docs.monad.xyz/)
- 🛠️ [Warpcast Embed Tool](https://warpcast.com/~/developers/mini-apps/embed)
- 💬 [Monad Discord](https://discord.gg/monad)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Join the Monad Discord community
- Check the troubleshooting guide in `TROUBLESHOOTING.md`
