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
    'Content-Type': 'application/json',
    ...(org ? { 'OpenAI-Organization': org } : {}),
    ...(project ? { 'OpenAI-Project': project } : {})
  };

  const body = {
    model: 'gpt-5',
    input: '日本語で「テスト出力です」と一文だけ返してください。',
    response_format: { type: 'text' },
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


