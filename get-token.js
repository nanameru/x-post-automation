import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { URLSearchParams } from 'url';

// ---------------------------------
// ▼ あなたの情報（変更不要）
// ---------------------------------
const clientId = "OGR4V3RRUk45aHp3VG1jS29ZRXI6MTpjaQ";
const clientSecret = "WGdBUEPoBoa_YPM49QfrE7ifvHNsVpAXELis1sIiDLo61hU2Gs";
const redirectUri = "https://webhook.site/799a5a90-c0ee-48be-a8ad-7598a693b8e7";
const scopes = "tweet.write tweet.read users.read offline.access";
const verifierFilePath = path.join(process.cwd(), '.pkce_verifier.txt');
// ---------------------------------

/**
 * Generates and saves a PKCE code verifier and challenge.
 */
async function generateUrl() {
  // PKCE（S256）: verifier を保存し、challenge をURLに付与
  const verifier = crypto.randomBytes(32).toString('hex');
  await fs.writeFile(verifierFilePath, verifier);

  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('✅ ステップ1: 以下のURLをブラウザで開いて認可してください');
  console.log('----------------------------------------------------------------');
  console.log(authUrl.href);
  console.log('----------------------------------------------------------------\n');
  console.log('認可後、リダイレクト先のURLから "code" をコピーし、次のコマンドを実行してください:');
  console.log('node get-token.js token YOUR_CODE_HERE');
}

/**
 * Exchanges the authorization code for an access token.
 */
async function exchangeToken(code) {
  try {
    const verifier = await fs.readFile(verifierFilePath, 'utf-8');
    const response = await axios.post(
      'https://api.x.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    );
    
    console.log('\n🎉 トークンの取得に成功しました！');
    console.log('以下の値をGitHub Secretsに登録してください。');
    console.log('================================================================');
    console.log('名前: X_OAUTH2_ACCESS_TOKEN');
    console.log('値 (Access Token):', response.data.access_token);
    console.log('----------------------------------------------------------------');
    if (response.data.refresh_token) {
      console.log('（参考）リフレッシュトークンも発行されました。');
      console.log('値 (Refresh Token):', response.data.refresh_token);
    }
    console.log('================================================================');
    
    try { await fs.unlink(verifierFilePath); } catch {}
    console.log('\n✅ 完了です。');

  } catch (error) {
    console.error('❌ トークン交換中にエラーが発生しました:');
    console.error(error.response?.data || error.message);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  const argument = process.argv[3];

  if (command === 'url') {
    await generateUrl();
  } else if (command === 'token') {
    if (!argument) {
      console.error('エラー: 認可コードが指定されていません。');
      console.error('使い方: node get-token.js token YOUR_CODE_HERE');
      process.exit(1);
    }
    await exchangeToken(argument.trim());
  } else {
    console.error('エラー: 無効なコマンドです。');
    console.error('使い方:');
    console.error('  1. 認可URLを生成: node get-token.js url');
    console.error('  2. トークンを交換: node get-token.js token <認可コード>');
  }
}

main();
