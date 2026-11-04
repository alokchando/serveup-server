import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);
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

app.get("/events", async (req, res) => {
  const users = await db.collection("events").find({}).toArray();
  res.json(users);
});

app.get("/events/upcoming", async (req, res) => {
  try {
    const users = await db
      .collection("events")
      .find({
        eventDate: { $gt: new Date() },
        status: "active",
      })
      .sort({ eventDate: 1 })
      .toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/events/recent", async (req, res) => {
  try {
    const users = await db
      .collection("events")
      .find({
        eventDate: { $gt: new Date() },
        status: "active",
      })
      .sort({ eventDate: 1 })
      .limit(6)
      .toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get("/events/pastevents", async (req, res) => {
  try {
    const users = await db
      .collection("events")
      .find({
        eventDate: { $lt: new Date() },
      })
      .sort({ eventDate: -1 })

      .toArray();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// create events
app.post("/events", async (req, res) => {
  const { title, description, category, image, location, eventDate } = req.body;

  // Create event object
  const eventData = {
    ...req.body,
    status: "active",
    eventDate: new Date(req.body.eventDate),
    createdAt: new Date()

  };

  // Insert into MongoDB
  await db.collection("events").insertOne(eventData);
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});
