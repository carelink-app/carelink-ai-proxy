// Vercel Serverless Function - CareLink AI Proxy
// Claude API 키를 안전하게 보호하면서 프론트엔드에서 AI를 사용할 수 있게 해주는 프록시

export default async function handler(req, res) {
  // CORS 설정
  const allowedOrigins = [
    'https://carelink-app.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ];
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { action, message, jobs, userProfile } = req.body;

    let systemPrompt = '';
    let userMessage = message || '';
    let maxTokens = 800;

    if (action === 'match') {
      maxTokens = 600;
      systemPrompt = `당신은 요양링크(CareLink) AI 매칭 전문가입니다.
사용자 프로필과 구인공고 목록을 분석하여 가장 적합한 일자리를 추천해주세요.
지역, 자격증, 경력, 급여, 근무시간을 종합적으로 고려하세요.
한국어로 친절하게 답변하세요. 이모지를 적절히 사용하세요.`;
      userMessage = `사용자 프로필: ${JSON.stringify(userProfile || {})}\n\n구인공고 목록: ${JSON.stringify(jobs || [])}\n\n가장 적합한 일자리 3개를 추천하고 이유를 설명해주세요.`;
    } else if (action === 'write') {
      maxTokens = 600;
      systemPrompt = `당신은 요양링크(CareLink) 구인공고 작성 전문가입니다.
주어진 정보를 바탕으로 전문적이고 매력적인 요양보호사 구인공고를 작성해주세요.
간결하고 핵심적인 내용만 포함하세요.`;
    } else {
      systemPrompt = `당신은 요양링크(CareLink) AI 도우미 '링키'입니다.
요양보호사 구인/구직 매칭 플랫폼의 AI 어시스턴트로서 다음을 도와줍니다:
- 요양보호사 자격증, 취업, 급여 등 요양 관련 상담
- 앱 사용법 안내 (회원가입, 공고 등록, 지원 방법 등)
- 문의사항 답변
- 일반적인 대화

항상 친절하고 전문적으로 한국어로 답변하세요.
답변은 간결하게 핵심만 전달하세요 (최대 3-4문장).
이모지를 적절히 사용하세요.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      return res.status(response.status).json({
        error: 'AI API error',
        detail: response.status === 401 ? 'Invalid API key' : 'API request failed'
      });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '죄송합니다, 응답을 생성하지 못했습니다.';

    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
