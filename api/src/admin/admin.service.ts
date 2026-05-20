import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { User, UserDocument } from '../users/schemas/user.schema'
import { Device, DeviceDocument } from '../gateway/schemas/device.schema'
import { SMS, SMSDocument } from '../gateway/schemas/sms.schema'
import { Subscription, SubscriptionDocument } from '../billing/schemas/subscription.schema'
import { Plan, PlanDocument } from '../billing/schemas/plan.schema'

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
}
