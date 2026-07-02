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
- `-P, --proxyPath <string>` - proxy URL prefix (default: `/`, which proxies from root)
- `-o, --origin <string>` - fallback Origin header when missing (default: `*`)
- `-c, --credentials` - enable credentialed CORS responses (`Access-Control-Allow-Credentials: true`)
- `-r, --rewriteCookies` - rewrite response cookies for local development compatibility
- `-x, --proxy` - enable automatic upstream proxy detection from `HTTP_PROXY` / `HTTPS_PROXY`. This is useful if your network requires a proxy to reach the target backend. (default: `false`)

### Example

```bash
npx corsfly -t https://google.com -p 8010 -r
```

Then send requests to:

```text
http://localhost:8010/...
```

The proxy forwards them to the remote backend and adjusts CORS response headers.

## Notes

- The proxy path defaults to root (`/`). Set `-P` if you want a dedicated prefix.
- If the client request does not include an `Origin` header, the configured fallback origin is used.
- Do not use `--credentials` with `--origin *`; supply a specific origin such as `http://localhost:3000`.
- `credentials: 'include'` is required on the client side if you want to send cookies through the proxy.
  ```javascript
  fetch('http://localhost:8010/proxy/endpoint', {
    method: 'GET',
    credentials: 'include', // 👈 Mandatory
  });
  ```

## License

ISC
