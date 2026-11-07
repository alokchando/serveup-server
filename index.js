import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const token = authHeader.split(" ")[1];

  const { payload } = await jwtVerify(token, JWKS);

  req.user = payload;

  next();
};

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

// Create Event
app.post("/events", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      image,
      location,
      eventDate,
      creatorName,
      creatorEmail,
    } = req.body;

    const startDate = new Date(eventDate);

    if (isNaN(startDate.getTime()) || startDate <= new Date()) {
      return res.status(400).send({
        message: "Please select a valid future date.",
      });
    }

    // Create event object
    const eventData = {
      title: title.trim(),
      description: description.trim(),
      category,
      image,
      location: location.trim(),
      eventDate: startDate,
      endDate: new Date(startDate.getTime() + 2 * 60 * 60 * 1000),
      creatorName,
      creatorEmail,
      status: "active",
      createdAt: new Date(),
    };

    const result = await db.collection("events").insertOne(eventData);

    res.status(201).send({
      success: true,
      message: "Event created successfully!",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).send({
      message: "Failed to create event.",
    });
  }
});

// details
app.get("/events/:id", async (req, res) => {
  const { id } = req.params;

  const event = await db.collection("events").findOne({
    _id: new ObjectId(id),
  });

  const participantCount = await db.collection("participants").countDocuments({
    eventId: id,
  });

  res.send({
    ...event,
    participantCount,
  });
});

// join invents
app.post("/events/:id/join", verifyToken, async (req, res) => {
  const { id } = req.params;

  // Check if event exists
  const event = await db.collection("events").findOne({
    _id: new ObjectId(id),
  });

  // Get user information from JWT
  const participantName = req.user.name;
  const participantEmail = req.user.email;

  // Create participant data
  const participantData = {
    eventId: id,
    participantName,
    participantEmail: participantEmail.toLowerCase(),
    joinedAt: new Date(),
  };

  // Save participant
  await db.collection("participants").insertOne(participantData);

  res.status(201).send({
    message: "Successfully joined the event",
  });
});

// joined events
app.get("/events/joined/:email", verifyToken, async (req, res) => {
  const { email } = req.params;

  const participants = await db
    .collection("participants")
    .find({ participantEmail: email.toLowerCase() })
    .toArray();

  const eventIds = participants.map((p) => new ObjectId(p.eventId));

  const events = await db
    .collection("events")
    .find({ _id: { $in: eventIds } })
    .toArray();

  res.send(events);
});

// Update an event
app.patch("/events/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { creatorEmail, ...updatedData } = req.body;

  const result = await db.collection("events").updateOne(
    {
      _id: new ObjectId(id),
      creatorEmail: creatorEmail.toLowerCase(),
    },
    {
      $set: updatedData,
    },
  );

  res.send({ message: "Event updated successfully" });
});

// Get events created by a user using email
app.get("/events/my-events/:email", verifyToken, async (req, res) => {
  const { email } = req.params;

  const events = await db
    .collection("events")
    .find({
      creatorEmail: email.toLowerCase(),
    })
    .sort({ createdAt: -1 })
    .toArray();

  res.send(events);
});

// Delete event
app.delete("/events/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { creatorEmail } = req.body;

  const result = await db.collection("events").deleteOne({
    _id: new ObjectId(id),
    creatorEmail: creatorEmail.toLowerCase(),
  });

  res.send({ message: "Event deleted successfully" });
});

app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

export default app;
