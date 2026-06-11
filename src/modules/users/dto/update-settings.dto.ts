import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Whether the dashboard is enabled',
    example: true,
  })
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Language preference of the extension',
    example: 'ko',
    maxLength: 5,
  })
  lang?: string;

  @ApiPropertyOptional({
    description: 'UI Theme of the dashboard',
    example: 'dark',
    maxLength: 10,
  })
  theme?: string;

  @ApiPropertyOptional({
    description: 'Flexible layout configuration key-value store',
    example: { showHeatmap: true, showPrList: true },
  })
  layoutConfig?: Record<string, any>;
}
