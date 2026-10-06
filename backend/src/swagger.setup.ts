import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'swagger';
export const SWAGGER_JSON_PATH = 'swagger-json';
export const SWAGGER_UI_VERSION = '5.33.0';

const CDN_BASE = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

export interface SwaggerSetupOptions {
  cdnAssets?: boolean;
}

interface SwaggerUiRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  credentials?: string;
}

export const authRequestInterceptor = (req: SwaggerUiRequest) => {
  if (/\/api\/auth\//.test(req.url)) {
    req.credentials = 'include';
    if (req.method.toUpperCase() === 'POST') {
      req.headers['X-Auth-Request'] = '1';
    }
  }
  return req;
};

const DESCRIPTION = `
Cookie-based JWT authentication for a browser frontend.

**Flow:** \`POST /api/auth/signup\` → \`POST /api/auth/signin\` (sets the \`auth.token\` HttpOnly cookie) → \`GET /api/auth/me\` → \`POST /api/auth/logout\` (clears the cookie).

**Not Bearer auth.** The access token is a 15-minute HS256 JWT that lives only in the \`auth.token\` cookie. It is never returned in JSON. Swagger UI cannot inject an HttpOnly cookie, so there is no Authorize step: sign in with the endpoint below and the browser stores the cookie.

**CSRF protection.** Every authentication POST needs \`X-Auth-Request: 1\` (this page adds it automatically) and a browser Origin that is listed in \`AUTH_ALLOWED_ORIGINS\`. To use "Try it out" here, the origin of this page must be in that list.

**Rate limits.** Signup: 5 attempts per client IP per 15 minutes. Signin: 10 attempts per client IP per 15 minutes. Exceeding a limit returns 429 with a \`Retry-After\` header (seconds).

**Logout** clears the cookie but does not revoke tokens: a copied JWT stays valid until it expires.
`;

export function configureSwagger(
  app: NestExpressApplication,
  options: SwaggerSetupOptions = {},
): void {
  const config = new DocumentBuilder()
    .setTitle('Auth API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addCookieAuth(
      'auth.token',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth.token',
        description:
          'HttpOnly JWT cookie set by POST /api/auth/signin. Not a Bearer token and not settable from this page.',
      },
      'auth-cookie',
    )
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    SwaggerModule.createDocument(app, config),
    {
      jsonDocumentUrl: SWAGGER_JSON_PATH,
      customSiteTitle: 'Auth API docs',
      customCss:
        '.swagger-ui .scheme-container .auth-wrapper { display: none; }',
      ...(options.cdnAssets && {
        customCssUrl: `${CDN_BASE}/swagger-ui.css`,
        customJs: [
          `${CDN_BASE}/swagger-ui-bundle.js`,
          `${CDN_BASE}/swagger-ui-standalone-preset.js`,
        ],
      }),
      swaggerOptions: {
        withCredentials: true,
        persistAuthorization: false,
        requestInterceptor: authRequestInterceptor,
      },
    },
  );
}
