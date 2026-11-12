/**
 * @jest-environment jsdom
 */
import fs from "fs";
import path from "path";

const publicDir = path.resolve(__dirname, "../../public");
const read = (name) => fs.readFileSync(path.join(publicDir, name), "utf8");

const ORIGIN = "https://mylunariaai.com";
const PRIVATE_PATHS = [
  "/authorization",
  "/reset-password",
  "/my-charts",
  "/natal-chart-result",
  "/relationships",
  "/dashboard",
];

describe("public/robots.txt", () => {
  const lines = () => read("robots.txt").split(/\r?\n/).map((line) => line.trim());

  test("не закрывает весь сайт", () => {
    expect(lines().filter((line) => /^Disallow:\s*\/?\s*$/i.test(line))).toEqual([]);
    expect(lines()).toContain("Allow: /");
  });

  test("закрывает приватные страницы", () => {
    PRIVATE_PATHS.forEach((p) => expect(lines()).toContain(`Disallow: ${p}`));
  });

  test("указывает карту сайта", () => {
    expect(lines()).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe("public/sitemap.xml", () => {
  const locs = () => {
    const doc = new DOMParser().parseFromString(read("sitemap.xml"), "application/xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    return Array.from(doc.getElementsByTagName("loc")).map((node) => node.textContent.trim());
  };

  test("содержит только публичные страницы на основном домене", () => {
    const urls = locs();
    expect(urls.sort()).toEqual(
      ["/", "/try-free", "/pricing", "/terms", "/privacy", "/refunds", "/support"].map((p) => `${ORIGIN}${p}`).sort()
    );
  });

  test("не содержит приватных путей", () => {
    locs().forEach((url) => {
      expect(url.startsWith(`${ORIGIN}/`)).toBe(true);
      PRIVATE_PATHS.forEach((p) => expect(url).not.toContain(p));
    });
  });
});

describe("public/index.html head", () => {
  const html = () => read("index.html");

  test("есть превью для ссылок", () => {
    ["og:type", "og:site_name", "og:locale", "og:title", "og:description"].forEach((name) =>
      expect(html()).toContain(`property="${name}"`)
    );
    expect(html()).toContain('name="twitter:card"');
  });

  test("есть значок, и файл значка существует", () => {
    const match = html().match(/<link rel="icon"[^>]*href="%PUBLIC_URL%\/([^"]+)"/);
    expect(match).not.toBeNull();
    expect(fs.existsSync(path.join(publicDir, match[1]))).toBe(true);
  });

  test("нет статического canonical и og:url", () => {
    expect(html()).not.toMatch(/rel="canonical"/);
    expect(html()).not.toMatch(/property="og:url"/);
  });

  test("прежние meta и атрибуты на месте", () => {
    expect(html()).toContain('data-clarity-mask="true"');
    expect(html()).toContain('name="description"');
    expect(html()).toContain('name="theme-color"');
  });
});
