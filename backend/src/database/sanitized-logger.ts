import { ConsoleLogger } from '@nestjs/common';
import { safeDatabaseErrorName } from './database-error-name';

const MONGOOSE_CONTEXT = 'MongooseModule';
const RETRY_COUNT_PATTERN = /Retrying \((\d+)\)/;
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

function errorNameFromStack(stack: unknown): string {
  const firstToken =
    typeof stack === 'string' ? stack.split(/[:\n]/)[0].trim() : undefined;
  return safeDatabaseErrorName(firstToken);
}

function retryMessage(message: unknown): string {
  const retry = RETRY_COUNT_PATTERN.exec(String(message));
  return retry
    ? `Unable to connect to the database. Retrying (${retry[1]})...`
    : 'Unable to connect to the database.';
}

function isMongooseRetryLog(optionalParams: unknown[]): boolean {
  return optionalParams.at(-1) === MONGOOSE_CONTEXT;
}

export class SanitizedLogger extends ConsoleLogger {
  error(message: unknown, ...optionalParams: unknown[]) {
    if (isMongooseRetryLog(optionalParams)) {
      const reason = errorNameFromStack(optionalParams[0]);
      return super.error(
        `${retryMessage(message)} Reason: ${reason}.`,
        MONGOOSE_CONTEXT,
      );
    }
    return super.error(redactUris(message), ...optionalParams.map(redactUris));
  }
}
