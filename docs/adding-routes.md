# Adding New Routes to OPORTAL

## How routing works

OPORTAL is a static site deployed on **Vercel**. It has two routing layers:

| File | Purpose |
|---|---|
| `vercel.json` | **The one that matters for production.** Tells Vercel to serve `portal.html` for clean URLs like `/devportal`. Without an entry here, the URL 404s. |
| `nginx.conf` | Only used when running the Docker container locally (`docker run`). Has no effect on the live site. |
| `assets/js/router.js` | Client-side router. Maps URL path segments to the JS function that opens the matching modal (e.g. `devportal → openDevPortalModal`). |

## Checklist when adding a new route

All three files need to be updated together:

### 1. `vercel.json` — add the rewrite
```json
{ "source": "/my-new-route", "destination": "/portal.html" }
```

### 2. `assets/js/router.js` — map the route to a modal opener
```js
var ROUTES = {
  ...
  'my-new-route': 'openMyNewModal',
};
```

### 3. `nginx.conf` — add to the location block (for local Docker use)
```nginx
location ~ ^/(... |my-new-route)$ {
    try_files /portal.html =404;
}
```

## If a route 404s on the live site

1. Check `vercel.json` first — this is almost always the cause
2. Check `assets/js/router.js` — make sure the route key maps to a real global function
3. nginx.conf is irrelevant for the live site — don't waste time there

## Example: how /devportal was added

| File | Change |
|---|---|
| `vercel.json` | Added `{ "source": "/devportal", "destination": "/portal.html" }` |
| `router.js` | Added `devportal: 'openDevPortalModal'` |
| `nginx.conf` | Added `devportal` to location block (local only, not needed for live) |
