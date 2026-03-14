# Paxion Web And Cloud Deployment

## Recommended free deployment

Use this split:

1. Frontend PWA: Vercel free
2. Cloud relay backend: Render free
3. Source control and releases: GitHub

This gives you:

1. An installable phone web app
2. Browser access from anywhere
3. Cloud relay access without your PC being on

## Important limitation

The current web deployment is real and usable, but it is not full Electron parity.

Works in hosted web/PWA mode:

1. Chat UI
2. Library UI and browser-local persistence
3. Logs/workspace UI
4. Mobile install as PWA
5. Cloud relay configuration and queue viewing
6. Browser-supported voice input/output

Still desktop-only today:

1. Native tray runtime
2. Native wake-word binaries
3. Secure OS storage
4. Direct Electron IPC features
5. Native terminal/workspace execution
6. Direct telephony runtime integrations tied to Electron main process

So if your PC is off, the hosted app still works as a web app, but only the features already available in browser mode or backed by the cloud relay will work.

## Frontend deploy on Vercel

Prerequisites:

1. Push the repo to GitHub
2. Have a Vercel account

Steps:

1. In Vercel, choose Add New Project
2. Import the GitHub repo
3. Keep the root directory as the repo root
4. Framework preset: Vite
5. Build command: `npm run build`
6. Output directory: `dist`
7. Deploy

The repo includes [vercel.json](../vercel.json) for SPA rewrites and service worker headers.

After deploy:

1. Open the deployed URL on your phone
2. Use the in-app Install On Phone button when available
3. If the browser does not show the install prompt, use Add to Home Screen manually

## Relay deploy on Render

Prerequisites:

1. Have a Render account
2. Generate a strong random relay token

Steps:

1. In Render, create a new Web Service
2. Point it at this repo
3. Root directory: `relay`
4. Build command: `npm install`
5. Start command: `npm start`
6. Set env var `PAXION_RELAY_TOKEN` to a long random secret
7. Deploy

The relay service also supports platform `PORT` automatically.

Optional:

1. Use [relay/render.yaml](../relay/render.yaml) as a Render blueprint reference

Health check:

1. Open `https://your-render-service.onrender.com/health`
2. Expected response: `{ "ok": true, "service": "paxion-cloud-relay" }`

## Connect the hosted app to the relay

In Paxion Access tab:

1. Set Relay endpoint to your Render URL
2. Set Relay token to the same `PAXION_RELAY_TOKEN`
3. Set Mode to `cloud`
4. Enable queue polling if desired
5. Save config

## Best practical production path

If you want true full power even while your PC is off, the next architecture step is:

1. Keep the current Vercel PWA frontend
2. Keep the Render relay
3. Add a real hosted Paxion API service for library/workspace/access/admin persistence and actions
4. Add hosted database/storage

That would move the Electron-only intelligence and persistence surfaces into the cloud and make phone usage first-class.
