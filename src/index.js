import puppeteer from "@cloudflare/puppeteer";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/test-mandarake") {
      return new Response(
        "Mandarake Hunter is running",
        {
          headers: {
            "content-type": "text/plain; charset=UTF-8"
          }
        }
      );
    }

    let browser;

    try {
      browser = await puppeteer.launch(
        env.BROWSER
      );

      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/151.0.0.0 Safari/537.36"
      );

      // 1. Стартова сторінка Mandarake
      await page.goto(
        "https://www.mandarake.co.jp/",
        {
          waitUntil: "domcontentloaded",
          timeout: 30000
        }
      );

      const firstUrl = page.url();

      // 2. Mail-Order
      await page.goto(
        "https://order.mandarake.co.jp/order/?lang=en",
        {
          waitUntil: "domcontentloaded",
          timeout: 30000
        }
      );

      const orderUrl = page.url();

      // 3. Пошук JoJo
      await page.goto(
        "https://order.mandarake.co.jp/order/listPage/list?keyword=%E3%82%B8%E3%83%A7%E3%82%B8%E3%83%A7&lang=en",
        {
          waitUntil: "domcontentloaded",
          timeout: 30000
        }
      );

      // Трошки даємо сторінці догрузитися
      await new Promise(
        resolve => setTimeout(resolve, 1500)
      );

      const finalUrl = page.url();

      const html =
        await page.content();

      const cookies =
        await page.cookies();

      const cookieNames =
        cookies.map(
          cookie => cookie.name
        );

      await browser.close();
      browser = null;

      return json({
        success: true,

        firstUrl,
        orderUrl,
        finalUrl,

        length:
          html.length,

        hasJojo:
          html.includes("ジョジョ"),

        hasGiorno:
          html.includes("Giorno"),

        hasItemCode:
          html.includes("itemCode"),

        hasSearchResult:
          html.includes("Search result"),

        has3800:
          html.includes("3,800"),

        hasMailOrder:
          html.includes("Mail-Order"),

        cookieNames,

        hasAccessToken:
          cookieNames.includes(
            "mandarake_access_token"
          ),

        hasMandarakeOrder:
          cookieNames.includes(
            "mandarake_order"
          ),

        hasMandarakeUser:
          cookieNames.includes(
            "tr_mndrk_user"
          ),

        beginning:
          html.slice(0, 1000)
      });

    } catch (error) {

      if (browser) {
        try {
          await browser.close();
        } catch {}
      }

      return json({
        success: false,
        error:
          String(error),

        stack:
          error?.stack || null
      });
    }
  }
};


function json(data) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      headers: {
        "content-type":
          "application/json; charset=UTF-8"
      }
    }
  );
}
