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
  credentials?: boolean;
  rewriteCookies?: boolean;
  upstreamProxyEnabled?: boolean; // 1. Added toggle configuration property
}

function validateProxyConfig(config: ProxyConfig): void {
  const { port, targetUrl, proxyPath, origin, credentials } = config;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port. Expected an integer between 1 and 65535.');
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    throw new Error('Invalid targetUrl. Expected a valid http:// or https:// URL.');
  }

  if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
    throw new Error('Invalid targetUrl protocol. Only http:// and https:// are supported.');
  }

  if (origin !== '*') {
    try {
      const parsedOrigin = new URL(origin);
      if (!['http:', 'https:'].includes(parsedOrigin.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error('Invalid origin. Use * or a valid http:// or https:// URL.');
    }
  }

  if (credentials && origin === '*') {
    throw new Error('Invalid CORS configuration. --credentials cannot be used with origin="*".');
  }
}

export function startProxy({
  port,
  targetUrl,
  proxyPath,
  origin,
  credentials = false,
  rewriteCookies = false,
  upstreamProxyEnabled = true // 2. Default to true for out-of-the-box convenience
}: ProxyConfig) {
  validateProxyConfig({
    port,
    targetUrl,
    proxyPath,
    origin,
    credentials,
    rewriteCookies,
    upstreamProxyEnabled
  });

  const app = express();
  app.disable('x-powered-by');

  app.use(cors({
    credentials,
    origin: (incomingOrigin, callback) => callback(null, incomingOrigin || true)
  }));

  const cleanTargetUrl = targetUrl.replace(/\/$/, '');
  const normalizedProxyPath = proxyPath.replace(/^\/|\/$/g, '');
  const formattedProxyPath = normalizedProxyPath ? `/${normalizedProxyPath}` : '/';

  // 3. Only look for env variables if the feature is explicitly enabled
  const upstreamProxy = upstreamProxyEnabled
    ? (process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy)
    : undefined;

  const proxyOptions: Options = {
    target: cleanTargetUrl,
    changeOrigin: true,
    secure: false,

    pathFilter: (pathname: string) => {
      if (formattedProxyPath === '/') {
        return true;
      }
      return pathname === formattedProxyPath || pathname.startsWith(`${formattedProxyPath}/`);
    },

    pathRewrite: (path) => {
      if (formattedProxyPath === '/') {
        return path;
      }
      const cleanPath = path.replace(formattedProxyPath, '');
      return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
    },
    logger: console,
    on: {
      proxyReq: (proxyReq, req, res) => {
        console.log(`${pc.green('Proxied ->')} ${pc.cyan(req.url)}`);
      },
      proxyRes: (proxyRes, req, res) => {
        const requestOrigin = req.headers.origin;
        const actualOrigin = requestOrigin || origin;
        const requestAllowHeaders = req.headers['access-control-request-headers'];
        const existingVary = proxyRes.headers['vary'];

        delete proxyRes.headers['access-control-allow-origin'];
        delete proxyRes.headers['access-control-allow-credentials'];
        delete proxyRes.headers['access-control-allow-methods'];
        delete proxyRes.headers['access-control-allow-headers'];
        delete proxyRes.headers['access-control-expose-headers'];

        proxyRes.headers['access-control-allow-origin'] = actualOrigin;
        proxyRes.headers['vary'] = existingVary ? `${existingVary}, Origin` : 'Origin';

        if (credentials) {
          proxyRes.headers['access-control-allow-credentials'] = 'true';
        }

        proxyRes.headers['access-control-allow-methods'] = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
        if (requestAllowHeaders) {
          proxyRes.headers['access-control-allow-headers'] = requestAllowHeaders as string;
        } else {
          proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
        }

        const existingExposeHeaders = proxyRes.headers['access-control-expose-headers'];
        if (existingExposeHeaders) {
          proxyRes.headers['access-control-expose-headers'] = existingExposeHeaders;
        }

        if (rewriteCookies) {
          const setCookieHeader = proxyRes.headers['set-cookie'];
          if (setCookieHeader) {
            const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

            proxyRes.headers['set-cookie'] = cookies.map((cookie) => {
              let modifiedCookie = cookie;

              // Normalize SameSite to Lax for local development and broad compatibility.
              modifiedCookie = modifiedCookie.replace(/;\s*SameSite=(None|Strict)/gi, '; SameSite=Lax');
              if (!/;\s*SameSite=/i.test(modifiedCookie)) {
                modifiedCookie = `${modifiedCookie}; SameSite=Lax`;
              }

              // Remove restrictive domain and secure attributes for localhost HTTP proxying.
              modifiedCookie = modifiedCookie.replace(/;\s*Domain=[^;]+/gi, '');
              modifiedCookie = modifiedCookie.replace(/;\s*Secure/gi, '');

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