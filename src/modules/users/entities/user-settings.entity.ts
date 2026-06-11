import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('user_settings')
export class UserSettings {
  @ApiProperty({ description: 'The unique UUID of the user associated with these settings', example: 'd3b07384-d113-4956-a0f1-281247ff421a' })
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @ApiProperty({ description: 'Flag to enable or disable the dashboard view', example: true })
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @ApiProperty({ description: 'Selected language code', example: 'ko' })
  @Column({ type: 'varchar', length: 5, default: 'ko' })
  lang: string;

  @ApiProperty({ description: 'UI Theme of the dashboard', example: 'system' })
  @Column({ type: 'varchar', length: 10, default: 'system' })
  theme: string;

  @ApiProperty({ description: 'Custom dashboard widgets layout configuration', example: { showHeatmap: true, showPrList: true } })
  @Column({ name: 'layout_config', type: 'jsonb', default: {} })
  layoutConfig: Record<string, any>;

  @ApiProperty({ description: 'The date and time when the settings were last updated' })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
