import GitHubTrendingBot from './auto-post.js';

/**
 * テスト用スクリプト
 * API投稿なしでGitHubトレンド取得とテキスト生成をテスト
 */
class TestBot extends GitHubTrendingBot {
  constructor() {
    super();
    this.isDryRun = true;
  }

  // テスト用：実際の投稿をスキップ
  async postTweet(tweetText, imagePath, repoUrl) {
    console.log('🧪 [TEST MODE] Tweet would be posted:');
    console.log('📝 Text:', tweetText);
    console.log('🖼️ Image:', imagePath || 'No image');
    console.log('🔗 URL:', repoUrl);
    console.log('─'.repeat(50));
    return { data: { id: 'test_tweet_id' } };
  }

  // テスト用：Issues記録をスキップ
  async recordPostedRepository(repoName, repoUrl) {
    console.log(`🧪 [TEST MODE] Would record: ${repoName}`);
  }

  // テスト用：重複チェックをスキップ（常にfalse）
  async isDuplicateRepository(repoName) {
    console.log(`🧪 [TEST MODE] Checking duplicates for: ${repoName}`);
    return false;
  }
}

async function runTests() {
  console.log('🧪 Starting test mode...');
  console.log('📋 This will test all functions except actual X posting and GitHub Issues');
  console.log('─'.repeat(50));

  const bot = new TestBot();
  
  try {
    // 環境変数チェック
    console.log('🔍 Checking environment variables...');
    const requiredEnvs = [
      'GITHUB_TOKEN',
      'OPENAI_API_KEY'
      // X API keys は投稿テストしないのでチェックしない
    ];

    const missingEnvs = requiredEnvs.filter(env => !process.env[env]);
    if (missingEnvs.length > 0) {
      console.log(`❌ Missing environment variables: ${missingEnvs.join(', ')}`);
      console.log('💡 Set these variables or run with real credentials for full test');
    } else {
      console.log('✅ Required environment variables found');
    }
    console.log('─'.repeat(50));

    // テスト実行
    await bot.run();
    
    console.log('─'.repeat(50));
    console.log('✅ Test completed successfully!');
    console.log('💡 To run with real posting, use: npm start');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Full error:', error);
  }
}

// テスト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}