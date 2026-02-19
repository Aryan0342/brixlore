import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    const url = process.env.DATABASE_URL ?? '';
    const host = url
      .replace(/^[^@]+@/, '')
      .split('/')[0]
      .split('?')[0];
    console.log(`[Prisma] Connected to DB host: ${host || '(unknown)'}`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
