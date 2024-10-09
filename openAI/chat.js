const express = require("express");
const { getRandomContents } = require("../utils/randomContents");
const { tokenize } = require("../utils/tokenize");
const delay = require("../utils/delay");

const router = express.Router();

router.post("/openai/deployments/:dummy/chat/completions", async (req, res) => {
  const delayHeader = req.headers["x-set-response-delay-ms"];

  let delayTime = parseInt(delayHeader) || 0;

  await delay(delayTime);
  const defaultMockType = process.env.MOCK_TYPE || "random";
  const {
    messages,
    stream,
    mockType = defaultMockType,
    mockFixedContents,
    model,
  } = req.body;
  const randomResponses = getRandomContents();

  // Check if 'messages' is provided and is an array
  if (!messages || !Array.isArray(messages)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid "messages" in request body' });
  }

  // Check if 'stream' is a boolean
  if (stream !== undefined && typeof stream !== "boolean") {
    return res.status(400).json({ error: 'Invalid "stream" in request body' });
  }

  // Get response content
  let content;
  switch (mockType) {
    case "echo":
      content = messages[messages.length - 1].content;
      break;
    case "random":
      content =
        randomResponses[Math.floor(Math.random() * randomResponses.length)];
      break;
    case "fixed":
      content = mockFixedContents;
      break;
  }

  // Generate a mock response
  // If 'stream' is true, set up a Server-Sent Events stream
  if (stream) {
    // Set the headers for SSE
    res.setHeader("Content-Type", "text/event-stream;charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    const data = {
      id: "chatcmpl-00000000000000000000000000000",
      object: "chat.completion.chunk",
      created: Date.now(),
      model: model,
      system_fingerprint: "fp_000000000a",
      choices: [
        {
          index: 0,
          delta: {
            role: "assistant",
            content: "",
          },
          content_filter_results: {
            hate: { filtered: false, severity: "safe" },
            protected_material_code: { filtered: false, detected: false },
            protected_material_text: { filtered: false, detected: false },
            self_harm: { filtered: false, severity: "safe" },
            sexual: { filtered: false, severity: "safe" },
            violence: { filtered: false, severity: "safe" },
          },
        },
      ],
    };

    const intervalTime = 100;
    let chunkIndex = 0;
    let tokens = tokenize(content); // Tokenize the content
    let intervalId = setInterval(() => {
      if (chunkIndex < tokens.length) {
        data.choices[0].delta.content = tokens[chunkIndex];
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        chunkIndex++;
      } else {
        clearInterval(intervalId);
        data.choices[0] = {
          delta: {},
          index: 0,
          finish_reason: "stop",
          content_filter_results: {},
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    }, intervalTime);
  } else {
    const n = req.body.n || 1; // Get 'n' from request body, default to 1 if not provided
    const choices = [];

    for (let i = 0; i < n; i++) {
      choices.push({
        message: {
          role: "assistant",
          content: content,
        },
        finish_reason: "stop",
        index: i,
      });
    }

    const response = {
      id: "chatcmpl-00000000000000000000000000000",
      object: "chat.completion",
      created: Date.now(),
      model: model,
      system_fingerprint: "fp_000000000a",
      usage: {
        prompt_tokens: 10,
        completion_tokens: 50,
        total_tokens: 60,
      },
      choices: choices,
    };
    // Send the response
    res.json(response);
  }
});

module.exports = router;
