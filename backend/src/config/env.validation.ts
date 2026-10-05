import * as Joi from 'joi';

const mongodbUriMessage =
  '"MONGODB_URI" must be a non-empty string starting with mongodb:// or mongodb+srv://';

const MIN_JWT_SECRET_BYTES = 32;
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
});
