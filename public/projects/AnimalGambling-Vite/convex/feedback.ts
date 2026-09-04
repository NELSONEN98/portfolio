import { mutation } from "./_generated/server";
import { v } from "convex/values";

/* ►► Guardar una opinión. La única escritura de la tabla `feedback`. ◄◄
 *
 * El schema declara la FORMA —que `rating` sea un número, que `bug` sea
 * texto— y nada más: acepta un rating de 47, uno de −3 y un comentario de
 * diez megas sin chistar, porque Convex valida tipos, no contenido. Los
 * topes viven acá, que es el único lugar por donde se puede entrar.
 *
 * Es a propósito que no haya autenticación: esto es un demo público y
 * pedirle una cuenta a alguien para que diga qué le pareció es la forma más
 * segura de no enterarse nunca. Lo que sí hay son límites, porque un
 * formulario abierto sin topes es una tabla que cualquiera puede llenar.
 */

/* Cuánto se guarda de cada campo abierto. No es un número elegido a ojo:
   son unas quince líneas de texto, más de lo que nadie escribe en un
   formulario de salida, y poco para que sirva de depósito. Se RECORTA en
   vez de rechazar: quien escribió de más igual quiso decir algo, y perder
   su opinión entera por pasarse de largo sería el peor canje posible. */
const TOPE_TEXTO = 1200;
const TOPE_NOMBRE = 60;

/* Recorta y limpia. Devuelve null —y no "" — para lo que quedó vacío: el
   schema distingue "no lo mandó" de "lo mandó en blanco", y guardar cadenas
   vacías llenaría la tabla de campos que parecen respuestas y no lo son. */
function texto(valor: string | null | undefined, tope: number): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim().slice(0, tope);
  return limpio.length ? limpio : null;
}

export const enviar = mutation({
  args: {
    rating: v.number(),
    name: v.optional(v.union(v.null(), v.string())),
    gusto: v.optional(v.union(v.null(), v.string())),
    mejoraria: v.optional(v.union(v.null(), v.string())),
    comentario: v.optional(v.union(v.null(), v.string())),
    bug: v.optional(v.union(v.null(), v.string())),
    gano: v.optional(v.union(v.null(), v.boolean())),
    volveria: v.optional(v.union(v.null(), v.boolean())),
    reglasComplicadas: v.optional(v.union(v.null(), v.boolean())),
    duracionSeg: v.optional(v.number()),
    sessionId: v.optional(v.string()),
    mesa: v.optional(v.number()),
    version: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    /* El rating es lo único obligatorio y lo único que se rechaza en vez de
       corregirse: un 47 no es un desliz de tipeo, es alguien llamando a la
       mutación por fuera del formulario, y guardarlo redondeado
       ensuciaría el promedio —que es justamente para lo que existe este
       campo— sin dejar rastro de que pasó. */
    const rating = Math.round(args.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      throw new Error("La calificación tiene que ir de 1 a 5.");
    }

    /* La mesa y la duración sí se acomodan en silencio: son contexto que
       manda el cliente solo, no respuestas de nadie. Si vienen raras, el
       dato que se pierde es de relleno y no vale tirar el formulario
       entero por él. */
    const mesa =
      typeof args.mesa === "number" && args.mesa >= 2 && args.mesa <= 4
        ? Math.round(args.mesa)
        : undefined;
    const duracionSeg =
      typeof args.duracionSeg === "number" && args.duracionSeg >= 0
        ? Math.min(Math.round(args.duracionSeg), 60 * 60 * 6)
        : undefined;

    await ctx.db.insert("feedback", {
      rating,
      name: texto(args.name, TOPE_NOMBRE),
      gusto: texto(args.gusto, TOPE_TEXTO),
      mejoraria: texto(args.mejoraria, TOPE_TEXTO),
      comentario: texto(args.comentario, TOPE_TEXTO),
      bug: texto(args.bug, TOPE_TEXTO),
      gano: typeof args.gano === "boolean" ? args.gano : null,
      volveria: typeof args.volveria === "boolean" ? args.volveria : null,
      reglasComplicadas:
        typeof args.reglasComplicadas === "boolean" ? args.reglasComplicadas : null,
      duracionSeg,
      sessionId: args.sessionId,
      mesa,
      version: texto(args.version, 40) ?? undefined,
      createdAt: Date.now(),
    });

    /* Sin devolver el id: el cliente no tiene nada que hacer con él y
       devolverlo invitaría a que alguien construya algo encima. */
    return { ok: true };
  },
});
