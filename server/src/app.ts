import express from "express";
import routes from "./routes";

const app = express();

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", clientOrigin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());
app.use(routes);

export default app;
