/**
 * 官方课程目录快照的来源信息。
 *
 * 课程内容由服务端的 `official-data.ts` 提供；这里保留公开给页面的来源，
 * 让用户可以追溯课程代码、类别和教师信息来自哪份教务处通知。
 */
export const OFFICIAL_CATALOG_TERM = '2026-2027-1';

export const OFFICIAL_CATALOG_SOURCES = [
  {
    label: '通识教育选修课程简介',
    url: 'https://xcjwb.hfut.edu.cn/a3/b1/c714a41905/page.htm',
  },
  {
    label: '学生选课选教通知（含课程预告）',
    url: 'https://xcjwb.hfut.edu.cn/a3/b0/c714a41904/page.htm',
  },
  {
    label: '课程预告.xlsx',
    url: 'https://xcjwb.hfut.edu.cn/_upload/article/files/58/65/80ee63384e3b91684e8d4d44920e/f2304582-b65c-477c-b401-cc62d44287d2.xlsx',
  },
  {
    label: '秋季跨专业选修课程介绍',
    // 用户给出的路径缺少 c1177；教务处实际页面为这个地址。
    url: 'https://xcjwb.hfut.edu.cn/a4/17/c1177a42007/page.htm',
  },
] as const;

export interface OfficialCatalogSource {
  label: string;
  url: string;
}
