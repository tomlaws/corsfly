# corsfly

A small Node.js proxy utility for enabling cross-origin requests to a target backend server.

## Features

- Express-based local proxy server
- CORS headers automatically handled
- Optional upstream HTTP(S) proxy support
- Configurable proxy path prefix
- Supports cookie rewrite bypass on SameSite restrictions

## Requirements

- Node.js 20+ (or compatible with `tsx`)
- `npm` or a compatible package manager

## Installation

```bash
npm install
```

## Usage

Build and run the proxy command:

```bash
npm install
npm run build
npx corsfly --targetUrl https://example.com
```

If you install globally or link the package, invoke it directly:

```bash
npm link
corsfly --targetUrl https://example.com
```

### CLI options

- `-t, --targetUrl <url>` (required) - remote backend server URL
- `-p, --port <number>` - local proxy port (default: `8010`)
- `--proxyPath <string>` - proxy URL prefix (default: `proxy`)
- `-o, --origin <string>` - fallback Origin header when missing (default: `http://localhost:3000`)
- `-c, --rewriteCookies` - enable cookie rewrite to bypass strict SameSite restrictions
- `--no-proxy` - disable automatic upstream proxy detection from `HTTP_PROXY` / `HTTPS_PROXY`

### Example

```bash
npx tsx src/cli.ts -t https://api.example.com -p 8010 --proxyPath proxy --rewriteCookies
```

Then send requests to:

```text
http://localhost:8010/proxy/...
```

The proxy forwards them to the remote backend and adjusts CORS response headers.

## Notes

- The proxy strips the configured prefix before forwarding requests to the target.
- If an incoming request does not include an `Origin` header, the configured fallback origin is used.
- If the target URL is HTTPS and an upstream proxy is configured via environment variables, requests will be routed through it.

## Development

During development, run the source directly:

```bash
npx tsx src/cli.ts --targetUrl https://example.com
```

After building, use the installed `corsfly` command:

```bash
npm run build
npx corsfly --targetUrl https://example.com
```

## License

ISC
