import { program } from 'commander';
import { startProxy } from './index';

program
  .requiredOption('-t, --targetUrl <url>', 'The remote backend server URL to target')
  .option('-p, --port <number>', 'Local proxy server port to run on', '8010')
  .option('--proxyPath <string>', 'The URL path prefix segment to route through', 'proxy')
  .option('-o, --origin <string>', 'Fallback origin to use if the incoming request lacks an Origin header', '*')
  .option('-c, --rewriteCookies', 'Bypass strict cross-domain SameSite cookie restrictions', false)
  .option('--no-proxy', 'Disable automatic detection of system HTTP_PROXY/HTTPS_PROXY environment variables')
  .parse(process.argv);

const options = program.opts();

startProxy({
  port: parseInt(options.port, 10),
  targetUrl: options.targetUrl,
  proxyPath: options.proxyPath,
  origin: options.origin,
  rewriteCookies: options.rewriteCookies,
  upstreamProxyEnabled: options.proxy,
});