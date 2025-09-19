import puppeteer from 'puppeteer';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';
import sodium from 'tweetsodium';

class GitHubTrendingBot {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Lazily initialize to allow OAuth2 refresh at runtime
    this.twitterClient = null;
    this.tweetClient = null;
  }

  async refreshOAuth2TokenIfNeeded() {
    if (this.tweetClient) return; // already initialized

    // Always refresh using OAuth2. No access-token nor OAuth1 fallback.
    const refreshToken = process.env.X_OAUTH2_REFRESH_TOKEN;
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;

    if (!refreshToken) {
      throw new Error('Missing X_OAUTH2_REFRESH_TOKEN');
    }

    // If clientSecret exists, treat as confidential client flow.
    const isConfidential = Boolean(clientSecret);

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        ...(isConfidential ? {} : { client_id: clientId })
      });

      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
      };
      if (isConfidential) {
        if (!clientId || !clientSecret) {
          throw new Error('Confidential flow requires X_CLIENT_ID and X_CLIENT_SECRET');
        }
        headers['Authorization'] = 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      } else {
        if (!clientId) {
          throw new Error('PKCE flow requires X_CLIENT_ID');
        }
      }

      const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers,
        body
      });
      const data = await resp.json();
      if (!resp.ok) {
        const err = data?.error || data?.error_description || resp.status;
        throw new Error(`Refresh failed: ${err}`);
      }
      const accessToken = data.access_token;
      if (!accessToken) {
        throw new Error('Refresh succeeded but no access_token in response');
      }
      this.twitterClient = new TwitterApi(accessToken);
      this.tweetClient = this.twitterClient;
      console.log('🔐 Using refreshed OAuth2 token for X API');

      // If a new refresh_token is returned, update GitHub Secret
      const newRefreshToken = data.refresh_token;
      if (newRefreshToken) {
        try {
          if (process.env.TEST_MODE === 'true') {
            console.log('🛡️ TEST_MODE: Skipping secret update');
            return;
          }
          const repoOwner = process.env.GITHUB_REPOSITORY?.split('/')?.[0] || 'nanameru';
          const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1] || 'x-post-automation';
          const adminToken = process.env.GITHUB_SECRET_UPDATE_TOKEN || process.env.GITHUB_TOKEN;
          if (!adminToken) {
            console.warn('⚠️ No admin token for secret update. Skipping.');
            return;
          }

          const getKey = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/public-key`, {
            headers: {
              'Authorization': `token ${adminToken}`,
              'Accept': 'application/vnd.github+json'
            }
          });
          const keyData = await getKey.json();
          if (!getKey.ok) {
            console.warn('⚠️ Failed to get repo public key:', keyData?.message || getKey.status);
            return;
          }

          const messageBytes = new TextEncoder().encode(newRefreshToken);
          const keyBytes = Buffer.from(keyData.key, 'base64');
          const encryptedBytes = sodium.seal(messageBytes, keyBytes);
          const encryptedValue = Buffer.from(encryptedBytes).toString('base64');

          console.log('🔐 Attempting to rotate repo secret X_OAUTH2_REFRESH_TOKEN...');
          const putResp = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/actions/secrets/X_OAUTH2_REFRESH_TOKEN`, {
            method: 'PUT',
            headers: {
              'Authorization': `token ${adminToken}`,
              'Accept': 'application/vnd.github+json'
            },
            body: JSON.stringify({
              encrypted_value: encryptedValue,
              key_id: keyData.key_id
            })
          });
          if (!putResp.ok) {
            const putErr = await putResp.text();
            console.warn('⚠️ Failed to update secret:', putResp.status, putErr);
          } else {
            // 201: created, 204: updated. Value自体は取得不可だが、更新成否はHTTPステータスで判定
            if (putResp.status === 201) {
              console.log('🔁 GitHub secret created: X_OAUTH2_REFRESH_TOKEN (201)');
            } else if (putResp.status === 204) {
              console.log('🔁 GitHub secret updated: X_OAUTH2_REFRESH_TOKEN (204)');
            } else {
              console.log(`🔁 GitHub secret update succeeded with status ${putResp.status}`);
            }
            console.log('ℹ️ Note: GitHub does not expose secret values; update verified by status code only');
          }
        } catch (se) {
          console.warn('⚠️ Secret rotation failed:', se.message);
        }
      }
      return;
    } catch (e) {
      console.error('❌ OAuth2 refresh failed:', e.message);
      throw e;
    }
  }

  /**
   * GitHubトレンドページから人気リポジトリを取得
   */
  async getTrendingRepositories() {
    console.log('🔍 Fetching GitHub trending repositories...');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.goto('https://github.com/trending', { waitUntil: 'networkidle0' });

      // トレンドリポジトリのリンクを取得
      const repositories = await page.evaluate(() => {
        const repoElements = document.querySelectorAll('article.Box-row');
        return Array.from(repoElements).slice(0, 10).map(element => {
          const linkElement = element.querySelector('h2 a');
          const descElement = element.querySelector('p.col-9');
          const starsElement = element.querySelector('a[href$="/stargazers"]');
          const languageElement = element.querySelector('[itemprop="programmingLanguage"]');
          
          return {
            name: linkElement?.textContent.trim().replace(/\s+/g, ' ') || '',
            url: linkElement ? 'https://github.com' + linkElement.getAttribute('href') : '',
            description: descElement?.textContent.trim() || '',
            stars: starsElement?.textContent.trim() || '0',
            language: languageElement?.textContent.trim() || 'Unknown'
          };
        }).filter(repo => repo.name && repo.url);
      });

      console.log(`📊 Found ${repositories.length} trending repositories`);
      return repositories;
    } finally {
      await browser.close();
    }
  }

  /**
   * GitHub Issuesを使って重複チェック
   */
  async isDuplicateRepository(repoName) {
    try {
      const { data: issues } = await this.octokit.rest.issues.listForRepo({
        owner: 'nanameru',
        repo: 'x-post-automation',
        labels: 'posted',
        state: 'all',
        per_page: 100
      });

      return issues.some(issue => issue.title.includes(repoName));
    } catch (error) {
      console.error('❌ Error checking duplicates:', error.message);
      return false;
    }
  }

  /**
   * 投稿済みリポジトリを記録
   */
  async recordPostedRepository(repoName, repoUrl) {
    try {
      await this.octokit.rest.issues.create({
        owner: 'nanameru',
        repo: 'x-post-automation',
        title: `Posted: ${repoName}`,
        body: `Repository: ${repoUrl}\nPosted at: ${new Date().toISOString()}`,
        labels: ['posted', 'auto-generated']
      });
      
      console.log(`✅ Recorded posted repository: ${repoName}`);
    } catch (error) {
      console.error('❌ Error recording repository:', error.message);
    }
  }

  /**
   * リポジトリの詳細情報を取得
   */
  async getRepositoryDetails(repoUrl) {
    const repoPath = repoUrl.replace('https://github.com/', '');
    const [owner, name] = repoPath.split('/');

    try {
      const { data: repo } = await this.octokit.rest.repos.get({
        owner,
        repo: name
      });

      let readme = '';
      try {
        const { data: readmeData } = await this.octokit.rest.repos.getReadme({
          owner,
          repo: name
        });
        readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      } catch (error) {
        console.log(`📝 No README found for ${owner}/${name}`);
      }

      return {
        ...repo,
        readme: readme.substring(0, 3000) // README を最初の3000文字に制限
      };
    } catch (error) {
      console.error(`❌ Error fetching repository details for ${owner}/${name}:`, error.message);
      return null;
    }
  }

  /**
   * ChatGPTでツイート文を生成
   */
  async generateTweetText(repoDetails, trendingInfo) {
    const prompt = `
あなたは短く鋭い日本語のテック投稿ライターです。次の情報から、指定の文体でポスト文を1つだけ作ってください。

文体の条件:
- 冒頭は「<主体>が<何をしていて>面白い。」で始める
- 2〜3文、最大260文字。絵文字・ハッシュタグなし。丁寧でカジュアル
- 「これを〜しておけば、〜から〜できる」の型を1回含める
- 誇張や断定は避け、事実ベースで端的に価値を示す
- URLは本文に入れない（本文の直後に改行し、コード側でURLを1行付ける）

主体の決め方:
- owner/repo から自然な主語（owner か repo 名）を選ぶ

素材:
- リポジトリ名: ${trendingInfo.name}
- 説明: ${trendingInfo.description}
- 言語: ${trendingInfo.language}
- スター数: ${trendingInfo.stars}

README抜粋（参考用・引用はしない）:
${repoDetails?.readme?.substring(0, 200) || 'README情報なし'}

出力: 本文のみ（1つ）。先頭/末尾の空白なし。`;

    try {
      const response = await this.openai.responses.create({
        model: "gpt-5",
        input: prompt,
        reasoning: { effort: "low" },
        max_output_tokens: 150
      });

      const text = (response.output_text || "").trim();
      if (text) return text;
      // Fallback if SDK shape changes
      const choiceText = response?.choices?.[0]?.message?.content?.[0]?.text ||
                         response?.choices?.[0]?.message?.content || "";
      if (choiceText) return String(choiceText).trim();
      return `🔥 GitHubトレンド: ${trendingInfo.name}\n\n${trendingInfo.description}`;
    } catch (error) {
      console.error('❌ Error generating tweet text:', error.message);
      return `🔥 GitHubトレンド: ${trendingInfo.name}\n\n${trendingInfo.description}`;
    }
  }

  /**
   * Xにツイートを投稿
   */
  async postTweet(tweetText, repoUrl) {
    try {
      await this.refreshOAuth2TokenIfNeeded();
      // 本文 + 改行 + URL（末尾にURLのみ）
      const tweetData = {
        text: `${tweetText}\n${repoUrl}`
      };

      const tweet = await this.tweetClient.v2.tweet(tweetData);
      
      console.log(`🐦 Tweet posted successfully: ${tweet.data.id}`);
      return tweet;
    } catch (error) {
      console.error('❌ Error posting tweet:', error.message);
      // Extra diagnostics for common X API permission issues
      const headers = error?.headers || error?.data?.headers;
      const accessLevel = headers?.['x-access-level'] || headers?.['X-Access-Level'];
      const detail = error?.data?.detail || error?.data?.title || '';
      if (accessLevel) console.error(`ℹ️ x-access-level: ${accessLevel}`);
      if (detail) console.error(`ℹ️ X API detail: ${detail}`);

      if (error?.code === 403 || error?.data?.status === 403) {
        // Provide targeted hints for both OAuth1.0a and OAuth2 cases
        if (process.env.X_OAUTH2_ACCESS_TOKEN || process.env.X_OAUTH2_REFRESH_TOKEN) {
          console.error('🔎 Hint: Ensure your X Project tier allows writing and token has tweet.write scope.');
        } else {
          console.error('🔎 Hint: OAuth 1.0a app/token may not allow writes. Re-generate RW tokens.');
        }
      }
      throw error;
    }
  }

  /**
   * メイン処理
   */
  async run() {
    try {
      console.log('🚀 Starting GitHub Trending X Bot...');

      const trendingRepos = await this.getTrendingRepositories();
      if (trendingRepos.length === 0) {
        console.log('📭 No trending repositories found');
        return;
      }

      let selectedRepo = null;
      for (const repo of trendingRepos) {
        const isDuplicate = await this.isDuplicateRepository(repo.name);
        if (!isDuplicate) { selectedRepo = repo; break; }
      }

      if (!selectedRepo) {
        console.log('📭 All trending repositories have already been posted');
        return;
      }

      console.log(`🎯 Selected repository: ${selectedRepo.name}`);
      const repoDetails = await this.getRepositoryDetails(selectedRepo.url);
      const tweetText = await this.generateTweetText(repoDetails, selectedRepo);
      await this.postTweet(tweetText, selectedRepo.url);
      await this.recordPostedRepository(selectedRepo.name, selectedRepo.url);
      console.log('✅ Process completed successfully!');
      
    } catch (error) {
      console.error('❌ Error in main process:', error);
      process.exit(1);
    }
  }
}

// メイン処理実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new GitHubTrendingBot();
  bot.run();
}

export default GitHubTrendingBot;
