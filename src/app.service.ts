import { Injectable } from '@nestjs/common';

/**
 * Service providing basic application-wide utilities and health confirmations.
 */
@Injectable()
export class AppService {
  /**
   * Retrieves a standard welcome message.
   *
   * @returns Greeting string
   */
  getHello(): string {
    return 'Hello World!';
  }
}
