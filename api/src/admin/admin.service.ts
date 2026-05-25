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

type AdminUsersQuery = {
  page?: number
  limit?: number
  search?: string
  status?: string
  role?: string
  plan?: string
  hasDevices?: string
  sortBy?: string
  sortDir?: string
}

const STALE_HEARTBEAT_MINUTES = 30
const HIGH_PENDING_SMS_THRESHOLD = 5

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

  async getUsersList(query: AdminUsersQuery) {
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
    if (query.role && query.role !== 'all') {
      filter.role = query.role
    }
    if (query.status === 'banned') {
      filter.isBanned = true
    } else if (query.status === 'unverified') {
      filter.emailVerifiedAt = null
      filter.isBanned = { $ne: true }
    } else if (query.status === 'active') {
      filter.isBanned = { $ne: true }
      filter.emailVerifiedAt = { $ne: null }
    }

    const users = await this.userModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()

    const userIds = users.map((user: any) => user._id)
    const [smsCounts, deviceCounts, subscriptions] = await Promise.all([
      this.smsModel.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
      this.deviceModel.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]),
      this.subscriptionModel
        .find({ user: { $in: userIds }, isActive: true })
        .populate('plan')
        .lean(),
    ])
    const smsCountByUserId = new Map(
      smsCounts.map((item: { _id: Types.ObjectId; count: number }) => [
        item._id.toString(),
        item.count,
      ]),
    )
    const deviceCountByUserId = new Map(
      deviceCounts.map((item: { _id: Types.ObjectId; count: number }) => [
        item._id.toString(),
        item.count,
      ]),
    )
    const subscriptionByUserId = new Map(
      subscriptions.map((subscription: any) => [
        subscription.user.toString(),
        subscription,
      ]),
    )

    const usersWithDetails = users
      .map((user: any) => {
        const userId = user._id.toString()
        const subscription = subscriptionByUserId.get(userId)
        const devicesCount = deviceCountByUserId.get(userId) ?? 0
        const smsCount = smsCountByUserId.get(userId) ?? 0
        return {
          ...user,
          subscription: subscription || {
            plan: { name: 'free' },
            isActive: true,
            status: 'active',
          },
          devicesCount,
          smsCount,
        }
      })
      .filter((user: any) => {
        if (query.plan && query.plan !== 'all') {
          const planName = user.subscription?.plan?.name ?? 'free'
          if (planName !== query.plan) return false
        }
        if (query.hasDevices === 'with' && user.devicesCount === 0) return false
        if (query.hasDevices === 'without' && user.devicesCount > 0) return false
        return true
      })

    const sortBy = query.sortBy || 'createdAt'
    const sortDir = query.sortDir === 'asc' ? 1 : -1
    usersWithDetails.sort((a: any, b: any) => {
      let aValue: any
      let bValue: any

      if (sortBy === 'smsCount' || sortBy === 'devicesCount') {
        aValue = a[sortBy] ?? 0
        bValue = b[sortBy] ?? 0
      } else if (sortBy === 'plan') {
        aValue = a.subscription?.plan?.name ?? 'free'
        bValue = b.subscription?.plan?.name ?? 'free'
      } else if (sortBy === 'name' || sortBy === 'email') {
        aValue = String(a[sortBy] ?? '').toLowerCase()
        bValue = String(b[sortBy] ?? '').toLowerCase()
      } else {
        aValue = new Date(a.createdAt ?? 0).getTime()
        bValue = new Date(b.createdAt ?? 0).getTime()
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * sortDir
      }
      return String(aValue).localeCompare(String(bValue)) * sortDir
    })

    const totalUsers = usersWithDetails.length
    const paginatedUsers = usersWithDetails.slice(skip, skip + limit)

    return {
      users: paginatedUsers,
      totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      summary: {
        bannedUsers: usersWithDetails.filter((user: any) => user.isBanned).length,
        unverifiedUsers: usersWithDetails.filter((user: any) => !user.emailVerifiedAt).length,
        usersWithoutDevices: usersWithDetails.filter((user: any) => user.devicesCount === 0).length,
        totalMessages: usersWithDetails.reduce((total: number, user: any) => total + user.smsCount, 0),
      },
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

  async getDeviceMonitoring() {
    const staleSince = new Date(Date.now() - STALE_HEARTBEAT_MINUTES * 60 * 1000)

    const [devices, pendingCounts] = await Promise.all([
      this.deviceModel
        .find()
        .select(
          '_id user name brand manufacturer model os osVersion appVersionName appVersionCode appVersionInfo enabled heartbeatEnabled lastHeartbeat sentSMSCount receivedSMSCount smsSendDelaySeconds fcmTokenInvalidatedAt fcmTokenInvalidReason batteryInfo networkInfo createdAt',
        )
        .populate({ path: 'user', select: '_id name email' })
        .sort({ lastHeartbeat: 1 })
        .lean(),
      this.smsModel.aggregate([
        {
          $match: {
            type: 'SENT',
            status: { $in: ['pending', 'dispatched', 'received_by_device', 'sending'] },
          },
        },
        {
          $group: {
            _id: '$device',
            count: { $sum: 1 },
          },
        },
      ]),
    ])

    const pendingCountByDeviceId = new Map(
      pendingCounts.map((item: { _id: Types.ObjectId; count: number }) => [
        item._id?.toString(),
        item.count,
      ]),
    )

    const monitoredDevices = devices.map((device: any) => {
      const pendingSMSCount = pendingCountByDeviceId.get(device._id.toString()) ?? 0
      const lastHeartbeat = device.lastHeartbeat ? new Date(device.lastHeartbeat) : null
      const isOnline = Boolean(device.enabled && lastHeartbeat && lastHeartbeat >= staleSince)
      const isStale = Boolean(device.enabled && (!lastHeartbeat || lastHeartbeat < staleSince))
      const hasHighPendingSMS = pendingSMSCount >= HIGH_PENDING_SMS_THRESHOLD
      const heartbeatAgeMinutes = lastHeartbeat
        ? Math.max(0, Math.floor((Date.now() - lastHeartbeat.getTime()) / 60000))
        : null
      const hasInvalidFcmToken = Boolean(device.fcmTokenInvalidatedAt)
      const connectionStatus = !device.enabled
        ? 'disabled'
        : hasInvalidFcmToken
          ? 'fcm_invalid'
          : isOnline
            ? 'online'
            : 'offline'

      return {
        _id: device._id,
        name: device.name,
        brand: device.brand,
        manufacturer: device.manufacturer,
        model: device.model,
        os: device.os,
        osVersion: device.osVersion,
        appVersionName: device.appVersionInfo?.versionName ?? device.appVersionName,
        appVersionCode: device.appVersionInfo?.versionCode ?? device.appVersionCode,
        enabled: device.enabled,
        heartbeatEnabled: device.heartbeatEnabled,
        lastHeartbeat: device.lastHeartbeat,
        heartbeatAgeMinutes,
        sentSMSCount: device.sentSMSCount ?? 0,
        receivedSMSCount: device.receivedSMSCount ?? 0,
        smsSendDelaySeconds: device.smsSendDelaySeconds ?? 5,
        pendingSMSCount,
        isOnline,
        isStale,
        hasHighPendingSMS,
        connectionStatus,
        fcmTokenStatus: hasInvalidFcmToken ? 'invalid' : 'valid',
        fcmTokenInvalidatedAt: device.fcmTokenInvalidatedAt,
        fcmTokenInvalidReason: device.fcmTokenInvalidReason,
        batteryInfo: device.batteryInfo,
        networkInfo: device.networkInfo,
        user: device.user,
        createdAt: device.createdAt,
      }
    })

    const onlineDevices = monitoredDevices.filter((device) => device.isOnline).length
    const offlineDevices = monitoredDevices.filter(
      (device) => device.enabled && !device.isOnline,
    ).length
    const disabledDevices = monitoredDevices.filter((device) => !device.enabled).length
    const staleHeartbeatDevices = monitoredDevices.filter((device) => device.isStale).length
    const highPendingDevices = monitoredDevices.filter((device) => device.hasHighPendingSMS).length
    const pendingMessagesTotal = monitoredDevices.reduce(
      (total, device) => total + device.pendingSMSCount,
      0,
    )

    const attentionDevices = monitoredDevices
      .filter(
        (device) =>
          device.isStale ||
          device.hasHighPendingSMS ||
          Boolean(device.fcmTokenInvalidatedAt),
      )
      .sort((a, b) => {
        const aScore =
          (a.isStale ? 1000 : 0) +
          (a.hasHighPendingSMS ? 500 : 0) +
          (a.fcmTokenInvalidatedAt ? 250 : 0) +
          a.pendingSMSCount
        const bScore =
          (b.isStale ? 1000 : 0) +
          (b.hasHighPendingSMS ? 500 : 0) +
          (b.fcmTokenInvalidatedAt ? 250 : 0) +
          b.pendingSMSCount
        return bScore - aScore
      })
      .slice(0, 25)

    return {
      thresholds: {
        staleHeartbeatMinutes: STALE_HEARTBEAT_MINUTES,
        highPendingSMS: HIGH_PENDING_SMS_THRESHOLD,
      },
      summary: {
        totalDevices: monitoredDevices.length,
        enabledDevices: monitoredDevices.length - disabledDevices,
        disabledDevices,
        onlineDevices,
        offlineDevices,
        staleHeartbeatDevices,
        highPendingDevices,
        pendingMessagesTotal,
      },
      attentionDevices,
    }
  }

  async getUserMessages(
    userId: string,
    query: { page?: number; limit?: number; type?: string; status?: string },
  ) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid User ID')
    }

    const page = Math.max(1, Number(query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)))
    const skip = (page - 1) * limit
    const messageQuery: any = {
      user: new Types.ObjectId(userId),
      deletedAt: { $exists: false },
    }

    if (query.type === 'sent') {
      messageQuery.type = 'SENT'
    } else if (query.type === 'received') {
      messageQuery.type = 'RECEIVED'
    }
    if (query.status && query.status !== 'all') {
      messageQuery.status = query.status
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
    const now = Date.now()
    const dataWithWaiting = data.map((message: any) => {
      const status = String(message.status || '').toLowerCase()
      const waitingFrom =
        status === 'sending'
          ? message.sendingAt
          : status === 'received_by_device'
            ? message.receivedByDeviceAt
            : status === 'dispatched'
              ? message.dispatchedAt
              : message.requestedAt || message.createdAt
      const waitingMinutes =
        ['pending', 'dispatched', 'received_by_device', 'sending'].includes(status) && waitingFrom
          ? Math.max(0, Math.floor((now - new Date(waitingFrom).getTime()) / 60000))
          : null

      return {
        ...message,
        waitingMinutes,
      }
    })

    return {
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: dataWithWaiting,
    }
  }

  async cancelMessage(messageId: string) {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException('Invalid Message ID')
    }

    const message = await this.smsModel.findOne({
      _id: new Types.ObjectId(messageId),
      deletedAt: { $exists: false },
    })

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    if (!['pending', 'dispatched', 'received_by_device'].includes(message.status)) {
      throw new BadRequestException('Only pending, dispatched, or device-received messages can be cancelled')
    }

    const previousStatus = message.status
    message.status = 'cancelled'
    message.cancelledAt = new Date()
    message.errorMessage =
      previousStatus === 'dispatched'
        ? 'Cancelled by admin after dispatch; device-side delivery may already be in progress.'
        : 'Cancelled by admin before dispatch.'
    await message.save()

    return { success: true, message }
  }

  async deleteMessage(messageId: string) {
    if (!Types.ObjectId.isValid(messageId)) {
      throw new BadRequestException('Invalid Message ID')
    }

    const message = await this.smsModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(messageId),
        deletedAt: { $exists: false },
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedReason: 'Deleted by admin',
        },
      },
      { new: true },
    )

    if (!message) {
      throw new NotFoundException('Message not found')
    }

    return { success: true }
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
