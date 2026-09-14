import puppeteer from "@cloudflare/puppeteer";


const CONFIG = {

  searches: [

    // 🔥 JOJO — ПРІОРИТЕТ
    {
      name: "JoJo",
      keyword: "ジョジョ",
      type: "jojo",
      maxPrice: 10000
    },

    {
      name: "Super Action Statue",
      keyword: "超像可動",
      type: "jojo",
      maxPrice: 10000
    },

    {
      name: "Medicos",
      keyword: "メディコス",
      type: "jojo",
      maxPrice: 10000
    },


    // 💸 БУДЬ-ЯКІ ДЕШЕВІ ФІГУРКИ
    {
      name: "Cheap figures",
      keyword: "フィギュア",
      type: "cheap",
      maxPrice: 3000
    },

    {
      name: "Prize figures",
      keyword: "プライズ フィギュア",
      type: "cheap",
      maxPrice: 3000
    }

  ],

  maxItemsPerSearch: 20
};



export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);


    // Головна
    if (url.pathname === "/") {

      return json({
        success: true,
        message: "Mandarake Hunter is running",
        routes: [
          "/run"
        ]
      });
    }


    // Ручний запуск
    if (url.pathname === "/run") {

      return await runMandarake(env);
    }

    if (url.pathname === "/debug-dom") {

      let browser = null;
    
      try {
    
        browser =
          await puppeteer.launch(
            env.BROWSER
          );
    
        const page =
          await browser.newPage();
    
        await page.setUserAgent(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/151.0.0.0 Safari/537.36"
        );
    
        await page.goto(
          "https://www.mandarake.co.jp/",
          {
            waitUntil: "domcontentloaded",
            timeout: 30000
          }
        );
    
        await page.goto(
          "https://order.mandarake.co.jp/order/?lang=en",
          {
            waitUntil: "domcontentloaded",
            timeout: 30000
          }
        );
    
        await page.goto(
          "https://order.mandarake.co.jp/order/listPage/list?keyword=%E3%82%B8%E3%83%A7%E3%82%B8%E3%83%A7&lang=en",
          {
            waitUntil: "domcontentloaded",
            timeout: 30000
          }
        );
    
        await sleep(1000);
    
        const debug =
          await page.evaluate(() => {
    
            const link =
              document.querySelector(
                'a[href*="itemCode=1070800275"]'
              ) ||
              document.querySelector(
                'a[href*="/order/detailPage/item"]'
              );
    
            if (!link) {
              return {
                found: false
              };
            }
    
            const parents = [];
    
            let node = link;
    
            for (
              let level = 0;
              level < 10 && node;
              level++
            ) {
    
              parents.push({
    
                level,
    
                tag:
                  node.tagName,
    
                id:
                  node.id || null,
    
                className:
                  typeof node.className === "string"
                    ? node.className
                    : null,
    
                text:
                  (
                    node.innerText ||
                    ""
                  )
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 1500),
    
                html:
                  (
                    node.outerHTML ||
                    ""
                  )
                    .slice(0, 4000)
    
              });
    
              node =
                node.parentElement;
            }
    
            return {
    
              found: true,
    
              href:
                link.href,
    
              linkText:
                (
                  link.innerText ||
                  ""
                ).trim(),
    
              parents
    
            };
          });
    
        await browser.close();
    
        browser = null;
    
        return json({
          success: true,
          debug
        });
    
      } catch (error) {
    
        if (browser) {
          try {
            await browser.close();
          } catch {}
        }
    
        return json({
          success: false,
          error: String(error),
          stack:
            error?.stack || null
        });
      }
    }


    return new Response(
      "Not found",
      {
        status: 404
      }
    );
  }
};



async function runMandarake(env) {

  let browser = null;

  const startedAt =
    Date.now();


  try {

    browser =
      await puppeteer.launch(
        env.BROWSER
      );


    const page =
      await browser.newPage();


    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/151.0.0.0 Safari/537.36"
    );


    await page.setViewport({
      width: 1280,
      height: 900
    });


    // --------------------------------
    // 1. Створюємо сесію Mandarake
    // --------------------------------

    await page.goto(
      "https://www.mandarake.co.jp/",
      {
        waitUntil: "domcontentloaded",
        timeout: 30000
      }
    );


    await page.goto(
      "https://order.mandarake.co.jp/order/?lang=en",
      {
        waitUntil: "domcontentloaded",
        timeout: 30000
      }
    );


    const results = [];

    const errors = [];


    // --------------------------------
    // 2. Пошуки
    // --------------------------------

    for (
      const search
      of CONFIG.searches
    ) {

      try {

        const searchUrl =
          "https://order.mandarake.co.jp/order/listPage/list" +
          "?keyword=" +
          encodeURIComponent(
            search.keyword
          ) +
          "&lang=en";


        await page.goto(
          searchUrl,
          {
            waitUntil:
              "domcontentloaded",

            timeout:
              30000
          }
        );


        // Невелика пауза, щоб DOM догрузився
        await sleep(700);


        const currentUrl =
          page.url();


        // Якщо Mandarake раптом викинув
        // нас із магазину
        if (
          !currentUrl.includes(
            "order.mandarake.co.jp/order/"
          )
        ) {

          errors.push({
            search:
              search.name,

            error:
              "Redirected outside Mandarake order",

            url:
              currentUrl
          });

          continue;
        }


        // --------------------------------
        // 3. Збираємо посилання на товари
        // --------------------------------

        const rawItems =
          await page.evaluate(() => {
        
            const blocks =
              Array.from(
                document.querySelectorAll(
                  ".thumlarge > .block[data-itemidx]"
                )
              );
        
            return blocks.map(
              block => {
        
                const itemCode =
                  block.getAttribute(
                    "data-itemidx"
                  );
        
        
                const titleElement =
                  block.querySelector(
                    ".title a"
                  );
        
        
                const priceElement =
                  block.querySelector(
                    ".price p"
                  );
        
        
                const shopElement =
                  block.querySelector(
                    ".basic .shop"
                  );
        
        
                const stockElement =
                  block.querySelector(
                    ".basic .stock"
                  );
        
        
                const itemNoElement =
                  block.querySelector(
                    ".basic .itemno"
                  );
        
        
                const imageElement =
                  block.querySelector(
                    ".pic .thum img"
                  );
        
        
                const linkElement =
                  titleElement ||
                  block.querySelector(
                    '.pic a[href*="/order/detailPage/item"]'
                  );
        
        
                const newArrival =
                  Boolean(
                    block.querySelector(
                      ".new_arrival"
                    )
                  );
        
        
                let href =
                  linkElement?.href ||
                  null;
        
        
                let image =
                  imageElement?.src ||
                  imageElement?.getAttribute(
                    "data-src"
                  ) ||
                  imageElement?.getAttribute(
                    "data-original"
                  ) ||
                  null;
        
        
                return {
        
                  itemCode,
        
                  title:
                    (
                      titleElement?.textContent ||
                      ""
                    ).trim(),
        
                  priceText:
                    (
                      priceElement?.textContent ||
                      ""
                    ).trim(),
        
                  shop:
                    (
                      shopElement?.textContent ||
                      ""
                    ).trim(),
        
                  stock:
                    (
                      stockElement?.textContent ||
                      ""
                    ).trim(),
        
                  itemNo:
                    (
                      itemNoElement?.textContent ||
                      ""
                    ).trim(),
        
                  image,
        
                  href,
        
                  newArrival,
        
                  text:
                    (
                      block.innerText ||
                      ""
                    ).trim()
        
                };
              }
            );
          });


        // --------------------------------
        // 4. Нормалізуємо
        // --------------------------------

        let count = 0;


        for (
          const raw
          of rawItems
        ) {

          if (
            count >=
            CONFIG.maxItemsPerSearch
          ) {
            break;
          }


          const price =
            extractYenPrice(
              raw.priceText ||
              raw.text
            );


          // Якщо ціну поки не знайшли —
          // все одно покажемо товар у debug.
          // Так побачимо реальну структуру.
          const normalized = {
          
            source:
              "Mandarake",
          
            search:
              search.name,
          
            type:
              search.type,
          
            itemCode:
              raw.itemCode,
          
            title:
              cleanText(
                raw.title
              ),
          
            priceYen:
              price,
          
            maxPriceYen:
              search.maxPrice,
          
            withinPrice:
              price !== null
                ? price <=
                  search.maxPrice
                : null,
          
            shop:
              cleanText(
                raw.shop
              ),
          
            stock:
              cleanText(
                raw.stock
              ),
          
            itemNo:
              cleanText(
                raw.itemNo
              ),
          
            newArrival:
              raw.newArrival,
          
            image:
              raw.image,
          
            link:
              raw.href,
          
            rawText:
              cleanText(
                raw.text
              ).slice(
                0,
                800
              )
          
          };
          
          
          results.push(
            normalized
          );
          
          
          count++;

      }
      } catch (error) {

        errors.push({

          search:
            search.name,

          error:
            String(error)

        });
      }
    }


    await browser.close();

    browser = null;


    // --------------------------------
    // 5. Прибираємо дублікати
    // --------------------------------

    const unique =
      deduplicateItems(
        results
      );


    const priced =
      unique.filter(
        item =>
          Number.isFinite(
            item.priceYen
          )
      );


    const availableFigures =
      priced.filter(
        item =>
          !isSoldOut(item) &&
          looksLikeFigure(item)
      );
    
    
    const jojo =
      availableFigures
        .filter(
          item =>
            isJojoFigure(item) &&
            item.priceYen <= 10000
        )
        .sort(
          (a, b) =>
            a.priceYen - b.priceYen
        );
    
    
    const cheap =
      availableFigures
        .filter(
          item =>
            !isJojoFigure(item) &&
            item.priceYen <= 3000
        )
        .sort(
          (a, b) =>
            a.priceYen - b.priceYen
        );
    
    
    const matching = [
      ...jojo,
      ...cheap
    ];
    
    
    for (const item of matching) {
    
      item.defect =
        hasDefect(item);
    
      item.badge =
        item.defect
          ? "⚠️ ДЕФЕКТ"
          : (
              isJojoFigure(item)
                ? "⭐ JOJO"
                : "🔥 ДЕШЕВО"
            );
    }

    return json({

      success: true,

      searches:
        CONFIG.searches.length,

      foundRaw:
        results.length,

      unique:
        unique.length,

      priced:
        priced.length,

      figures:
        availableFigures.length,
      
      matching:
        matching.length,

      jojo:
        jojo.length,

      cheap:
        cheap.length,

      browserSeconds:
        Number(
          (
            (
              Date.now() -
              startedAt
            ) / 1000
          ).toFixed(2)
        ),

      errors,

      // Поки показуємо максимум 40,
      // щоб JSON не був величезний.
      items:
        matching.slice(
          0,
          40
        )

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
        error?.stack ||
        null,

      browserSeconds:
        Number(
          (
            (
              Date.now() -
              startedAt
            ) / 1000
          ).toFixed(2)
        )

    });
  }
}



// ========================================
// PRICE
// ========================================

function extractYenPrice(text) {

  if (!text) {
    return null;
  }

  const normalized =
    String(text)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const patterns = [

    /(?:¥|￥)\s*([\d,]+)/i,

    /([\d,]+)\s*円/i,

    /JPY\s*([\d,]+)/i,

    /([\d,]+)\s*JPY/i,

    /([\d,]+)\s*yen\b/i

  ];

  for (
    const pattern
    of patterns
  ) {

    const match =
      normalized.match(
        pattern
      );

    if (!match) {
      continue;
    }

    const value =
      Number(
        match[1]
          .replace(/,/g, "")
      );

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 10000000
    ) {
      return value;
    }
  }

  return null;
}



// ========================================
// DEDUPLICATION
// ========================================

function deduplicateItems(
  items
) {

  const map =
    new Map();


  for (
    const item
    of items
  ) {

    const key =
      item.itemCode ||
      item.link;


    if (!key) {
      continue;
    }


    // Якщо товар уже зустрічався,
    // JoJo-результат має пріоритет
    // над cheap.
    if (
      map.has(key)
    ) {

      const old =
        map.get(key);


      if (
        old.type !== "jojo" &&
        item.type === "jojo"
      ) {

        map.set(
          key,
          item
        );
      }


      continue;
    }


    map.set(
      key,
      item
    );
  }


  return Array.from(
    map.values()
  );
}



// ========================================
// HELPERS
// ========================================

function cleanText(text) {

  return String(
    text || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function sleep(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


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
          "application/json; charset=UTF-8",

        "cache-control":
          "no-store"
      }
    }
  );
}

function isSoldOut(item) {

  const text =
    `${item.title || ""} ${item.rawText || ""}`
      .toLowerCase();

  return (
    text.includes("sold out") ||
    text.includes("out of stock") ||
    text.includes("品切") ||
    text.includes("売り切れ")
  );
}


function hasDefect(item) {

  const text =
    `${item.title || ""} ${item.rawText || ""}`
      .toLowerCase();

  const words = [
    "has damage",
    "damaged",
    "damage",
    "junk",
    "ジャンク",
    "破損",
    "欠品",
    "箱なし",
    "箱無し",
    "本体のみ",
    "台座欠品",
    "パーツ欠品",
    "パーツのみ",
    "開封"
  ];

  return words.some(
    word =>
      text.includes(
        word.toLowerCase()
      )
  );
}


function looksLikeFigure(item) {

  const text =
    `${item.title || ""} ${item.rawText || ""}`
      .toLowerCase();


  // Явно НЕ фигурки
  const reject = [

    "t-shirt",
    "shirt",
    "towel",
    "badge",
    "can badge",
    "sticker",
    "keychain",
    "key chain",
    "acrylic stand",
    "acrylic panel",
    "acrylic magnet",
    "magnet",
    "playing cards",
    "card collection",
    "comic",
    "jump comics",
    "manga",
    "dvd",
    "blu-ray",
    "blu ray",
    "book",
    "poster",
    "clear file",
    "box tissue",
    "tissue",
    "wall scroll",
    "illustration board",
    "art panel",

    "缶バッジ",
    "ステッカー",
    "キーホルダー",
    "アクリルスタンド",
    "アクリルパネル",
    "アクリル",
    "コミック",
    "漫画",
    "dvd",
    "blu-ray"
  ];


  if (
    reject.some(
      word =>
        text.includes(word)
    )
  ) {
    return false;
  }


  // R18 заглушка Mandarake
  if (
    (item.image || "")
      .includes(
        "/item_list/r18.png"
      )
  ) {
    return false;
  }


  // Сильные признаки фигурки
  const figureWords = [

    "figure",
    "figures",
    "figurine",

    "super action",
    "super action statue",
    "超像可動",

    "s.h.figuarts",
    "shfiguarts",
    "figuarts",

    "nendoroid",
    "ねんどろいど",

    "figma",

    "mafiarte",
    "mafiarte",

    "mometria",

    "world collectable figure",
    "wcf",

    "grandista",

    "q posket",
    "qposket",

    "masterlise",

    "ichiban kuji",
    "一番くじ",

    "prize figure",
    "プライズ",

    "statue",

    "action figure",
    "scale figure",

    "フィギュア"
  ];


  return figureWords.some(
    word =>
      text.includes(word)
  );
}


function isJojoFigure(item) {

  if (!looksLikeFigure(item)) {
    return false;
  }

  const text =
    `${item.title || ""} ${item.rawText || ""}`
      .toLowerCase();

  const jojoWords = [

    "jojo",
    "jojo's bizarre",
    "jojo's bizzare",
    "ジョジョ",

    "jotaro",
    "dio",
    "giorno",
    "jolyne",
    "josuke",
    "joseph joestar",
    "jonathan joestar",
    "gyro zeppeli",
    "johnny joestar",
    "diego brando",
    "killer queen",
    "crazy diamond",
    "star platinum",
    "gold experience",
    "golden experience",
    "polnareff",
    "prosciutto",
    "spice girl",
    "sheer heart attack",
    "fugo",
    "bruno buccellati",
    "bucciarati"
  ];

  return jojoWords.some(
    word =>
      text.includes(word)
  );
}
