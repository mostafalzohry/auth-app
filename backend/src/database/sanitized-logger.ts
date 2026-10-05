import { ConsoleLogger } from '@nestjs/common';

const MONGODB_URI_PATTERN = /mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi;

function redactUris(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(MONGODB_URI_PATTERN, 'mongodb://<redacted>');
  }
  if (value instanceof Error) {
    return redactUris(value.stack ?? value.message);
  }
  return value;
}

export class SanitizedLogger extends ConsoleLogger {
  error(message: unknown, ...optionalParams: unknown[]) {
    const context = optionalParams.at(-1);
    if (context === 'MongooseModule') {
      const stack = optionalParams[0];
      const errorName =
        typeof stack === 'string' ? stack.split(/[:\n]/)[0].trim() : '';
      const reason = errorName ? ` Reason: ${errorName}.` : '';
      return super.error(`${String(redactUris(message))}${reason}`, context);
    }
    return super.error(redactUris(message), ...optionalParams.map(redactUris));
  }
}
