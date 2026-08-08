import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/* Las salas se abandonan sin avisar — se cierra la pestaña y nadie llama a
   leaveRoom. Cada sala nace con expiresAt a 30 minutos; esto es lo que
   finalmente lo hace cumplir. */
crons.interval(
  "limpiar salas vencidas",
  { minutes: 10 },
  internal.rooms.cleanupExpired,
  {}
);

export default crons;
