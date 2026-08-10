import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import handler from "./api/send-push.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/send-push", async (req, res) => {
    try {
      await handler(req as any, res as any);
    } catch (err: any) {
      console.error("Erro no manipulador de push no Express:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err?.message || "Erro interno no servidor." });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
}

startServer();
