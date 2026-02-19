import { BadRequestException, Injectable } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, readdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { PrismaService } from '../prisma/prisma.service';
import { R2Service } from '../storage/r2.service';

function getContentType(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (lower.endsWith('.ts')) return 'video/MP2T';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return undefined;
}

function getUploadPrefixFromKey(key: string): string | null {
  const match = key.replace(/^\/+/, '').match(/^uploads\/([^/]+)\//);
  if (!match) return null;
  return `uploads/${match[1]}/hls`;
}

@Injectable()
export class TranscodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Service: R2Service,
  ) {}

  async transcodeEpisodeToHls(
    episodeId: string,
    opts?: {
      outputPrefix?: string;
      tempDir?: string;
      keepTemp?: boolean;
    },
  ): Promise<{ episodeId: string; hlsKey: string; files: number }> {
    const episode = await (this.prisma as any).episode.findUnique({
      where: { id: episodeId },
      select: { id: true, videoUrl: true },
    });
    if (!episode?.videoUrl) {
      throw new BadRequestException('Episode videoUrl is required for transcode');
    }

    const outputPrefix = opts?.outputPrefix?.trim() || getUploadPrefixFromKey(episode.videoUrl);
    if (!outputPrefix) {
      throw new BadRequestException(
        'outputPrefix is required when videoUrl does not use uploads/<id>/',
      );
    }

    const baseTemp = opts?.tempDir?.trim() || path.join(process.cwd(), 'tmp', 'hls');
    const jobDir = path.join(baseTemp, `${episodeId}-${Date.now()}`);
    const outputDir = path.join(jobDir, 'out');
    mkdirSync(outputDir, { recursive: true });

    const sourceKey = episode.videoUrl.trim();
    const sourceUrl = /^https?:\/\//i.test(sourceKey)
      ? sourceKey
      : await this.r2Service.getSignedGetUrl(sourceKey);

    const sourcePath = path.join(jobDir, 'source.mp4');
    await this.downloadToFile(sourceUrl, sourcePath);

    await this.runFfmpeg(sourcePath, outputDir);

    const files = readdirSync(outputDir);
    if (!files.includes('index.m3u8')) {
      throw new BadRequestException('HLS output missing index.m3u8');
    }

    try {
      for (const file of files) {
        const key = `${outputPrefix.replace(/\/+$/, '')}/${file}`;
        const filePath = path.join(outputDir, file);
        await this.r2Service.uploadFile(key, filePath, getContentType(file));
      }

      const hlsKey = `${outputPrefix.replace(/\/+$/, '')}/index.m3u8`;
      await (this.prisma as any).episode.update({
        where: { id: episodeId },
        data: { hlsUrl: hlsKey },
      });

      return { episodeId, hlsKey, files: files.length };
    } finally {
      if (!opts?.keepTemp) {
        // Best-effort cleanup: ignore failures on Windows file locks.
        try {
          await this.deleteDir(jobDir);
        } catch {
          // ignore
        }
      }
    }
  }

  private async downloadToFile(url: string, destPath: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new BadRequestException(`Failed to download source: ${res.status}`);
    }
    await pipeline(res.body, createWriteStream(destPath));
  }

  private runFfmpeg(sourcePath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        sourcePath,
        '-c:v',
        'h264',
        '-profile:v',
        'main',
        '-level',
        '3.1',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-hls_time',
        '6',
        '-hls_list_size',
        '0',
        '-hls_segment_filename',
        path.join(outputDir, 'seg_%03d.ts'),
        '-f',
        'hls',
        path.join(outputDir, 'index.m3u8'),
      ];

      // Use FFMPEG_PATH if set and valid, otherwise default to 'ffmpeg'
      // In production (Linux), ignore Windows paths from local .env files
      let ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
      
      // If FFMPEG_PATH contains Windows path separators and we're on Linux, use default
      if (process.platform !== 'win32' && (ffmpegBin.includes('\\') || ffmpegBin.includes('C:'))) {
        ffmpegBin = 'ffmpeg';
      }
      
      const proc = spawn(ffmpegBin, args, { stdio: 'inherit' });
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new BadRequestException(`ffmpeg exited with code ${code}`));
      });
    });
  }

  private async deleteDir(targetDir: string): Promise<void> {
    if (!existsSync(targetDir)) return;
    await import('fs/promises').then((fs) => fs.rm(targetDir, { recursive: true, force: true }));
  }
}
