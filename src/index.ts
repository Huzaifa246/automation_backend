import express, { Request, Response } from "express";
import { searchBitcoinPrice } from "./searchBitcoinPrice.js";
import cors from "cors";
import bodyParser from "body-parser";
import { admin, db } from "./config/firebase.js";
import { saveArticlesToFirebase } from "./config/saveArticlesToFirebase.js";
import { OpenAI } from "openai";
import dotenv from "dotenv";

const app = express();
const port = 5000;
app.use(express.json());
app.use(bodyParser.json({ limit: "200mb" }));
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000", // Default to localhost
  })
);

app.use((req, res, next) => {
  const payloadSize = JSON.stringify(req.body).length;
  console.log(`Payload size: ${payloadSize} bytes`);

  if (payloadSize > 200000000) {
      return res.status(413).json({ error: "Payload too large. Split data into smaller chunks." });
  }

  next();
});

dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!openai) {
  console.error("OPENAI_API_KEY is missing");
  process.exit(1); // Exit the application if key is not found
}

const MAX_TOKENS = 32000; // Token limit for gpt-4o
const MAX_RESPONSE_TOKENS = 1000; // Max response tokens to leave room for input tokens

// Utility function to count tokens (approximation)
const countTokens = (text: string) => {
  // Approximate token count based on average word length (may need refinement)
  return Math.ceil(text.length / 4);
};

// Utility function to chunk content based on token count (estimate)
const chunkContent = (
  content: string,
  maxTokens: number = MAX_TOKENS - MAX_RESPONSE_TOKENS
) => {
  const chunks: string[] = [];
  let currentChunk = "";
  let currentTokenCount = 0;

  const words = content.split(" ");
  for (const word of words) {
    const tokenCount = countTokens(word); // Approximate token count per word
    if (currentTokenCount + tokenCount <= maxTokens) {
      currentChunk += ` ${word}`;
      currentTokenCount += tokenCount;
    } else {
      chunks.push(currentChunk.trim());
      currentChunk = word;
      currentTokenCount = tokenCount;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

app.post(
  "/api/generate-summary",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { selectedBatch } = req.body;

      if (
        !selectedBatch ||
        !Array.isArray(selectedBatch.articles) ||
        selectedBatch.articles.length === 0
      ) {
        res.status(400).json({ error: "No batch provided or batch is empty" });
        return;
      }

      // Step 1: Collect all articles in the selected batch into one string
      let allContent = "";
      selectedBatch.articles.forEach((article: any) => {
        allContent += `Title: ${article.title}\nContent: ${article.content}\n\n`;
      });

      if (!allContent) {
        res.status(404).json({ error: "No content to summarize." });
        return;
      }

      // Step 2: Chunk the content to fit within the token limit
      const contentChunks = chunkContent(
        allContent,
        MAX_TOKENS - MAX_RESPONSE_TOKENS - 1000 // Adjust to leave room for other parts
      );

      console.log(`Number of chunks created: ${contentChunks.length}`);
      contentChunks.forEach((chunk, index) => {
        const tokenCount = countTokens(chunk);
        console.log(`Chunk ${index + 1} token count: ${tokenCount}`);
      });

      const chunkSummaries: any[] = [];

      // Step 3: Generate a summary for each chunk
      for (let i = 0; i < contentChunks.length; i++) {
        const chunk = contentChunks[i];
        console.log(`Processing chunk ${i + 1}`);
        const tokenCount = countTokens(chunk);
        console.log(
          `Processing chunk ${i + 1} with token count: ${tokenCount}`
        );

        if (tokenCount > MAX_TOKENS) {
          throw new Error(
            `Chunk ${i + 1} exceeds the maximum allowed token count.`
          );
        }

        const summaryResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `
                You are a professional summarizer specializing in Bitcoin. Summarize only Bitcoin's latest price trends, market updates, and key developments.
                Generate a structured summary:
                {
                  "heading1",
                  "para1",
                  "heading2",
                  "para2",
                  "metatitle": "Latest Bitcoin trends & price",
                  "metadescription": "Meta Description summarizing the latest Bitcoin information",
                  "tags": "Comma-separated tags (e.g., Bitcoin)"
                }
                Focus on Bitcoin's latest price trends, market updates, and key developments. Use clear and concise language.
              `,
            },
            {
              role: "user",
              content: `Articles to summarize:\n\n${chunk}`,
            },
          ],
          temperature: 0.7,
          max_tokens: MAX_RESPONSE_TOKENS,
        });

        const rawOutput = summaryResponse.choices[0]?.message?.content?.trim();
        if (!rawOutput) {
          console.error(`Chunk ${i + 1}: Empty output from the model.`);
          continue;
        }

        try {
          // Attempt to parse JSON directly
          const parsedSummary = JSON.parse(rawOutput);
          chunkSummaries.push(parsedSummary);
        } catch (jsonError) {
          console.error(
            `Chunk ${i + 1}: Failed to parse JSON, attempting fallback.`,
            rawOutput
          );

          // Extract JSON-like content using a regex
          const jsonMatch = rawOutput.match(/{[\s\S]*}/);
          if (jsonMatch) {
            try {
              const parsedFallback = JSON.parse(jsonMatch[0]);
              chunkSummaries.push(parsedFallback);
            } catch (fallbackError) {
              console.error(
                `Chunk ${i + 1}: Fallback JSON parse failed.`,
                fallbackError
              );
            }
          } else {
            console.error(`Chunk ${i + 1}: No JSON-like content found.`);
          }
        }
      }

      if (chunkSummaries.length === 0) {
        res.status(500).json({
          error: "No valid summaries were generated.",
        });
        return;
      }

      const unique = (arr) =>
        Array.from(new Set(arr.filter((item) => item.trim() !== "")));

      // Step 4: Combine chunk summaries into a final structured summary
      const finalSummary = {
        heading1: unique(chunkSummaries.map((s) => s.heading1)).join(", "),
        para1: chunkSummaries.map((s) => s.para1 || "").join(",\n"),
        heading2: unique(chunkSummaries.map((s) => s.heading2)).join(", "),
        para2: chunkSummaries.map((s) => s.para2 || "").join(",\n"),
        metatitle: unique(chunkSummaries.map((s) => s.metatitle || "")).join(
          ",\n"
        ),
        metadescription: unique(
          chunkSummaries.map((s) => s.metadescription || "")
        ).join(",\n"),
        tags: "Bitcoin, Cryptocurrency, Price Trends",
      };

      // Send the structured summary as a response
      res.json({
        success: true,
        summary: finalSummary,
      });
    } catch (error: any) {
      console.error(
        "Error in generate-summary:",
        error.message || error.toString()
      );
      res.status(500).json({
        error: "Error generating summary",
        details: error.message || error.toString(),
      });
    }
  }
);

app.get(
  "/search",
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const query = req.query.q as string;
      console.log(query, "query");

      if (!query) {
        res.status(400).json({ error: "Search query is required" });
        return;
      }

      const results = await searchBitcoinPrice(query);
      console.log(results, "results");

      // Assuming `saveArticlesToFirebase` is implemented
      await saveArticlesToFirebase(results);

      res.json({ message: "Articles saved successfully", results });
    } catch (error) {
      console.error("Error saving articles:", error);
      res
        .status(500)
        .json({ error: "An error occurred while saving articles" });
    }
  }
);
// app.get(
//   "/search",
//   async (req: express.Request, res: express.Response): Promise<void> => {
//     try {
//       const query = req.query.q as string;
//       const site = req.query.site as string; // Optional site-specific query
//       console.log(query, "query", site ? `site:${site}` : '');

//       if (!query) {
//         res.status(400).json({ error: "Search query is required" });
//         return;
//       }

//       const fullQuery = site ? `${query} site:${site}` : query;
//       const results = await searchBitcoinPrice(fullQuery);
//       console.log(results, "results");

//       await saveArticlesToFirebase(results);

//       res.json({ message: "Articles saved successfully", results });
//     } catch (error) {
//       console.error("Error saving articles:", error);
//       res.status(500).json({ error: "An error occurred while saving articles" });
//     }
//   }
// );

// Updated articlesRoute
app.get("/api/articles", async (req: Request, res: Response): Promise<void> => {
  try {
    const articlesSnapshot = await db.collection("articleBatches").get();

    const articles: admin.firestore.DocumentData[] = [];

    articlesSnapshot.forEach((doc: { data: () => any }) => {
      articles.push(doc.data()); // Add each article data to the articles array
    });

    if (articles.length === 0) {
      res.status(404).json({ error: "No articles found" });
      return;
    }

    res.json(articles); // Send the articles as a response
  } catch (error) {
    console.error("Error fetching articles from Firestore:", error);
    res.status(500).json({ error: "Error fetching articles from Firestore" });
  }
});

// app.post("/save-article", async (req, res): Promise<void> => {
//   try {
//     const { content } = req.body;

//     if (!content || content.trim() === "") {
//       res.status(400).json({ message: "Content is required." });
//       return;
//     }

//     // Generate a title using OpenAI Chat Completions
//     const response = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a professional summarizer specializing in Bitcoin that generates concise and engaging titles for articles.",
//         },
//         {
//           role: "user",
//           content: `Articles content to summarize:\n\n${content}`,
//         },
//       ],
//       max_tokens: 60,
//       n: 1,
//     });

//     const choice = response.choices?.[0];
//     const message = choice?.message;

//     if (!message || !message.content) {
//       res.status(500).json({ message: "Failed to generate title." });
//       return;
//     }

//     const title = message.content.trim();

//     console.log("title", title);
//     // Save to Firestore
//     const docRef = await db.collection("article_summarize").add({
//       title,
//       content,
//       createdAt: Date.now(), // Use FieldValue correctly
//     });

//     res.status(201).json({
//       message: "Article saved successfully.",
//       id: docRef.id,
//       title,
//     });
//   } catch (error) {
//     console.error("Error saving article:", error);
//     res.status(500).json({ message: "Internal server error." });
//   }
// });

app.post("/save-article", async (req, res): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === "") {
      res.status(400).json({ message: "Content is required." });
      return;
    }

    // Generate a title using OpenAI Chat Completions
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a professional summarizer specializing in Bitcoin that generates concise and engaging titles for articles.",
        },
        {
          role: "user",
          content: `Articles content to summarize:\n\n${content}`,
        },
      ],
      max_tokens: 60,
      n: 1,
    });

    const choice = response.choices?.[0];
    const message = choice?.message;

    if (!message || !message.content) {
      res.status(500).json({ message: "Failed to generate title." });
      return;
    }

    const title = message.content.trim();

    console.log("title", title);

    // Save to Firestore
    const docRef = await db.collection("article_summarize").add({
      title,
      content,
      createdAt: Date.now(), // Use FieldValue correctly
    });

    // Prepare data for external API call
    const para1Start = content.indexOf("Paragraph 1:");
    const heading1Start = content.indexOf("Heading 1:");
    const heading2Start = content.indexOf("Heading 2:");
    const para2Start = content.indexOf("Paragraph 2:");
    const metaTitleStart = content.indexOf("Meta Title:");

    const heading1 = content
      .substring(
        heading1Start + "Heading 1:".length,
        content.indexOf(",", heading1Start)
      )
      .trim();

    // Extract `Heading 2` (ends at the next section start)
    const heading2 = content
      .substring(heading2Start + "Heading 2:".length, para2Start)
      .split("\n")[0]
      .trim();

    if (para1Start === -1 || heading2Start === -1 || metaTitleStart === -1) {
      throw new Error("Content does not match the expected format.");
    }

    // Extract para1
    const para1 = content
      .substring(para1Start + "Paragraph 1:".length, heading2Start)
      .trim();

    // Extract para2
    const para2 = content
      .substring(para2Start + "Paragraph 2:".length, metaTitleStart)
      .trim();

    // Extract Meta Title
    const metaTitle = content
      .substring(metaTitleStart + "Meta Title:".length)
      .split("\n")[0]
      .trim();

    const payload = {
      heading1,
      para1: `Paragraph 1: ${para1}`,
      heading2,
      para2: `Paragraph 2: ${para2}`,
      metatitle: metaTitle,
      metadescription: para1.slice(0, 160), // Use the first 160 characters of para1
      tags: "Bitcoin, Cryptocurrency, Price Trends",
    };

    // Validate the payload conditions
    if (!payload.heading1) {
      throw new Error(
        "heading1 must be provided and should end at the first comma."
      );
    }
    if (!payload.para1.startsWith("Paragraph 1:")) {
      throw new Error("para1 must start with 'Paragraph 1:'");
    }
    if (!payload.heading2) {
      throw new Error("heading2 must be provided.");
    }
    if (!payload.para2.startsWith("Paragraph 2:")) {
      throw new Error("para2 must start with 'Paragraph 2:'");
    }

    // Make API call to external service
    const apiResponse = await fetch(
      "https://edge21-backend.vercel.app/api/data/storeParaDetails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!apiResponse.ok) {
      const apiError = await apiResponse.text();
      console.error("Error from external API:", apiError);
      res.status(500).json({
        message: "Failed to send data to external API.",
        details: apiError,
      });
      return;
    }

    const apiResult = await apiResponse.json();

    res.status(201).json({
      message: "Article saved successfully and data sent to external API.",
      id: docRef.id,
      title,
      apiResponse: apiResult,
    });
  } catch (error) {
    console.error("Error saving article:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
