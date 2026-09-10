import { $fetch } from '#imports';

/**
 * 从 jsDelivr 拉取 npm 包的已发布版本列表（设置页的版本下拉用）。
 * 这是对第三方公开 API 的 GET 请求，不走本站 /api 客户端。
 */

interface JsDelivrPackageResp {
  tags?: Record<string, string>;
  versions?: { version: string }[];
}

export interface VersionList {
  latest: string;
  versions: string[];
}

export async function fetchVersions(pkg: string): Promise<VersionList> {
  const data = await $fetch<JsDelivrPackageResp>(
    `https://data.jsdelivr.com/v1/packages/npm/${encodeURIComponent(pkg)}`,
    { timeout: 10000 },
  );

  return {
    latest: data.tags?.latest || '',
    versions: (data.versions || []).slice(0, 30).map((v) => v.version),
  };
}
