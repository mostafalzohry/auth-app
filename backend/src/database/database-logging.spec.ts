import { Logger } from '@nestjs/common';
import { MongooseError } from 'mongoose';
import { sanitizeConnectionError } from './database.module';
import { SanitizedLogger } from './sanitized-logger';

const PASSWORD = 'S3cretPw';
const URI = `mongodb+srv://fakeuser:${PASSWORD}@cluster.example.net/auth_app`;

function leakyError() {
  const error = new MongooseError(`bad auth for ${URI} (password ${PASSWORD})`);
  Object.defineProperty(error, 'name', {
    value: 'MongooseServerSelectionError',
  });
  error.stack = `${error.name}: ${error.message}\n    at connect (${URI})`;
  return error;
}

describe('database error logging', () => {
  let output: string;

  beforeEach(() => {
    output = '';
    const capture = (chunk: string | Uint8Array) => {
      output += String(chunk);
      return true;
    };
    jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    Logger.overrideLogger(new SanitizedLogger());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Logger.overrideLogger(['error', 'warn', 'log']);
  });

  it('logs retries the way @nestjs/mongoose does without leaking secrets', () => {
    const error = leakyError();
    new Logger('MongooseModule').error(
      'Unable to connect to the database. Retrying (1)...',
      error.stack,
    );

    expect(output).toContain('Unable to connect to the database. Retrying (1)');
    expect(output).toContain('MongooseServerSelectionError');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('fakeuser');
    expect(output).not.toContain('cluster.example.net');
    expect(output).not.toContain('    at connect');
  });

  it('redacts connection strings in other error logs', () => {
    Logger.error(`Failed with ${URI}`, `trace ${URI}`, 'Other');

    expect(output).toContain('mongodb://<redacted>');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('fakeuser');
  });

  it('falls back to a generic reason for an unrecognized or malicious error name', () => {
    const logger = new Logger('MongooseModule');
    const stacks = [
      `${URI}: boom`,
      `fakeuser:${PASSWORD}@host Error: boom`,
      `Error ${PASSWORD}\n    at x`,
      `MongoServerError ${PASSWORD}: boom`,
    ];

    for (const stack of stacks) {
      logger.error('Unable to connect to the database. Retrying (2)...', stack);
    }

    expect(output).toContain(
      'Retrying (2)... Reason: DatabaseConnectionError.',
    );
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('fakeuser');
    expect(output).not.toContain('cluster.example.net');
  });

  it('handles a missing stack argument', () => {
    new Logger('MongooseModule').error(
      'Unable to connect to the database. Retrying (3)...',
    );

    expect(output).toContain(
      'Retrying (3)... Reason: DatabaseConnectionError.',
    );
    expect(output).not.toContain('undefined');
  });

  it('drops a driver message embedded in the retry message', () => {
    new Logger('MongooseModule').error(
      `Unable to connect to the database. Message: bad auth ${PASSWORD} ${URI}. Retrying (1)...`,
      leakyError().stack,
    );

    expect(output).toContain(
      'Retrying (1)... Reason: MongooseServerSelectionError.',
    );
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('Message:');
  });

  it('leaves normal application logging intact', () => {
    new Logger('Other').log('server started');
    Logger.error('plain failure', 'trace line', 'Other');

    expect(output).toContain('server started');
    expect(output).toContain('plain failure');
    expect(output).toContain('trace line');
  });

  it('replaces the final connection error with a sanitized one', () => {
    const sanitized = sanitizeConnectionError(leakyError());
    const logged = `${sanitized.message}\n${sanitized.stack}`;

    expect(sanitized.message).toContain('MongooseServerSelectionError');
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain('fakeuser');
    expect(logged).not.toContain(URI);
  });

  it('uses a generic name in the final error when the name is not recognized', () => {
    const error = new MongooseError('driver message');
    Object.defineProperty(error, 'name', {
      value: `${URI} ${PASSWORD}`,
    });

    const sanitized = sanitizeConnectionError(error);
    const logged = `${sanitized.message}\n${sanitized.stack}`;

    expect(sanitized.message).toContain('(DatabaseConnectionError)');
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain('fakeuser');
    expect(logged).not.toContain('driver message');
  });
});
