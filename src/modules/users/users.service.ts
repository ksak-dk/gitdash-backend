import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Service responsible for managing user profiles and settings persistence.
 * Communicates directly with TypeORM repositories for User and UserSettings entities.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
  ) {}

  /**
   * Finds an existing user by their GitHub ID, or creates a new user along with default settings
   * if they do not exist. If the username has changed on GitHub, it updates it.
   *
   * @param githubId - Unique GitHub identifier string returned from OAuth provider
   * @param username - GitHub login handle (username)
   * @returns Promise resolving to the newly fetched or created User entity
   */
  async findOrCreateUser(githubId: string, username: string): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { githubId },
      relations: { settings: true },
    });

    if (!user) {
      user = this.userRepository.create({
        githubId,
        username,
      });
      user = await this.userRepository.save(user);

      const settings = this.userSettingsRepository.create({
        userId: user.id,
        enabled: true,
        lang: 'ko',
        theme: 'system',
        layoutConfig: {},
      });
      user.settings = await this.userSettingsRepository.save(settings);
    } else if (user.username !== username) {
      user.username = username;
      user = await this.userRepository.save(user);
    }

    return user;
  }

  /**
   * Retrieves the settings of a specific user.
   *
   * @param userId - Unique internal user UUID
   * @returns Promise resolving to the UserSettings entity
   * @throws NotFoundException if the settings associated with the userId do not exist
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    const settings = await this.userSettingsRepository.findOne({
      where: { userId },
    });
    if (!settings) {
      throw new NotFoundException('User settings not found');
    }
    return settings;
  }

  /**
   * Partially updates a user's settings profile.
   *
   * @param userId - Unique internal user UUID
   * @param updateData - DTO containing optional settings updates (enabled, lang, theme, layoutConfig)
   * @returns Promise resolving to the updated UserSettings entity
   * @throws NotFoundException if the settings to be updated do not exist
   */
  async updateUserSettings(
    userId: string,
    updateData: UpdateSettingsDto,
  ): Promise<UserSettings> {
    const settings = await this.getUserSettings(userId);

    if (updateData.enabled !== undefined) settings.enabled = updateData.enabled;
    if (updateData.lang !== undefined) settings.lang = updateData.lang;
    if (updateData.theme !== undefined) settings.theme = updateData.theme;
    if (updateData.layoutConfig !== undefined) {
      settings.layoutConfig = {
        ...settings.layoutConfig,
        ...updateData.layoutConfig,
      };
    }

    return this.userSettingsRepository.save(settings);
  }
}
