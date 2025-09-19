// Minimal test script to call OpenAI Responses API via fetch
// Env: OPENAI_API_KEY (required), OPENAI_ORG (optional), OPENAI_PROJECT (optional)

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const org = process.env.OPENAI_ORG;
  const project = process.env.OPENAI_PROJECT;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  const prompt = `
あなたは短く鋭い日本語のテック投稿ライターです。次の情報から、指定の文体でポスト文を1つだけ作ってください。

文体の条件:
- 冒頭は「<主体>が<何をしていて>面白い。」で始める
- 2〜3文、最大260文字。絵文字・ハッシュタグなし。丁寧でカジュアル
- 「これを〜しておけば、〜から〜できる」の型を1回含める（例: これをブックマークしておけば、必要な領域から最短で要点に届く）
- 誇張や断定を避け、事実ベースで端的に価値を示す（「最高」「すごく良い」等の主観の重複は避ける）
- URLは本文に入れない（本文の直後に改行し、コード側でURLを1行付ける）

主体の決め方:
- owner/repo から自然な主語（owner か repo 名）を選ぶ

特別な書き分け（リソース集/リンク集の場合）:
- 説明やREADMEに awesome/curated/list/resources/book/community/newsletter などの語が多い場合は、
  - 対象読者（例: データエンジニア）を一語で明示
  - カバー範囲を2〜3種だけ具体的に列挙（例: 書籍・コミュニティ・ニュースレター）
  - 主観を減らし、網羅性/整理度/継続更新などの事実を簡潔に示す

素材:
- リポジトリ名: OWNER/REPO
- 説明: curated resources for data engineering (books, communities, newsletters, videos, blogs)
- 言語: Various
- スター数: 9999

README抜粋（参考用・引用はしない）:
Awesome curated list for data engineers. Links to books, communities, newsletters, videos, blogs, and learning paths.

出力: 本文のみ（1つ）。先頭/末尾の空白なし。`;

  const body = {
    model: 'gpt-5',
    input: prompt,
    reasoning: { effort: 'low' },
    max_output_tokens: 200
  };

  console.log(`INIT fetch (org=${org ? 'set' : 'unset'}, project=${project ? 'set' : 'unset'})`);
  try {
    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const raw = await resp.text();
    if (!resp.ok) {
      console.error(`ERROR HTTP ${resp.status}:`, raw.slice(0, 1000));
      process.exit(1);
    }
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch {}
    const text = (data?.output_text ?? '').trim();
    if (text) {
      console.log('OK output_text:', text);
      return;
    }
    const choicePrimary = data?.choices?.[0]?.message?.content?.[0]?.text;
    const choiceAlt = data?.choices?.[0]?.message?.content;
    const choiceText = (choicePrimary ?? choiceAlt ?? '').toString().trim();
    if (choiceText) {
      console.log('OK choices content:', choiceText);
      return;
    }
    console.warn('EMPTY: No content returned');
  } catch (e) {
    console.error('ERROR calling OpenAI:', e?.message || e);
    process.exit(1);
  }
}

main();


