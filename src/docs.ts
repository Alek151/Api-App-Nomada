import type { Context } from 'hono';
import { openApiSpec } from './openapi';

export function openApiJson(c: Context) {
  return c.json(openApiSpec);
}

export function swaggerHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nómada API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body style="margin:0;background:#0f172a"><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>SwaggerUIBundle({url:'/api/v1/openapi.json',dom_id:'#swagger-ui',deepLinking:true,preset:[SwaggerUIBundle.presets.apis]});</script></body></html>`;
}
