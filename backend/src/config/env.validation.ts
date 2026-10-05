import * as Joi from 'joi';

const mongodbUriMessage =
  '"MONGODB_URI" must be a non-empty string starting with mongodb:// or mongodb+srv://';

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
});
