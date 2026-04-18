export default async function handler(req, res) {
  let input = req.query.address || req.url.slice(1).split('?')[0];
  if (!input) return res.status(400).send('Missing address');

  let ca = input;

  // Detect if NOT a contract address → resolve via Dexscreener
  if (input.length < 30) {
    try {
      const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(input)}`);
      const searchData = await searchRes.json();

      // Pick best match (Solana + highest market cap)
      const pair = searchData?.pairs
        ?.filter(p => p.chainId === "solana")
        ?.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))[0];

      if (!pair || !pair.baseToken?.address) {
        return res.status(404).send('Token not found');
      }

      ca = pair.baseToken.address;
    } catch (err) {
      console.error("Dexscreener resolve error:", err);
      return res.status(500).send('Failed to resolve token');
    }
  }

  // Check if it's a Twitter bot
  const userAgent = req.headers['user-agent'] || '';
  const isTwitterBot = userAgent.includes('Twitterbot') || 
                       userAgent.includes('facebookexternalhit') ||
                       userAgent.includes('Slackbot') ||
                       userAgent.includes('LinkedInBot');

  if (isTwitterBot) {
    try {
      const response = await fetch(`https://pump.fun/coin/${ca}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)' }
      });

      const html = await response.text();

      let title = html.match(/<title>(.*?)<\/title>/)?.[1] || 'Token on Pump.Fun';

      let img = null;

      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (ogImageMatch) img = ogImageMatch[1];

      if (!img) {
        const tokenImageMatch = html.match(/<img[^>]+src="([^"]+token[^"]+\.(?:png|jpg|jpeg|gif))"/i);
        if (tokenImageMatch) img = tokenImageMatch[1];
      }

      if (!img) {
        const anyImageMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
        if (anyImageMatch) img = anyImageMatch[1];
      }

      if (!img) img = 'https://pump.fun/logo.png';

      if (img && img.startsWith('/')) {
        img = `https://pump.fun${img}`;
      }

      let description = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
      if (!description) {
        const marketCapMatch = html.match(/\$?([\d.]+[KM]?)\s*(?:market cap|MC)/i);
        if (marketCapMatch) description = `Market Cap: $${marketCapMatch[1]} | Buy on Pump.fun`;
        else description = 'New token on Pump.fun';
      }

      res.send(`<!DOCTYPE html>
      <html><head>
        <meta property="og:title" content="${escapeHtml(title)}" />
        <meta property="og:description" content="${escapeHtml(description)}" />
        <meta property="og:image" content="${img}" />
        <meta property="og:site_name" content="Pump.Fun" />
        <meta property="og:url" content="https://pump.fun/coin/${ca}" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${escapeHtml(title)}" />
        <meta name="twitter:description" content="${escapeHtml(description)}" />
        <meta name="twitter:image" content="${img}" />
        <meta name="twitter:site" content="@pump_fun" />
        <title>${escapeHtml(title)}</title>
      </head><body>
        <p>Redirecting...</p>
      </body></html>`);
    } catch (error) {
      res.send(`<!DOCTYPE html>
      <html><head>
        <meta property="og:title" content="Token on Pump.Fun" />
        <meta property="og:description" content="Buy on Pump.fun" />
        <meta property="og:image" content="https://pump.fun/logo.png" />
        <meta property="og:site_name" content="Pump.Fun" />
        <meta name="twitter:card" content="summary_large_image" />
      </head><body></body></html>`);
    }
  } else {
    // Humans → redirect with resolved CA
    res.redirect(302, `https://pump.live-stream.fun/${ca}`);
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
