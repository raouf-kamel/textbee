import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { User, UserDocument } from '../users/schemas/user.schema'
import { Device, DeviceDocument } from '../gateway/schemas/device.schema'
import { SMS, SMSDocument } from '../gateway/schemas/sms.schema'
import { Subscription, SubscriptionDocument } from '../billing/schemas/subscription.schema'
import { Plan, PlanDocument } from '../billing/schemas/plan.schema'

type AdminPlanInput = {
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

type AdminDeviceInput = {
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

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
    @InjectModel(SMS.name) private smsModel: Model<SMSDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
  ) {}

  async getStats() {
    const totalUsers = await this.userModel.countDocuments()
    const totalDevices = await this.deviceModel.countDocuments()
    const totalSMS = await this.smsModel.countDocuments()
    const activeSubscriptions = await this.subscriptionModel.countDocuments({
      isActive: true,
      status: 'active',
    })

    // Breakdown of active subscriptions by plan
    const activeSubDocs = await this.subscriptionModel
      .find({ isActive: true, status: 'active' })
      .populate('plan')
    
    const planCounts = { free: 0, pro: 0, custom: 0 }
    activeSubDocs.forEach((sub: any) => {
      const planName = sub.plan?.name || 'free'
      if (planCounts[planName] !== undefined) {
        planCounts[planName]++
      } else {
        planCounts[planName] = 1
      }
    })

    return {
      totalUsers,
      totalDevices,
      totalSMS,
      activeSubscriptions,
      planCounts,
    }
  }

  async getUsersList(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page || 1))
    const limit = Math.max(1, Number(query.limit || 10))
    const skip = (page - 1) * limit

    const filter: any = {}
    if (query.search) {
      const cleanSearch = query.search.trim()
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
      ]
    }

    const totalUsers = await this.userModel.countDocuments(filter)
    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const userIds = users.map((user: any) => user._id)
    const smsCounts = await this.smsModel.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ])
    const smsCountByUserId = new Map(
      smsCounts.map((item: { _id: Types.ObjectId; count: number }) => [
        item._id.toString(),
        item.count,
      ]),
    )

    const usersWithDetails = await Promise.all(
      users.map(async (user: any) => {
        // Fetch active subscription for user
        const subscription = await this.subscriptionModel
          .findOne({ user: user._id, isActive: true })
          .populate('plan')
          .lean()

        // Fetch devices count for user
        const devicesCount = await this.deviceModel.countDocuments({
          user: user._id,
        })

        return {
          ...user,
          subscription: subscription || {
            plan: { name: 'free' },
            isActive: true,
            status: 'active',
          },
          devicesCount,
          smsCount: smsCountByUserId.get(user._id.toString()) ?? 0,
        }
      })
    )

    return {
      users: usersWithDetails,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
    }
  }

  async updateRole(userId: string, role: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const user = await this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId),
      { role },
      { new: true }
    )

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return { success: true, role: user.role }
  }

  async toggleBan(userId: string, isBanned: boolean) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const user = await this.userModel.findByIdAndUpdate(
      new Types.ObjectId(userId),
      { isBanned },
      { new: true }
    )

    if (!user) {
      throw new NotFoundException('User not found')
    }

    return { success: true, isBanned: user.isBanned }
  }

  async overrideUserSubscription(
    userId: string,
    overrideDto: {
      planName: string
      subscriptionEndDate?: Date
      customDailyLimit?: number
      customMonthlyLimit?: number
      customBulkSendLimit?: number
      notes?: string
    }
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const userObjectId = new Types.ObjectId(userId)
    const user = await this.userModel.findById(userObjectId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    // Find the requested plan in the database
    const plan = await this.planModel.findOne({ name: overrideDto.planName })
    if (!plan) {
      throw new BadRequestException(`Plan '${overrideDto.planName}' not found`)
    }

    // Deactivate all OTHER active subscriptions for this user
    await this.subscriptionModel.updateMany(
      { user: userObjectId, plan: { $ne: plan._id }, isActive: true },
      { isActive: false, subscriptionEndDate: new Date() }
    )

    // Set custom limits if provided, otherwise leave as undefined to inherit plan limits
    const updateData: any = {
      isActive: true,
      status: 'active',
      subscriptionEndDate: overrideDto.subscriptionEndDate || null,
      customDailyLimit: overrideDto.customDailyLimit !== undefined ? overrideDto.customDailyLimit : null,
      customMonthlyLimit: overrideDto.customMonthlyLimit !== undefined ? overrideDto.customMonthlyLimit : null,
      customBulkSendLimit: overrideDto.customBulkSendLimit !== undefined ? overrideDto.customBulkSendLimit : null,
      meta: {
        adminOverridden: true,
        overriddenAt: new Date(),
        notes: overrideDto.notes || '',
      },
    }

    // Create or update subscription
    await this.subscriptionModel.updateOne(
      { user: userObjectId, plan: plan._id },
      updateData,
      { upsert: true }
    )

    const updatedSub = await this.subscriptionModel
      .findOne({ user: userObjectId, plan: plan._id, isActive: true })
      .populate('plan')

    return {
      success: true,
      subscription: updatedSub,
    }
  }

  async getUserDevices(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    return this.deviceModel.find({ user: new Types.ObjectId(userId) }).sort({ createdAt: -1 })
  }

  async getUserMessages(
    userId: string,
    query: { page?: number; limit?: number; type?: string },
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const page = Math.max(1, Number(query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)))
    const skip = (page - 1) * limit
    const messageQuery: any = { user: new Types.ObjectId(userId) }

    if (query.type === 'sent') {
      messageQuery.type = 'SENT'
    } else if (query.type === 'received') {
      messageQuery.type = 'RECEIVED'
    }

    const [total, data] = await Promise.all([
      this.smsModel.countDocuments(messageQuery),
      this.smsModel
        .find(messageQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'device',
          select: '_id name brand model buildId enabled',
        })
        .lean(),
    ])

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data,
    }
  }

  async getPlans() {
    return this.planModel.find().sort({ name: 1 })
  }

  async upsertPlan(planDto: AdminPlanInput) {
    const name = planDto.name?.trim().toLowerCase()
    if (!name) {
      throw new BadRequestException('Plan name is required')
    }

    const updateData = this.normalizePlanInput({ ...planDto, name }, true)
    const plan = await this.planModel.findOneAndUpdate(
      { name },
      updateData,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    return { success: true, plan }
  }

  async updatePlan(planId: string, planDto: AdminPlanInput) {
    if (!Types.ObjectId.isValid(planId)) {
      throw new BadRequestException('Invalid Plan ID')
    }

    const updateData = this.normalizePlanInput(planDto, false)
    const plan = await this.planModel.findByIdAndUpdate(
      new Types.ObjectId(planId),
      updateData,
      { new: true }
    )

    if (!plan) {
      throw new NotFoundException('Plan not found')
    }

    return { success: true, plan }
  }

  async createUserDevice(userId: string, deviceDto: AdminDeviceInput) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const userObjectId = new Types.ObjectId(userId)
    const user = await this.userModel.findById(userObjectId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const deviceData = this.normalizeDeviceInput(deviceDto)
    if (!deviceData.name && !deviceData.model) {
      throw new BadRequestException('Device name or model is required')
    }

    const device = await this.deviceModel.create({
      ...deviceData,
      user: userObjectId,
      enabled: deviceData.enabled ?? true,
      brand: deviceData.brand ?? 'Manual',
      model: deviceData.model ?? deviceData.name ?? 'Manual Device',
      buildId: deviceData.buildId ?? `manual-${Date.now()}`,
      os: deviceData.os ?? 'Android',
      appVersionCode: deviceData.appVersionCode ?? 0,
      sentSMSCount: 0,
      receivedSMSCount: 0,
    })

    return { success: true, device }
  }

  async updateDevice(deviceId: string, deviceDto: AdminDeviceInput) {
    if (!Types.ObjectId.isValid(deviceId)) {
      throw new BadRequestException('Invalid Device ID')
    }

    const updateData = this.normalizeDeviceInput(deviceDto)
    const device = await this.deviceModel.findByIdAndUpdate(
      new Types.ObjectId(deviceId),
      { $set: updateData },
      { new: true }
    )

    if (!device) {
      throw new NotFoundException('Device not found')
    }

    return { success: true, device }
  }

  async deleteDevice(deviceId: string) {
    if (!Types.ObjectId.isValid(deviceId)) {
      throw new BadRequestException('Invalid Device ID')
    }

    const result = await this.deviceModel.deleteOne({ _id: new Types.ObjectId(deviceId) })
    if (result.deletedCount === 0) {
      throw new NotFoundException('Device not found')
    }

    return { success: true }
  }

  private normalizePlanInput(planDto: AdminPlanInput, requireLimits: boolean) {
    const updateData: any = {}

    if (planDto.name !== undefined) {
      const name = planDto.name.trim().toLowerCase()
      if (!name) throw new BadRequestException('Plan name is required')
      updateData.name = name
    }

    ;(['dailyLimit', 'monthlyLimit', 'bulkSendLimit'] as const).forEach((field) => {
      if (planDto[field] === undefined) {
        if (requireLimits) throw new BadRequestException(`${field} is required`)
        return
      }
      updateData[field] = this.parseNumber(planDto[field], field)
    })

    ;(['monthlyPrice', 'yearlyPrice'] as const).forEach((field) => {
      if (planDto[field] !== undefined) {
        updateData[field] = this.parseNumber(planDto[field], field)
      } else if (requireLimits) {
        updateData[field] = 0
      }
    })

    if (planDto.isActive !== undefined) updateData.isActive = Boolean(planDto.isActive)
    ;(['polarProductId', 'polarMonthlyProductId', 'polarYearlyProductId'] as const).forEach((field) => {
      if (planDto[field] !== undefined) {
        const value = planDto[field]?.trim()
        updateData[field] = value || undefined
      }
    })

    if (requireLimits && updateData.name) {
      updateData.polarProductId ??= `manual-${updateData.name}`
      updateData.polarMonthlyProductId ??= `manual-${updateData.name}-monthly`
      updateData.polarYearlyProductId ??= `manual-${updateData.name}-yearly`
    }

    return updateData
  }

  private normalizeDeviceInput(deviceDto: AdminDeviceInput) {
    const updateData: any = {}
    const stringFields: Array<keyof AdminDeviceInput> = [
      'name',
      'fcmToken',
      'brand',
      'manufacturer',
      'model',
      'serial',
      'buildId',
      'os',
      'osVersion',
      'appVersionName',
    ]

    stringFields.forEach((field) => {
      if (deviceDto[field] !== undefined) {
        const value = String(deviceDto[field] ?? '').trim()
        updateData[field] = value || undefined
      }
    })

    if (deviceDto.enabled !== undefined) updateData.enabled = Boolean(deviceDto.enabled)
    if (deviceDto.receiveSMSEnabled !== undefined) {
      updateData.receiveSMSEnabled = Boolean(deviceDto.receiveSMSEnabled)
    }
    if (deviceDto.appVersionCode !== undefined) {
      updateData.appVersionCode = this.parseNumber(deviceDto.appVersionCode, 'appVersionCode')
    }
    if (deviceDto.smsSendDelaySeconds !== undefined) {
      updateData.smsSendDelaySeconds = Math.min(
        3600,
        Math.max(0, this.parseNumber(deviceDto.smsSendDelaySeconds, 'smsSendDelaySeconds')),
      )
    }
    if (deviceDto.fcmToken !== undefined) updateData.fcmTokenUpdatedAt = new Date()

    return updateData
  }

  private parseNumber(value: unknown, fieldName: string) {
    const parsed = Number(value)
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`${fieldName} must be a number`)
    }
    return parsed
  }
}
