import { set, connect } from "mongoose";
set("strictQuery", false);

const connectDB = (url) => {
  return connect(url);
};

export default connectDB;
