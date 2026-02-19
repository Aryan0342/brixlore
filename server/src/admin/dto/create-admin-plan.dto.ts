import {
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsArray,
  IsString,
  Min,
  MinLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateAdminPlanDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsNumberString()
  price: string;

  @IsString()
  @MinLength(1)
  duration: string;

  @IsInt()
  @Min(0)
  deviceLimit: number;

  @IsBoolean()
  offlineAllowed: boolean;

  @IsInt()
  @Min(0)
  maxOfflineDownloads: number;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  perks?: string[];

  @IsOptional()
  @IsString()
  stripePriceId?: string;
}
