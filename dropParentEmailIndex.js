import { MongoClient } from "mongodb";

(async () => {
  const uri = "mongodb://localhost:5100/ems-api"; // Changed to port 5100
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log("Indexes before:", await db.collection("parents").indexes());
    const indexes = await db.collection("parents").indexes();
    const emailIndex = indexes.find((idx) => idx.name === "email_1");
    if (emailIndex) {
      await db.collection("parents").dropIndex("email_1");
      console.log("Dropped root-level email_1 index from parents collection.");
    } else {
      console.log("No root-level email_1 index found.");
    }
    console.log("Indexes after:", await db.collection("parents").indexes());
  } catch (err) {
    console.error("Error while dropping index:", err);
  } finally {
    await client.close();
  }
})();
