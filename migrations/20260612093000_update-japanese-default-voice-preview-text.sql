update public.default_voices
set preview_text = 'こんにちは、イザナミです。落ち着いた声で、洗練された日本語ナレーションをお届けします。'
where slug = 'deepgram-izanami';

update public.default_voices
set preview_text = 'こんにちは、フウジンです。自然で力強い声で、日本語のナレーションをお届けします。'
where slug = 'deepgram-fujin';
