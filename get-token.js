import axios from 'axios';
import { URLSearchParams } from 'url';

// 使い方:
//   PKCE:           X_CLIENT_ID=... X_REDIRECT_URI=... X_CODE_VERIFIER=... node get-token.js "<authorization_code>"
//   Confidential:   X_CLIENT_ID=... X_CLIENT_SECRET=... X_REDIRECT_URI=... node get-token.js "<authorization_code>"
// 環境変数:
//   - X_CLIENT_ID           : 必須（両フロー）
//   - X_CLIENT_SECRET       : 機密クライアントのとき必須（PKCEでは未設定にする）
//   - X_REDIRECT_URI        : 必須（認可時と完全一致）
//   - X_CODE_VERIFIER       : PKCEのとき必須（機密では未設定にする）
//   - X_FLOW                : 任意（'pkce' | 'confidential'）。未指定なら X_CLIENT_SECRET の有無で自動判定

async function main() {
  const code = process.argv[2] || '';
  if (!code) {
    console.error('Usage: node get-token.js "<Authorization Code>"');
    process.exit(1);
  }

  try {
    const clientId = process.env.X_CLIENT_ID || '';
    const clientSecret = process.env.X_CLIENT_SECRET || '';
    const redirectUri = process.env.X_REDIRECT_URI || '';
    const codeVerifier = process.env.X_CODE_VERIFIER || '';
    const explicitFlow = (process.env.X_FLOW || '').toLowerCase();
    const isConfidential = explicitFlow
      ? explicitFlow === 'confidential'
      : Boolean(clientSecret);

    if (!clientId || !redirectUri) {
      console.error('Missing env: X_CLIENT_ID and X_REDIRECT_URI are required');
      process.exit(1);
    }

    const url = 'https://api.twitter.com/2/oauth2/token';

    let bodyParams = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    };
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

    // 共通でclient_idは常に含める（Twitter側で要求されるケースに備える）
    bodyParams.client_id = clientId;

    if (isConfidential) {
      if (!clientSecret) {
        console.error('Missing env: X_CLIENT_SECRET is required for confidential flow');
        process.exit(1);
      }
      // 機密クライアント: Basic認証ヘッダ付与
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
      // 機密+PKCEも許容（code_verifierがあれば一緒に送る）
      if (codeVerifier) {
        bodyParams.code_verifier = codeVerifier;
      }
    } else {
      // PKCE: Authorizationヘッダは付けない。code_verifier必須。
      if (!codeVerifier) {
        console.error('Missing env: X_CODE_VERIFIER is required for PKCE flow');
        process.exit(1);
      }
      bodyParams.code_verifier = codeVerifier;
    }

    const resp = await axios.post(url, new URLSearchParams(bodyParams).toString(), { headers });
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error(e.response?.data || e.message);
    process.exit(1);
  }
}

main();
