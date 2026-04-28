# AquaSmart: Water Usage Monitoring System
*A smart, Node.js powered IoT-inspired web dashboard for a Design Thinking & Algorithms project.*

## Architectural Upgrade
The system has been upgraded to feature a **"Proper Backend"**.
- Core time-series processing logic runs securely on the **Node.js / Express Server**.
- The Dashboard (`public/` directory) is a lightweight client driven by real-time updates via **WebSockets (Socket.io)**.
- Features a mock `/api/telemetry` endpoint that hardware like an ESP32 or Arduino can perform HTTP POSTs against, updating the system in real life effortlessly.

## How to Run it Locally (Development)
You need Node.js installed.
1. Open a terminal in this folder and install the dependencies:
   ```bash
   npm install
   ```
2. Start the Backend Server:
   ```bash
   npm start
   ```
3. Open your browser and navigate to: `http://localhost:3000`

## Deployment Instructions (Production)
The stack is standard Node.js, making it highly portable.
You can easily deploy it for free on services like **Render**, **Vercel**, **Heroku**, or **Railway**.

### Example: Deploying via Render.com
1. Push this folder to a new GitHub Repository.
2. Sign up on [Render.com](https://render.com) and click **Create -> Web Service**.
3. Connect your GitHub account and select your repository.
4. Render will automatically detect it as a Node.js project. You only need two settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Deploy**. Render will generate a live HTTPS URL for your project (e.g., `https://aquasmart.onrender.com`).

### Interaction
Connect to the server UI up and hit "Start Demo". Changes requested via the UI will fire through WebSockets to the Node.js server, evaluate the algorithm, and instantly broadcast the true state to your client UI in real time!
