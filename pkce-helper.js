import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Usage:
//   X_CLIENT_ID=... X_REDIRECT_URI=... node pkce-helper.js
// Optional:
//   SCOPE="tweet.write tweet.read users.read offline.access" STATE=your_state node pkce-helper.js

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateCodeVerifier() {
  // 64 bytes -> ~86 chars base64url; cut to max 128 if needed
  const random = crypto.randomBytes(64);
  return base64url(random).slice(0, 128);
}

function toCodeChallenge(codeVerifier) {
  const sha256 = crypto.createHash('sha256').update(codeVerifier).digest();
  return base64url(sha256);
}

function buildAuthUrl({ clientId, redirectUri, scope, state, codeChallenge }) {
  const url = new URL('https://twitter.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

function main() {
  const clientId = process.env.X_CLIENT_ID || '';
  const redirectUri = process.env.X_REDIRECT_URI || '';
  const scope = process.env.SCOPE || 'tweet.write tweet.read users.read offline.access';
  const state = process.env.STATE || base64url(crypto.randomBytes(12));
  const silent = process.argv.includes('--silent') || process.env.NO_URL === '1';

  if (!clientId || !redirectUri) {
    console.error('Missing env: X_CLIENT_ID and X_REDIRECT_URI are required');
    process.exit(1);
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = toCodeChallenge(codeVerifier);
  const authUrl = buildAuthUrl({ clientId, redirectUri, scope, state, codeChallenge });

  // Persist for later exchange
  const store = {
    clientId,
    redirectUri,
    scope,
    state,
    codeVerifier,
    codeChallenge,
    createdAt: new Date().toISOString()
  };
  const filePath = path.join(process.cwd(), '.pkce.json');
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2));

  if (silent) {
    console.log(`Saved PKCE verifier to ${filePath}`);
    return;
  }

  console.log('code_verifier:');
  console.log(codeVerifier);
  console.log('\ncode_challenge:');
  console.log(codeChallenge);
  console.log('\nauthorize URL:');
  console.log(authUrl);

  console.log('\nExport for later token exchange (copy/paste):');
  console.log(`export X_CODE_VERIFIER=${codeVerifier}`);
  console.log(`export X_CLIENT_ID=${clientId}`);
  console.log(`export X_REDIRECT_URI=${redirectUri}`);
  console.log('\nNext: run code exchange:');
  console.log('node exchange-code.js "<AUTHORIZATION_CODE>"');
}

main();


