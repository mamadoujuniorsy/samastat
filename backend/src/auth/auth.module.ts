import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { StaffGuard } from './staff.guard.js';
import { AdminGuard } from './admin.guard.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, StaffGuard, AdminGuard],
  exports: [AuthService, StaffGuard, AdminGuard],
})
export class AuthModule {}
