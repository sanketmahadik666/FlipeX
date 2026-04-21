import express from "express";
import cors from "cors";
import { buildRouter } from "./routes";

const app = express();
const PORT = Number(process.env.BACKEND_PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", buildRouter());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[backend] listening on :${PORT}`);
});
