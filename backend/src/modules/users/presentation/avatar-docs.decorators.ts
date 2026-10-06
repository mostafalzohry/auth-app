import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { ErrorResponse } from '../../auth/presentation/dto/error.response';
import {
  AVATAR_ACCEPTED_LABEL,
  AVATAR_FIELD_NAME,
  AVATAR_MAX_INPUT_MEGAPIXELS,
  AVATAR_MAX_UPLOAD_MIB,
} from '../domain/avatar-policy';

export function ApiMultipartAvatarBody() {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      required: true,
      schema: {
        type: 'object',
        required: [AVATAR_FIELD_NAME],
        properties: {
          [AVATAR_FIELD_NAME]: {
            type: 'string',
            format: 'binary',
            description: `Exactly one ${AVATAR_ACCEPTED_LABEL} image, at most ${AVATAR_MAX_UPLOAD_MIB} MiB. No other parts or fields are accepted.`,
          },
        },
      },
    }),
    ApiResponse({
      status: 413,
      description: `The file is over ${AVATAR_MAX_UPLOAD_MIB} MiB, or the decoded image is over the ${AVATAR_MAX_INPUT_MEGAPIXELS}-megapixel input limit.`,
      type: ErrorResponse,
    }),
    ApiResponse({
      status: 415,
      description: `The request is not \`multipart/form-data\`, or the file is not a ${AVATAR_ACCEPTED_LABEL} image (SVG and GIF are rejected).`,
      type: ErrorResponse,
    }),
  );
}
