/**
 * Auto-Deploy Webhook Server for Admin Platform
 *
 * Receives GitHub webhooks and triggers deployment.
 * Uses custom raw body capture for reliable HMAC verification.
 */

const express = require('express');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 9006;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const REPO_PATH = process.env.REPO_PATH || '/repo';
const BRANCH = process.env.BRANCH || 'main';

// Deployment state
let isDeploying = false;
let lastDeployment = null;

// Custom middleware to capture raw body from request stream
function captureRawBody(req, res, next) {
  let data = '';
  req.setEncoding('utf8');

  req.on('data', chunk => { data += chunk; });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
  req.on('error', err => next(err));
}

// Verify GitHub webhook signature
function verifySignature(rawBody, signature) {
  if (!WEBHOOK_SECRET) {
    console.log('[WEBHOOK] No WEBHOOK_SECRET configured, skipping verification');
    return true;
  }

  if (!signature) {
    console.log('[WEBHOOK] No signature provided');
    return false;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (err) {
    console.log('[WEBHOOK] Signature comparison error:', err.message);
    return false;
  }
}

// Parse GitHub payload (handles both JSON and URL-encoded)
function parsePayload(rawBody, contentType) {
  if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawBody);
    const payloadString = params.get('payload');
    return payloadString ? JSON.parse(payloadString) : null;
  }
  return JSON.parse(rawBody);
}

// Run deployment
async function runDeployment() {
  const startTime = Date.now();
  console.log('[DEPLOY] Starting deployment...');

  try {
    // 1. Git fetch and pull
    console.log('[DEPLOY] Fetching latest changes...');
    await execPromise(`cd ${REPO_PATH} && git fetch origin ${BRANCH}`);
    await execPromise(`cd ${REPO_PATH} && git checkout ${BRANCH}`);
    const { stdout: pullOutput } = await execPromise(`cd ${REPO_PATH} && git pull origin ${BRANCH}`);
    console.log('[DEPLOY] Git pull:', pullOutput.trim());

    // 2. Build containers
    console.log('[DEPLOY] Building containers...');
    await execPromise(`cd ${REPO_PATH}/admin-platform && docker compose -f docker-compose.prod.yml build`);

    // 3. Restart containers with zero downtime
    console.log('[DEPLOY] Restarting containers...');
    await execPromise(`cd ${REPO_PATH}/admin-platform && docker compose -f docker-compose.prod.yml up -d`);

    // 4. Health check
    console.log('[DEPLOY] Running health check...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      const { stdout: healthOutput } = await execPromise('curl -s http://localhost:8080/docs');
      if (healthOutput.includes('swagger') || healthOutput.includes('FastAPI')) {
        console.log('[DEPLOY] Health check passed!');
      } else {
        console.log('[DEPLOY] Health check warning: unexpected response');
      }
    } catch (healthErr) {
      console.log('[DEPLOY] Health check failed:', healthErr.message);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[DEPLOY] Deployment completed in ${duration}s`);

    return {
      success: true,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('[DEPLOY] Deployment failed:', error.message);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// GitHub webhook endpoint
app.post('/webhook', captureRawBody, async (req, res) => {
  console.log('[WEBHOOK] Received request');
  console.log('[WEBHOOK] Content-Type:', req.headers['content-type']);
  console.log('[WEBHOOK] Event:', req.headers['x-github-event']);

  // Verify signature
  const signature = req.headers['x-hub-signature-256'];
  if (!verifySignature(req.rawBody, signature)) {
    console.log('[WEBHOOK] Invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse payload
  let payload;
  try {
    payload = parsePayload(req.rawBody, req.headers['content-type']);
  } catch (err) {
    console.log('[WEBHOOK] Failed to parse payload:', err.message);
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Check if this is a push to our branch
  const event = req.headers['x-github-event'];
  if (event === 'push') {
    const ref = payload.ref || '';
    const branch = ref.replace('refs/heads/', '');

    if (branch !== BRANCH) {
      console.log(`[WEBHOOK] Ignoring push to ${branch} (watching ${BRANCH})`);
      return res.json({ status: 'ignored', reason: `Not ${BRANCH} branch` });
    }

    console.log(`[WEBHOOK] Push to ${BRANCH} detected, triggering deployment`);
  } else if (event === 'ping') {
    console.log('[WEBHOOK] Ping received');
    return res.json({ status: 'pong' });
  } else {
    console.log(`[WEBHOOK] Ignoring event: ${event}`);
    return res.json({ status: 'ignored', reason: `Event ${event} not handled` });
  }

  // Check if already deploying
  if (isDeploying) {
    console.log('[WEBHOOK] Deployment already in progress');
    return res.status(429).json({ error: 'Deployment in progress' });
  }

  // Start deployment
  isDeploying = true;
  res.json({ status: 'deploying' });

  try {
    lastDeployment = await runDeployment();
  } finally {
    isDeploying = false;
  }
});

// Manual deploy endpoint (for testing)
app.post('/deploy', express.json(), async (req, res) => {
  console.log('[DEPLOY] Manual deployment triggered');

  if (isDeploying) {
    return res.status(429).json({ error: 'Deployment in progress' });
  }

  isDeploying = true;

  try {
    const result = await runDeployment();
    lastDeployment = result;
    res.json(result);
  } finally {
    isDeploying = false;
  }
});

// Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: isDeploying ? 'deploying' : 'idle',
    lastDeployment,
    branch: BRANCH,
    uptime: process.uptime()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[AUTO-DEPLOY] Server running on port ${PORT}`);
  console.log(`[AUTO-DEPLOY] Watching branch: ${BRANCH}`);
  console.log(`[AUTO-DEPLOY] Repo path: ${REPO_PATH}`);
  console.log(`[AUTO-DEPLOY] Webhook secret: ${WEBHOOK_SECRET ? 'configured' : 'NOT SET'}`);
});
