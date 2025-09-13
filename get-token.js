import axios from 'axios';
import { URLSearchParams } from 'url';

// ご指定のcurlと同じパラメータで実行するだけの簡易スクリプト
// 使い方: node get-token.js "<Authorization Code>"

const clientId = 'OGR4V3RRUk45aHp3VG1jS29ZRXI6MTpjaQ';
const clientSecret = 'eZ2Lz6S-Nqy-evR-41ScafzDuqk63bItKXgD_lj10AP_RF965Z';
const redirectUri = 'https://webhook.site/799a5a90-c0ee-48be-a8ad-7598a693b8e7';
const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

async function main() {
  const code = process.argv[2] || '';
  if (!code) {
    console.error('Usage: node get-token.js "<Authorization Code>"');
    process.exit(1);
  }

  try {
    const resp = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (e) {
    console.error(e.response?.data || e.message);
    process.exit(1);
  }
}

main();
