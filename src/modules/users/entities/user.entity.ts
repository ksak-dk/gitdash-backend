import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { UserSettings } from './user-settings.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('users')
export class User {
  @ApiProperty({ description: 'The unique UUID of the user', example: 'd3b07384-d113-4956-a0f1-281247ff421a' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'The Github user ID', example: '12345678' })
  @Column({ name: 'github_id', type: 'varchar', length: 100, unique: true })
  githubId: string;

  @ApiProperty({ description: 'The Github username', example: 'octocat' })
  @Column({ type: 'varchar', length: 100 })
  username: string;

  @ApiProperty({ description: 'The date and time when the user was created' })
  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @ApiProperty({ description: 'The date and time when the user profile was last updated' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @ApiProperty({ type: () => UserSettings, description: 'The settings configuration associated with the user' })
  @OneToOne(() => UserSettings, (settings) => settings.user, { cascade: true })
  settings: UserSettings;
}
