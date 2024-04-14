import type { Express, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import unirest from 'unirest';

/**
 * loadPageProxy
 * 쿠키 포함하여 서버 페이지를 호출하여 텍스트로 리턴.
 *
 * @param req {Request}
 * @param domain {string}
 * @returns {Promise<string>}
 */
function loadPageProxy(req: Request, domain: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // CookieJar를 이용하는 방법으로는 쿠키가 제대로 전송되지 않아 request header에 직접 쿠키를 부어넣음
      // const CookieJar = unirest.jar()
      // Object.entries(req.cookies).forEach(([key, value]) => CookieJar.add(`${key}=${value || ''}`))
      const cookies = Object.entries(req.cookies || {}).map(([key, value]) => `${key}=${value || ''}`);

      unirest(req.method ?? 'get', `${domain}${req.url}`)
        .headers({ cookie: cookies.join('; ') }) // HTTP/1.1 방식
        .followAllRedirects(true)
        //.jar(CookieJar)
        .end((response: any) => {
          // response.body(HTML string)를 전달한다. 필요시 조작해서 리턴한다.
          resolve(response.body ?? '');
        });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

/**
 * initializeProxyServer
 *
 * @param app {Express}
 * @param pageProxyServerUrl {string}
 */
export function initializeProxyServer(app: Express, pageProxyServerUrl: string): void {
  // Set up the proxy web page.
  app.use('/page', async (req: Request, res: Response) => {
    try {
      // 프록시 타겟서버 설정, 30X 등의 리다이렉트 이슈 등으로 인해 프로토콜 값을 잘 체크해봐야 한다.
      const html = await loadPageProxy(req, pageProxyServerUrl);
      return res.send(html).end();
    } catch (e) {
      console.error(e);
      res.sendStatus(500).end();
    }
  });

  // Set up the proxy web page's request url (위 설정 페이지(/page) 내 API 호출 코드에 대한 프록시 처리)
  app.use(
    /^\/api-page-proxy\/.*/,
    createProxyMiddleware({
      target: pageProxyServerUrl,
      changeOrigin: true,
      secure: false,
      followRedirects: true, // DO NOT CHANGE: follow redirects if status was 30X
      autoRewrite: false, // DO NOT CHANGE: preserves original request url!
    }),
  );
}

