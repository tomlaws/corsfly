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

## Usage

Run the command:

```bash
npx corsfly --targetUrl https://example.com
```

If you install globally via `npm install -g corsfly`, invoke it directly:

```bash
corsfly --targetUrl https://example.com
```

### CLI options

- `-t, --targetUrl <url>` (required) - remote backend server URL
- `-p, --port <number>` - local proxy port (default: `8010`)
- `--proxyPath <string>` - proxy URL prefix (default: `proxy`)
- `-o, --origin <string>` - fallback Origin header when missing (default: `*`)
- `-c, --rewriteCookies` - enable cookie rewrite to bypass strict SameSite restrictions
- `--proxy` - enable automatic upstream proxy detection from `HTTP_PROXY` / `HTTPS_PROXY`. Upstream proxy detection is enabled by default to facilitate corporate network environments.

### Example

```bash
npx corsfly -t https://api.example.com -p 8010 --proxyPath proxy --rewriteCookies
```

Then send requests to:

```text
http://localhost:8010/proxy/...
```

The proxy forwards them to the remote backend and adjusts CORS response headers.

## Notes

- The proxy strips the configured prefix before forwarding requests to the target.
- If the client request does not include an `Origin` header, the configured fallback origin is used.

## License

ISC
