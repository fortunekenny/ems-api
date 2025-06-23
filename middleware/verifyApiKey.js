// middlewares/verifyApiKey.js
import ApiKey from "./models/ApiKeyModel.js";

export const verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey) return res.status(401).json({ message: "API key is required" });

  try {
    const keyRecord = await ApiKey.findOne({ key: apiKey, active: true });

    if (!keyRecord)
      return res.status(403).json({ message: "Invalid or inactive API key" });

    req.apiKey = keyRecord; // Attach key info to request
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};
