import puppeteer from "@cloudflare/puppeteer";


const CONFIG = {

  searches: [

    // ⭐ JOJO — ПРІОРИТЕТ
    {
      name: "JoJo",
      keyword: "ジョジョ",
      type: "jojo",
      maxPrice: 10000
    },

    // ⭐ SUPER ACTION STATUE
    {
      name: "Super Action Statue",
      keyword: "超像可動",
      type: "jojo",
      maxPrice: 10000
    },

    // 🔥 БУДЬ-ЯКІ ДЕШЕВІ ФІГУРКИ
    {
      name: "Cheap figures",
      keyword: "フィギュア",
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
          "/run",
          "/bootstrap"
        ]
      });
    }


    // Ручний запуск
    // Ручний запуск
    if (url.pathname === "/run") {
      return await runMandarake(env, false);
    }
    
    // Перший запуск:
    // запам'ятати поточні товари БЕЗ Telegram
    if (url.pathname === "/bootstrap") {
      return await runMandarake(env, true);
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



async function runMandarake(env, bootstrap = false) {

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
          looksLikeFigure(item) &&
          looksLikeAnimeFigure(item)
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

    // --------------------------------
    // --------------------------------
    // 6. Telegram + SEEN
    // --------------------------------
    
    let sent = 0;
    let alreadySeen = 0;
    let bootstrapped = 0;
    let telegramErrors = [];
    
    const MAX_MESSAGES_PER_RUN = 8;
    
    
    // ========================================
    // BOOTSTRAP
    // Запам'ятовуємо ВСІ поточні товари.
    // Telegram НЕ викликається.
    // ========================================
    
    if (bootstrap) {
    
      for (const item of matching) {
    
        const seenKey =
          `mandarake:item:${item.itemCode}`;
    
        const seen =
          await env.SEEN.get(seenKey);
    
        if (seen) {
          alreadySeen++;
          continue;
        }
    
        await env.SEEN.put(
          seenKey,
          JSON.stringify({
            title: item.title,
            priceYen: item.priceYen,
            seenAt: new Date().toISOString(),
            bootstrap: true
          }),
          {
            expirationTtl:
              90 * 24 * 60 * 60
          }
        );
    
        bootstrapped++;
      }
    
    }
    
    
    // ========================================
    // ЗВИЧАЙНИЙ РЕЖИМ
    // Надсилаємо тільки НОВІ товари.
    // ========================================
    
    else {
    
      for (const item of matching) {
    
        if (sent >= MAX_MESSAGES_PER_RUN) {
          break;
        }
    
        const seenKey =
          `mandarake:item:${item.itemCode}`;
    
        const seen =
          await env.SEEN.get(seenKey);
    
        if (seen) {
          alreadySeen++;
          continue;
        }
    
        try {
    
          await sendMandarakeItem(
            env,
            item
          );
    
          sent++;
    
          await env.SEEN.put(
            seenKey,
            JSON.stringify({
              title: item.title,
              priceYen: item.priceYen,
              seenAt: new Date().toISOString(),
              bootstrap: false
            }),
            {
              expirationTtl:
                90 * 24 * 60 * 60
            }
          );
    
        } catch (error) {
    
          telegramErrors.push({
            itemCode: item.itemCode,
            error: String(error)
          });
    
        }
      }
    
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
      
      mode:
        bootstrap
          ? "bootstrap"
          : "notify",
      
      bootstrapped,
      sent,
      alreadySeen,
      telegramErrors,

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

  const defectWords = [
    "has damage",
    "damaged",
    "damage",
    "broken",
    "junk",

    "ジャンク",
    "破損",
    "欠品",
    "箱なし",
    "箱無し",
    "本体のみ",
    "台座欠品",
    "パーツ欠品",
    "パーツのみ"
  ];

  return defectWords.some(
    word =>
      text.includes(
        word.toLowerCase()
      )
  );
}}


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

function looksLikeAnimeFigure(item) {

  if (!looksLikeFigure(item)) {
    return false;
  }

  const text =
    `${item.title || ""} ${item.rawText || ""}`
      .toLowerCase();


  // ========================================
  // 1. JOJO завжди пропускаємо
  // ========================================

  if (isJojoFigure(item)) {
    return true;
  }


  // ========================================
  // 2. ЯВНО НЕ АНІМЕ
  // ========================================

  const rejectWords = [

    // Спорт
    "baseball",
    "football",
    "soccer",
    "basketball",
    "nba",
    "mlb",
    "nfl",
    "pacific league",
    "central league",
    "baystars",
    "marines",
    "fighters",

    // Динозаври / тварини
    "dinosaur",
    "dinosaurs",
    "jurassic",
    "animal",
    "animals",
    "wildlife",

    // Їжа / рекламні персонажі
    "biscuit",
    "candy",
    "sweets",
    "food mascot",

    // Не фігурка для нашої задачі
    "figure charm",
    "figure keychain",
    "mascot charm",

    // Західні франшизи
    "disney",
    "mickey",
    "minnie",
    "marvel",
    "spider-man",
    "spiderman",
    "avengers",
    "batman",
    "superman",
    "dc comics",
    "star wars",
    "pixar",
    "transformers",

    // Реальні люди / спортсмени
    "player figure",
    "athlete"
  ];

  if (
    rejectWords.some(
      word =>
        text.includes(word)
    )
  ) {
    return false;
  }


  // ========================================
  // 3. ВІДОМІ АНІМЕ / МАНГА / ЯПОНСЬКІ
  //    ПЕРСОНАЖІ ТА СЕРІЇ
  // ========================================

  const animeWords = [

    // Demon Slayer
    "demon slayer",
    "kimetsu no yaiba",
    "nezuko",
    "tanjiro",
    "rengoku",
    "zenitsu",
    "inosuke",

    // One Piece
    "one piece",
    "luffy",
    "zoro",
    "nami",
    "sanji",
    "ace",
    "trafalgar law",

    // Naruto
    "naruto",
    "sasuke",
    "sakura haruno",
    "kakashi",
    "itachi",

    // Dragon Ball
    "dragon ball",
    "goku",
    "vegeta",
    "frieza",

    // JJK
    "jujutsu kaisen",
    "gojo",
    "satoru gojo",
    "yuji itadori",
    "sukuna",
    "megumi fushiguro",

    // Chainsaw Man
    "chainsaw man",
    "denji",
    "makima",
    "power",

    // Bleach
    "bleach",
    "ichigo",
    "rukia",

    // Hunter x Hunter
    "hunter x hunter",
    "hunter×hunter",
    "gon freecss",
    "killua",
    "kurapika",
    "hisoka",

    // MHA
    "my hero academia",
    "boku no hero",
    "deku",
    "bakugo",
    "todoroki",

    // Attack on Titan
    "attack on titan",
    "shingeki no kyojin",
    "eren",
    "mikasa",
    "levi",

    // Evangelion
    "evangelion",
    "rei ayanami",
    "asuka langley",

    // Death Note
    "death note",
    "light yagami",
    "misa amane",
    "ryuk",

    // Frieren
    "frieren",
    "fern",
    "stark",

    // Re:Zero
    "re:zero",
    "rezero",
    "rem",
    "ram",
    "emilia",

    // Oshi no Ko
    "oshi no ko",
    "kana arima",
    "ruby hoshino",
    "aquamarine hoshino",
    "ai hoshino",

    // Sailor Moon
    "sailor moon",

    // Spy x Family
    "spy x family",
    "anya forger",
    "yor forger",

    // Fate
    "fate/",
    "fate stay night",
    "fate grand order",
    "saber",

    // Sword Art Online
    "sword art online",
    "asuna",
    "kirito",

    // Bocchi
    "bocchi the rock",

    // Pokémon
    "pokemon",
    "pokémon",
    "pikachu",

    // Vocaloid / Miku
    "hatsune miku",
    "初音ミク",
    "vocaloid",

    // Japanese anime terminology
    "アニメ",
    "鬼滅の刃",
    "呪術廻戦",
    "ワンピース",
    "ナルト",
    "ドラゴンボール",
    "チェンソーマン",
    "進撃の巨人",
    "葬送のフリーレン",
    "推しの子"
  ];


  if (
    animeWords.some(
      word =>
        text.includes(word)
    )
  ) {
    return true;
  }


  // ========================================
  // 4. СИЛЬНІ ЯПОНСЬКІ FIGURE-СЕРІЇ
  //
  // Це дозволяє ловити менш відомі аніме,
  // яких немає у списку вище.
  // ========================================

  const animeFigureLines = [

    "nendoroid",
    "ねんどろいど",

    "figma",

    "pop up parade",

    "q posket",
    "qposket",

    "grandista",

    "masterlise",

    "world collectable figure",
    " wcf ",

    "ichiban kuji",

    "一番くじ",

    "banpresto",

    "good smile company",

    "good smile",

    "kotobukiya",

    "alter ",

    "max factory",

    "taito",

    "sega prize",

    "furyu",
    "fuRyu",

    "mometria"
  ];


  return animeFigureLines.some(
    word =>
      text.includes(
        word.toLowerCase()
      )
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


async function sendMandarakeItem(
  env,
  item
) {

  const chatIds =
    String(env.CHAT_IDS || "")
      .split(",")
      .map(
        id => id.trim()
      )
      .filter(Boolean);

  if (!env.BOT_TOKEN) {
    throw new Error(
      "BOT_TOKEN is missing"
    );
  }

  if (!chatIds.length) {
    throw new Error(
      "CHAT_IDS is empty"
    );
  }


  const priceUah =
    await yenToUah(
      item.priceYen
    );


  const priceLine =
    priceUah !== null
      ? `💴 <b>¥${formatNumber(item.priceYen)}</b> | 🇺🇦 ≈ <b>${formatNumber(priceUah)} грн</b>`
      : `💴 <b>¥${formatNumber(item.priceYen)}</b>`;


  const defectLine =
    item.defect
      ? "\n⚠️ <b>МОЖЛИВИЙ ДЕФЕКТ / НЕПОВНА КОМПЛЕКТАЦІЯ</b>\n"
      : "";


  const arrivalLine =
    item.newArrival
      ? "\n🆕 <b>New Arrival</b>"
      : "";


  const text =
    `${item.badge}\n\n` +

    `<b>${escapeHtml(item.title)}</b>\n\n` +

    `${priceLine}\n` +

    `🏪 ${escapeHtml(item.shop || "Mandarake")}` +

    `${arrivalLine}` +

    `${defectLine}\n\n` +

    `<a href="${escapeHtml(item.link)}">🔗 Відкрити на Mandarake</a>`;


  for (const chatId of chatIds) {

    if (
      item.image &&
      /^https?:\/\//i.test(
        item.image
      )
    ) {

      const photoResponse =
        await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/sendPhoto`,
          {
            method: "POST",

            headers: {
              "content-type":
                "application/json"
            },

            body:
              JSON.stringify({
                chat_id:
                  chatId,

                photo:
                  item.image,

                caption:
                  text,

                parse_mode:
                  "HTML"
              })
          }
        );


      if (photoResponse.ok) {
        continue;
      }
    }


    const messageResponse =
      await fetch(
        `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,
        {
          method: "POST",

          headers: {
            "content-type":
              "application/json"
          },

          body:
            JSON.stringify({
              chat_id:
                chatId,

              text,

              parse_mode:
                "HTML",

              disable_web_page_preview:
                false
            })
        }
      );


    if (!messageResponse.ok) {

      const errorText =
        await messageResponse.text();

      throw new Error(
        `Telegram ${messageResponse.status}: ${errorText}`
      );
    }
  }
}


async function yenToUah(yen) {

  try {

    const response =
      await fetch(
        "https://api.frankfurter.dev/v2/rates?base=JPY&quotes=UAH"
      );


    if (!response.ok) {
      return null;
    }


    const data =
      await response.json();


    let rate = null;


    if (Array.isArray(data)) {

      const uah =
        data.find(
          row =>
            row.quote === "UAH"
        );

      rate =
        Number(
          uah?.rate
        );

    } else {

      rate =
        Number(
          data?.rates?.UAH ??
          data?.UAH
        );
    }


    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return null;
    }


    return Math.round(
      yen * rate
    );

  } catch {

    return null;
  }
}


function formatNumber(value) {

  return Math.round(value)
    .toLocaleString(
      "uk-UA"
    )
    .replace(
      /\u00a0/g,
      " "
    );
}


function escapeHtml(value) {

  return String(
    value || ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    );
}
