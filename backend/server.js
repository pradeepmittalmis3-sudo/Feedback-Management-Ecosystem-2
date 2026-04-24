import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import createUpdateRouter, { startWorkingDataSheetSync } from "./api/update.js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", createUpdateRouter(supabase));

const syncBootState = startWorkingDataSheetSync(supabase);

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
  if (syncBootState.started) {
    console.log(
      `Background sheet sync started (every ${Math.round(
        syncBootState.intervalMs / 1000
      )}s)`
    );
  } else {
    console.log(`Background sheet sync not started: ${syncBootState.reason}`);
  }
});
