import { InvalidArgumentError, program } from 'commander';
import { startProxy } from './index';

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new InvalidArgumentError('Port must be an integer between 1 and 65535.');
  }
  return port;
}

function parseHttpUrl(value: string, fieldName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InvalidArgumentError(`${fieldName} must be a valid URL.`);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new InvalidArgumentError(`${fieldName} must use http:// or https://.`);
  }

  return parsed.toString();
}

function parseProxyPath(value: string): string {
  const normalized = value.replace(/^\/|\/$/g, '');
  return normalized;
}

function parseOrigin(value: string): string {
  if (value === '*') {
    return value;
  }
  return parseHttpUrl(value, 'origin');
}

program
  .requiredOption('-t, --targetUrl <url>', 'The remote backend server URL to target', (value) => parseHttpUrl(value, 'targetUrl'))
  .option('-p, --port <number>', 'Local proxy server port to run on', parsePort, 8010)
  .option('-P, --proxyPath <string>', 'The URL path prefix segment to route through (use / for root)', parseProxyPath, '/')
  .option('-o, --origin <string>', 'Fallback origin to use if the incoming request lacks an Origin header', parseOrigin, '*')
  .option('-c, --credentials', 'Enable CORS credentials support (Access-Control-Allow-Credentials: true)', false)
  .option('-r, --rewriteCookies', 'Rewrite response cookies for local development compatibility', false)
  .option('-x, --proxy', 'Enable automatic detection of system HTTP_PROXY/HTTPS_PROXY environment variables', false)
  .parse(process.argv);

const options = program.opts();

if (options.credentials && options.origin === '*') {
  throw new InvalidArgumentError('Cannot use --credentials with --origin * . Provide a specific origin URL instead.');
}

startProxy({
  port: options.port,
  targetUrl: options.targetUrl,
  proxyPath: options.proxyPath,
  origin: options.origin,
  credentials: !!options.credentials,
  rewriteCookies: !!options.rewriteCookies,
  upstreamProxyEnabled: options.proxy,
});