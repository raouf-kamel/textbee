import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { UserRole } from '../../users/user-roles.enum'

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (user && user.role === UserRole.ADMIN) {
      return true
    }

    throw new ForbiddenException(
      'Access denied. Administrative privileges are required.'
    )
  }
}
