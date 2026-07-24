import { h, clearAndAppend } from "../utils.js";

function ruleCard(icon, title, children) {
  return h("div", { class: "card" }, [
    h("p", { style: "margin-top:0" }, [h("i", { class: `fa-solid ${icon}` }), " ", h("strong", {}, title)]),
    ...children,
  ]);
}

export async function renderReglas(container) {
  clearAndAppend(
    container,
    h("div", {}, [
      h("div", { class: "section-title" }, "Reglas"),

      ruleCard("fa-square-poll-vertical", "Cómo se funciona", [
        h("p", { style: "margin-bottom:0" }, [
          "Cada semana eliges, entre los nominados, a quién crees que van a eliminar. ",
          h("strong", {}, "Si le atinas, sumas 1 punto"), ". Puedes cambiar tu pick las veces que quieras mientras la votación siga abierta.",
        ]),
      ]),

      ruleCard("fa-calendar-days", "Calendario de la semana", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, [h("strong", {}, "Lunes:"), " se anuncia el líder de la semana (inmunidad)."]),
          h("li", {}, [h("strong", {}, "Miércoles:"), " se publican los nominados y se abre la votación."]),
          h("li", {}, [h("strong", {}, "Viernes:"), " se confirma quién de los nominados ganó la salvación."]),
          h("li", {}, [h("strong", {}, "Día de eliminación:"), " se cierra la votación y se confirma quién salió."]),
          h("li", { style: "margin-bottom:0" }, [
            h("i", { class: "fa-solid fa-hourglass-half" }),
            " ",
            h("strong", {}, "Cuenta regresiva:"),
            " el día de la eliminación, en Votar aparece un contador en vivo hasta la hora exacta en que se cierra la votación (entre 6 y 8 PM). Al llegar a cero, ya no puedes votar ni cambiar tu pick, aunque el admin todavía no haya confirmado quién salió — así nadie puede copiar el resultado en vivo.",
          ]),
        ]),
      ]),

      ruleCard("fa-shield-halved", "Líder, nominados y salvación", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "El líder de la semana gana inmunidad y no puede ser nominado."),
          h("li", {}, "Los nominados se muestran con los puntos con los que fueron nominados."),
          h("li", {}, [
            "Si un nominado gana la salvación, sigue apareciendo en la lista con la etiqueta ",
            h("span", { class: "badge green" }, "Salvado"),
            ", pero ya nadie puede votar por él.",
          ]),
        ]),
      ]),

      ruleCard("fa-trophy", "Puntaje y Ranking", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "El Ranking muestra el puntaje total de todos los jugadores, de mayor a menor."),
          h("li", {}, "Los picks de los demás jugadores se mantienen ocultos hasta que la semana cierra, para que nadie copie el pick de otro."),
          h("li", {}, "Después de cada semana cerrada, el Ranking muestra un feed de quién acertó y quién falló."),
        ]),
      ]),

      ruleCard("fa-shuffle", "Sorteo Ganador", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "A cada jugador se le asigna un habitante al azar (sin repetir, salvo que haya más jugadores que habitantes). Lo asigna el admin, no se elige."),
          h("li", {}, "Se ve en tu perfil, dentro de la tarjeta de Temporada 4."),
          h("li", { style: "margin-bottom:0" }, [h("strong", {}, "Si ese habitante termina ganando la temporada completa, +3 puntos.")]),
        ]),
      ]),

      ruleCard("fa-list-ol", "Orden de Salida", [
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, "Antes de que se confirme la primera eliminación, arma en la pestaña \"Orden de Salida\" tu predicción del orden completo en el que crees que irán saliendo todos los habitantes."),
          h("li", {}, [h("strong", {}, "Por cada posición que aciertes, +1 punto."), " En cuanto se confirma la primera eliminación, tu orden se bloquea y ya no se puede cambiar."]),
          h("li", { style: "margin-bottom:0" }, "Si algún día salen 2 o más habitantes en la misma semana (doble eliminación), cuentan como bloque: no hace falta acertar el orden exacto entre ellos, basta con haber puesto a cualquiera en alguna de las posiciones de esa semana."),
        ]),
      ]),

      ruleCard("fa-medal", "Insignias", [
        h("p", { class: "muted", style: "margin-bottom:10px" }, "Se calculan solas a partir de tu historial de picks y tus elecciones de perfil."),
        h("ul", { style: "margin:0;padding-left:20px;margin-bottom:0" }, [
          h("li", {}, [h("i", { class: "fa-solid fa-fire" }), " ", h("strong", {}, "Racha de X:"), " llevas 3 o más semanas seguidas acertando."]),
          h("li", {}, [h("i", { class: "fa-solid fa-crow" }), " ", h("strong", {}, "Ojo de águila:"), " en algún momento llegaste a una racha de 5 aciertos seguidos."]),
          h("li", {}, [h("i", { class: "fa-solid fa-bullseye" }), " ", h("strong", {}, "Francotirador:"), " 70% o más de acierto, con al menos 3 semanas votadas."]),
          h("li", {}, [h("i", { class: "fa-solid fa-heart-crack" }), " ", h("strong", {}, "Corazón roto:"), " tu favorito ya fue eliminado de la casa."]),
          h("li", { style: "margin-bottom:0" }, [
            h("i", { class: "fa-solid fa-umbrella-beach" }),
            " ",
            h("strong", {}, "Team {cuarto}:"),
            " aparece por cada cuarto que elijas — el de esta temporada (Ibiza, Tulum, Malibú, Sin Cuarto) y los de temporadas anteriores (Cielo/Infierno, Mar/Tierra, Día/Noche/Eclipse). Cada uno tiene su propio color e ícono.",
          ]),
        ]),
      ]),
    ])
  );
}
