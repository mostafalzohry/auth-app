import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { AvatarImage } from '../domain/avatar';
import {
  AVATAR_ACCEPTED_FORMATS,
  AVATAR_MAX_DIMENSION,
  AVATAR_MAX_INPUT_PIXELS,
  AVATAR_MAX_OUTPUT_BYTES,
  AVATAR_OUTPUT_CONTENT_TYPE,
  AvatarInputFormat,
} from '../domain/avatar-policy';
import {
  AvatarProcessor,
  InvalidAvatarError,
} from '../domain/avatar-processor.port';

const PROCESSING_TIMEOUT_SECONDS = 10;
const OUTPUT_QUALITY = 80;
const ACCEPTED_FORMATS: ReadonlySet<string> = new Set(AVATAR_ACCEPTED_FORMATS);

sharp.cache(false);

function sniffFormat(bytes: Buffer): AvatarInputFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return bytes[2] === 0xff ? 'jpeg' : null;
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
  ) {
    return 'png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

@Injectable()
export class SharpAvatarProcessor implements AvatarProcessor {
  async process(input: Buffer): Promise<AvatarImage> {
    const claimed = sniffFormat(input);
    if (!claimed) throw new InvalidAvatarError('unsupported');

    let output: Buffer;
    try {
      const image = sharp(input, {
        limitInputPixels: AVATAR_MAX_INPUT_PIXELS,
        failOn: 'error',
        animated: false,
      });
      const { format } = await image.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format) || format !== claimed) {
        throw new InvalidAvatarError('unsupported');
      }
      output = await image
        .timeout({ seconds: PROCESSING_TIMEOUT_SECONDS })
        .rotate()
        .resize(AVATAR_MAX_DIMENSION, AVATAR_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: OUTPUT_QUALITY })
        .toBuffer();
    } catch (error) {
      if (error instanceof InvalidAvatarError) throw error;
      const pixelLimit = /pixel limit/i.test((error as Error).message ?? '');
      throw new InvalidAvatarError(pixelLimit ? 'too-large' : 'corrupt');
    }

    if (output.length > AVATAR_MAX_OUTPUT_BYTES) {
      throw new InvalidAvatarError('too-large');
    }
    return { data: output, contentType: AVATAR_OUTPUT_CONTENT_TYPE };
  }
}
