import * as Joi from 'joi';
import { parseAllowedOrigins } from './allowed-origins';

const mongodbUriMessage =
  '"MONGODB_URI" must be a non-empty string starting with mongodb:// or mongodb+srv://';

const MIN_JWT_SECRET_BYTES = 32;
const allowedOriginsMessage =
  '"AUTH_ALLOWED_ORIGINS" must be a comma-separated list of exact http(s) origins without credentials, paths, queries or wildcards';
const allowedOriginsHttpsMessage =
  '"AUTH_ALLOWED_ORIGINS" must contain only https origins in production';
const trustProxyMessage =
  '"TRUST_PROXY_HOPS" must be an integer between 0 and 5 and is required in production';

const jwtSecretMessage = `"JWT_SECRET" must be a string of at least ${MIN_JWT_SECRET_BYTES} bytes`;

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\/\S+$/)
    .required()
    .messages({
      'any.required': mongodbUriMessage,
      'string.base': mongodbUriMessage,
      'string.empty': mongodbUriMessage,
      'string.pattern.base': mongodbUriMessage,
    }),
  JWT_SECRET: Joi.string()
    .required()
    .custom((value: string, helpers) =>
      Buffer.byteLength(value, 'utf8') >= MIN_JWT_SECRET_BYTES
        ? value
        : helpers.error('secret.length'),
    )
    .messages({
      'any.required': jwtSecretMessage,
      'string.base': jwtSecretMessage,
      'string.empty': jwtSecretMessage,
      'secret.length': jwtSecretMessage,
    }),
  AUTH_ALLOWED_ORIGINS: Joi.string()
    .required()
    .custom((value: string, helpers) => {
      let origins: string[];
      try {
        origins = parseAllowedOrigins(value);
      } catch {
        return helpers.error('origins.invalid');
      }
      const environment = (helpers.state.ancestors[0] as { NODE_ENV?: string })
        .NODE_ENV;
      if (
        environment === 'production' &&
        origins.some((origin) => !origin.startsWith('https://'))
      ) {
        return helpers.error('origins.https');
      }
      return origins.join(',');
    })
    .messages({
      'any.required': allowedOriginsMessage,
      'string.base': allowedOriginsMessage,
      'string.empty': allowedOriginsMessage,
      'origins.invalid': allowedOriginsMessage,
      'origins.https': allowedOriginsHttpsMessage,
    }),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(5).messages({
    'number.base': trustProxyMessage,
    'number.integer': trustProxyMessage,
    'number.min': trustProxyMessage,
    'number.max': trustProxyMessage,
  }),
})
  .custom((env: { NODE_ENV?: string; TRUST_PROXY_HOPS?: number }, helpers) =>
    env.NODE_ENV === 'production' && env.TRUST_PROXY_HOPS === undefined
      ? helpers.error('trust.required')
      : env,
  )
  .messages({ 'trust.required': trustProxyMessage });
