import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { AdminGuard } from '../auth/guards/admin.guard'
import { AdminService } from './admin.service'

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getStats()
  }

  @Get('users')
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string
  ) {
    return this.adminService.getUsersList({ page, limit, search })
  }

  @Patch('users/:id/role')
  async updateRole(@Param('id') id: string, @Body('role') role: string) {
    return this.adminService.updateRole(id, role)
  }

  @Patch('users/:id/ban')
  async toggleBan(@Param('id') id: string, @Body('isBanned') isBanned: boolean) {
    return this.adminService.toggleBan(id, isBanned)
  }

  @Post('users/:id/subscription/override')
  async overrideSubscription(
    @Param('id') id: string,
    @Body()
    overrideDto: {
      planName: string
      subscriptionEndDate?: Date
      customDailyLimit?: number
      customMonthlyLimit?: number
      customBulkSendLimit?: number
      notes?: string
    }
  ) {
    return this.adminService.overrideUserSubscription(id, overrideDto)
  }

  @Get('users/:id/devices')
  async getUserDevices(@Param('id') id: string) {
    return this.adminService.getUserDevices(id)
  }

  @Delete('devices/:deviceId')
  async deleteDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.deleteDevice(deviceId)
  }
}
