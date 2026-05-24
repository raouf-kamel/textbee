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

  @Get('devices/monitoring')
  async getDeviceMonitoring() {
    return this.adminService.getDeviceMonitoring()
  }

  @Get('users')
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('plan') plan?: string,
    @Query('hasDevices') hasDevices?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    return this.adminService.getUsersList({
      page,
      limit,
      search,
      status,
      role,
      plan,
      hasDevices,
      sortBy,
      sortDir,
    })
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

  @Get('users/:id/messages')
  async getUserMessages(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.adminService.getUserMessages(id, { page, limit, type })
  }

  @Get('plans')
  async getPlans() {
    return this.adminService.getPlans()
  }

  @Post('plans')
  async upsertPlan(
    @Body()
    planDto: {
      name: string
      dailyLimit: number
      monthlyLimit: number
      bulkSendLimit: number
      monthlyPrice?: number
      yearlyPrice?: number
      isActive?: boolean
      polarProductId?: string
      polarMonthlyProductId?: string
      polarYearlyProductId?: string
    }
  ) {
    return this.adminService.upsertPlan(planDto)
  }

  @Patch('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body()
    planDto: {
      name?: string
      dailyLimit?: number
      monthlyLimit?: number
      bulkSendLimit?: number
      monthlyPrice?: number
      yearlyPrice?: number
      isActive?: boolean
      polarProductId?: string
      polarMonthlyProductId?: string
      polarYearlyProductId?: string
    }
  ) {
    return this.adminService.updatePlan(id, planDto)
  }

  @Post('users/:id/devices')
  async createUserDevice(
    @Param('id') id: string,
    @Body()
    deviceDto: {
      name?: string
      enabled?: boolean
      fcmToken?: string
      brand?: string
      manufacturer?: string
      model?: string
      serial?: string
      buildId?: string
      os?: string
      osVersion?: string
      appVersionName?: string
      appVersionCode?: number
      receiveSMSEnabled?: boolean
      smsSendDelaySeconds?: number
    }
  ) {
    return this.adminService.createUserDevice(id, deviceDto)
  }

  @Patch('devices/:deviceId')
  async updateDevice(
    @Param('deviceId') deviceId: string,
    @Body()
    deviceDto: {
      name?: string
      enabled?: boolean
      fcmToken?: string
      brand?: string
      manufacturer?: string
      model?: string
      serial?: string
      buildId?: string
      os?: string
      osVersion?: string
      appVersionName?: string
      appVersionCode?: number
      receiveSMSEnabled?: boolean
      smsSendDelaySeconds?: number
    }
  ) {
    return this.adminService.updateDevice(deviceId, deviceDto)
  }

  @Delete('devices/:deviceId')
  async deleteDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.deleteDevice(deviceId)
  }
}
