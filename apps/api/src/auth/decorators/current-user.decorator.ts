import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AccessTokenPayload } from '../auth.types';

type AuthenticatedRequest = Request & {
  user?: AccessTokenPayload;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error('CurrentUser used without authentication guard');
    }

    return request.user;
  },
);
