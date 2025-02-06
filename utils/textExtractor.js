import tesseract from "tesseract.js";
// import pdfParse from "pdf-parse";
import mammoth from "mammoth";
// import fetch from "node-fetch";
import axios from "axios";
// import fs from "fs";
// const pdfParse = require("pdf-parse");
import * as pdfjsLib from "pdfjs-dist";

import * as tf from "@tensorflow/tfjs";
import use from "@tensorflow-models/universal-sentence-encoder";
import { pipeline } from "@huggingface/transformers";
// import { use } from "@tensorflow-models/universal-sentence-encoder"; // For TensorFlow.js
// import tf from "@tensorflow/tfjs-node"; // TensorFlow backend
// import QuestionAnsweringModel from "@huggingface/question-answering"; // Hypothetical model for QA tasks

export const extractTextFromFile = async (file) => {
  const { url, mimetype } = file;

  try {
    if (!url) {
      throw new Error("File URL is missing.");
    }

    // Download the file from the URL
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const fileBuffer = Buffer.from(response.data);

    if (mimetype === "application/pdf") {
      // Process PDF file
      const pdf = await pdfjsLib.getDocument({ data: fileBuffer }).promise;
      let textArray = [];
      for (let num = 1; num <= pdf.numPages; num++) {
        const page = await pdf.getPage(num);
        const content = await page.getTextContent();
        textArray.push(content.items.map((item) => item.str).join(" "));
      }
      return textArray.join(" ");
    } else if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      // Process DOCX file
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } else if (mimetype.startsWith("image/")) {
      // Process Image file with OCR
      const result = await tesseract.recognize(fileBuffer, "eng");
      return result.data.text;
    } else {
      throw new Error(
        "Unsupported file type for evaluation. Supported types: PDF, DOCX, Image.",
      );
    }
  } catch (error) {
    console.error(
      "Error processing file from URL:",
      url,
      "Error:",
      error.message,
    );
    throw new Error("Failed to extract text from the file.");
  }
};

// Load the Universal Sentence Encoder model
const model = await use.load();

/*export const calculateSemanticSimilarity = async (text1, text2) => {
  console.log("Inputs to calculateSemanticSimilarity:", { text1, text2 });

  try {
    if (!text1 || !text2) {
      // console.error("Invalid inputs for similarity calculation:", {
      //   text1,
      //   text2,
      // });
      return 0; // Default to 0 similarity if inputs are invalid
    }

    const embeddings1 = await model.embed([text1]);
    const embeddings2 = await model.embed([text2]);

    const embeddings1Array = embeddings1.arraySync()[0]; // Convert to array
    const embeddings2Array = embeddings2.arraySync()[0];

    // Log the embeddings for debugging
    // console.log("Embeddings arrays:", { embeddings1Array, embeddings2Array });

    const similarity = calculateCosineSimilarity(
      embeddings1Array,
      embeddings2Array,
    );
    // console.log("Calculated similarity:", similarity);

    return similarity;
  } catch (err) {
    console.error("Error in calculateSemanticSimilarity:", err);
    return 0; // Default to 0 in case of errors
  }
};*/

export const calculateSemanticSimilarity = async (text1, text2) => {
  // console.log("Inputs to calculateSemanticSimilarity:", { text1, text2 });

  try {
    if (!text1 || !text2) {
      console.error("Invalid inputs for similarity calculation:", {
        text1,
        text2,
      });
      return 0; // Default to 0 similarity if inputs are invalid
    }

    const embeddings1 = await model.embed([text1]);
    const embeddings2 = await model.embed([text2]);

    const embeddings1Array = embeddings1.arraySync()[0]; // Convert to array
    const embeddings2Array = embeddings2.arraySync()[0];

    // Normalize the embeddings
    const embeddings1Normalized = normalizeVector(embeddings1Array);
    const embeddings2Normalized = normalizeVector(embeddings2Array);

    // Log the embeddings for debugging
    // console.log("Normalized Embeddings arrays:", {
    //   embeddings1Normalized,
    //   embeddings2Normalized,
    // });

    const similarity = calculateCosineSimilarity(
      embeddings1Normalized,
      embeddings2Normalized,
    );
    // console.log("Calculated similarity:", text1, text2, similarity);

    return similarity;
  } catch (err) {
    console.error("Error in calculateSemanticSimilarity:", err);
    return 0; // Default to 0 in case of errors
  }
};

// Helper function for cosine similarity
const calculateCosineSimilarity = (vec1, vec2) => {
  const dotProduct = vec1.reduce((sum, v, i) => sum + v * vec2[i], 0);
  const magnitude1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
  return dotProduct / (magnitude1 * magnitude2);
};

// Helper function to normalize a vector
const normalizeVector = (vec) => {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val ** 2, 0));
  return vec.map((val) => val / magnitude);
};

/*calculateSemanticSimilarity2("sofia", "sofai"); //Calculated similarity: sofia sofai 0.5743433937760358
calculateSemanticSimilarity2("cat", "table"); //Calculated similarity: cat table 0.4252069558047871
calculateSemanticSimilarity2("dog", "puppy"); //Calculated similarity: dog puppy 0.7674349862105809
calculateSemanticSimilarity2("collective noun", "collection noun"); //Calculated similarity: collective noun collection noun 0.7293500188435394
calculateSemanticSimilarity2("sun", "sun"); //Calculated similarity: sun sun 1.0000000000000002
calculateSemanticSimilarity2("sun", "son"); //Calculated similarity: sun son 0.32500026238711566*/

// Completely dissimilar strings: "cat" vs. "table".
// Identical strings: "sofia" vs. "sofia".
// Variations: "collective noun" vs. "collection noun".

/*export const calculateSemanticSimilarity = async (text1, text2) => {
  console.log("Inputs to calculateSemanticSimilarity:", { text1, text2 });
  try {
    if (!text1 || !text2) {
      console.error("Invalid inputs for similarity calculation:", {
        text1,
        text2,
      });
      return 0; // Default to 0 similarity if inputs are invalid
    }

    const embeddings1 = await model.embed([text1]);
    const embeddings2 = await model.embed([text2]);

    console.log("Embeddings:", { embeddings1, embeddings2 });

    const cosineSimilarity = tf.metrics.cosineProximity(
      embeddings1,
      embeddings2,
    );
    const similarity = cosineSimilarity.dataSync()[0];

    if (typeof similarity === "number") {
      return similarity;
    }

    console.error("Failed to calculate similarity, returning 0.");
    return 0; // Default to 0 if similarity isn't a number
  } catch (err) {
    console.error("Error in calculateSemanticSimilarity:", err);
    return 0; // Default to 0 in case of errors
  }
};*/

/*export const calculateSemanticSimilarity = async (text1, text2) => {
  try {
    if (!text1 || !text2) {
      console.error("Invalid inputs for similarity calculation:", {
        text1,
        text2,
      });
      return 0; // Default to 0 similarity if inputs are invalid
    }

    const embeddings1 = await model.embed([text1]);
    const embeddings2 = await model.embed([text2]);

    const cosineSimilarity = tf.metrics.cosineProximity(
      embeddings1,
      embeddings2,
    );
    const similarity = cosineSimilarity.dataSync()[0];

    if (typeof similarity === "number") {
      return similarity;
    }

    console.error("Failed to calculate similarity, returning 0.");
    return 0; // Default to 0 if similarity isn't a number
  } catch (err) {
    console.error("Error in calculateSemanticSimilarity:", err);
    return 0; // Default to 0 in case of errors
  }
};/

/*export const calculateSemanticSimilarity = async (text1, text2) => {
  const embeddings1 = await model.embed([text1]);
  const embeddings2 = await model.embed([text2]);

  const cosineSimilarity = tf.metrics.cosineProximity(embeddings1, embeddings2);
  return cosineSimilarity.dataSync()[0]; // Extract similarity value from TensorFlow tensor
};*/
