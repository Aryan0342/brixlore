import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(1, { message: 'planId is required' })
  planId: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  cancelUrl?: string;
}
