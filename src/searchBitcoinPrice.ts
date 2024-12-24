/* eslint-disable @typescript-eslint/no-unused-vars */
import puppeteer from "puppeteer";
import { saveArticlesToFirebase } from "./config/saveArticlesToFirebase.js";

// export async function searchBitcoinPrice(query: string): Promise<{ title: string; link: string; content: string, source: string }[]> {
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
//   });

//   const page = await browser.newPage();

//   const totalPages = 5;
//   const results: { title: string; link: string; content: string, source: string }[] = [];

//   // for (let pageNum = 0; pageNum < totalPages; pageNum++) {
//   //   const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${pageNum * 10}`;

//   //   await page.goto(searchUrl, {
//   //     waitUntil: 'domcontentloaded',
//   //     timeout: 120000,
//   //   });

//   //   const links = await page.evaluate(() => {
//   //     return Array.from(document.querySelectorAll('h3')).map((element) => ({
//   //       title: element.innerText || 'No title',
//   //       link: element.closest('a')?.href || 'No link',
//   //     }));
//   //   });

//   //   for (const link of links) {
//   //     if (link.link && link.link !== 'No link') {
//   //       try {
//   //         const articleContent = await scrapeArticleContent(link.link);

//   //         results.push({
//   //           title: link.title,
//   //           link: link.link,
//   //           content: articleContent || 'Content unavailable',
//   //         });
//   //       } catch (error) {
//   //         console.error(`Error fetching content for link: ${link.link}`, error);
//   //         results.push({
//   //           title: link.title,
//   //           link: link.link,
//   //           content: 'Content unavailable',
//   //         });
//   //       }
//   //     }
//   //   }
//   // }
//   const searchUrls = [
//     { filter: "All", baseUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d&start=` },
//     { filter: "News", baseUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&tbs=qdr:d&start=` },
//   ];

//   for (const search of searchUrls) {
//     console.log(`Fetching results for ${search.filter} filter...`);

//     for (let pageNum = 0; pageNum < totalPages; pageNum++) {
//       const searchUrl = `${search.baseUrl}${pageNum * 10}`;

//       try {
//         await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

//         // Extract search results
//         const links = await page.evaluate(() => {
//           return Array.from(document.querySelectorAll('h3')).map((element) => ({
//             title: element.innerText || 'No title',
//             link: element.closest('a')?.href || 'No link',
//           }));
//         });

//         console.log(`Fetched ${links.length} links from page ${pageNum + 1} (${search.filter}).`);

//         for (const link of links) {
//           if (link.link && link.link !== 'No link') {
//             try {
//               const articleContent = await scrapeArticleContent(link.link);

//               results.push({
//                 title: link.title,
//                 link: link.link,
//                 content: articleContent || 'Content unavailable',
//                 source: search.filter,
//               });
//             } catch (error) {
//               console.error(`Error fetching content for link: ${link.link}`, error);
//               results.push({
//                 title: link.title,
//                 link: link.link,
//                 content: 'Content unavailable',
//                 source: search.filter,
//               });
//             }
//           }
//         }
//       } catch (error) {
//         console.error(`Error fetching page ${pageNum + 1} (${search.filter}):`, error);
//       }
//     }
//   }

//   await browser.close();
//   await saveArticlesToFirebase(results);
//   // await saveScrapedArticlesToFile(results);

//   return results;
// }

// TEST
export async function searchBitcoinPrice(
  query: string
): Promise<{ title: string; link: string; content: string; source: string }[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  const totalPages = 5;
  const results: {
    title: string;
    link: string;
    content: string;
    source: string;
  }[] = [];

  // Google Search URLs for "All" and "News" filters with past 24 hours
  const searchUrls = [
    { filter: "All", baseUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbs=qdr:d&start=` },
    { filter: "News", baseUrl: `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&tbs=qdr:d&start=` },
    // {
    //   filter: "Twitter",
    //   baseUrl: `https://twitter.com/search?q=${encodeURIComponent(
    //     query
    //   )}&f=live`,
    // },
  ];

  for (const search of searchUrls) {
    console.log(`Fetching results for ${search.filter} filter...`);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const searchUrl = `${search.baseUrl}${pageNum * 10}`;

      try {
        await page.goto(searchUrl, {
          waitUntil: "networkidle2",
          timeout: 120000,
        });

        // Extract search results based on the filter
        const links = await page.evaluate((filter) => {
          if (filter === "News") {
            // For Google News results
            // return Array.from(document.querySelectorAll(".SoaBEf")).map(
            //   (element) => ({
            //     title: element.innerText || "No title", // Adjust selector for title
            //     link: element.querySelector(".WlydOe")?.href || "No link", // Adjust selector for link
            //   })
            // );
            return Array.from(document.querySelectorAll(".SoaBEf")).map((element) => {
              const titleElement = element as HTMLElement;
              const linkElement = element.querySelector(".WlydOe") as HTMLAnchorElement;
        
              return {
                title: titleElement?.innerText || "No title", // Adjust selector for title
                link: linkElement?.href || "No link", // Adjust selector for link
              };
            });
          } 
          // else if (filter === "Twitter") {
          //   // For Twitter scraping
          //   return Array.from(document.querySelectorAll("article")).map(
          //     (element) => {
          //       const linkElement = element.querySelector(
          //         'a[href^="/"]:not([role="link"])'
          //       );
          //       const title =
          //         element.querySelector("div[lang]")?.textContent || "No title";
          //       const link = linkElement
          //         ? `https://twitter.com${linkElement.getAttribute("href")}`
          //         : "No link";
          //       return { title, link };
          //     }
          //   );
          // } 
          else {
            // For All results
            // return Array.from(document.querySelectorAll("h3")).map(
            //   (element) => ({
            //     title: element.innerText || "No title",
            //     link: element.closest("a")?.href || "No link",
            //   })
            // );
            return Array.from(document.querySelectorAll("h3")).map((element) => {
              const titleElement = element as HTMLElement;
              const linkElement = element.closest("a") as HTMLAnchorElement;
        
              return {
                title: titleElement?.innerText || "No title",
                link: linkElement?.href || "No link",
              };
            });
          }
        }, search.filter);

        console.log(
          `Fetched ${links.length} links from page ${pageNum + 1} (${
            search.filter
          }).`
        );

        for (const link of links) {
          if (link.link && link.link !== "No link") {
            try {
              const articleContent = await scrapeArticleContent(link.link);

              results.push({
                title: link.title,
                link: link.link,
                content: articleContent || "Content unavailable",
                source: search.filter, // Indicate the source ("All" or "News")
              });
            } catch (error) {
              console.error(
                `Error fetching content for link: ${link.link}`,
                error
              );
              results.push({
                title: link.title,
                link: link.link,
                content: "Content unavailable",
                source: search.filter,
              });
            }
          }
        }
      } catch (error) {
        console.error(
          `Error fetching page ${pageNum + 1} (${search.filter}):`,
          error
        );
      }
    }
  }

  await browser.close();
  await saveArticlesToFirebase(results);
  return results;
}

async function scrapeArticleContent(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const page = await browser.newPage();

  try {
    await page.setRequestInterception(true);
    page.on(
      "request",
      (request: {
        resourceType: () => string;
        abort: () => void;
        continue: () => void;
      }) => {
        // if (request.resourceType() === 'image' || request.resourceType() === 'media') {
        //   request.abort();
        // }
        if (
          ["image", "media", "font", "stylesheet"].includes(
            request.resourceType()
          )
        ) {
          request.abort();
        } else {
          request.continue();
        }
      }
    );

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });

    const content = await page.evaluate(() => {
      const article = document.querySelector("article") || document.body;
      return article ? article.innerText.trim() : "No content available";
    });

    return content;
  } catch (error) {
    console.error(`Error scraping content from ${url}:`, error);
    return "Error fetching article content";
  } finally {
    await browser.close();
  }
}
