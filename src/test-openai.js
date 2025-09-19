import OpenAI from 'openai';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const organization = process.env.OPENAI_ORG;
  const project = process.env.OPENAI_PROJECT;

  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  console.log(`INIT OpenAI SDK (org=${organization ? 'set' : 'unset'}, project=${project ? 'set' : 'unset'})`);
  const openai = new OpenAI({ apiKey, organization, project });

  const prompt = '日本語で1文だけ、簡潔に「テスト出力です」と伝えてください。';
  try {
    console.log('REQUEST model=gpt-5, max_output_tokens=60');
    const resp = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'low' },
      max_output_tokens: 60,
    });

    const text = (resp?.output_text ?? '').trim();
    if (text) {
      console.log('OK output_text:', text);
      return;
    }

    const choicePrimary = resp?.choices?.[0]?.message?.content?.[0]?.text;
    const choiceAlt = resp?.choices?.[0]?.message?.content;
    const choiceText = (choicePrimary ?? choiceAlt ?? '').toString().trim();
    if (choiceText) {
      console.log('OK choices content:', choiceText);
      return;
    }

    console.warn('EMPTY: No content returned from model');
  } catch (err) {
    console.error('ERROR calling OpenAI:', err?.message || err);
    const raw = err?.response?.data || err?.stack || '';
    if (raw) {
      const preview = typeof raw === 'string' ? raw.slice(0, 1000) : JSON.stringify(raw).slice(0, 1000);
      console.error('PAYLOAD PREVIEW:', preview);
    }
    process.exit(1);
  }
}

main();


