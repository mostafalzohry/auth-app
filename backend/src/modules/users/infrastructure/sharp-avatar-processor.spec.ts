import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { InvalidAvatarError } from '../domain/avatar-processor.port';
import { SharpAvatarProcessor } from './sharp-avatar-processor';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '../../../../test/fixtures', name));

describe('SharpAvatarProcessor (real images)', () => {
  const processor = new SharpAvatarProcessor();

  it.each(['landscape-exif6.jpg', 'square.png', 'square.webp'])(
    'accepts %s and re-encodes it as WebP within 256x256',
    async (name) => {
      const result = await processor.process(fixture(name));

      expect(result.contentType).toBe('image/webp');
      const meta = await sharp(result.data).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBeLessThanOrEqual(256);
      expect(meta.height).toBeLessThanOrEqual(256);
    },
  );

  it('auto-orients and strips metadata', async () => {
    const result = await processor.process(fixture('landscape-exif6.jpg'));

    const meta = await sharp(result.data).metadata();
    expect(meta.width).toBeLessThan(meta.height as number);
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(result.data.toString('latin1')).not.toContain(
      'fixture-secret-metadata',
    );
  });

  it('does not enlarge small images', async () => {
    const meta = await sharp(
      (await processor.process(fixture('square.png'))).data,
    ).metadata();

    expect([meta.width, meta.height]).toEqual([64, 64]);
  });

  it.each([
    ['SVG', 'vector.svg'],
    ['GIF', 'pixel.gif'],
  ])('rejects %s as unsupported', async (_label, name) => {
    await expect(processor.process(fixture(name))).rejects.toMatchObject({
      reason: 'unsupported',
    });
  });

  it('rejects arbitrary bytes and empty input as unsupported', async () => {
    await expect(
      processor.process(Buffer.from('not an image')),
    ).rejects.toMatchObject({ reason: 'unsupported' });
    await expect(processor.process(Buffer.alloc(0))).rejects.toBeInstanceOf(
      InvalidAvatarError,
    );
  });

  it('rejects a corrupt image that has valid magic bytes', async () => {
    await expect(
      processor.process(fixture('truncated.png')),
    ).rejects.toMatchObject({ reason: 'corrupt' });
  });

  it('rejects images over the input pixel limit', async () => {
    const huge = await sharp({
      create: {
        width: 5000,
        height: 5000,
        channels: 3,
        background: '#fff',
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    await expect(processor.process(huge)).rejects.toMatchObject({
      reason: 'too-large',
    });
  });

  it('never leaks decoder messages in the error', async () => {
    const error = await processor
      .process(fixture('truncated.png'))
      .catch((e: Error) => e);

    expect((error as Error).message).toBe('Invalid avatar image (corrupt)');
  });
});
