import puppeteer from 'puppeteer';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';
import { TwitterApi } from 'twitter-api-v2';

class GitHubTrendingBot {
  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Enforce OAuth2 if requested
    if (String(process.env.REQUIRE_OAUTH2 || '').toLowerCase() === 'true' && !process.env.X_OAUTH2_ACCESS_TOKEN) {
      throw new Error('X_OAUTH2_ACCESS_TOKEN is required because REQUIRE_OAUTH2=true');
    }

    // Prefer OAuth2 user-context token when provided (requires tweet.write scope)
    if (process.env.X_OAUTH2_ACCESS_TOKEN) {
      this.twitterClient = new TwitterApi(process.env.X_OAUTH2_ACCESS_TOKEN);
      this.tweetClient = this.twitterClient; // OAuth2 client already carries scopes
      console.log('🔐 Using OAuth2 user token for X API');
    } else {
      // Fallback to OAuth 1.0a user-context tokens
      this.twitterClient = new TwitterApi({
        appKey: process.env.X_API_KEY,
        appSecret: process.env.X_API_SECRET,
        accessToken: process.env.X_ACCESS_TOKEN,
        accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
      });

      this.tweetClient = this.twitterClient.readWrite;
      console.log('🔐 Using OAuth1.0a user tokens for X API');
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
            name: linkElement?.textContent.trim().replace(/\\s+/g, ' ') || '',
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
        body: `Repository: ${repoUrl}\\nPosted at: ${new Date().toISOString()}`,
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
以下のGitHubトレンドリポジトリについて、カジュアルで魅力的なTwitter投稿文を作成してください。

リポジトリ名: ${trendingInfo.name}
説明: ${trendingInfo.description}
言語: ${trendingInfo.language}
スター数: ${trendingInfo.stars}
URL: ${trendingInfo.url}

README抜粋:
${repoDetails?.readme?.substring(0, 1000) || 'README情報なし'}

スタイル要件:
- 280文字以内
- カジュアルで親しみやすい口調
- 具体的な魅力や使用事例を強調
- 「これ○○で圧巻」「○○がありがたい」のような自然な表現
- 技術的な特徴を分かりやすく説明
- ハッシュタグを2-3個含める
- 絵文字は控えめに（1-2個程度）
- URLは含めない（別途添付するため）

参考例: 「これNano-Bananaの活用事例が60個以上まとめてあって圧巻。プロンプトと出力が一覧で見れるのがありがたいですね。」

日本語で作成してください。`;

    try {
      // Use the Responses API (v4 SDK) and supported model
      const response = await this.openai.responses.create({
        model: "gpt-4o-mini",
        input: prompt,
        max_output_tokens: 150,
        temperature: 0.7
      });

      const text = (response.output_text || "").trim();
      if (text) return text;
      // Fallback if SDK shape changes
      const choiceText = response?.choices?.[0]?.message?.content?.[0]?.text ||
                         response?.choices?.[0]?.message?.content || "";
      if (choiceText) return String(choiceText).trim();
      return `🔥 GitHubトレンド: ${trendingInfo.name}\n\n${trendingInfo.description}\n\n#GitHub #${trendingInfo.language} #OpenSource`;
    } catch (error) {
      console.error('❌ Error generating tweet text:', error.message);
      return `🔥 GitHubトレンド: ${trendingInfo.name}\\n\\n${trendingInfo.description}\\n\\n#GitHub #${trendingInfo.language} #OpenSource`;
    }
  }


  /**
   * Xにツイートを投稿
   */
  async postTweet(tweetText, repoUrl) {
    try {
      // ツイート投稿（テキストのみ）
      const tweetData = {
        text: `${tweetText}\\n\\n🔗 ${repoUrl}`
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
        if (process.env.X_OAUTH2_ACCESS_TOKEN) {
          console.error('🔎 Hint: Ensure your X Project is on a tier that allows writing tweets and your OAuth2 token has tweet.write scope.');
          console.error('➡️  Fix: In X Developer Portal, enable User authentication with Read and write, add tweet.write scope, re-authorize to obtain a new OAuth2 access token, and update X_OAUTH2_ACCESS_TOKEN.');
        } else {
          console.error('🔎 Hint: Your OAuth 1.0a app/token may not allow writes.');
          console.error('➡️  Fix: Set App permissions to "Read and write", then re-generate Access Token & Secret and update X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET. Consider switching to OAuth2 with tweet.write.');
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

      // 1. トレンドリポジトリを取得
      const trendingRepos = await this.getTrendingRepositories();
      
      if (trendingRepos.length === 0) {
        console.log('📭 No trending repositories found');
        return;
      }

      // 2. 重複チェック & 1つ選択
      let selectedRepo = null;
      for (const repo of trendingRepos) {
        const isDuplicate = await this.isDuplicateRepository(repo.name);
        if (!isDuplicate) {
          selectedRepo = repo;
          break;
        }
      }

      if (!selectedRepo) {
        console.log('📭 All trending repositories have already been posted');
        return;
      }

      console.log(`🎯 Selected repository: ${selectedRepo.name}`);

      // 3. リポジトリの詳細情報を取得
      const repoDetails = await this.getRepositoryDetails(selectedRepo.url);

      // 4. ツイート文を生成
      const tweetText = await this.generateTweetText(repoDetails, selectedRepo);

      // 5. ツイート投稿（テキストのみ）
      await this.postTweet(tweetText, selectedRepo.url);

      // 6. 投稿済みとして記録
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
