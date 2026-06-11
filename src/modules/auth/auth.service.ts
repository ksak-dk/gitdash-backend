import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

/**
 * Service facilitating the OAuth and JWT authentication lifecycle.
 * Handshakes with UsersService to synchronize user profiles on login.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Processes a successful GitHub OAuth login. Synchronizes the user details into the database,
   * constructs a JWT token payload enclosing the internal userId and external GitHub token, and signs it.
   *
   * @param user - Object enclosing the profile returned from Passport GitHub strategy (githubId, username, githubAccessToken)
   * @returns Promise resolving to an object containing the signed access_token and basic user profile
   */
  async login(user: any) {
    const dbUser = await this.usersService.findOrCreateUser(user.githubId, user.username);

    const payload = {
      sub: dbUser.id,
      username: dbUser.username,
      githubAccessToken: user.githubAccessToken,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: dbUser.id,
        username: dbUser.username,
      },
    };
  }
}
