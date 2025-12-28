import { Router } from 'express';
import ShopModel from "../models/shop";
import UserModel from '../models/user';

const router = Router();

type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

type SitemapUrl = {
  loc: string;
  lastmod?: string;      // YYYY-MM-DD
  changefreq?: ChangeFreq;
  priority?: number;     // 0.0 to 1.0
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, ''); // remove trailing slash
}

function normalizePath(path: string) {
  if (!path.startsWith('/')) return `/${path}`;
  return path;
}

function toLastMod(date?: any) {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  // sitemap-friendly stable format
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get('/sitemap.xml', async (req, res) => {
  try {
    const BASE_URL = normalizeBaseUrl(process.env.PUBLIC_URL || 'https://izyglam.com');

    // Pages statiques avec signaux SEO
    const staticUrls: SitemapUrl[] = [
      { loc: `${BASE_URL}/`, changefreq: 'daily', priority: 1.0 },
      { loc: `${BASE_URL}/main`, changefreq: 'daily', priority: 0.9 },
      { loc: `${BASE_URL}/pro`, changefreq: 'weekly', priority: 0.8 },
      { loc: `${BASE_URL}/pricing`, changefreq: 'weekly', priority: 0.7 },
      { loc: `${BASE_URL}/help`, changefreq: 'monthly', priority: 0.4 },
      { loc: `${BASE_URL}/signup`, changefreq: 'monthly', priority: 0.3 },
      { loc: `${BASE_URL}/login`, changefreq: 'monthly', priority: 0.1 },
      { loc: `${BASE_URL}/cgu`, changefreq: 'yearly', priority: 0.1 }
    ];

    // Shops dynamiques
    const shops = await ShopModel.find({})
      .select('slug updatedAt')
      .lean();

    const shopUrls: SitemapUrl[] = shops
      .filter((s: any) => typeof s.slug === 'string' && s.slug.trim().length > 0)
      .map((s: any) => {
        const slug = encodeURIComponent(s.slug.trim());
        return {
          loc: `${BASE_URL}${normalizePath(`/shop/${slug}`)}`,
          lastmod: toLastMod(s.updatedAt),
          changefreq: 'weekly',
          priority: 0.8
        };
      });

    // Pros dynamiques
    const pros = await UserModel.find({ role: 'professionnel' })
      .select('slug updatedAt')
      .lean();

    const proUrls: SitemapUrl[] = pros
      .filter((p: any) => typeof p.slug === 'string' && p.slug.trim().length > 0)
      .map((p: any) => {
        const slug = encodeURIComponent(p.slug.trim());
        return {
          loc: `${BASE_URL}${normalizePath(`/pro/${slug}`)}`,
          lastmod: toLastMod(p.updatedAt),
          changefreq: 'weekly',
          priority: 0.7
        };
      });

    // Assemble
    const urls: SitemapUrl[] = [
      ...staticUrls,
      ...shopUrls,
      ...proUrls
    ];

    // XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `
  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : ''}
    ${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}
    ${typeof u.priority === 'number' ? `<priority>${u.priority.toFixed(1)}</priority>` : ''}
  </url>
`).join('')}
</urlset>`;

    // Headers HTTP "pro"
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h cache

    res.status(200).send(xml);

  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Sitemap generation failed');
  }
});

export default router;
