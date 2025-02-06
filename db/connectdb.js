import { set, connect } from "mongoose";
set("strictQuery", false);

const connectDB = (url) => {
  return connect(url);
};

/*const connectDB = async (url, options = {}) => {
  try {
    await mongoose.connect(url, options);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
};*/

export default connectDB;
