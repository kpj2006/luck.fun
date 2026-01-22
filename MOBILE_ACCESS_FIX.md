# 🔧 Mobile Access Fix - Quick Start Guide

## ✅ What Was Fixed:

1. **Backend now listens on 0.0.0.0** - Accepts connections from any device on your network
2. **Dynamic WebSocket URL** - Client-side detection of hostname
3. **Debug Panel** - Shows exact URLs being used (bottom-left button with "i" icon)
4. **Better logging** - Console shows which URL is being used

---

## 🚀 Start the App:

### 1. Start Backend:
```bash
cd backend
npm run dev
```

**You should see:**
```
✅ WebSocket server running on 0.0.0.0:8080
📱 Mobile access: Use ws://YOUR-LOCAL-IP:8080
💻 Desktop access: Use ws://localhost:8080
```

### 2. Start Frontend:
```bash
cd client
npm run dev
```

### 3. Find Your Computer's IP:

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" - Example: `192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
```
Look for "inet" - Example: `192.168.1.100`

### 4. Access from Mobile:

**On your phone (SAME WiFi network):**
```
http://YOUR-IP:3000
```
Example: `http://192.168.1.100:3000`

---

## 🐛 Debug Panel

Click the **"i" icon** in bottom-left corner to see:
- Current hostname
- WebSocket URL being used
- Connection status
- Expected backend URL

**What to check:**
- ✅ **Hostname** should be your IP (e.g., 192.168.1.100)
- ✅ **WebSocket URL** should be `ws://YOUR-IP:8080`
- ✅ **Online** should be "Yes"

---

## ✅ Verification Steps:

### On Desktop (http://localhost:3000):
1. Open browser console (F12)
2. Look for: `Using localhost URL: ws://localhost:8080`
3. Should see: `✅ Connected to WS`
4. Game should work

### On Mobile (http://YOUR-IP:3000):
1. Open Debug Panel (bottom-left "i" icon)
2. Check WebSocket URL shows `ws://YOUR-IP:8080`
3. Top-right should show "Connected" briefly
4. Game should work

---

## 🔥 Common Issues:

### Issue: "Server Offline" on mobile

**Check #1: Backend is running**
```bash
# In backend terminal, you should see:
✅ WebSocket server running on 0.0.0.0:8080
```

**Check #2: Same WiFi network**
- Phone and computer must be on SAME WiFi
- Not mobile data, not different WiFi

**Check #3: Firewall**
```bash
# Windows: Allow port 8080
# Settings > Windows Firewall > Allow app through firewall
# Add exception for port 8080
```

**Check #4: Test backend accessibility**
```bash
# From another device on same network:
curl http://YOUR-IP:8080

# Should NOT timeout (may show error, but should connect)
```

### Issue: "Cannot connect" on mobile but works on desktop

**Cause:** Backend only listening on localhost

**Fix:** Make sure you updated the backend code:
```typescript
// backend/src/index.ts should have:
const wss = new WebSocketServer({ 
  port: 8080,
  host: '0.0.0.0' // <-- This line is crucial!
});
```

**Then restart backend:**
```bash
cd backend
npm run dev
```

### Issue: Wrong WebSocket URL in debug panel

**If debug panel shows `ws://localhost:8080` on mobile:**
- Hard refresh the page (Ctrl+Shift+R)
- Clear browser cache
- Try incognito/private mode

**The URL should automatically match your access method:**
- Desktop: `ws://localhost:8080`
- Mobile: `ws://YOUR-IP:8080`

---

## 📝 Testing Checklist:

### Desktop:
- [ ] Backend starts and shows "0.0.0.0:8080"
- [ ] Frontend loads at localhost:3000
- [ ] Console shows "Using localhost URL"
- [ ] Game connects and works
- [ ] Can see other players count
- [ ] Can connect wallet

### Mobile:
- [ ] Can access http://YOUR-IP:3000
- [ ] Debug panel shows correct IP in WebSocket URL
- [ ] Connection status briefly shows "Connected"
- [ ] Game loads (no "server crashed")
- [ ] Can see game timer
- [ ] Can connect wallet
- [ ] Transactions work

---

## 🎯 Success Indicators:

**Backend Terminal:**
```
✅ WebSocket server running on 0.0.0.0:8080
🟢 New client connected  <-- Should see this when you connect
```

**Browser Console:**
```
Current hostname: 192.168.1.100
Using dynamic URL: ws://192.168.1.100:8080
✅ Connected to WS
Sent identification: guest
```

**Debug Panel (Mobile):**
```
Hostname: 192.168.1.100
WebSocket URL: ws://192.168.1.100:8080
Online: Yes
Expected Backend: http://192.168.1.100:8080
```

**Connection Status Badge:**
- Shows "Connecting..." (yellow) briefly
- Shows "Connected" (green) briefly then disappears
- **NO** "Server Offline" (red)

---

## 💡 Pro Tips:

1. **Keep backend terminal visible** - Watch for "New client connected"
2. **Use Debug Panel** - Bottom-left "i" icon shows all connection info
3. **Check browser console** - F12 shows detailed logs
4. **Restart both** - If issues persist, restart backend then frontend
5. **Same WiFi essential** - Double-check both devices on same network

---

## 🔧 Quick Troubleshooting Commands:

```bash
# Check if backend is accessible
curl http://YOUR-IP:8080

# Find your IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Check what's using port 8080
netstat -ano | findstr :8080  # Windows
lsof -i :8080                 # Mac/Linux

# Kill process on port 8080 (if needed)
taskkill /PID <process-id> /F  # Windows
kill -9 <process-id>           # Mac/Linux

# Test WebSocket from command line
npm install -g wscat
wscat -c ws://YOUR-IP:8080
```

---

## 🎉 It's Working When:

- ✅ Mobile loads game interface (not "server crashed")
- ✅ Debug panel shows correct IP-based WebSocket URL
- ✅ Connection badge shows "Connected" then disappears
- ✅ Backend terminal shows "New client connected"
- ✅ Game timer updates in real-time
- ✅ Can see connected players count
- ✅ Wallet connection works
- ✅ Can place trades

---

**Still not working? Check the Debug Panel first - it will show you exactly what URLs are being used!**
