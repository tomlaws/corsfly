import express from 'express';
import cors from 'cors';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import pc from 'picocolors';

interface ProxyConfig {
  port: number;
  targetUrl: string;
  proxyPath: string;
  origin: string;
  rewriteCookies?: boolean;
  upstreamProxyEnabled?: boolean; // 1. Added toggle configuration property
}

export function startProxy({
  port,
  targetUrl,
  proxyPath,
  origin,
  rewriteCookies = false,
  upstreamProxyEnabled = true // 2. Default to true for out-of-the-box convenience
}: ProxyConfig) {
  const app = express();
  app.disable('x-powered-by');

  app.use(cors({
    credentials: true,
    origin: (incomingOrigin, callback) => callback(null, incomingOrigin || true)
  }));

  const cleanTargetUrl = targetUrl.replace(/\/$/, '');
  const formattedProxyPath = `/${proxyPath.replace(/^\/|\/$/g, '')}`;

  // 3. Only look for env variables if the feature is explicitly enabled
  const upstreamProxy = upstreamProxyEnabled
    ? (process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY)
    : undefined;

  const proxyOptions: Options = {
    target: cleanTargetUrl,
    changeOrigin: true,
    secure: false,

    pathFilter: (pathname: string) => {
      return pathname.startsWith(formattedProxyPath);
    },

    pathRewrite: (path) => {
      const cleanPath = path.replace(formattedProxyPath, '');
      return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    },
    logger: console,
    on: {
      proxyReq: (proxyReq, req, res) => {
        console.log(`${pc.green('Proxied ->')} ${pc.cyan(req.url)}`);
      },
      proxyRes: (proxyRes, req, res) => {
        const actualOrigin = req.headers.origin || origin;

        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
        delete proxyRes.headers['access-control-expose-headers'];

        proxyRes.headers['access-control-allow-origin'] = actualOrigin;
        proxyRes.headers['access-control-allow-credentials'] = 'true';
        proxyRes.headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
        proxyRes.headers['access-control-allow-headers'] = '*';
        proxyRes.headers['access-control-expose-headers'] = '*';

        if (rewriteCookies) {
          const setCookieHeader = proxyRes.headers['set-cookie'];
          if (setCookieHeader) {
            proxyRes.headers['set-cookie'] = setCookieHeader.map(cookie => {
              // 1. Strip out the "Secure" flag so unencrypted http://localhost can accept it
              let modifiedCookie = cookie.replace(/;?\s*Secure/gi, '');

              // 2. Convert Lax/Strict to None so the cookie flows across different local ports (e.g., :3000 to :8010)
              modifiedCookie = modifiedCookie.replace(/SameSite=(Lax|Strict)/gi, 'SameSite=None');

              return modifiedCookie;
            });
          }
        }
      },
      error: (err, req, res) => {
        console.error(pc.red(`Proxy Error: ${err.message}`));

        if ('writeHead' in res) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
        } else {
          res.destroy();
        }
      }
    }
  };

  if (upstreamProxy) {
    const isTargetHttps = cleanTargetUrl.startsWith('https');

    if (isTargetHttps) {
      proxyOptions.agent = new HttpsProxyAgent({ keepAlive: true, proxy: upstreamProxy });
    } else {
      proxyOptions.agent = new HttpProxyAgent({ keepAlive: true, proxy: upstreamProxy });
    }
  }

  app.use(createProxyMiddleware(proxyOptions));

  app.listen(port, () => {
    console.log(pc.bgGreen(pc.black(pc.bold('  Proxy Active  '))));
    console.log(`${pc.blue('Target URL:')}    ${pc.white(cleanTargetUrl)}`);
    console.log(`${pc.blue('Proxy Prefix:')}  ${pc.white(formattedProxyPath)}`);
    console.log(`${pc.blue('Cookie Rewrite:')} ${rewriteCookies ? pc.green('Enabled') : pc.yellow('Disabled')}`);

    // 4. Update logs to explicitly show network routing state
    if (upstreamProxy) {
      console.log(`${pc.yellow('Upstream Proxy Routing:')} ${pc.white(upstreamProxy)}`);
    } else if (!upstreamProxyEnabled) {
      console.log(`${pc.gray('Upstream Proxy Routing:')} ${pc.gray('Manually Disabled via CLI')}`);
    }
    console.log(`${pc.blue('Listening on:')}  ${pc.white(`http://localhost:${port}${formattedProxyPath}`)}`);
  });
}