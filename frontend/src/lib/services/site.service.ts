import { get, post } from "@/lib/api-client";
import type {
  ContactSupportRequestDto,
  ContactSupportResponseDto,
  SitePageDto,
} from "@/types/api";

export const siteService = {
  async getPage(slug: string): Promise<SitePageDto | null> {
    try {
      return await get<SitePageDto>(`site/pages/${slug}`);
    } catch {
      return null;
    }
  },
  async submitContact(
    body: ContactSupportRequestDto,
  ): Promise<ContactSupportResponseDto> {
    return post<ContactSupportResponseDto>("site/contact", body);
  },
};
