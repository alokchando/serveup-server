import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3001;

const client = new MongoClient(process.env.MONGO_URI);
let db;

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    db = client.db("serveup");
    return db;
  } catch (err) {
    console.dir(err);
  }
}

await connectToMongoDB();

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/events", async (req, res) => {
  try {
    const users = await db.collection("events").find({}).toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
