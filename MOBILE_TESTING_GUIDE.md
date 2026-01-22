# 🔧 Mobile Testing & Troubleshooting Guide

## 🚨 FIXED ISSUES

### Problem: "Server Crashed" on Mobile
**Root Cause:** WebSocket URL was hardcoded to `localhost:8080` - mobile devices can't access localhost.

**Solution Implemented:**
1. ✅ Dynamic WebSocket URL - automatically uses your computer's IP
2. ✅ Better error handling - shows helpful messages instead of crashing
3. ✅ Auto-reconnect - tries to reconnect after 3 seconds
4. ✅ Connection status indicator - shows online/offline state

---

## 📱 How to Test on Mobile (Same WiFi)

### Step 1: Start Backend
```bash
cd backend
npm run dev
```
**Make sure you see:** "WebSocket server running on port 8080"

### Step 2: Start Frontend
```bash
cd client
npm run dev
```
**Make sure you see:** "Local: http://localhost:3000"

### Step 3: Find Your Computer's IP

**On Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your WiFi adapter
Example: `192.168.1.100`

**On Mac/Linux:**
```bash
ifconfig
```
Look for "inet" under your WiFi interface
Example: `192.168.1.100`

### Step 4: Access from Mobile

**On your phone (must be on SAME WiFi):**
1. Open browser (Safari for iOS, Chrome for Android)
2. Go to: `http://YOUR-IP:3000`
   - Example: `http://192.168.1.100:3000`
3. Wait for it to load
4. Check connection status in top-right corner

---

## ✅ What to Verify

### Backend is Running:
```bash
# Check if backend WebSocket server is accessible
curl http://YOUR-IP:8080

# Should NOT error out (may show upgrade required)
```

### Frontend WebSocket Connection:
1. Open browser console on mobile (Chrome DevTools on desktop)
2. Look for: "✅ Connected to WS"
3. Should NOT see: "⚠️ WS error"

### Network Connection:
- Ensure phone and computer are on **same WiFi network**
- Disable VPN on both devices
- Check firewall isn't blocking port 8080

---

## 🐛 Common Issues & Fixes

### Issue 1: "Connection error. Please check if backend is running."

**Causes:**
- Backend not running
- Wrong IP address
- Different WiFi networks
- Firewall blocking port 8080

**Fix:**
```bash
# 1. Verify backend is running
cd backend
npm run dev

# 2. Allow port 8080 through Windows Firewall
# Windows Settings > Network & Internet > Windows Firewall
# > Advanced Settings > Inbound Rules > New Rule
# > Port > TCP > 8080 > Allow

# 3. Verify IP address is correct
ipconfig
```

### Issue 2: "Disconnected from server. Reconnecting..."

**Causes:**
- Backend crashed or restarted
- Network interruption
- Mobile locked/backgrounded

**Fix:**
- Page will auto-reload after 3 seconds
- Or manually refresh the page
- Check backend terminal for errors

### Issue 3: Can't access via IP on mobile

**Causes:**
- Phone on different WiFi
- Computer firewall blocking external connections
- Router isolation mode enabled

**Fix:**
```bash
# 1. Verify same network
# On phone: Settings > WiFi > Check network name
# On computer: Check WiFi connection

# 2. Test connection
ping YOUR-COMPUTER-IP  # from phone terminal app

# 3. Temporarily disable firewall to test
# Windows: Settings > Firewall > Turn off (test only!)
```

### Issue 4: WebSocket immediately crashes

**Causes:**
- Port 8080 already in use
- Backend crashed
- CORS issues

**Fix:**
```bash
# Check what's using port 8080
netstat -ano | findstr :8080

# Kill process if needed
taskkill /PID <process-id> /F

# Restart backend
cd backend
npm run dev
```

---

## 🔍 Debug Mode

### Enable Detailed Logging:

**In socket.ts (already implemented):**
```typescript
ws.onopen = () => {
  console.log("✅ Connected to WS");
  console.log("WebSocket URL:", url);  // Shows actual URL used
};

ws.onerror = (err) => {
  console.error("⚠️ WS error:", err);
  console.error("WebSocket URL:", url);
};
```

**View logs on mobile:**
1. **iOS Safari:**
   - Connect iPhone to Mac
   - Safari > Develop > [Your iPhone] > localhost:3000
   - Console tab shows logs

2. **Android Chrome:**
   - Connect phone via USB
   - Chrome desktop > chrome://inspect
   - Click "inspect" under your device
   - Console tab shows logs

---

## 📊 Verify Everything Works

### Checklist:
- [ ] Backend running on port 8080
- [ ] Frontend running on port 3000
- [ ] Can access frontend via IP on desktop browser
- [ ] Can access frontend via IP on mobile browser
- [ ] Connection status shows "Connected"
- [ ] No "Server Crashed" message
- [ ] WebSocket connects (check console)
- [ ] Game loads and shows waiting state

---

## 🌐 Alternative: Use ngrok (Internet Access)

If local IP doesn't work, use ngrok to expose your backend:

```bash
# Install ngrok
npm install -g ngrok

# Expose backend port
ngrok http 8080

# You'll get a URL like: https://abc123.ngrok.io

# Set environment variable
NEXT_PUBLIC_BACKEND_URL=wss://abc123.ngrok.io
```

**Then:**
1. Restart frontend
2. Access from anywhere with internet
3. No need for same WiFi

---

## 🚀 For Production Deployment

When deploying to Vercel:

1. **Deploy Backend First:**
   - Railway: https://railway.app
   - Get WebSocket URL like: `wss://your-app.railway.app`

2. **Set Environment Variable:**
   - Vercel Dashboard > Settings > Environment Variables
   - Add: `NEXT_PUBLIC_BACKEND_URL=wss://your-app.railway.app`

3. **Redeploy Frontend:**
   - Vercel will use production backend URL
   - Works from anywhere with internet

---

## 📝 Quick Test Script

Save this as `test-connection.html` and open on mobile:

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Test</title>
</head>
<body>
    <h1>WebSocket Connection Test</h1>
    <div id="status">Testing...</div>
    <div id="log"></div>
    
    <script>
        const log = document.getElementById('log');
        const status = document.getElementById('status');
        
        // Replace with your IP
        const ws = new WebSocket('ws://YOUR-IP:8080');
        
        ws.onopen = () => {
            status.innerHTML = '✅ Connected!';
            status.style.color = 'green';
            log.innerHTML += '<p>Connection successful</p>';
        };
        
        ws.onerror = (err) => {
            status.innerHTML = '❌ Connection Failed';
            status.style.color = 'red';
            log.innerHTML += '<p>Error: ' + err + '</p>';
        };
        
        ws.onclose = () => {
            log.innerHTML += '<p>Connection closed</p>';
        };
    </script>
</body>
</html>
```

---

## 💡 Pro Tips

1. **Keep Backend Terminal Visible:**
   - Watch for connection messages
   - See errors immediately

2. **Use Console Logs:**
   - Backend shows: "Client connected"
   - Frontend shows: "✅ Connected to WS"

3. **Test Step by Step:**
   - First: Access via localhost on desktop
   - Then: Access via IP on desktop
   - Finally: Access via IP on mobile

4. **Restart Everything:**
   - Sometimes a clean restart fixes issues
   - Close all terminals
   - Start backend first, then frontend

---

## 🎯 Success Indicators

**You know it's working when:**
- ✅ Mobile shows game interface (not "server crashed")
- ✅ Connection status says "Connected" 
- ✅ Can see other players count
- ✅ Game timer updates in real-time
- ✅ Can connect wallet
- ✅ Can place trades

---

## 📞 Still Having Issues?

**Check these files were updated:**
1. `client/constants/constants.ts` - Dynamic WS_URL
2. `client/app/hooks/socket.ts` - Better error handling
3. `client/app/components/connection-status.tsx` - Status indicator

**Try this:**
```bash
# Clean install
cd client
rm -rf node_modules
rm -rf .next
npm install
npm run dev
```

Good luck! 🚀
